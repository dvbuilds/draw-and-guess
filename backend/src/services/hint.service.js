import { randomInt } from 'node:crypto';
import { Room } from '../models/Room.js';

const idOf = (value) => String(value);

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

export function buildHintPattern(word, revealedPositions = []) {
  const revealed = new Set(revealedPositions);
  return Array.from(word, (character, index) => {
    if (/\s/u.test(character)) return character;
    if (revealed.has(index)) return character;
    return '_';
  }).join('');
}

export async function publishProgressiveHint({ io, roomId, turn, hintNumber }) {
  const room = await Room.findById(roomId)
    .select('+currentWordId +currentWordText +revealedLetterPositions');
  if (!room || room.gameStatus !== 'started' || room.roundStatus !== 'guessing'
      || room.currentRound !== turn.currentRound || room.currentTurn !== turn.currentTurn
      || idOf(room.currentDrawerPlayerId) !== turn.drawerPlayerId
      || idOf(room.currentWordId) !== turn.wordId
      || !room.settings.hintsEnabled || room.settings.hints < hintNumber
      || !room.currentWordText) return false;

  const positions = room.revealedLetterPositions ?? [];
  const revealed = new Set(positions);
  const hiddenLetters = Array.from(room.currentWordText)
    .map((character, index) => ({ character, index }))
    .filter(({ character, index }) => /[\p{L}\p{N}]/u.test(character) && !revealed.has(index));
  // Always leave at least one alphanumeric character concealed.
  if (hiddenLetters.length <= 1) return false;

  const { index } = hiddenLetters[randomInt(hiddenLetters.length)];
  const updated = await Room.findOneAndUpdate(
    { ...currentTurnFilter(room), hintLevel: hintNumber - 1 },
    { $addToSet: { revealedLetterPositions: index }, $set: { hintLevel: hintNumber } },
    { returnDocument: 'after' }
  );
  if (!updated) return false;

  io.to(room.code).emit('word_hint', {
    roomCode: room.code,
    currentRound: room.currentRound,
    currentTurn: room.currentTurn,
    hintNumber,
    hintCount: room.settings.hints,
    pattern: buildHintPattern(room.currentWordText, [...positions, index]),
  });
  return true;
}
