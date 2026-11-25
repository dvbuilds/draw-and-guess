import { after, before, test } from 'node:test';
import assert from 'node:assert/strict';
import http from 'node:http';
import app from '../src/app.js';
import { Word } from '../src/models/Word.js';
import { prepareWordOptions } from '../src/services/wordSelection.service.js';
import { SEED_WORDS } from '../src/data/seedWords.js';
import { normalizeGuess } from '../src/services/guessValidation.service.js';

const originalFind = Word.find;
const originalDistinct = Word.distinct;
let server;
let baseUrl;

after(async () => {
  if (server) await new Promise((resolve) => server.close(resolve));
  Word.find = originalFind;
  Word.distinct = originalDistinct;
});

test('filters word options by category and the room-pinned language', async () => {
  assert.deepEqual([...new Set(SEED_WORDS.map((word) => word.language))].sort(), ['en', 'es', 'fr']);
  assert.equal(normalizeGuess(' ÁRBOL ', 'es'), 'árbol');
  const words = [
    { _id: '000000000000000000000001', text: 'Gato', category: 'Animals', language: 'es', isActive: true },
    { _id: '000000000000000000000002', text: 'Perro', category: 'Animals', language: 'es', isActive: true },
    { _id: '000000000000000000000003', text: 'Chat', category: 'Animals', language: 'fr', isActive: true },
    { _id: '000000000000000000000004', text: 'Pan', category: 'Food', language: 'es', isActive: true },
  ];
  let lastQuery;
  Word.find = async (query) => {
    lastQuery = query;
    return words.filter((word) => word.isActive && word.language === query.language
      && query.category.$in.includes(word.category));
  };

  const selected = await prepareWordOptions({
    wordChoices: 2, wordMode: 'Normal', language: 'es', wordCategories: ['Animals'],
  });
  assert.equal(lastQuery.language, 'es');
  assert.deepEqual(lastQuery.category.$in, ['Animals']);
  assert.equal(selected.options.length, 2);
  assert.equal(selected.options.every((word) => word.language === 'es' && word.category === 'Animals'), true);
  await assert.rejects(
    prepareWordOptions({ wordChoices: 1, wordMode: 'Combination', language: 'es', wordCategories: ['Animals'] }),
    { code: 'INVALID_WORD_CATEGORIES' }
  );
});

test('lists active languages and localized categories through the word catalog API', async () => {
  Word.distinct = async (field, filter) => {
    if (field === 'language') return ['en', 'es', 'fr'];
    if (field === 'category' && filter.language === 'es') return ['Animals', 'Food'];
    return ['Animals'];
  };
  server = http.createServer(app);
  await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
  baseUrl = `http://127.0.0.1:${server.address().port}/api/words`;

  const languageResponse = await fetch(`${baseUrl}/languages`);
  assert.equal(languageResponse.status, 200);
  assert.deepEqual((await languageResponse.json()).data.map(({ code }) => code), ['en', 'es', 'fr']);

  const categoryResponse = await fetch(`${baseUrl}/categories?language=es`);
  assert.equal(categoryResponse.status, 200);
  assert.deepEqual((await categoryResponse.json()).data, ['Animals', 'Food']);

  const invalidResponse = await fetch(`${baseUrl}/categories?language=de`);
  assert.equal(invalidResponse.status, 400);
  assert.equal((await invalidResponse.json()).error.code, 'INVALID_WORD_LANGUAGE');
});
