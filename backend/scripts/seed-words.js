import { connectDB, disconnectDB } from '../src/config/db.js';
import { Word } from '../src/models/Word.js';
import { SEED_WORDS } from '../src/data/seedWords.js';

try {
  await connectDB();
  let indexes = [];
  try {
    indexes = await Word.collection.indexes();
  } catch (error) {
    if (error.code !== 26 && error.codeName !== 'NamespaceNotFound') throw error;
  }
  const obsoleteUniqueTextIndex = indexes.find((index) =>
    index.unique && index.key?.normalizedText === 1 && !index.key?.language);
  if (obsoleteUniqueTextIndex) await Word.collection.dropIndex(obsoleteUniqueTextIndex.name);
  await Word.collection.createIndex({ language: 1, normalizedText: 1 }, { unique: true });

  for (const { text, category, language = 'en' } of SEED_WORDS) {
    const normalizedText = text.toLocaleLowerCase(language);
    await Word.updateOne(
      { language, normalizedText },
      { $setOnInsert: { text, normalizedText, category, language, isActive: true } },
      { upsert: true }
    );
  }
  console.log(`[words] seeded ${SEED_WORDS.length} words`);
} finally {
  await disconnectDB();
}
