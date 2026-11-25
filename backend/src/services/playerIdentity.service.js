import { createHash, randomBytes, timingSafeEqual } from 'node:crypto';
import { Player } from '../models/Player.js';
import { ApiError } from '../utils/ApiError.js';

const NAME_PATTERN = /^[\p{L}\p{N}_ -]+$/u;
const ROOM_ID_PATTERN = /^[A-Za-z0-9_-]+$/;

export function validatePlayerName(value) {
  if (typeof value !== 'string') {
    throw new ApiError(400, 'Display name is required', 'VALIDATION_ERROR');
  }
  const displayName = value.trim();
  if (!displayName) throw new ApiError(400, 'Display name is required', 'VALIDATION_ERROR');
  if (displayName.length > 24) {
    throw new ApiError(400, 'Display name must be 24 characters or fewer', 'VALIDATION_ERROR');
  }
  if (!NAME_PATTERN.test(displayName)) {
    throw new ApiError(400, 'Display name may contain letters, numbers, spaces, underscores, and hyphens only', 'VALIDATION_ERROR');
  }
  return displayName;
}

function validateRoomId(value) {
  if (typeof value !== 'string' || !value.trim() || value.trim().length > 64 || !ROOM_ID_PATTERN.test(value.trim())) {
    throw new ApiError(400, 'Room ID is required and must be at most 64 letters, numbers, underscores, or hyphens', 'VALIDATION_ERROR');
  }
  return value.trim();
}

function hashToken(token) {
  return createHash('sha256').update(token).digest('hex');
}

function playerData(player) {
  return { playerId: player.id, displayName: player.displayName, roomId: player.roomId };
}

export async function createGuestIdentity({ displayName: inputName, roomId: inputRoomId }) {
  const displayName = validatePlayerName(inputName);
  const roomId = validateRoomId(inputRoomId);
  const identityToken = randomBytes(32).toString('base64url');
  try {
    const player = await Player.create({
      displayName,
      normalizedDisplayName: displayName.toLocaleLowerCase('en'),
      roomId,
      identityTokenHash: hashToken(identityToken),
    });
    return { ...playerData(player), identityToken };
  } catch (err) {
    if (err.code === 11000 && err.keyPattern?.roomId && err.keyPattern?.normalizedDisplayName) {
      throw new ApiError(409, 'That display name is already in use in this room', 'PLAYER_NAME_TAKEN');
    }
    throw err;
  }
}

export async function validateGuestIdentity({ playerId, identityToken }) {
  if (typeof playerId !== 'string' || !playerId.trim() || typeof identityToken !== 'string' || !identityToken) {
    throw new ApiError(400, 'Player ID and identity token are required', 'VALIDATION_ERROR');
  }
  if (!/^[a-f\d]{24}$/i.test(playerId)) return { valid: false, player: null };

  const player = await Player.findById(playerId).select('+identityTokenHash');
  if (!player) return { valid: false, player: null };
  const expected = Buffer.from(player.identityTokenHash, 'hex');
  const actual = Buffer.from(hashToken(identityToken), 'hex');
  const valid = expected.length === actual.length && timingSafeEqual(expected, actual);
  return { valid, player: valid ? playerData(player) : null };
}
