import http from 'http';
import app from './app.js';
import { env } from './config/env.js';
import { connectDB, disconnectDB } from './config/db.js';
import { initSocket } from './sockets/index.js';
import { resumeActiveTurnTimers, stopAllTurnTimers } from './services/timer.service.js';
import { Word } from './models/Word.js';
import { SEED_WORDS } from './data/seedWords.js';

const server = http.createServer(app);
const io = initSocket(server);

// Lets REST controllers emit socket events later: req.app.get('io')
app.set('io', io);

await connectDB();
await Word.bulkWrite(SEED_WORDS.map(({ text, category, language }) => {
  const normalizedText = text.toLocaleLowerCase(language);
  return {
    updateOne: {
      filter: { language, normalizedText },
      update: { $setOnInsert: { text, normalizedText, category, language, isActive: true } },
      upsert: true,
    },
  };
}));
await resumeActiveTurnTimers(io);

server.listen(env.PORT, () => {
  console.log(`[server] running on http://localhost:${env.PORT} (${env.NODE_ENV})`);
});

async function shutdown(signal) {
  console.log(`\n[server] ${signal} received, shutting down`);
  stopAllTurnTimers();
  io.close();
  server.close(async () => {
    await disconnectDB();
    process.exit(0);
  });
}

process.on('SIGINT', () => shutdown('SIGINT'));
process.on('SIGTERM', () => shutdown('SIGTERM'));
