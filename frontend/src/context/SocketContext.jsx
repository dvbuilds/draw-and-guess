import { createContext, useCallback, useEffect, useMemo, useState } from 'react';
import { emitWithAck, getSocket, pingServer } from '../services/socket.js';

export const SocketContext = createContext(null);

export function SocketProvider({ children, autoConnect = true }) {
  const socket = useMemo(() => getSocket(), []);
  const [status, setStatus] = useState(socket.connected ? 'connected' : 'disconnected');
  const [socketId, setSocketId] = useState(socket.id || null);
  const [reconnectAttempt, setReconnectAttempt] = useState(0);
  const [error, setError] = useState(null);

  useEffect(() => {
    const handleConnect = () => {
      setStatus('connected');
      setSocketId(socket.id || null);
      setReconnectAttempt(0);
      setError(null);
    };

    const handleDisconnect = (reason) => {
      setSocketId(null);
      // io client disconnect is intentional; transport/server disconnects will auto-reconnect
      if (reason === 'io client disconnect') {
        setStatus('disconnected');
      } else {
        setStatus('reconnecting');
      }
    };

    const handleConnectError = (err) => {
      setStatus('error');
      setSocketId(null);
      setError(err?.message || 'Socket connection failed');
    };

    const handleReconnectAttempt = (attempt) => {
      setStatus('reconnecting');
      setReconnectAttempt(attempt);
    };

    const handleReconnectFailed = () => {
      setStatus('error');
      setError('Unable to reconnect to the server');
    };

    socket.on('connect', handleConnect);
    socket.on('disconnect', handleDisconnect);
    socket.on('connect_error', handleConnectError);
    socket.io.on('reconnect_attempt', handleReconnectAttempt);
    socket.io.on('reconnect_failed', handleReconnectFailed);

    if (autoConnect && !socket.connected) {
      setStatus('connecting');
      socket.connect();
    }

    return () => {
      socket.off('connect', handleConnect);
      socket.off('disconnect', handleDisconnect);
      socket.off('connect_error', handleConnectError);
      socket.io.off('reconnect_attempt', handleReconnectAttempt);
      socket.io.off('reconnect_failed', handleReconnectFailed);
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
      isReconnecting: status === 'reconnecting',
      reconnectAttempt,
      socketId,
      error,
      connect,
      disconnect,
      emitWithAck,
      ping: pingServer,
    }),
    [socket, status, reconnectAttempt, socketId, error, connect, disconnect]
  );

  return <SocketContext.Provider value={value}>{children}</SocketContext.Provider>;
}
