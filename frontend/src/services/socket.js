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
      reconnectionAttempts: 5,
      reconnectionDelay: 1000,
    });
  }
  return socketInstance;
}

/**
 * Emits a Socket.IO event following the backend ack contract:
 * { success: true, data } | { success: false, error }
 */
export function emitWithAck(event, payload, timeoutMs = 5000) {
  const socket = getSocket();

  return new Promise((resolve, reject) => {
    if (!socket.connected) {
      reject(new Error('Socket is not connected'));
      return;
    }

    const args = payload !== undefined ? [payload] : [];

    socket
      .timeout(timeoutMs)
      .emit(event, ...args, (err, response) => {
        if (err) {
          reject(new Error(`Socket ack timeout for event "${event}"`));
          return;
        }
        if (response?.success === false) {
          reject(new Error(response?.error?.message || `Socket event "${event}" failed`));
          return;
        }
        resolve(response?.data ?? response);
      });
  });
}

export function pingServer() {
  return emitWithAck('system:ping');
}
