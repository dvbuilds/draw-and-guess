export const DISPLAY_NAME_MAX_LENGTH = 24;
export const ROOM_ID_MAX_LENGTH = 64;
export const DEFAULT_ROOM_ID = 'lobby';

const DISPLAY_NAME_PATTERN = /^[\p{L}\p{N}_ -]+$/u;
const ROOM_ID_PATTERN = /^[A-Za-z0-9_-]+$/;

export function validateDisplayNameInput(rawValue) {
  if (typeof rawValue !== 'string') {
    return { valid: false, value: '', error: 'Display name is required' };
  }

  const trimmed = rawValue.trim();
  if (!trimmed) {
    return { valid: false, value: trimmed, error: 'Display name is required' };
  }

  if (trimmed.length > DISPLAY_NAME_MAX_LENGTH) {
    return {
      valid: false,
      value: trimmed,
      error: `Display name must be ${DISPLAY_NAME_MAX_LENGTH} characters or fewer`,
    };
  }

  if (!DISPLAY_NAME_PATTERN.test(trimmed)) {
    return {
      valid: false,
      value: trimmed,
      error: 'Display name may contain letters, numbers, spaces, underscores, and hyphens only',
    };
  }

  return { valid: true, value: trimmed, error: null };
}

export function validateRoomIdInput(rawValue) {
  if (typeof rawValue !== 'string') {
    return {
      valid: false,
      value: '',
      error: `Room ID is required and must be at most ${ROOM_ID_MAX_LENGTH} letters, numbers, underscores, or hyphens`,
    };
  }

  const trimmed = rawValue.trim();
  if (!trimmed || trimmed.length > ROOM_ID_MAX_LENGTH || !ROOM_ID_PATTERN.test(trimmed)) {
    return {
      valid: false,
      value: trimmed,
      error: `Room ID is required and must be at most ${ROOM_ID_MAX_LENGTH} letters, numbers, underscores, or hyphens`,
    };
  }

  return { valid: true, value: trimmed, error: null };
}
