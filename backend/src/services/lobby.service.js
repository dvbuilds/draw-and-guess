import { createHash, timingSafeEqual } from 'node:crypto';
import { Player } from '../models/Player.js';
import { Room } from '../models/Room.js';
import { validateGuestIdentity } from './playerIdentity.service.js';
import { ApiError } from '../utils/ApiError.js';

const MIN_PLAYERS_TO_START = 2;
const hash = (value) => createHash('sha256').update(value).digest('hex');
const membershipLocks = new Map();

async function withMembershipLock(key, action) {
  const previous = membershipLocks.get(key) ?? Promise.resolve();
  let release;
  const current = new Promise((resolve) => { release = resolve; });
  membershipLocks.set(key, current);
  await previous;
  try {
    return await action();
  } finally {
    release();
    if (membershipLocks.get(key) === current) membershipLocks.delete(key);
  }
}

function tokenMatches(expectedHash, suppliedToken) {
  if (!expectedHash || typeof suppliedToken !== 'string' || !suppliedToken) return false;
  const expected = Buffer.from(expectedHash, 'hex');
  const actual = Buffer.from(hash(suppliedToken), 'hex');
  return expected.length === actual.length && timingSafeEqual(expected, actual);
}

function playerIdOf(value) {
  return String(value);
}

function roster(room) {
  return room.members.map((member) => ({
    playerId: playerIdOf(member.playerId),
    displayName: member.displayName,
    role: member.role,
    isConnected: Boolean(member.isConnected),
  }));
}

function findMember(room, playerId) {
  return room.members.find((member) => playerIdOf(member.playerId) === playerId);
}

function assignNextHost(room, leavingPlayerId) {
  const currentHostId = playerIdOf(room.hostPlayerId);
  if (currentHostId !== leavingPlayerId) return null;
  const eligible = room.members.filter((member) => playerIdOf(member.playerId) !== leavingPlayerId);
  const nextHost = eligible.find((member) => member.isConnected)
    ?? eligible[0]
    ?? null;
  room.hostPlayerId = nextHost?.playerId ?? null;
  for (const member of room.members) {
    member.role = nextHost && playerIdOf(member.playerId) === playerIdOf(nextHost.playerId)
      ? 'host'
      : 'player';
  }
  return nextHost ? { playerId: playerIdOf(nextHost.playerId), displayName: nextHost.displayName } : null;
}

function roomLookup(roomCode) {
  if (typeof roomCode !== 'string' || !/^[A-Za-z0-9]{8}$/.test(roomCode.trim())) {
    throw new ApiError(400, 'A valid 8-character roomCode is required', 'INVALID_ROOM_CODE');
  }
  return roomCode.trim().toUpperCase();
}

export async function joinLobby({ socket, io, payload }) {
  const roomCode = roomLookup(payload?.roomCode);
  if (typeof payload?.playerId !== 'string' || typeof payload?.identityToken !== 'string') {
    throw new ApiError(400, 'Player ID and identity token are required', 'VALIDATION_ERROR');
  }
  return withMembershipLock(`${roomCode}:${payload.playerId.toLowerCase()}`, () => joinLobbyLocked({ socket, io, payload, roomCode }));
}

async function joinLobbyLocked({ socket, io, payload, roomCode }) {
  const identity = await validateGuestIdentity({
    playerId: payload.playerId,
    identityToken: payload.identityToken,
  });
  if (!identity.valid) throw new ApiError(400, 'Player identity is invalid', 'INVALID_PLAYER_IDENTITY');
  const playerId = identity.player.playerId;

  const room = await Room.findOne({ code: roomCode }).select('+privateInviteTokenHash');
  if (!room) throw new ApiError(404, 'Room code was not found', 'ROOM_NOT_FOUND');
  if (!room.isPublic && !tokenMatches(room.privateInviteTokenHash, payload.inviteToken)) {
    throw new ApiError(403, 'A valid invite token is required for this private room', 'PRIVATE_ROOM');
  }

  const player = await Player.findById(playerId);
  const member = findMember(room, playerId);
  if (!player || !member) {
    throw new ApiError(403, 'Player must join this room before connecting to its lobby', 'ROOM_MEMBERSHIP_REQUIRED');
  }
  if (socket.data.lobby && socket.data.lobby.roomId !== String(room._id)) {
    throw new ApiError(409, 'This socket is already connected to another room', 'ALREADY_IN_LOBBY');
  }
  if (socket.data.lobby?.roomId === String(room._id)
      && socket.data.lobby.playerId === playerId) {
    return { roomCode, players: roster(room), reconnected: false, alreadyConnected: true };
  }

  const reconnected = Boolean(member.lastDisconnectedAt || member.isConnected);
  const previousSocketId = member.socketId;
  member.isConnected = true;
  member.socketId = socket.id;
  if (!room.hostPlayerId) {
    room.hostPlayerId = member.playerId;
    member.role = 'host';
  }
  await room.save();
  await socket.join(roomCode);
  socket.data.lobby = {
    roomId: String(room._id),
    roomCode,
    playerId,
  };

  if (previousSocketId && previousSocketId !== socket.id) {
    const previousSocket = io.sockets.sockets.get(previousSocketId);
    if (previousSocket) previousSocket.disconnect(true);
  }

  const event = {
    player: {
      playerId,
      displayName: member.displayName,
      role: member.role,
      isConnected: true,
    },
    reconnected,
    players: roster(room),
  };
  io.to(roomCode).emit('player_joined', event);
  return { roomCode, players: event.players, reconnected, alreadyConnected: false };
}

export async function leaveLobby({ io, socket, reason = 'left', unexpected = false }) {
  const session = socket.data.lobby;
  if (!session) return { left: false };

  const room = await Room.findById(session.roomId);
  if (!room) {
    delete socket.data.lobby;
    return { left: false };
  }
  const member = findMember(room, session.playerId);
  // A newer connection may already have replaced this socket. Its disconnect must
  // not mark that active connection as offline or remove its room membership.
  if (!member || member.socketId !== socket.id) {
    delete socket.data.lobby;
    return { left: false };
  }

  const player = { playerId: session.playerId, displayName: member.displayName };
  let hostTransferredTo = null;
  if (unexpected) {
    member.isConnected = false;
    member.socketId = null;
    member.lastDisconnectedAt = new Date();
    hostTransferredTo = assignNextHost(room, session.playerId);
  } else {
    room.members = room.members.filter((item) => playerIdOf(item.playerId) !== session.playerId);
    hostTransferredTo = assignNextHost(room, session.playerId);
  }
  await room.save();
  delete socket.data.lobby;

  const event = {
    player,
    reason,
    unexpected,
    hostTransferredTo,
    players: roster(room),
  };
  io.to(session.roomCode).emit('player_left', event);
  if (!unexpected) await socket.leave(session.roomCode);
  return { left: true, hostTransferredTo, players: event.players };
}

export async function startLobbyGame({ socket, io }) {
  const session = socket.data.lobby;
  if (!session) throw new ApiError(403, 'Join a room before starting the game', 'NOT_IN_ROOM');
  const room = await Room.findById(session.roomId);
  if (!room) throw new ApiError(404, 'Room was not found', 'ROOM_NOT_FOUND');
  if (playerIdOf(room.hostPlayerId) !== session.playerId) {
    throw new ApiError(403, 'Only the current host can start the game', 'HOST_ONLY');
  }
  const member = findMember(room, session.playerId);
  if (!member || member.socketId !== socket.id || !member.isConnected) {
    throw new ApiError(403, 'The current socket is not the active host connection', 'HOST_ONLY');
  }
  if (room.gameStatus && room.gameStatus !== 'lobby') {
    throw new ApiError(409, 'The game has already started', 'GAME_ALREADY_STARTED');
  }
  const activePlayers = room.members.filter((item) => item.isConnected).length;
  if (activePlayers < MIN_PLAYERS_TO_START) {
    throw new ApiError(409, `At least ${MIN_PLAYERS_TO_START} connected players are required to start`, 'NOT_ENOUGH_PLAYERS');
  }

  const startedAt = new Date();
  const startedRoom = await Room.findOneAndUpdate(
    {
      _id: room._id,
      hostPlayerId: room.hostPlayerId,
      gameStatus: { $in: ['lobby', null] },
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
    { $set: { gameStatus: 'started', gameStartedAt: startedAt } },
    { new: true }
  );
  if (!startedRoom) {
    const current = await Room.findById(session.roomId);
    if (current?.gameStatus && current.gameStatus !== 'lobby') {
      throw new ApiError(409, 'The game has already started', 'GAME_ALREADY_STARTED');
    }
    if (playerIdOf(current?.hostPlayerId) !== session.playerId) {
      throw new ApiError(403, 'Only the current host can start the game', 'HOST_ONLY');
    }
    throw new ApiError(409, `At least ${MIN_PLAYERS_TO_START} connected players are required to start`, 'NOT_ENOUGH_PLAYERS');
  }
  const event = {
    roomCode: session.roomCode,
    hostPlayerId: session.playerId,
    startedAt: startedRoom.gameStartedAt.toISOString(),
    players: roster(startedRoom),
  };
  io.to(session.roomCode).emit('game_start', event);
  return event;
}
