import { Room } from '../models/Room.js';
import { publishProgressiveHint } from './hint.service.js';

const timers = new Map();
const idOf = (value) => String(value);

function timerKey(room) {
  return idOf(room._id);
}

function currentTurnFilter(room) {
  return {
    _id: room._id,
    gameStatus: 'started',
    roundStatus: 'guessing',
    currentRound: room.currentRound,
    currentTurn: room.currentTurn,
    currentDrawerPlayerId: room.currentDrawerPlayerId,
    currentWordId: room.currentWordId,
  };
}

export function stopTurnTimer(roomOrId, clear) {
  const key = typeof roomOrId === 'object' ? timerKey(roomOrId) : idOf(roomOrId);
  const active = timers.get(key);
  if (!active) return false;
  const clearHandle = clear ?? active.clear ?? clearTimeout;
  for (const handle of active.handles) clearHandle(handle);
  timers.delete(key);
  return true;
}

export function stopAllTurnTimers() {
  for (const key of timers.keys()) stopTurnTimer(key);
}

async function expireTurn({ io, roomId, turn, now }) {
  const room = await Room.findById(roomId).select('+currentWordId +currentWordText');
  if (!room || room.gameStatus !== 'started' || room.roundStatus !== 'guessing'
      || room.currentRound !== turn.currentRound || room.currentTurn !== turn.currentTurn
      || idOf(room.currentDrawerPlayerId) !== turn.drawerPlayerId
      || idOf(room.currentWordId) !== turn.wordId
      || !room.turnEndsAt || new Date(room.turnEndsAt).getTime() > now()) return false;

  stopTurnTimer(roomId);
  io.to(room.code).emit('turn_timer_expired', {
    roomCode: room.code,
    currentRound: room.currentRound,
    currentTurn: room.currentTurn,
    drawerPlayerId: idOf(room.currentDrawerPlayerId),
  });
  const { advanceGameForRoom } = await import('./gameInitialization.service.js');
  await advanceGameForRoom({ io, roomId, reason: 'timer_expired' });
  return true;
}

export function startTurnTimer({ io, room, schedule = setTimeout, clear = clearTimeout, now = Date.now }) {
  if (!room || room.gameStatus !== 'started' || room.roundStatus !== 'guessing'
      || !room.currentWordText || !room.currentWordId
      || !Number.isInteger(room.settings?.drawingTime)) return false;
  stopTurnTimer(room);

  const durationSeconds = room.settings.drawingTime;
  const turnEndsAt = room.turnEndsAt ? new Date(room.turnEndsAt) : new Date(now() + durationSeconds * 1000);
  const turn = {
    currentRound: room.currentRound,
    currentTurn: room.currentTurn,
    drawerPlayerId: idOf(room.currentDrawerPlayerId),
    wordId: idOf(room.currentWordId),
  };
  const record = { handles: [], clear };
  timers.set(timerKey(room), record);

  io.to(room.code).emit('turn_timer_started', {
    roomCode: room.code,
    currentRound: room.currentRound,
    currentTurn: room.currentTurn,
    durationSeconds,
    turnEndsAt: turnEndsAt.toISOString(),
  });

  const startAt = turnEndsAt.getTime() - durationSeconds * 1000;
  const hintCount = room.settings.hintsEnabled ? Math.min(room.settings.hints ?? 0, 5) : 0;
  for (let hintNumber = 1; hintNumber <= hintCount; hintNumber += 1) {
    const hintAt = startAt + (durationSeconds * 1000 * hintNumber) / (hintCount + 1);
    const handle = schedule(
      () => publishProgressiveHint({ io, roomId: room._id, turn, hintNumber })
        .catch((error) => console.error('[timer] hint delivery failed:', error)),
      Math.max(0, hintAt - now())
    );
    handle?.unref?.();
    record.handles.push(handle);
  }
  const expiration = schedule(
    () => expireTurn({ io, roomId: room._id, turn, now })
      .catch((error) => console.error('[timer] turn completion failed:', error)),
    Math.max(0, turnEndsAt.getTime() - now())
  );
  expiration?.unref?.();
  record.handles.push(expiration);
  return true;
}

export async function resumeActiveTurnTimers(io) {
  const rooms = await Room.find({ gameStatus: 'started', roundStatus: 'guessing' })
    .select('+currentWordId +currentWordText +revealedLetterPositions');
  for (const room of rooms) {
    if (!room.turnEndsAt) {
      room.turnEndsAt = new Date(Date.now() + room.settings.drawingTime * 1000);
      await Room.updateOne(currentTurnFilter(room), { $set: { turnEndsAt: room.turnEndsAt } });
    }
    startTurnTimer({ io, room });
  }
  return rooms.length;
}
