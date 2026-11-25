import mongoose from 'mongoose';
import { WORD_CATEGORIES, WORD_LANGUAGE_CODES } from './Word.js';

const voteKickSchema = new mongoose.Schema({
  targetPlayerId: { type: mongoose.Schema.Types.ObjectId, ref: 'Player', required: true },
  startedByPlayerId: { type: mongoose.Schema.Types.ObjectId, ref: 'Player', required: true },
  eligibleVoterIds: [{ type: mongoose.Schema.Types.ObjectId, ref: 'Player' }],
  votes: [{
    playerId: { type: mongoose.Schema.Types.ObjectId, ref: 'Player', required: true },
    yes: { type: Boolean, required: true },
  }],
  requiredVotes: { type: Number, required: true },
  thresholdPercent: { type: Number, required: true },
  startedAt: { type: Date, required: true },
}, { _id: false });

const memberSchema = new mongoose.Schema(
  {
    playerId: { type: mongoose.Schema.Types.ObjectId, ref: 'Player', required: true },
    displayName: { type: String, required: true },
    normalizedDisplayName: { type: String, required: true },
    role: { type: String, enum: ['host', 'player'], required: true },
    joinedAt: { type: Date, default: Date.now },
    isConnected: { type: Boolean, default: false },
    socketId: { type: String, default: null },
    lastDisconnectedAt: { type: Date, default: null },
    score: { type: Number, min: 0, default: 0 },
  },
  { _id: false }
);

const roomSchema = new mongoose.Schema(
  {
    code: { type: String, required: true, unique: true, uppercase: true, minlength: 8, maxlength: 8 },
    isPublic: { type: Boolean, required: true, default: true },
    settings: {
      maxPlayers: { type: Number, required: true, min: 2, max: 20 },
      rounds: { type: Number, required: true, min: 2, max: 10 },
      drawingTime: { type: Number, required: true, min: 15, max: 240 },
      wordChoices: { type: Number, required: true, min: 1, max: 5 },
      hints: { type: Number, min: 0, max: 5, default: 3 },
      hintsEnabled: { type: Boolean, default: true },
      wordMode: { type: String, enum: ['Normal', 'Hidden', 'Combination'], required: true },
      language: { type: String, enum: WORD_LANGUAGE_CODES, default: 'en', required: true },
      wordCategories: { type: [{ type: String, enum: WORD_CATEGORIES }], default: [] },
      voteKickEnabled: { type: Boolean, default: true },
      voteKickThreshold: { type: Number, min: 50, max: 100, default: 60 },
      scoring: {
        correctGuessPoints: { type: Number, min: 1, max: 1000, default: 100 },
        drawerPointsPerCorrectGuess: { type: Number, min: 0, max: 1000, default: 50 },
      },
    },
    hostPlayerId: { type: mongoose.Schema.Types.ObjectId, ref: 'Player', default: null },
    members: { type: [memberSchema], default: [] },
    gameStatus: { type: String, enum: ['lobby', 'started', 'completed'], default: 'lobby', required: true },
    gameStartedAt: { type: Date, default: null },
    gameCompletedAt: { type: Date, default: null },
    gameLanguage: { type: String, enum: WORD_LANGUAGE_CODES, default: null },
    totalRounds: { type: Number, default: null },
    currentRound: { type: Number, default: null },
    currentTurn: { type: Number, default: null },
    turnOrder: [{ type: mongoose.Schema.Types.ObjectId, ref: 'Player' }],
    currentDrawerPlayerId: { type: mongoose.Schema.Types.ObjectId, ref: 'Player', default: null },
    roundStatus: { type: String, enum: ['waiting_for_word', 'guessing', 'completed'], default: null },
    roundCompletedAt: { type: Date, default: null },
    roundCompletionReason: { type: String, default: null },
    turnEndsAt: { type: Date, default: null },
    hintLevel: { type: Number, min: 0, max: 5, default: 0 },
    revealedLetterPositions: { type: [Number], default: [], select: false },
    eligibleGuesserIds: [{ type: mongoose.Schema.Types.ObjectId, ref: 'Player' }],
    correctGuesserIds: [{ type: mongoose.Schema.Types.ObjectId, ref: 'Player' }],
    finalLeaderboard: [{
      playerId: { type: mongoose.Schema.Types.ObjectId, ref: 'Player' },
      displayName: String,
      score: Number,
      rank: Number,
    }],
    winnerPlayerIds: [{ type: mongoose.Schema.Types.ObjectId, ref: 'Player' }],
    bannedPlayerIds: [{ type: mongoose.Schema.Types.ObjectId, ref: 'Player' }],
    kickedPlayerIds: [{ type: mongoose.Schema.Types.ObjectId, ref: 'Player' }],
    activeVoteKick: { type: voteKickSchema, default: null },
    wordOptionIds: { type: [mongoose.Schema.Types.ObjectId], ref: 'Word', default: [], select: false },
    currentWordId: { type: mongoose.Schema.Types.ObjectId, ref: 'Word', default: null, select: false },
    currentWordText: { type: String, default: null, select: false },
    currentWordCategory: { type: String, default: null, select: false },
    privateInviteTokenHash: { type: String, select: false },
  },
  { timestamps: true, versionKey: false }
);

roomSchema.index({ isPublic: 1, createdAt: -1 });

export const Room = mongoose.model('Room', roomSchema);
