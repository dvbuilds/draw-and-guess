import { Room } from '../models/Room.js';
import { emitWordOptions, prepareWordOptions } from './wordSelection.service.js';
import { resetRoomDrawing } from './drawing.service.js';
import { ApiError } from '../utils/ApiError.js';

const MIN_PLAYERS_TO_START = 2;
const idOf = (value) => String(value);

function players(room) {
  return room.members.map((member) => ({
    playerId: idOf(member.playerId),
    displayName: member.displayName,
    role: member.role,
    isConnected: Boolean(member.isConnected),
  }));
}

function gameState(room) {
  return {
    status: room.gameStatus,
    currentRound: room.currentRound,
    currentTurn: room.currentTurn,
    totalRounds: room.totalRounds,
    currentDrawerPlayerId: room.currentDrawerPlayerId ? idOf(room.currentDrawerPlayerId) : null,
    players: players(room),
  };
}

function requireHostSocket(room, socket) {
  const session = socket.data.lobby;
  if (!session || session.roomId !== idOf(room._id)) {
    throw new ApiError(403, 'Join a room before using game controls', 'NOT_IN_ROOM');
  }
  if (idOf(room.hostPlayerId) !== session.playerId) {
    throw new ApiError(403, 'Only the current host can use this game control', 'HOST_ONLY');
  }
  const hostMember = room.members.find((member) => idOf(member.playerId) === session.playerId);
  if (!hostMember || hostMember.socketId !== socket.id || !hostMember.isConnected) {
    throw new ApiError(403, 'The current socket is not the active host connection', 'HOST_ONLY');
  }
  return session;
}

function countConnected(room) {
  return room.members.filter((member) => member.isConnected).length;
}

function stateFilter(room) {
  return {
    _id: room._id,
    gameStatus: 'started',
    currentRound: room.currentRound,
    currentTurn: room.currentTurn,
    currentDrawerPlayerId: room.currentDrawerPlayerId,
  };
}

function nextConnectedTurn(room) {
  const order = room.turnOrder.map(idOf);
  if (!order.length) return null;
  const currentIndex = Math.max(0, order.indexOf(idOf(room.currentDrawerPlayerId)));
  let round = room.currentRound;

  for (let step = 1; step <= order.length; step += 1) {
    const index = (currentIndex + step) % order.length;
    if (index <= currentIndex) round += 1;
    if (round > room.totalRounds) return { complete: true };

    const playerId = order[index];
    const member = room.members.find((item) => idOf(item.playerId) === playerId);
    if (member?.isConnected) {
      return {
        complete: false,
        round,
        turn: index + 1,
        playerId: member.playerId,
        roundChanged: round !== room.currentRound,
      };
    }
  }
  return { complete: true, noConnectedPlayers: true };
}

async function completeGame({ io, room, reason }) {
  const completedAt = new Date();
  const completed = await Room.findOneAndUpdate(
    stateFilter(room),
    { $set: { gameStatus: 'completed', gameCompletedAt: completedAt } },
    { new: true }
  );
  if (!completed) return null;
  const event = {
    roomCode: completed.code,
    reason,
    completedAt: completed.gameCompletedAt.toISOString(),
    gameState: gameState(completed),
  };
  resetRoomDrawing(completed.code);
  io.to(completed.code).emit('game_complete', event);
  return event;
}

async function advanceTurn({ io, room, reason }) {
  if (countConnected(room) === 0) {
    return completeGame({ io, room, reason: 'no_connected_players' });
  }

  const next = nextConnectedTurn(room);
  if (!next || next.complete) {
    return completeGame({ io, room, reason: next?.noConnectedPlayers ? 'no_connected_players' : 'rounds_complete' });
  }
  const preparedWords = await prepareWordOptions(room.settings);

  const updated = await Room.findOneAndUpdate(
    stateFilter(room),
    {
      $set: {
        currentRound: next.round,
        currentTurn: next.turn,
        currentDrawerPlayerId: next.playerId,
        wordOptionIds: preparedWords.wordIds,
        currentWordId: null,
        currentWordText: null,
        currentWordCategory: null,
      },
    },
    { new: true }
  );
  if (!updated) throw new ApiError(409, 'Game state changed; request the current game state and retry', 'GAME_STATE_CHANGED');

  const event = {
    roomCode: updated.code,
    reason,
    currentRound: updated.currentRound,
    currentTurn: updated.currentTurn,
    totalRounds: updated.totalRounds,
    currentDrawerPlayerId: idOf(updated.currentDrawerPlayerId),
    players: players(updated),
  };
  resetRoomDrawing(updated.code);
  if (next.roundChanged) {
    io.to(updated.code).emit('round_started', {
      roomCode: updated.code,
      currentRound: updated.currentRound,
      totalRounds: updated.totalRounds,
      currentDrawerPlayerId: event.currentDrawerPlayerId,
    });
  }
  io.to(updated.code).emit('game_turn', event);
  emitWordOptions(io, updated, preparedWords.options);
  return event;
}

export async function initializeGame({ socket, io }) {
  const session = socket.data.lobby;
  if (!session) throw new ApiError(403, 'Join a room before starting the game', 'NOT_IN_ROOM');
  const room = await Room.findById(session.roomId);
  if (!room) throw new ApiError(404, 'Room was not found', 'ROOM_NOT_FOUND');
  requireHostSocket(room, socket);
  if (room.gameStatus && room.gameStatus !== 'lobby') {
    throw new ApiError(409, 'The game has already started', 'GAME_ALREADY_STARTED');
  }
  const connectedMembers = room.members.filter((member) => member.isConnected);
  if (connectedMembers.length < MIN_PLAYERS_TO_START) {
    throw new ApiError(409, `At least ${MIN_PLAYERS_TO_START} connected players are required to start`, 'NOT_ENOUGH_PLAYERS');
  }

  const preparedWords = await prepareWordOptions(room.settings);
  const turnOrder = connectedMembers.map((member) => member.playerId);
  const startedAt = new Date();
  const started = await Room.findOneAndUpdate(
    {
      _id: room._id,
      hostPlayerId: room.hostPlayerId,
      gameStatus: { $in: ['lobby', null] },
      'members': {
        $elemMatch: {
          playerId: room.hostPlayerId,
          socketId: socket.id,
          isConnected: true,
        },
      },
      $expr: {
        $gte: [
          {
            $size: {
              $filter: {
                input: '$members',
                as: 'member',
                cond: { $eq: ['$$member.isConnected', true] },
              },
            },
          },
          MIN_PLAYERS_TO_START,
        ],
      },
    },
    {
      $set: {
        gameStatus: 'started',
        gameStartedAt: startedAt,
        gameCompletedAt: null,
        totalRounds: room.settings.rounds,
        currentRound: 1,
        currentTurn: 1,
        turnOrder,
        currentDrawerPlayerId: turnOrder[0],
        wordOptionIds: preparedWords.wordIds,
        currentWordId: null,
        currentWordText: null,
        currentWordCategory: null,
      },
    },
    { new: true }
  );
  if (!started) {
    const current = await Room.findById(session.roomId);
    if (current?.gameStatus && current.gameStatus !== 'lobby') {
      throw new ApiError(409, 'The game has already started', 'GAME_ALREADY_STARTED');
    }
    if (idOf(current?.hostPlayerId) !== session.playerId) {
      throw new ApiError(403, 'Only the current host can start the game', 'HOST_ONLY');
    }
    throw new ApiError(409, `At least ${MIN_PLAYERS_TO_START} connected players are required to start`, 'NOT_ENOUGH_PLAYERS');
  }

  const event = {
    roomCode: started.code,
    hostPlayerId: session.playerId,
    startedAt: started.gameStartedAt.toISOString(),
    ...gameState(started),
  };
  resetRoomDrawing(started.code);
  io.to(started.code).emit('game_start', event);
  emitWordOptions(io, started, preparedWords.options);
  return event;
}

export async function advanceGameTurn({ socket, io }) {
  const session = socket.data.lobby;
  if (!session) throw new ApiError(403, 'Join a room before advancing the game', 'NOT_IN_ROOM');
  const room = await Room.findById(session.roomId);
  if (!room) throw new ApiError(404, 'Room was not found', 'ROOM_NOT_FOUND');
  requireHostSocket(room, socket);
  if (room.gameStatus !== 'started') {
    throw new ApiError(409, 'The game is not in progress', 'GAME_NOT_STARTED');
  }
  const result = await advanceTurn({ io, room, reason: 'host_advanced' });
  if (!result) throw new ApiError(409, 'Game state changed; retry the request', 'GAME_STATE_CHANGED');
  return result;
}

export async function handleUnavailablePlayer({ io, roomId, playerId, reason }) {
  const room = await Room.findById(roomId);
  if (!room || room.gameStatus !== 'started') return null;
  if (countConnected(room) === 0) {
    return completeGame({ io, room, reason: 'no_connected_players' });
  }
  if (idOf(room.currentDrawerPlayerId) === playerId) {
    return advanceTurn({ io, room, reason: reason || 'drawer_disconnected' });
  }
  return null;
}
