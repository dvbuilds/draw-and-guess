import { Server } from 'socket.io';
import { env } from '../config/env.js';
import { joinLobby, leaveLobby } from '../services/lobby.service.js';
import { advanceGameTurn, initializeGame } from '../services/gameInitialization.service.js';
import { selectWord } from '../services/wordSelection.service.js';
import { submitGuess } from '../services/guessValidation.service.js';
import { sendChatMessage } from '../services/chat.service.js';
import { addDrawingSegment, clearDrawing, syncDrawing, undoDrawing } from '../services/drawing.service.js';

function socketError(err) {
  return {
    code: err.statusCode ? err.code : 'INTERNAL_ERROR',
    message: err.statusCode ? err.message : 'Unable to complete the lobby action',
  };
}

function registerRequest(socket, eventName, handler) {
  socket.on(eventName, (payload, ack) => {
    Promise.resolve()
      .then(() => handler(payload))
      .then((data) => {
        if (typeof ack === 'function') ack({ success: true, data });
      })
      .catch((err) => {
        console.warn(`[socket] ${eventName} failed: ${err.message}`);
        const error = socketError(err);
        if (typeof ack === 'function') ack({ success: false, error });
        else socket.emit('lobby_error', error);
      });
  });
}

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

    registerRequest(socket, 'lobby:join', (payload) => joinLobby({ socket, io, payload }));
    registerRequest(socket, 'lobby:leave', (payload = {}) => leaveLobby({
      io,
      socket,
      reason: typeof payload.reason === 'string' ? payload.reason.slice(0, 64) : 'left',
    }));
    registerRequest(socket, 'game:start', () => initializeGame({ socket, io }));
    registerRequest(socket, 'game:next_turn', () => advanceGameTurn({ socket, io }));
    registerRequest(socket, 'word:select', (payload) => selectWord({ socket, io, payload }));
    registerRequest(socket, 'guess:submit', (payload) => submitGuess({ socket, io, payload }));
    registerRequest(socket, 'chat:send', (payload) => sendChatMessage({ socket, io, payload }));
    registerRequest(socket, 'drawing:stroke', (payload) => addDrawingSegment({ socket, io, payload }));
    registerRequest(socket, 'drawing:undo', () => undoDrawing({ socket, io }));
    registerRequest(socket, 'drawing:clear', () => clearDrawing({ socket, io }));
    registerRequest(socket, 'drawing:sync', () => syncDrawing({ socket }));

    socket.on('disconnect', (reason) => {
      leaveLobby({ io, socket, reason, unexpected: true })
        .catch((err) => console.error('[socket] disconnect cleanup failed:', err));
      console.log(`[socket] disconnected: ${socket.id} (${reason})`);
    });
  });

  return io;
}
