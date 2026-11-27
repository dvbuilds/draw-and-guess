import { useCallback, useEffect } from 'react';
import { useGame } from './useGame.js';
import { usePlayer } from './usePlayer.js';
import { useRoom } from './useRoom.js';
import { useSocket } from './useSocket.js';

/**
 * Reusable lobby hook that connects the current guest player to the room's
 * Socket.IO lobby and exposes live roster, host permissions, and connection state.
 */
export function useLobby(roomCode, inviteToken) {
  const { hasIdentity, isRestoring } = usePlayer();
  const {
    status: socketStatus,
    isConnected: isSocketConnected,
    isReconnecting,
    reconnectAttempt,
    error: socketError,
    connect: connectSocket,
    disconnect: disconnectSocket,
  } = useSocket();
  const {
    room,
    players,
    hostPlayer,
    isHost,
    connectedPlayersCount,
    lobbyStatus,
    joinedRoomCode,
    activityLog,
    error: lobbyError,
    connectToLobby,
    leaveLobby,
    clearError,
  } = useRoom();
  const {
    status: gameStatus,
    gameState,
    isStartingGame,
    startGame: startGameBase,
    error: gameError,
  } = useGame();

  const normalizedCode = (roomCode || '').trim().toUpperCase();

  useEffect(() => {
    if (!normalizedCode || isRestoring || !hasIdentity || !isSocketConnected) {
      return;
    }
    const needsJoin =
      lobbyStatus === 'idle' ||
      (lobbyStatus === 'joined' && joinedRoomCode !== normalizedCode);
    if (needsJoin) {
      connectToLobby({ roomCode: normalizedCode, inviteToken }).catch(() => {});
    }
  }, [
    normalizedCode,
    inviteToken,
    isRestoring,
    hasIdentity,
    isSocketConnected,
    lobbyStatus,
    joinedRoomCode,
    connectToLobby,
  ]);

  const startGame = useCallback(async () => {
    if (
      normalizedCode &&
      (lobbyStatus !== 'joined' || joinedRoomCode !== normalizedCode)
    ) {
      await connectToLobby({ roomCode: normalizedCode, inviteToken });
    }
    try {
      return await startGameBase();
    } catch (err) {
      if (err?.code === 'NOT_IN_ROOM' && normalizedCode) {
        const joined = await connectToLobby({ roomCode: normalizedCode, inviteToken });
        if (joined) {
          return await startGameBase();
        }
      }
      throw err;
    }
  }, [normalizedCode, inviteToken, lobbyStatus, joinedRoomCode, connectToLobby, startGameBase]);

  const canStartGame =
    isHost &&
    isSocketConnected &&
    lobbyStatus === 'joined' &&
    joinedRoomCode === normalizedCode &&
    gameStatus === 'lobby' &&
    connectedPlayersCount >= 2 &&
    !isStartingGame;

  return {
    room,
    roomCode: normalizedCode,
    players,
    hostPlayer,
    isHost,
    connectedPlayersCount,
    lobbyStatus,
    socketStatus,
    isSocketConnected,
    isReconnecting,
    reconnectAttempt,
    socketError,
    gameStatus,
    gameStartedAt: gameState.startedAt,
    isStartingGame,
    canStartGame,
    activityLog,
    error: lobbyError || gameError,
    connectSocket,
    disconnectSocket,
    retryJoinLobby: () => connectToLobby({ roomCode: normalizedCode, inviteToken }),
    leaveLobby,
    startGame,
    clearError,
  };
}
