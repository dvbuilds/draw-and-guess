import { Room } from '../models/Room.js';
import { ApiError } from '../utils/ApiError.js';
import { advanceGameForRoom } from './gameInitialization.service.js';
import { buildLeaderboard, completeRound, scoringRules } from './scoring.service.js';

const idOf = (value) => String(value);

export function normalizeGuess(value, language = 'en') {
  if (typeof value !== 'string' || value.length > 64) {
    throw new ApiError(400, 'Guess must be a word or phrase of at most 64 characters', 'INVALID_GUESS');
  }
  const normalized = value.normalize('NFKC')
    .trim()
    .toLocaleLowerCase(language)
    .replace(/[^\p{L}\p{N}]+/gu, ' ')
    .trim();
  if (!normalized) throw new ApiError(400, 'Guess cannot be empty', 'INVALID_GUESS');
  return normalized;
}

export async function submitGuess({ socket, io, payload }) {
  const session = socket.data.lobby;
  if (!session) throw new ApiError(403, 'Join a room before guessing', 'NOT_IN_ROOM');
  const room = await Room.findById(session.roomId).select('+currentWordId +currentWordText');
  if (!room) throw new ApiError(404, 'Room was not found', 'ROOM_NOT_FOUND');
  if (!socket.rooms.has(room.code)) throw new ApiError(403, 'Socket is not connected to this room', 'NOT_IN_ROOM');
  if (room.gameStatus !== 'started' || room.roundStatus !== 'guessing' || !room.currentWordText) {
    throw new ApiError(409, 'This round is not accepting guesses', 'ROUND_NOT_ACCEPTING_GUESSES');
  }
  const playerId = session.playerId;
  const member = room.members.find((item) => idOf(item.playerId) === playerId);
  if (!member?.isConnected || member.socketId !== socket.id) {
    throw new ApiError(403, 'This is not the active player connection', 'INVALID_ROOM_MEMBER');
  }
  const language = room.gameLanguage ?? room.settings.language ?? 'en';
  const guess = normalizeGuess(payload?.guess, language);
  if (idOf(room.currentDrawerPlayerId) === playerId) {
    throw new ApiError(403, 'The drawer cannot guess their own word', 'DRAWER_CANNOT_GUESS');
  }
  if (!(room.eligibleGuesserIds ?? []).some((id) => idOf(id) === playerId)) {
    throw new ApiError(403, 'This player is not eligible to guess this round', 'NOT_ELIGIBLE_TO_GUESS');
  }
  if ((room.correctGuesserIds ?? []).some((id) => idOf(id) === playerId)) {
    throw new ApiError(409, 'This player has already guessed correctly this round', 'ALREADY_GUESSED');
  }

  const correct = guess === normalizeGuess(room.currentWordText, language);
  if (!correct) {
    const feedback = {
      correct: false,
      playerId,
      displayName: member.displayName,
      message: 'Incorrect guess',
    };
    io.to(room.code).emit('guess_feedback', feedback);
    return feedback;
  }

  const rules = scoringRules(room.settings);
  const updated = await Room.findOneAndUpdate(
    {
      _id: room._id,
      gameStatus: 'started',
      roundStatus: 'guessing',
      currentRound: room.currentRound,
      currentTurn: room.currentTurn,
      currentDrawerPlayerId: room.currentDrawerPlayerId,
      currentWordId: room.currentWordId,
      eligibleGuesserIds: member.playerId,
      correctGuesserIds: { $ne: member.playerId },
      members: {
        $elemMatch: { playerId: member.playerId, socketId: socket.id, isConnected: true },
      },
    },
    {
      $addToSet: { correctGuesserIds: member.playerId },
      $inc: {
        'members.$[guesser].score': rules.correctGuessPoints,
        'members.$[drawer].score': rules.drawerPointsPerCorrectGuess,
      },
    },
    {
      returnDocument: 'after',
      arrayFilters: [
        { 'guesser.playerId': member.playerId },
        { 'drawer.playerId': room.currentDrawerPlayerId },
      ],
    }
  );
  if (!updated) {
    const latest = await Room.findById(session.roomId).select('+correctGuesserIds');
    if ((latest?.correctGuesserIds ?? []).some((id) => idOf(id) === playerId)) {
      throw new ApiError(409, 'This player has already guessed correctly this round', 'ALREADY_GUESSED');
    }
    throw new ApiError(409, 'The round changed before this guess was accepted', 'ROUND_NOT_ACCEPTING_GUESSES');
  }

  const feedback = {
    correct: true,
    playerId,
    displayName: member.displayName,
    scoreAwarded: rules.correctGuessPoints,
    drawerScoreAwarded: rules.drawerPointsPerCorrectGuess,
    message: 'Correct guess',
  };
  io.to(updated.code).emit('guess_feedback', feedback);
  io.to(updated.code).emit('scoreboard_updated', {
    roomCode: updated.code,
    leaderboard: buildLeaderboard(updated),
  });

  const eligibleIds = (updated.eligibleGuesserIds ?? []).map(idOf);
  const correctIds = new Set((updated.correctGuesserIds ?? []).map(idOf));
  const allEligibleGuessed = eligibleIds.every((id) => correctIds.has(id));
  if (allEligibleGuessed) {
    const completed = await completeRound({ io, room: updated, reason: 'all_guessed' });
    if (completed.completed) {
      await advanceGameForRoom({ io, roomId: updated._id, reason: 'all_guessed' });
      feedback.roundComplete = true;
    }
  }
  return feedback;
}
