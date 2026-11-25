import { io } from 'socket.io-client';
import { env } from '../config/env.js';

let socketInstance = null;

/**
 * Returns the shared Socket.IO client instance (lazy-initialized).
 */
export function getSocket() {
  if (!socketInstance) {
    socketInstance = io(env.SOCKET_URL, {
      autoConnect: false,
      withCredentials: true,
      transports: ['websocket', 'polling'],
      reconnection: true,
      reconnectionAttempts: 10,
      reconnectionDelay: 1000,
    });
  }
  return socketInstance;
}

/**
 * Emits a Socket.IO event following the backend (payload, ack) contract:
 * { success: true, data } | { success: false, error: { code, message } }
 */
export function emitWithAck(event, payload = {}, timeoutMs = 5000) {
  const socket = getSocket();

  return new Promise((resolve, reject) => {
    if (!socket.connected) {
      const err = new Error('Socket is not connected');
      err.code = 'SOCKET_DISCONNECTED';
      reject(err);
      return;
    }

    socket
      .timeout(timeoutMs)
      .emit(event, payload ?? {}, (err, response) => {
        if (err) {
          const timeoutErr = new Error(`Request timed out for "${event}"`);
          timeoutErr.code = 'TIMEOUT';
          reject(timeoutErr);
          return;
        }
        if (response?.success === false) {
          const serverErr = new Error(
            response?.error?.message || `Socket event "${event}" failed`
          );
          serverErr.code = response?.error?.code || 'SOCKET_ERROR';
          reject(serverErr);
          return;
        }
        resolve(response?.data ?? response);
      });
  });
}

export function pingServer() {
  return emitWithAck('system:ping', {});
}

export function joinLobbySocket({ roomCode, playerId, identityToken, inviteToken }) {
  const payload = { roomCode, playerId, identityToken };
  if (typeof inviteToken === 'string' && inviteToken.trim()) {
    payload.inviteToken = inviteToken.trim();
  }
  return emitWithAck('lobby:join', payload);
}

export function leaveLobbySocket(reason = 'user_left') {
  return emitWithAck('lobby:leave', { reason });
}

export function startGameSocket() {
  return emitWithAck('game:start', {});
}

export function nextTurnSocket() {
  return emitWithAck('game:next_turn', {});
}
