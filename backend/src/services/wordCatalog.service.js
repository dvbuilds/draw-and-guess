import { Word, WORD_CATEGORIES, WORD_LANGUAGES, WORD_LANGUAGE_CODES } from '../models/Word.js';
import { ApiError } from '../utils/ApiError.js';

export async function listAvailableLanguages() {
  const activeCodes = new Set(await Word.distinct('language', { isActive: true }));
  return WORD_LANGUAGES.filter(({ code }) => activeCodes.has(code));
}

export async function listAvailableCategories(language = 'en') {
  if (typeof language !== 'string' || !WORD_LANGUAGE_CODES.includes(language)) {
    throw new ApiError(400, `language must be one of: ${WORD_LANGUAGE_CODES.join(', ')}`, 'INVALID_WORD_LANGUAGE');
  }
  const activeCategories = new Set(await Word.distinct('category', { isActive: true, language }));
  return WORD_CATEGORIES.filter((category) => activeCategories.has(category));
}
