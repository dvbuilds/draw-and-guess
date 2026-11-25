import mongoose from 'mongoose';

const playerSchema = new mongoose.Schema(
  {
    displayName: { type: String, required: true, trim: true, minlength: 1, maxlength: 24 },
    normalizedDisplayName: { type: String, required: true },
    roomId: { type: String, required: true, trim: true, maxlength: 64 },
    // The raw capability is returned only at creation; only its digest is persisted.
    identityTokenHash: { type: String, required: true, select: false },
  },
  { timestamps: true, versionKey: false }
);

playerSchema.index({ roomId: 1, normalizedDisplayName: 1 }, { unique: true });

export const Player = mongoose.model('Player', playerSchema);
