import { createContext, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { usePlayer } from '../hooks/usePlayer.js';
import { useSocket } from '../hooks/useSocket.js';
import {
  createRoom as createRoomApi,
  joinRoom as joinRoomApi,
} from '../services/roomService.js';
import {
  joinLobbySocket,
  leaveLobbySocket,
  sendChatMessageSocket,
} from '../services/socket.js';
import {
  clearStoredRoomSession,
  loadStoredRoomSession,
  saveStoredRoomSession,
} from '../utils/roomStorage.js';

export const RoomContext = createContext(null);

function deduplicatePlayers(list = []) {
  const seen = new Set();
  const result = [];
  for (const item of list) {
    if (!item?.playerId || seen.has(item.playerId)) continue;
    seen.add(item.playerId);
    result.push({
      playerId: item.playerId,
      displayName: item.displayName,
      role: item.role || 'player',
      isConnected: Boolean(item.isConnected),
    });
  }
  return result;
}

function createActivityEntry(type, message) {
  return {
    id: `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
    type,
    message,
    timestamp: new Date().toISOString(),
  };
}

export function RoomProvider({ children }) {
  const { playerId, identityToken } = usePlayer();
  const { socket, isConnected, status: socketStatus } = useSocket();

  const initialStored = useMemo(() => loadStoredRoomSession(), []);

  const [room, setRoom] = useState(initialStored);
  const [players, setPlayers] = useState([]);
  const [lobbyStatus, setLobbyStatus] = useState('idle'); // idle | joining | joined | error
  const [syncedGameState, setSyncedGameState] = useState(null);
  const [activityLog, setActivityLog] = useState([]);
  const [chatMessages, setChatMessages] = useState([]);
  const [isSendingChat, setIsSendingChat] = useState(false);
  const [chatError, setChatError] = useState(null);
  const [error, setError] = useState(null);

  const activeLobbyRef = useRef({ roomCode: null, inviteToken: null });
  const joinInFlightRef = useRef(false);

  const syncPlayers = useCallback((nextPlayers) => {
    if (Array.isArray(nextPlayers)) {
      setPlayers(deduplicatePlayers(nextPlayers));
    }
  }, []);

  const appendActivity = useCallback((type, message) => {
    setActivityLog((prev) => [createActivityEntry(type, message), ...prev].slice(0, 20));
  }, []);

  const persistRoom = useCallback((nextRoom, inviteTokenOverride) => {
    if (!nextRoom) {
      clearStoredRoomSession();
      setRoom(null);
      return;
    }
    const merged = {
      ...nextRoom,
      ...(inviteTokenOverride ? { inviteToken: inviteTokenOverride } : {}),
    };
    setRoom(merged);
    saveStoredRoomSession(merged);
  }, []);

  const createRoom = useCallback(
    async ({ isPublic, settings }) => {
      setError(null);
      if (activeLobbyRef.current.roomCode && socket.connected) {
        await leaveLobbySocket('switched_room').catch(() => {});
      }
      activeLobbyRef.current = { roomCode: null, inviteToken: null };
      const created = await createRoomApi({
        playerId,
        identityToken,
        isPublic,
        settings,
      });
      persistRoom(created, created.inviteToken);
      setPlayers(
        (created.members || []).map((m) => ({
          playerId: m.playerId,
          displayName: m.displayName,
          role: m.role,
          isConnected: false,
        }))
      );
      setLobbyStatus('idle');
      setSyncedGameState(null);
      setActivityLog([]);
      setChatMessages([]);
      setChatError(null);
      return created;
    },
    [playerId, identityToken, persistRoom, socket]
  );

  const joinRoom = useCallback(
    async ({ roomCode, inviteToken }) => {
      setError(null);
      if (activeLobbyRef.current.roomCode && socket.connected) {
        await leaveLobbySocket('switched_room').catch(() => {});
      }
      activeLobbyRef.current = { roomCode: null, inviteToken: null };
      const joined = await joinRoomApi({
        playerId,
        identityToken,
        roomCode,
        inviteToken,
      });
      persistRoom(joined, inviteToken);
      setPlayers(
        (joined.members || []).map((m) => ({
          playerId: m.playerId,
          displayName: m.displayName,
          role: m.role,
          isConnected: false,
        }))
      );
      setLobbyStatus('idle');
      setSyncedGameState(null);
      setActivityLog([]);
      setChatMessages([]);
      setChatError(null);
      return joined;
    },
    [playerId, identityToken, persistRoom, socket]
  );

  const connectToLobby = useCallback(
    async ({ roomCode, inviteToken } = {}) => {
      const targetCode = (roomCode || room?.roomCode || '').trim().toUpperCase();
      const targetToken = inviteToken ?? room?.inviteToken ?? '';

      if (!targetCode || !playerId || !identityToken || !isConnected) {
        return null;
      }
      if (joinInFlightRef.current) return null;

      joinInFlightRef.current = true;
      activeLobbyRef.current = { roomCode: targetCode, inviteToken: targetToken };
      setLobbyStatus('joining');
      setError(null);

      try {
        const result = await joinLobbySocket({
          roomCode: targetCode,
          playerId,
          identityToken,
          inviteToken: targetToken,
        });

        setPlayers(deduplicatePlayers(result.players));
        setSyncedGameState(result.gameState ?? null);
        setLobbyStatus('joined');

        if (result.reconnected) {
          appendActivity('reconnect', 'Reconnected to the lobby.');
        }

        return result;
      } catch (err) {
        setLobbyStatus('error');
        setError({
          code: err?.code || 'LOBBY_JOIN_FAILED',
          message: err?.message || 'Unable to connect to room lobby',
        });
        throw err;
      } finally {
        joinInFlightRef.current = false;
      }
    },
    [room, playerId, identityToken, isConnected, appendActivity]
  );

  const leaveLobby = useCallback(
    async (reason = 'user_left') => {
      activeLobbyRef.current = { roomCode: null, inviteToken: null };
      try {
        if (socket.connected) {
          await leaveLobbySocket(reason);
        }
      } catch {
        // Proceed with local cleanup even if socket already dropped
      } finally {
        clearStoredRoomSession();
        setRoom(null);
        setPlayers([]);
        setLobbyStatus('idle');
        setSyncedGameState(null);
        setActivityLog([]);
        setChatMessages([]);
        setChatError(null);
        setError(null);
      }
    },
    [socket]
  );

  const clearRoomState = useCallback(() => {
    activeLobbyRef.current = { roomCode: null, inviteToken: null };
    clearStoredRoomSession();
    setRoom(null);
    setPlayers([]);
    setLobbyStatus('idle');
    setSyncedGameState(null);
    setActivityLog([]);
    setChatMessages([]);
    setChatError(null);
    setError(null);
  }, []);

  const sendChatMessage = useCallback(async (rawMessage) => {
    setIsSendingChat(true);
    setChatError(null);
    try {
      return await sendChatMessageSocket(rawMessage);
    } catch (err) {
      const normalized = {
        code: err?.code || 'CHAT_SEND_FAILED',
        message: err?.message || 'Unable to send chat message',
      };
      setChatError(normalized);
      throw normalized;
    } finally {
      setIsSendingChat(false);
    }
  }, []);

  const clearChatError = useCallback(() => {
    setChatError(null);
  }, []);

  const clearError = useCallback(() => {
    setError(null);
  }, []);

  // Subscribe to backend lobby broadcast events
  useEffect(() => {
    const handlePlayerJoined = (event) => {
      if (Array.isArray(event?.players)) {
        setPlayers(deduplicatePlayers(event.players));
      }
      if (event?.player?.displayName) {
        const verb = event.reconnected ? 'reconnected to' : 'joined';
        appendActivity(
          event.reconnected ? 'reconnect' : 'join',
          `${event.player.displayName} ${verb} the lobby`
        );
      }
    };

    const handlePlayerLeft = (event) => {
      if (Array.isArray(event?.players)) {
        setPlayers(deduplicatePlayers(event.players));
      }
      if (event?.player?.displayName) {
        const msg = event.unexpected
          ? `${event.player.displayName} disconnected`
          : `${event.player.displayName} left the room`;
        appendActivity(event.unexpected ? 'disconnect' : 'leave', msg);
      }
      if (event?.hostTransferredTo?.displayName) {
        appendActivity(
          'host',
          `Host role transferred to ${event.hostTransferredTo.displayName}`
        );
      }
    };

    const handleLobbyError = (err) => {
      setError({
        code: err?.code || 'LOBBY_ERROR',
        message: err?.message || 'Lobby error occurred',
      });
    };

    const handleChatMessage = (event) => {
      if (!event?.message) return;
      setChatMessages((prev) => [
        ...prev,
        {
          id: `${event.sentAt || Date.now()}-${event.playerId}-${Math.random().toString(36).slice(2, 6)}`,
          ...event,
        },
      ].slice(-100));
    };

    socket.on('player_joined', handlePlayerJoined);
    socket.on('player_left', handlePlayerLeft);
    socket.on('lobby_error', handleLobbyError);
    socket.on('chat:message', handleChatMessage);

    return () => {
      socket.off('player_joined', handlePlayerJoined);
      socket.off('player_left', handlePlayerLeft);
      socket.off('lobby_error', handleLobbyError);
      socket.off('chat:message', handleChatMessage);
    };
  }, [socket, appendActivity]);

  // Automatically re-join active lobby whenever socket connects/reconnects
  useEffect(() => {
    const handleConnect = () => {
      const { roomCode, inviteToken } = activeLobbyRef.current;
      if (roomCode && playerId && identityToken) {
        connectToLobby({ roomCode, inviteToken }).catch(() => {});
      }
    };

    socket.on('connect', handleConnect);
    return () => {
      socket.off('connect', handleConnect);
    };
  }, [socket, playerId, identityToken, connectToLobby]);

  const hostPlayer = useMemo(
    () => players.find((p) => p.role === 'host') || null,
    [players]
  );

  const isHost = Boolean(
    playerId &&
      ((hostPlayer && hostPlayer.playerId === playerId) ||
        (!hostPlayer && room?.hostPlayerId === playerId))
  );

  const connectedPlayersCount = useMemo(
    () => players.filter((p) => p.isConnected).length,
    [players]
  );

  const value = useMemo(
    () => ({
      room,
      roomCode: room?.roomCode || null,
      players,
      hostPlayer,
      isHost,
      connectedPlayersCount,
      lobbyStatus,
      syncedGameState,
      socketStatus,
      isSocketConnected: isConnected,
      activityLog,
      chatMessages,
      isSendingChat,
      chatError,
      error,
      createRoom,
      joinRoom,
      connectToLobby,
      leaveLobby,
      sendChatMessage,
      clearChatError,
      syncPlayers,
      clearRoomState,
      clearError,
    }),
    [
      room,
      players,
      hostPlayer,
      isHost,
      connectedPlayersCount,
      lobbyStatus,
      syncedGameState,
      socketStatus,
      isConnected,
      activityLog,
      chatMessages,
      isSendingChat,
      chatError,
      error,
      createRoom,
      joinRoom,
      connectToLobby,
      leaveLobby,
      sendChatMessage,
      clearChatError,
      syncPlayers,
      clearRoomState,
      clearError,
    ]
  );

  return <RoomContext.Provider value={value}>{children}</RoomContext.Provider>;
}
