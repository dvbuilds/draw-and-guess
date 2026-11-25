import http from 'http';
import app from './app.js';
import { env } from './config/env.js';
import { connectDB, disconnectDB } from './config/db.js';
import { initSocket } from './sockets/index.js';

const server = http.createServer(app);
const io = initSocket(server);

// Lets REST controllers emit socket events later: req.app.get('io')
app.set('io', io);

await connectDB();

server.listen(env.PORT, () => {
  console.log(`[server] running on http://localhost:${env.PORT} (${env.NODE_ENV})`);
});

async function shutdown(signal) {
  console.log(`\n[server] ${signal} received, shutting down`);
  io.close();
  server.close(async () => {
    await disconnectDB();
    process.exit(0);
  });
}

process.on('SIGINT', () => shutdown('SIGINT'));
process.on('SIGTERM', () => shutdown('SIGTERM'));