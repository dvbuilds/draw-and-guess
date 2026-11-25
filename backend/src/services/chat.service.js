import { Room } from '../models/Room.js';
import { ApiError } from '../utils/ApiError.js';

const MAX_MESSAGE_LENGTH = 500;
const idOf = (value) => String(value);

export function validateChatMessage(value) {
  if (typeof value !== 'string') {
    throw new ApiError(400, 'Chat message must be text', 'INVALID_CHAT_MESSAGE');
  }
  const message = value.trim();
  if (!message || message.length > MAX_MESSAGE_LENGTH || /[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/u.test(message)) {
    throw new ApiError(400, `Chat message must contain 1 to ${MAX_MESSAGE_LENGTH} valid characters`, 'INVALID_CHAT_MESSAGE');
  }
  return message;
}

export async function sendChatMessage({ socket, io, payload }) {
  const session = socket.data.lobby;
  if (!session) throw new ApiError(403, 'Join a room before chatting', 'NOT_IN_ROOM');
  const message = validateChatMessage(payload?.message);
  const room = await Room.findById(session.roomId);
  if (!room) throw new ApiError(404, 'Room was not found', 'ROOM_NOT_FOUND');
  if (!socket.rooms.has(room.code)) {
    throw new ApiError(403, 'Socket is not connected to this room', 'NOT_IN_ROOM');
  }
  const member = room.members.find((item) => idOf(item.playerId) === session.playerId);
  if (!member?.isConnected || member.socketId !== socket.id) {
    throw new ApiError(403, 'This is not the active room member connection', 'INVALID_ROOM_MEMBER');
  }

  const event = {
    roomCode: room.code,
    playerId: session.playerId,
    displayName: member.displayName,
    message,
    sentAt: new Date().toISOString(),
  };
  io.to(room.code).emit('chat:message', event);
  return event;
}
