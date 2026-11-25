import { api } from './api.js';

/**
 * Creates a public or private room with validated settings.
 * POST /api/rooms
 * Request:  { playerId, identityToken, isPublic, settings }
 * Response: { success: true, data: { roomId, roomCode, isPublic, settings, hostPlayerId, members, inviteLink, inviteToken? } }
 */
export async function createRoom({ playerId, identityToken, isPublic = true, settings = {} }) {
  const response = await api.post('/rooms', {
    playerId,
    identityToken,
    isPublic,
    settings,
  });
  return response.data?.data ?? response.data;
}

/**
 * Joins an existing room by 8-character roomCode (and inviteToken if private).
 * POST /api/rooms/join
 * Request:  { playerId, identityToken, roomCode, inviteToken? }
 * Response: { success: true, data: { roomId, roomCode, isPublic, settings, hostPlayerId, members, inviteLink? } }
 */
export async function joinRoom({ playerId, identityToken, roomCode, inviteToken }) {
  const payload = {
    playerId,
    identityToken,
    roomCode,
  };
  if (typeof inviteToken === 'string' && inviteToken.trim()) {
    payload.inviteToken = inviteToken.trim();
  }
  const response = await api.post('/rooms/join', payload);
  return response.data?.data ?? response.data;
}
