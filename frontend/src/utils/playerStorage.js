const STORAGE_KEY = 'draw_and_guess_player_identity';

export function loadStoredPlayerIdentity() {
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;

    const parsed = JSON.parse(raw);
    if (
      typeof parsed?.playerId === 'string' &&
      parsed.playerId.trim() &&
      typeof parsed?.displayName === 'string' &&
      parsed.displayName.trim() &&
      typeof parsed?.identityToken === 'string' &&
      parsed.identityToken.trim()
    ) {
      return {
        playerId: parsed.playerId,
        displayName: parsed.displayName,
        roomId: typeof parsed.roomId === 'string' ? parsed.roomId : '',
        identityToken: parsed.identityToken,
      };
    }

    return null;
  } catch {
    return null;
  }
}

export function saveStoredPlayerIdentity(identity) {
  try {
    const payload = {
      playerId: identity.playerId,
      displayName: identity.displayName,
      roomId: identity.roomId,
      identityToken: identity.identityToken,
    };
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(payload));
  } catch {
    // Ignore storage quota / privacy mode errors
  }
}

export function clearStoredPlayerIdentity() {
  try {
    window.localStorage.removeItem(STORAGE_KEY);
  } catch {
    // Ignore storage access errors
  }
}
