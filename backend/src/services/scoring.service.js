import { Room } from '../models/Room.js';

export const DEFAULT_SCORING_RULES = Object.freeze({
  correctGuessPoints: 100,
  drawerPointsPerCorrectGuess: 50,
});

const idOf = (value) => String(value);

export function scoringRules(settings = {}) {
  return {
    correctGuessPoints: settings.scoring?.correctGuessPoints ?? DEFAULT_SCORING_RULES.correctGuessPoints,
    drawerPointsPerCorrectGuess:
      settings.scoring?.drawerPointsPerCorrectGuess ?? DEFAULT_SCORING_RULES.drawerPointsPerCorrectGuess,
  };
}

export function buildLeaderboard(room) {
  const sorted = room.members
    .map((member) => ({
      playerId: idOf(member.playerId),
      displayName: member.displayName,
      score: Number.isFinite(member.score) ? member.score : 0,
    }))
    .sort((left, right) => right.score - left.score
      || left.displayName.localeCompare(right.displayName, 'en')
      || left.playerId.localeCompare(right.playerId));

  let lastScore = null;
  let rank = 0;
  return sorted.map((player, index) => {
    if (player.score !== lastScore) rank = index + 1;
    lastScore = player.score;
    return { ...player, rank };
  });
}

export function determineWinners(leaderboard) {
  if (!leaderboard.length) return [];
  const winningScore = leaderboard[0].score;
  return leaderboard.filter((player) => player.score === winningScore);
}

export async function completeRound({ io, room, reason }) {
  if (!room || room.gameStatus !== 'started' || room.roundStatus === 'completed') {
    return { completed: false, room };
  }
  const completedAt = new Date();
  const completed = await Room.findOneAndUpdate(
    {
      _id: room._id,
      gameStatus: 'started',
      currentRound: room.currentRound,
      currentTurn: room.currentTurn,
      currentDrawerPlayerId: room.currentDrawerPlayerId,
      roundStatus: room.roundStatus,
    },
    { $set: { roundStatus: 'completed', roundCompletedAt: completedAt, roundCompletionReason: reason } },
    { returnDocument: 'after' }
  );
  if (!completed) return { completed: false, room: null };

  const correctGuesserIds = (completed.correctGuesserIds ?? []).map(idOf);
  const eligibleGuesserIds = (completed.eligibleGuesserIds ?? []).map(idOf);
  const event = {
    roomCode: completed.code,
    currentRound: completed.currentRound,
    currentTurn: completed.currentTurn,
    drawerPlayerId: idOf(completed.currentDrawerPlayerId),
    reason,
    correctGuesserIds,
    missedGuesserIds: eligibleGuesserIds.filter((id) => !correctGuesserIds.includes(id)),
    completedAt: completed.roundCompletedAt.toISOString(),
    leaderboard: buildLeaderboard(completed),
  };
  io.to(completed.code).emit('round_complete', event);
  return { completed: true, room: completed, event };
}

export async function removeEligibleGuesser({ room, playerId }) {
  if (!room || room.gameStatus !== 'started' || room.roundStatus !== 'guessing') return null;
  return Room.findOneAndUpdate(
    {
      _id: room._id,
      gameStatus: 'started',
      currentRound: room.currentRound,
      currentTurn: room.currentTurn,
      roundStatus: 'guessing',
      eligibleGuesserIds: playerId,
    },
    { $pull: { eligibleGuesserIds: playerId } },
    { returnDocument: 'after' }
  );
}
