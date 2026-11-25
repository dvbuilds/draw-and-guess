import { requireRoomHost } from './moderation.service.js';
import { ApiError } from '../utils/ApiError.js';

export async function broadcastAnnouncement({ socket, io, payload }) {
  const { room, member, session } = await requireRoomHost(socket);
  if (typeof payload?.message !== 'string') {
    throw new ApiError(400, 'Announcement must be text', 'INVALID_ANNOUNCEMENT');
  }
  const message = payload.message.trim();
  if (!message || message.length > 500 || /[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/u.test(message)) {
    throw new ApiError(400, 'Announcement must contain 1 to 500 valid characters', 'INVALID_ANNOUNCEMENT');
  }
  const event = {
    roomCode: room.code,
    playerId: session.playerId,
    displayName: member.displayName,
    message,
    sentAt: new Date().toISOString(),
  };
  io.to(room.code).emit('room:announcement', event);
  return event;
}
