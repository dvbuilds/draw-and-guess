import { connectDB, disconnectDB } from '../src/config/db.js';
import { Word } from '../src/models/Word.js';
import { SEED_WORDS } from '../src/data/seedWords.js';

try {
  await connectDB();
  for (const { text, category } of SEED_WORDS) {
    const normalizedText = text.toLocaleLowerCase('en');
    await Word.updateOne(
      { normalizedText },
      { $setOnInsert: { text, normalizedText, category, isActive: true } },
      { upsert: true }
    );
  }
  console.log(`[words] seeded ${SEED_WORDS.length} words`);
} finally {
  await disconnectDB();
}
