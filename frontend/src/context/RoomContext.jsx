import { createContext, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { usePlayer } from '../hooks/usePlayer.js';
import { useSocket } from '../hooks/useSocket.js';
import {
  createRoom as createRoomApi,
  joinRoom as joinRoomApi,
} from '../services/roomService.js';
import {
  banPlayerSocket,
  castVoteKickSocket,
  joinLobbySocket,
  kickPlayerSocket,
  leaveLobbySocket,
  sendAnnouncementSocket,
  sendChatMessageSocket,
  startVoteKickSocket,
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
  const [joinedRoomCode, setJoinedRoomCode] = useState(null);
  const [syncedGameState, setSyncedGameState] = useState(null);
  const [activityLog, setActivityLog] = useState([]);
  const [chatMessages, setChatMessages] = useState([]);
  const [isSendingChat, setIsSendingChat] = useState(false);
  const [chatError, setChatError] = useState(null);
  const [announcements, setAnnouncements] = useState([]);
  const [latestAnnouncement, setLatestAnnouncement] = useState(null);
  const [activeVoteKick, setActiveVoteKick] = useState(null);
  const [lastVoteKickResult, setLastVoteKickResult] = useState(null);
  const [removedState, setRemovedState] = useState(null);
  const [moderationBusy, setModerationBusy] = useState(false);
  const [moderationError, setModerationError] = useState(null);
  const [voteKickBusy, setVoteKickBusy] = useState(false);
  const [voteKickError, setVoteKickError] = useState(null);
  const [announcementBusy, setAnnouncementBusy] = useState(false);
  const [announcementError, setAnnouncementError] = useState(null);
  const [error, setError] = useState(null);

  const activeLobbyRef = useRef({ roomCode: null, inviteToken: null });
  const joinInFlightRef = useRef(false);
  const pendingReconnectRef = useRef(null);

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
      pendingReconnectRef.current = null;
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
      setJoinedRoomCode(null);
      setSyncedGameState(null);
      setActivityLog([]);
      setChatMessages([]);
      setChatError(null);
      setAnnouncements([]);
      setLatestAnnouncement(null);
      setActiveVoteKick(null);
      setLastVoteKickResult(null);
      setRemovedState(null);
      setModerationError(null);
      setVoteKickError(null);
      setAnnouncementError(null);
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
      pendingReconnectRef.current = null;
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
      setJoinedRoomCode(null);
      setSyncedGameState(null);
      setActivityLog([]);
      setChatMessages([]);
      setChatError(null);
      setAnnouncements([]);
      setLatestAnnouncement(null);
      setActiveVoteKick(null);
      setLastVoteKickResult(null);
      setRemovedState(null);
      setModerationError(null);
      setVoteKickError(null);
      setAnnouncementError(null);
      return joined;
    },
    [playerId, identityToken, persistRoom, socket]
  );

  const connectToLobby = useCallback(
    async ({ roomCode, inviteToken } = {}) => {
      const targetCode = (roomCode || room?.roomCode || '').trim().toUpperCase();
      const targetToken = inviteToken ?? room?.inviteToken ?? '';

      if (!targetCode || !playerId || !identityToken || !socket.connected) {
        return null;
      }
      if (joinInFlightRef.current) return null;

      joinInFlightRef.current = true;
      const previousCode = activeLobbyRef.current.roomCode;
      activeLobbyRef.current = { roomCode: targetCode, inviteToken: targetToken };
      setLobbyStatus('joining');
      setJoinedRoomCode(null);
      setError(null);

      try {
        if (previousCode && previousCode !== targetCode && socket.connected) {
          await leaveLobbySocket('switched_room').catch(() => {});
        }

        const result = await joinLobbySocket({
          roomCode: targetCode,
          playerId,
          identityToken,
          inviteToken: targetToken,
        });

        setPlayers(deduplicatePlayers(result.players));
        setSyncedGameState(result.gameState ?? null);
        setJoinedRoomCode(result?.roomCode || targetCode);
        setLobbyStatus('joined');

        if (result.reconnected) {
          appendActivity('reconnect', 'Reconnected to the lobby.');
        }

        return result;
      } catch (err) {
        if (pendingReconnectRef.current?.roomCode !== targetCode) {
          activeLobbyRef.current = { roomCode: null, inviteToken: null };
        }
        setJoinedRoomCode(null);
        setLobbyStatus('error');
        setError({
          code: err?.code || 'LOBBY_JOIN_FAILED',
          message: err?.message || 'Unable to connect to room lobby',
        });
        throw err;
      } finally {
        joinInFlightRef.current = false;
        const pendingReconnect = pendingReconnectRef.current;
        pendingReconnectRef.current = null;
        if (pendingReconnect
            && socket.connected
            && activeLobbyRef.current.roomCode === pendingReconnect.roomCode) {
          Promise.resolve().then(() => connectToLobby(pendingReconnect)).catch(() => {});
        }
      }
    },
    [room, playerId, identityToken, socket, appendActivity]
  );

  const leaveLobby = useCallback(
    async (reason = 'user_left') => {
      pendingReconnectRef.current = null;
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
        setJoinedRoomCode(null);
        setSyncedGameState(null);
        setActivityLog([]);
        setChatMessages([]);
        setChatError(null);
        setAnnouncements([]);
        setLatestAnnouncement(null);
        setActiveVoteKick(null);
        setLastVoteKickResult(null);
        setRemovedState(null);
        setModerationError(null);
        setVoteKickError(null);
        setAnnouncementError(null);
        setError(null);
      }
    },
    [socket]
  );

  const clearRoomState = useCallback(() => {
    pendingReconnectRef.current = null;
    activeLobbyRef.current = { roomCode: null, inviteToken: null };
    clearStoredRoomSession();
    setRoom(null);
    setPlayers([]);
    setLobbyStatus('idle');
    setJoinedRoomCode(null);
    setSyncedGameState(null);
    setActivityLog([]);
    setChatMessages([]);
    setChatError(null);
    setAnnouncements([]);
    setLatestAnnouncement(null);
    setActiveVoteKick(null);
    setLastVoteKickResult(null);
    setRemovedState(null);
    setModerationError(null);
    setVoteKickError(null);
    setAnnouncementError(null);
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

  const kickPlayer = useCallback(async (targetPlayerId) => {
    setModerationBusy(true);
    setModerationError(null);
    try {
      return await kickPlayerSocket(targetPlayerId);
    } catch (err) {
      const normalized = {
        code: err?.code || 'KICK_FAILED',
        message: err?.message || 'Unable to kick player',
      };
      setModerationError(normalized);
      throw normalized;
    } finally {
      setModerationBusy(false);
    }
  }, []);

  const banPlayer = useCallback(async (targetPlayerId) => {
    setModerationBusy(true);
    setModerationError(null);
    try {
      return await banPlayerSocket(targetPlayerId);
    } catch (err) {
      const normalized = {
        code: err?.code || 'BAN_FAILED',
        message: err?.message || 'Unable to ban player',
      };
      setModerationError(normalized);
      throw normalized;
    } finally {
      setModerationBusy(false);
    }
  }, []);

  const startVoteKick = useCallback(async (targetPlayerId) => {
    setVoteKickBusy(true);
    setVoteKickError(null);
    try {
      return await startVoteKickSocket(targetPlayerId);
    } catch (err) {
      const normalized = {
        code: err?.code || 'VOTE_KICK_FAILED',
        message: err?.message || 'Unable to start vote kick',
      };
      setVoteKickError(normalized);
      throw normalized;
    } finally {
      setVoteKickBusy(false);
    }
  }, []);

  const castVoteKick = useCallback(async (yes) => {
    setVoteKickBusy(true);
    setVoteKickError(null);
    try {
      const result = await castVoteKickSocket(yes);
      setActiveVoteKick((prev) =>
        prev ? { ...prev, hasVoted: true, myVote: Boolean(yes) } : prev
      );
      return result;
    } catch (err) {
      const normalized = {
        code: err?.code || 'VOTE_CAST_FAILED',
        message: err?.message || 'Unable to submit vote',
      };
      setVoteKickError(normalized);
      throw normalized;
    } finally {
      setVoteKickBusy(false);
    }
  }, []);

  const sendAnnouncement = useCallback(async (message) => {
    setAnnouncementBusy(true);
    setAnnouncementError(null);
    try {
      return await sendAnnouncementSocket(message);
    } catch (err) {
      const normalized = {
        code: err?.code || 'ANNOUNCEMENT_FAILED',
        message: err?.message || 'Unable to broadcast announcement',
      };
      setAnnouncementError(normalized);
      throw normalized;
    } finally {
      setAnnouncementBusy(false);
    }
  }, []);

  const dismissAnnouncement = useCallback(() => setLatestAnnouncement(null), []);
  const dismissVoteKickResult = useCallback(() => setLastVoteKickResult(null), []);
  const clearModerationError = useCallback(() => setModerationError(null), []);
  const clearVoteKickError = useCallback(() => setVoteKickError(null), []);
  const clearAnnouncementError = useCallback(() => setAnnouncementError(null), []);
  const clearRemovedState = useCallback(() => setRemovedState(null), []);

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

    const handleRoomMembersUpdated = (event) => {
      if (Array.isArray(event?.players)) {
        setPlayers(deduplicatePlayers(event.players));
      }
      if (event?.hostTransferredTo?.displayName) {
        appendActivity('host', `Host role transferred to ${event.hostTransferredTo.displayName}`);
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

    const handleAnnouncement = (event) => {
      if (!event?.message) return;
      const entry = {
        id: `${event.sentAt || Date.now()}-${event.playerId || 'host'}-${Math.random().toString(36).slice(2, 6)}`,
        ...event,
      };
      setLatestAnnouncement(entry);
      setAnnouncements((prev) => [entry, ...prev].slice(0, 15));
      appendActivity('announcement', `Announcement from ${event.displayName || 'Host'}: ${event.message}`);
    };

    const handlePlayerKicked = (event) => {
      if (Array.isArray(event?.players)) {
        setPlayers(deduplicatePlayers(event.players));
      }
      if (event?.player?.displayName) {
        const label = event.source === 'vote_kick' ? 'via VoteKick' : 'by the host';
        appendActivity('leave', `${event.player.displayName} was removed ${label}`);
      }
      if (event?.hostTransferredTo?.displayName) {
        appendActivity(
          'host',
          `Host role transferred to ${event.hostTransferredTo.displayName}`
        );
      }
    };

    const handlePlayerBanned = (event) => {
      if (Array.isArray(event?.players)) {
        setPlayers(deduplicatePlayers(event.players));
      }
      if (event?.player?.displayName) {
        appendActivity('leave', `${event.player.displayName} was banned by the host`);
      }
      if (event?.hostTransferredTo?.displayName) {
        appendActivity(
          'host',
          `Host role transferred to ${event.hostTransferredTo.displayName}`
        );
      }
    };

    const handleModerationRemoved = (event) => {
      pendingReconnectRef.current = null;
      activeLobbyRef.current = { roomCode: null, inviteToken: null };
      clearStoredRoomSession();
      setRoom(null);
      setPlayers([]);
      setLobbyStatus('idle');
      setJoinedRoomCode(null);
      setActiveVoteKick(null);
      setRemovedState({
        roomCode: event?.roomCode || null,
        banned: Boolean(event?.banned),
        reason: event?.reason || (event?.banned ? 'banned_by_host' : 'kicked_by_host'),
      });
    };

    const handleVoteKickStarted = (event) => {
      if (!event?.targetPlayerId) return;
      setLastVoteKickResult(null);
      setVoteKickError(null);
      setActiveVoteKick({
        ...event,
        yesVotes: 0,
        noVotes: 0,
        votesCast: 0,
        hasVoted: false,
        myVote: null,
      });
      appendActivity(
        'votekick',
        `VoteKick started against ${event.targetDisplayName || 'a player'}`
      );
    };

    const handleVoteKickUpdated = (event) => {
      if (!event?.targetPlayerId) return;
      setActiveVoteKick((prev) => {
        if (!prev || prev.targetPlayerId !== event.targetPlayerId) return prev;
        return {
          ...prev,
          yesVotes: event.yesVotes ?? prev.yesVotes,
          noVotes: event.noVotes ?? prev.noVotes,
          votesCast: event.votesCast ?? prev.votesCast,
          requiredVotes: event.requiredVotes ?? prev.requiredVotes,
        };
      });
    };

    const handleVoteKickEnded = (event) => {
      if (!event?.targetPlayerId) return;
      setActiveVoteKick((prev) => {
        const targetDisplayName = prev?.targetDisplayName || 'player';
        setLastVoteKickResult({
          ...event,
          targetDisplayName,
          resolvedAt: new Date().toISOString(),
        });
        appendActivity(
          'votekick',
          `VoteKick for ${targetDisplayName} ${event.passed ? 'passed' : 'failed'}`
        );
        return null;
      });
    };

    socket.on('player_joined', handlePlayerJoined);
    socket.on('player_left', handlePlayerLeft);
    socket.on('room:members_updated', handleRoomMembersUpdated);
    socket.on('lobby_error', handleLobbyError);
    socket.on('chat:message', handleChatMessage);
    socket.on('room:announcement', handleAnnouncement);
    socket.on('player_kicked', handlePlayerKicked);
    socket.on('player_banned', handlePlayerBanned);
    socket.on('moderation:removed', handleModerationRemoved);
    socket.on('vote_kick:started', handleVoteKickStarted);
    socket.on('vote_kick:updated', handleVoteKickUpdated);
    socket.on('vote_kick:ended', handleVoteKickEnded);

    return () => {
      socket.off('player_joined', handlePlayerJoined);
      socket.off('player_left', handlePlayerLeft);
      socket.off('room:members_updated', handleRoomMembersUpdated);
      socket.off('lobby_error', handleLobbyError);
      socket.off('chat:message', handleChatMessage);
      socket.off('room:announcement', handleAnnouncement);
      socket.off('player_kicked', handlePlayerKicked);
      socket.off('player_banned', handlePlayerBanned);
      socket.off('moderation:removed', handleModerationRemoved);
      socket.off('vote_kick:started', handleVoteKickStarted);
      socket.off('vote_kick:updated', handleVoteKickUpdated);
      socket.off('vote_kick:ended', handleVoteKickEnded);
    };
  }, [socket, appendActivity]);

  // Automatically re-join active lobby whenever socket connects/reconnects
  useEffect(() => {
    const handleConnect = () => {
      const { roomCode, inviteToken } = activeLobbyRef.current;
      if (roomCode && playerId && identityToken) {
        if (joinInFlightRef.current) {
          pendingReconnectRef.current = { roomCode, inviteToken };
          return;
        }
        connectToLobby({ roomCode, inviteToken }).catch(() => {});
      }
    };

    const handleDisconnect = () => {
      setJoinedRoomCode(null);
      setLobbyStatus((prev) => (prev === 'joined' || prev === 'joining' ? 'idle' : prev));
    };

    socket.on('connect', handleConnect);
    socket.on('disconnect', handleDisconnect);
    return () => {
      socket.off('connect', handleConnect);
      socket.off('disconnect', handleDisconnect);
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
      joinedRoomCode,
      syncedGameState,
      socketStatus,
      isSocketConnected: isConnected,
      activityLog,
      chatMessages,
      isSendingChat,
      chatError,
      announcements,
      latestAnnouncement,
      activeVoteKick,
      lastVoteKickResult,
      removedState,
      moderationBusy,
      moderationError,
      voteKickBusy,
      voteKickError,
      announcementBusy,
      announcementError,
      error,
      createRoom,
      joinRoom,
      connectToLobby,
      leaveLobby,
      sendChatMessage,
      clearChatError,
      kickPlayer,
      banPlayer,
      startVoteKick,
      castVoteKick,
      sendAnnouncement,
      dismissAnnouncement,
      dismissVoteKickResult,
      clearModerationError,
      clearVoteKickError,
      clearAnnouncementError,
      clearRemovedState,
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
      joinedRoomCode,
      syncedGameState,
      socketStatus,
      isConnected,
      activityLog,
      chatMessages,
      isSendingChat,
      chatError,
      announcements,
      latestAnnouncement,
      activeVoteKick,
      lastVoteKickResult,
      removedState,
      moderationBusy,
      moderationError,
      voteKickBusy,
      voteKickError,
      announcementBusy,
      announcementError,
      error,
      createRoom,
      joinRoom,
      connectToLobby,
      leaveLobby,
      sendChatMessage,
      clearChatError,
      kickPlayer,
      banPlayer,
      startVoteKick,
      castVoteKick,
      sendAnnouncement,
      dismissAnnouncement,
      dismissVoteKickResult,
      clearModerationError,
      clearVoteKickError,
      clearAnnouncementError,
      clearRemovedState,
      syncPlayers,
      clearRoomState,
      clearError,
    ]
  );

  return <RoomContext.Provider value={value}>{children}</RoomContext.Provider>;
}
