import { api } from './api.js';

/**
 * Fetches active word languages from GET /api/words/languages.
 */
export async function getAvailableLanguages() {
  const response = await api.get('/words/languages');
  return response.data?.data ?? response.data;
}

/**
 * Fetches active word categories for a given language from GET /api/words/categories.
 */
export async function getAvailableCategories(language = 'en') {
  const response = await api.get('/words/categories', {
    params: { language },
  });
  return response.data?.data ?? response.data;
}
