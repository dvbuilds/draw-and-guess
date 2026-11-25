import mongoose from 'mongoose';
import { Room } from '../models/Room.js';
import { removeRoomPlayer, requireRoomMemberForVote } from './moderation.service.js';
import { ApiError } from '../utils/ApiError.js';

const idOf = (value) => String(value);

function voteCounts(vote) {
  const yesVotes = vote.votes.filter((item) => item.yes).length;
  const noVotes = vote.votes.length - yesVotes;
  return { yesVotes, noVotes, votesCast: vote.votes.length };
}

export async function startVoteKick({ socket, io, payload }) {
  const { room, member, session } = await requireRoomMemberForVote(socket);
  if (!['lobby', 'started'].includes(room.gameStatus)) {
    throw new ApiError(409, 'VoteKick is only available in an active room', 'VOTE_KICK_UNAVAILABLE');
  }
  const targetPlayerId = typeof payload?.playerId === 'string' ? payload.playerId.toLowerCase() : '';
  if (!mongoose.isValidObjectId(targetPlayerId)) {
    throw new ApiError(400, 'A valid playerId is required', 'INVALID_PLAYER_ID');
  }
  if (targetPlayerId === session.playerId) {
    throw new ApiError(400, 'Players cannot start a vote against themselves', 'CANNOT_VOTE_SELF');
  }
  if (room.settings.voteKickEnabled === false) {
    throw new ApiError(403, 'VoteKick is disabled for this room', 'VOTE_KICK_DISABLED');
  }
  const target = room.members.find((item) => idOf(item.playerId) === targetPlayerId);
  if (!target) throw new ApiError(404, 'Target player is not a room member', 'PLAYER_NOT_IN_ROOM');
  if (room.activeVoteKick) throw new ApiError(409, 'A VoteKick is already active in this room', 'VOTE_KICK_ACTIVE');

  const eligibleVoterIds = room.members
    .filter((item) => item.isConnected && idOf(item.playerId) !== targetPlayerId)
    .map((item) => item.playerId);
  const thresholdPercent = room.settings.voteKickThreshold ?? 60;
  const requiredVotes = Math.max(1, Math.ceil(eligibleVoterIds.length * thresholdPercent / 100));
  const vote = {
    targetPlayerId: target.playerId,
    startedByPlayerId: member.playerId,
    eligibleVoterIds,
    votes: [],
    requiredVotes,
    thresholdPercent,
    startedAt: new Date(),
  };
  const updated = await Room.findOneAndUpdate(
    { _id: room._id, activeVoteKick: null },
    { $set: { activeVoteKick: vote } },
    { returnDocument: 'after' }
  );
  if (!updated) throw new ApiError(409, 'A VoteKick is already active in this room', 'VOTE_KICK_ACTIVE');

  const event = {
    roomCode: room.code,
    targetPlayerId,
    targetDisplayName: target.displayName,
    startedByPlayerId: session.playerId,
    eligibleVoterIds: eligibleVoterIds.map(idOf),
    requiredVotes,
    thresholdPercent,
  };
  io.to(room.code).emit('vote_kick:started', event);
  return event;
}

export async function castVoteKick({ socket, io, payload }) {
  const { room, member, session } = await requireRoomMemberForVote(socket);
  if (!['lobby', 'started'].includes(room.gameStatus)) {
    throw new ApiError(409, 'VoteKick is only available in an active room', 'VOTE_KICK_UNAVAILABLE');
  }
  if (typeof payload?.yes !== 'boolean') {
    throw new ApiError(400, 'Vote must be a boolean yes/no value', 'INVALID_VOTE');
  }
  const vote = room.activeVoteKick;
  if (!vote) throw new ApiError(409, 'There is no active VoteKick in this room', 'NO_ACTIVE_VOTE_KICK');
  const targetPlayerId = idOf(vote.targetPlayerId);
  if (session.playerId === targetPlayerId) {
    throw new ApiError(403, 'Players cannot vote on their own removal', 'CANNOT_VOTE_SELF');
  }
  if (!(vote.eligibleVoterIds ?? []).some((id) => idOf(id) === session.playerId)) {
    throw new ApiError(403, 'This player is not eligible to vote', 'NOT_ELIGIBLE_TO_VOTE');
  }

  const updated = await Room.findOneAndUpdate(
    {
      _id: room._id,
      'activeVoteKick.targetPlayerId': vote.targetPlayerId,
      'activeVoteKick.votes.playerId': { $ne: member.playerId },
      members: { $elemMatch: { playerId: member.playerId, socketId: socket.id, isConnected: true } },
    },
    { $push: { 'activeVoteKick.votes': { playerId: member.playerId, yes: payload.yes } } },
    { returnDocument: 'after' }
  );
  if (!updated) {
    throw new ApiError(409, 'This player has already voted or the vote has ended', 'DUPLICATE_VOTE');
  }

  const activeVote = updated.activeVoteKick;
  const counts = voteCounts(activeVote);
  const passed = counts.yesVotes >= activeVote.requiredVotes;
  const finished = passed || counts.votesCast >= activeVote.eligibleVoterIds.length;
  if (!finished) {
    const event = { roomCode: room.code, targetPlayerId, ...counts, requiredVotes: activeVote.requiredVotes };
    io.to(room.code).emit('vote_kick:updated', event);
    return event;
  }

  const claimed = await Room.findOneAndUpdate(
    { _id: room._id, 'activeVoteKick.targetPlayerId': activeVote.targetPlayerId },
    { $set: { activeVoteKick: null } },
    { returnDocument: 'before' }
  );
  if (!claimed) throw new ApiError(409, 'The VoteKick has already ended', 'VOTE_ALREADY_ENDED');
  const result = {
    roomCode: room.code,
    targetPlayerId,
    passed,
    reason: passed ? 'threshold_reached' : 'all_votes_cast',
    requiredVotes: activeVote.requiredVotes,
    ...counts,
  };
  io.to(room.code).emit('vote_kick:ended', result);
  if (passed) {
    const latest = await Room.findById(room._id);
    await removeRoomPlayer({
      io,
      room: latest,
      targetPlayerId,
      actorPlayerId: idOf(activeVote.startedByPlayerId),
      source: 'vote_kick',
    });
  }
  return result;
}
