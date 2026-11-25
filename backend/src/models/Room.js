import mongoose from 'mongoose';

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
    },
    hostPlayerId: { type: mongoose.Schema.Types.ObjectId, ref: 'Player', default: null },
    members: { type: [memberSchema], default: [] },
    gameStatus: { type: String, enum: ['lobby', 'started'], default: 'lobby', required: true },
    gameStartedAt: { type: Date, default: null },
    privateInviteTokenHash: { type: String, select: false },
  },
  { timestamps: true, versionKey: false }
);

roomSchema.index({ isPublic: 1, createdAt: -1 });

export const Room = mongoose.model('Room', roomSchema);
