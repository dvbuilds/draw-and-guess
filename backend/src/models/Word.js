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

export const WORD_LANGUAGES = Object.freeze([
  { code: 'en', name: 'English' },
  { code: 'es', name: 'Español' },
  { code: 'fr', name: 'Français' },
]);
export const WORD_LANGUAGE_CODES = WORD_LANGUAGES.map(({ code }) => code);

const wordSchema = new mongoose.Schema(
  {
    text: { type: String, required: true, trim: true, minlength: 2, maxlength: 48 },
    normalizedText: { type: String, required: true },
    category: { type: String, required: true, enum: WORD_CATEGORIES, index: true },
    language: { type: String, required: true, enum: WORD_LANGUAGE_CODES, default: 'en' },
    isActive: { type: Boolean, default: true, index: true },
  },
  { timestamps: true, versionKey: false }
);

wordSchema.index({ category: 1, isActive: 1 });
wordSchema.index({ language: 1, category: 1, isActive: 1 });
wordSchema.index({ language: 1, normalizedText: 1 }, { unique: true });

export const Word = mongoose.model('Word', wordSchema);
