import { createContext, useCallback, useEffect, useMemo, useState } from 'react';
import { emitWithAck, getSocket, pingServer } from '../services/socket.js';

export const SocketContext = createContext(null);

export function SocketProvider({ children, autoConnect = true }) {
  const socket = useMemo(() => getSocket(), []);
  const [status, setStatus] = useState(socket.connected ? 'connected' : 'disconnected');
  const [socketId, setSocketId] = useState(socket.id || null);
  const [error, setError] = useState(null);

  useEffect(() => {
    const handleConnect = () => {
      setStatus('connected');
      setSocketId(socket.id || null);
      setError(null);
    };

    const handleDisconnect = () => {
      setStatus('disconnected');
      setSocketId(null);
    };

    const handleConnectError = (err) => {
      setStatus('error');
      setSocketId(null);
      setError(err?.message || 'Socket connection failed');
    };

    socket.on('connect', handleConnect);
    socket.on('disconnect', handleDisconnect);
    socket.on('connect_error', handleConnectError);

    if (autoConnect && !socket.connected) {
      setStatus('connecting');
      socket.connect();
    }

    return () => {
      socket.off('connect', handleConnect);
      socket.off('disconnect', handleDisconnect);
      socket.off('connect_error', handleConnectError);
    };
  }, [socket, autoConnect]);

  const connect = useCallback(() => {
    if (!socket.connected) {
      setStatus('connecting');
      setError(null);
      socket.connect();
    }
  }, [socket]);

  const disconnect = useCallback(() => {
    if (socket.connected) {
      socket.disconnect();
    }
  }, [socket]);

  const value = useMemo(
    () => ({
      socket,
      status,
      isConnected: status === 'connected',
      socketId,
      error,
      connect,
      disconnect,
      emitWithAck,
      ping: pingServer,
    }),
    [socket, status, socketId, error, connect, disconnect]
  );

  return <SocketContext.Provider value={value}>{children}</SocketContext.Provider>;
}
