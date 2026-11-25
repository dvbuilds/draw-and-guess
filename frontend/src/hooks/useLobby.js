import { useEffect } from 'react';
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
    startGame,
    error: gameError,
  } = useGame();

  const normalizedCode = (roomCode || '').trim().toUpperCase();

  useEffect(() => {
    if (!normalizedCode || isRestoring || !hasIdentity || !isSocketConnected) {
      return;
    }
    if (lobbyStatus === 'idle') {
      connectToLobby({ roomCode: normalizedCode, inviteToken }).catch(() => {});
    }
  }, [
    normalizedCode,
    inviteToken,
    isRestoring,
    hasIdentity,
    isSocketConnected,
    lobbyStatus,
    connectToLobby,
  ]);

  const canStartGame =
    isHost &&
    isSocketConnected &&
    lobbyStatus === 'joined' &&
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
