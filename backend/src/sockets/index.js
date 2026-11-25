import { Server } from 'socket.io';
import { env } from '../config/env.js';

export function initSocket(httpServer) {
  const io = new Server(httpServer, {
    cors: { origin: env.CLIENT_URL, credentials: true },
  });

  io.on('connection', (socket) => {
    console.log(`[socket] connected: ${socket.id}`);

    // Foundation test event. Every client->server event with a reply
    // uses an ack callback that receives { success, data } or { success, error }.
    socket.on('system:ping', (...args) => {
      const ack = args.at(-1);
      if (typeof ack === 'function') {
        ack({ success: true, data: { message: 'pong', serverTime: Date.now() } });
      }
    });

    // Later modules register their handlers here, e.g.
    // registerPlayerHandlers(io, socket);
    // registerRoomHandlers(io, socket);

    socket.on('disconnect', (reason) => {
      console.log(`[socket] disconnected: ${socket.id} (${reason})`);
    });
  });

  return io;
}