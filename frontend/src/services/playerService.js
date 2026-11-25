import { api } from './api.js';

/**
 * Creates a guest player identity scoped to a room.
 * POST /api/players
 * Request:  { displayName, roomId }
 * Response: { success: true, data: { playerId, displayName, roomId, identityToken } }
 */
export async function createGuestIdentity({ displayName, roomId }) {
  const response = await api.post('/players', { displayName, roomId });
  return response.data?.data ?? response.data;
}

/**
 * Validates a stored guest player identity and reconnect token.
 * POST /api/players/validate
 * Request:  { playerId, identityToken }
 * Response: { success: true, data: { valid, player: { playerId, displayName, roomId } | null } }
 */
export async function validateGuestIdentity({ playerId, identityToken }) {
  const response = await api.post('/players/validate', { playerId, identityToken });
  return response.data?.data ?? response.data;
}
