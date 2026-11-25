import mongoose from 'mongoose';

export const WORD_CATEGORIES = [
  'Animals',
  'Food',
  'Objects',
  'Nature',
  'Places',
  'Activities',
  'Combination',
];

const wordSchema = new mongoose.Schema(
  {
    text: { type: String, required: true, trim: true, minlength: 2, maxlength: 48 },
    normalizedText: { type: String, required: true, unique: true, index: true },
    category: { type: String, required: true, enum: WORD_CATEGORIES, index: true },
    isActive: { type: Boolean, default: true, index: true },
  },
  { timestamps: true, versionKey: false }
);

wordSchema.index({ category: 1, isActive: 1 });

export const Word = mongoose.model('Word', wordSchema);
