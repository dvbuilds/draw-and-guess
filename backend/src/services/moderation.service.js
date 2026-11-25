import mongoose from 'mongoose';
import { Room } from '../models/Room.js';
import { handleUnavailablePlayer } from './gameInitialization.service.js';
import { ApiError } from '../utils/ApiError.js';

const idOf = (value) => String(value);

async function requireActiveRoomMember(socket) {
  const session = socket.data.lobby;
  if (!session) throw new ApiError(403, 'Join a room before using moderation', 'NOT_IN_ROOM');
  const room = await Room.findById(session.roomId);
  if (!room) throw new ApiError(404, 'Room was not found', 'ROOM_NOT_FOUND');
  if (!socket.rooms.has(room.code)) throw new ApiError(403, 'Socket is not in this room', 'NOT_IN_ROOM');
  const member = room.members.find((item) => idOf(item.playerId) === session.playerId);
  if (!member?.isConnected || member.socketId !== socket.id) {
    throw new ApiError(403, 'This is not the active room member connection', 'INVALID_ROOM_MEMBER');
  }
  return { room, member, session };
}

export async function requireRoomHost(socket) {
  const result = await requireActiveRoomMember(socket);
  if (idOf(result.room.hostPlayerId) !== result.session.playerId) {
    throw new ApiError(403, 'Only the current host can moderate room members', 'HOST_ONLY');
  }
  return result;
}

export async function removeRoomPlayer({ io, room, targetPlayerId, actorPlayerId, ban = false, source = 'host' }) {
  const member = room.members.find((item) => idOf(item.playerId) === targetPlayerId);
  if (!member) throw new ApiError(404, 'Target player is not a room member', 'PLAYER_NOT_IN_ROOM');
  const removesHostByVote = source === 'vote_kick' && targetPlayerId === idOf(room.hostPlayerId);
  if (targetPlayerId === idOf(room.hostPlayerId) && !removesHostByVote) {
    throw new ApiError(400, 'The current host cannot be removed', 'CANNOT_REMOVE_HOST');
  }

  const targetSocketId = member.socketId;
  if (ban) {
    room.bannedPlayerIds ??= [];
    if (!room.bannedPlayerIds.some((id) => idOf(id) === targetPlayerId)) {
      room.bannedPlayerIds.push(member.playerId);
    }
  }
  if (room.activeVoteKick && idOf(room.activeVoteKick.targetPlayerId) === targetPlayerId) {
    room.activeVoteKick = null;
  }

  const wasInGame = room.gameStatus === 'started';
  let hostTransferredTo = null;
  if (removesHostByVote) {
    const nextHost = room.members.find((item) => idOf(item.playerId) !== targetPlayerId && item.isConnected)
      ?? room.members.find((item) => idOf(item.playerId) !== targetPlayerId)
      ?? null;
    room.hostPlayerId = nextHost?.playerId ?? null;
    for (const item of room.members) {
      item.role = nextHost && idOf(item.playerId) === idOf(nextHost.playerId) ? 'host' : 'player';
    }
    hostTransferredTo = nextHost
      ? { playerId: idOf(nextHost.playerId), displayName: nextHost.displayName }
      : null;
  }
  if (wasInGame) {
    room.kickedPlayerIds ??= [];
    if (!room.kickedPlayerIds.some((id) => idOf(id) === targetPlayerId)) {
      room.kickedPlayerIds.push(member.playerId);
    }
    member.isConnected = false;
    member.socketId = null;
    member.lastDisconnectedAt = new Date();
  } else {
    room.members = room.members.filter((item) => idOf(item.playerId) !== targetPlayerId);
  }
  await room.save();

  const eventName = ban ? 'player_banned' : 'player_kicked';
  const event = {
    roomCode: room.code,
    actorPlayerId,
    source,
    player: { playerId: targetPlayerId, displayName: member.displayName },
    banned: ban,
    hostTransferredTo,
  };
  io.to(room.code).emit(eventName, event);
  const targetSocket = targetSocketId ? io.sockets.sockets.get(targetSocketId) : null;
  if (targetSocket) {
    targetSocket.emit('moderation:removed', { roomCode: room.code, banned: ban, reason: eventName });
    targetSocket.disconnect(true);
  }
  if (wasInGame) {
    await handleUnavailablePlayer({ io, roomId: room._id, playerId: targetPlayerId, reason: 'player_kicked' });
  }
  return event;
}

export async function kickPlayer({ socket, io, payload }) {
  const { room, session } = await requireRoomHost(socket);
  const targetPlayerId = typeof payload?.playerId === 'string' ? payload.playerId.toLowerCase() : '';
  if (typeof targetPlayerId !== 'string' || !mongoose.isValidObjectId(targetPlayerId)) {
    throw new ApiError(400, 'A valid playerId is required', 'INVALID_PLAYER_ID');
  }
  if (targetPlayerId === session.playerId) throw new ApiError(400, 'The host cannot kick themselves', 'CANNOT_KICK_SELF');
  return removeRoomPlayer({ io, room, targetPlayerId, actorPlayerId: session.playerId });
}

export async function banPlayer({ socket, io, payload }) {
  const { room, session } = await requireRoomHost(socket);
  const targetPlayerId = typeof payload?.playerId === 'string' ? payload.playerId.toLowerCase() : '';
  if (typeof targetPlayerId !== 'string' || !mongoose.isValidObjectId(targetPlayerId)) {
    throw new ApiError(400, 'A valid playerId is required', 'INVALID_PLAYER_ID');
  }
  if (targetPlayerId === session.playerId) throw new ApiError(400, 'The host cannot ban themselves', 'CANNOT_BAN_SELF');
  return removeRoomPlayer({ io, room, targetPlayerId, actorPlayerId: session.playerId, ban: true });
}

export async function requireRoomMemberForVote(socket) {
  return requireActiveRoomMember(socket);
}
