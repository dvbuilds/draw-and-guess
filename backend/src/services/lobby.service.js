import { Player } from '../models/Player.js';
import { Room } from '../models/Room.js';
import { validateRoomInvitation } from './room.service.js';
import { validateGuestIdentity } from './playerIdentity.service.js';
import { handleUnavailablePlayer } from './gameInitialization.service.js';
import { deliverWordStateToDrawer } from './wordSelection.service.js';
import { ApiError } from '../utils/ApiError.js';

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

  const room = await Room.findOne({ code: roomCode }).select(
    '+privateInviteTokenHash +wordOptionIds +currentWordId +currentWordText +currentWordCategory'
  );
  if (!room) throw new ApiError(404, 'Room code was not found', 'ROOM_NOT_FOUND');
  if (!validateRoomInvitation(room, payload.inviteToken)) {
    throw new ApiError(403, 'A valid invite token is required for this private room', 'PRIVATE_ROOM');
  }

  const player = await Player.findById(playerId);
  const member = findMember(room, playerId);
  if (!player || !member) {
    throw new ApiError(403, 'Player must join this room before connecting to its lobby', 'ROOM_MEMBERSHIP_REQUIRED');
  }
  if (room.gameStatus === 'started'
      && !(room.turnOrder ?? []).some((id) => playerIdOf(id) === playerId)) {
    throw new ApiError(409, 'This player was not active when the game started', 'PLAYER_NOT_IN_GAME');
  }
  if (socket.data.lobby && socket.data.lobby.roomId !== String(room._id)) {
    throw new ApiError(409, 'This socket is already connected to another room', 'ALREADY_IN_LOBBY');
  }
  if (socket.data.lobby?.roomId === String(room._id)
      && socket.data.lobby.playerId === playerId) {
    if (room.gameStatus === 'started' && playerId === playerIdOf(room.currentDrawerPlayerId)) {
      await deliverWordStateToDrawer({ io, room, socket });
    }
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

  if (room.gameStatus === 'started' && playerId === playerIdOf(room.currentDrawerPlayerId)) {
    await deliverWordStateToDrawer({ io, room, socket });
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
  return {
    roomCode,
    players: event.players,
    reconnected,
    alreadyConnected: false,
    gameState: room.gameStatus === 'started' || room.gameStatus === 'completed'
      ? {
        status: room.gameStatus,
        currentRound: room.currentRound,
        currentTurn: room.currentTurn,
        totalRounds: room.totalRounds,
        currentDrawerPlayerId: room.currentDrawerPlayerId ? playerIdOf(room.currentDrawerPlayerId) : null,
      }
      : null,
  };
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
  const retainGameMember = room.gameStatus === 'started';
  if (unexpected || retainGameMember) {
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
  if (room.gameStatus === 'started') {
    await handleUnavailablePlayer({
      io,
      roomId: room._id,
      playerId: session.playerId,
      reason: unexpected ? 'drawer_disconnected' : 'drawer_left',
    });
  }
  return { left: true, hostTransferredTo, players: event.players };
}
