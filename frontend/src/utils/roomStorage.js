const ROOM_SESSION_KEY = 'draw_and_guess_active_room';

export function loadStoredRoomSession() {
  try {
    const raw = window.sessionStorage.getItem(ROOM_SESSION_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (typeof parsed?.roomCode === 'string' && parsed.roomCode.trim()) {
      return parsed;
    }
    return null;
  } catch {
    return null;
  }
}

export function saveStoredRoomSession(roomData) {
  try {
    if (!roomData?.roomCode) return;
    window.sessionStorage.setItem(ROOM_SESSION_KEY, JSON.stringify(roomData));
  } catch {
    // Ignore storage access errors
  }
}

export function clearStoredRoomSession() {
  try {
    window.sessionStorage.removeItem(ROOM_SESSION_KEY);
  } catch {
    // Ignore storage access errors
  }
}
