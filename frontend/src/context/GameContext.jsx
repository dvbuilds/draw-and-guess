import { createContext, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { usePlayer } from '../hooks/usePlayer.js';
import { useRoom } from '../hooks/useRoom.js';
import { useSocket } from '../hooks/useSocket.js';
import { nextTurnSocket, startGameSocket } from '../services/socket.js';

export const GameContext = createContext(null);

const INITIAL_GAME_STATE = {
  status: 'lobby', // lobby | started | completed
  currentRound: null,
  currentTurn: null,
  totalRounds: null,
  currentDrawerPlayerId: null,
  startedAt: null,
  completedAt: null,
  completionReason: null,
  lastTurnReason: null,
};

function createLogEntry(type, message) {
  return {
    id: `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
    type,
    message,
    timestamp: new Date().toISOString(),
  };
}

export function GameProvider({ children }) {
  const { playerId } = usePlayer();
  const { socket, isConnected } = useSocket();
  const { roomCode, players, syncedGameState, syncPlayers } = useRoom();

  const [gameState, setGameState] = useState(INITIAL_GAME_STATE);
  const [gameLog, setGameLog] = useState([]);
  const [isStartingGame, setIsStartingGame] = useState(false);
  const [isAdvancingTurn, setIsAdvancingTurn] = useState(false);
  const [error, setError] = useState(null);

  const lastLogKeyRef = useRef(null);
  const previousRoomCodeRef = useRef(roomCode);

  const appendLog = useCallback((dedupeKey, type, message) => {
    if (dedupeKey && lastLogKeyRef.current === dedupeKey) return;
    if (dedupeKey) lastLogKeyRef.current = dedupeKey;
    setGameLog((prev) => [createLogEntry(type, message), ...prev].slice(0, 20));
  }, []);

  const resetGameState = useCallback(() => {
    setGameState(INITIAL_GAME_STATE);
    setGameLog([]);
    setError(null);
    lastLogKeyRef.current = null;
  }, []);

  // Reset game state whenever the active room changes or is cleared
  useEffect(() => {
    if (previousRoomCodeRef.current !== roomCode) {
      previousRoomCodeRef.current = roomCode;
      resetGameState();
    }
  }, [roomCode, resetGameState]);

  // Hydrate game state returned by lobby:join ack (e.g., on reconnect or page reload)
  useEffect(() => {
    if (!syncedGameState) return;
    setGameState((prev) => ({
      ...prev,
      status: syncedGameState.status || prev.status,
      currentRound: syncedGameState.currentRound ?? prev.currentRound,
      currentTurn: syncedGameState.currentTurn ?? prev.currentTurn,
      totalRounds: syncedGameState.totalRounds ?? prev.totalRounds,
      currentDrawerPlayerId:
        syncedGameState.currentDrawerPlayerId ?? prev.currentDrawerPlayerId,
    }));
  }, [syncedGameState]);

  const applyGameStart = useCallback(
    (payload) => {
      if (!payload) return;
      if (Array.isArray(payload.players)) {
        syncPlayers(payload.players);
      }
      setGameState({
        status: payload.status || 'started',
        currentRound: payload.currentRound ?? 1,
        currentTurn: payload.currentTurn ?? 1,
        totalRounds: payload.totalRounds ?? null,
        currentDrawerPlayerId: payload.currentDrawerPlayerId ?? null,
        startedAt: payload.startedAt || new Date().toISOString(),
        completedAt: null,
        completionReason: null,
        lastTurnReason: 'game_started',
      });
      setError(null);
      appendLog(
        `start:${payload.startedAt || ''}`,
        'start',
        `Game started · Round ${payload.currentRound ?? 1} of ${payload.totalRounds ?? '?'}`
      );
    },
    [syncPlayers, appendLog]
  );

  const applyGameTurn = useCallback(
    (payload) => {
      if (!payload) return;
      if (Array.isArray(payload.players)) {
        syncPlayers(payload.players);
      }
      setGameState((prev) => ({
        ...prev,
        status: 'started',
        currentRound: payload.currentRound ?? prev.currentRound,
        currentTurn: payload.currentTurn ?? prev.currentTurn,
        totalRounds: payload.totalRounds ?? prev.totalRounds,
        currentDrawerPlayerId: payload.currentDrawerPlayerId ?? null,
        lastTurnReason: payload.reason || null,
      }));
      setError(null);

      const drawerName =
        (payload.players || players).find(
          (p) => p.playerId === payload.currentDrawerPlayerId
        )?.displayName || 'Next player';

      appendLog(
        `turn:${payload.currentRound}:${payload.currentTurn}:${payload.currentDrawerPlayerId}`,
        'turn',
        `Round ${payload.currentRound}, Turn ${payload.currentTurn}: ${drawerName} is drawing`
      );
    },
    [syncPlayers, players, appendLog]
  );

  const applyGameComplete = useCallback(
    (payload) => {
      if (!payload) return;
      const nextState = payload.gameState || payload;
      if (Array.isArray(nextState.players)) {
        syncPlayers(nextState.players);
      }
      setGameState((prev) => ({
        ...prev,
        status: 'completed',
        currentRound: nextState.currentRound ?? prev.currentRound,
        currentTurn: nextState.currentTurn ?? prev.currentTurn,
        totalRounds: nextState.totalRounds ?? prev.totalRounds,
        currentDrawerPlayerId: nextState.currentDrawerPlayerId ?? null,
        completedAt: payload.completedAt || new Date().toISOString(),
        completionReason: payload.reason || 'rounds_complete',
      }));
      setError(null);
      appendLog(
        `complete:${payload.completedAt || ''}`,
        'complete',
        `Game completed (${payload.reason === 'no_connected_players' ? 'no connected players' : 'all rounds finished'})`
      );
    },
    [syncPlayers, appendLog]
  );

  // Subscribe to backend game initialization & turn Socket.IO broadcasts
  useEffect(() => {
    const handleGameStart = (event) => {
      applyGameStart(event);
    };

    const handleRoundStarted = (event) => {
      if (!event) return;
      setGameState((prev) => ({
        ...prev,
        currentRound: event.currentRound ?? prev.currentRound,
        totalRounds: event.totalRounds ?? prev.totalRounds,
        currentDrawerPlayerId:
          event.currentDrawerPlayerId ?? prev.currentDrawerPlayerId,
      }));
      appendLog(
        `round:${event.currentRound}`,
        'round',
        `Round ${event.currentRound} of ${event.totalRounds} started`
      );
    };

    const handleGameTurn = (event) => {
      applyGameTurn(event);
    };

    const handleGameComplete = (event) => {
      applyGameComplete(event);
    };

    socket.on('game_start', handleGameStart);
    socket.on('round_started', handleRoundStarted);
    socket.on('game_turn', handleGameTurn);
    socket.on('game_complete', handleGameComplete);

    return () => {
      socket.off('game_start', handleGameStart);
      socket.off('round_started', handleRoundStarted);
      socket.off('game_turn', handleGameTurn);
      socket.off('game_complete', handleGameComplete);
    };
  }, [socket, applyGameStart, applyGameTurn, applyGameComplete, appendLog]);

  const startGame = useCallback(async () => {
    setIsStartingGame(true);
    setError(null);
    try {
      const result = await startGameSocket();
      applyGameStart(result);
      return result;
    } catch (err) {
      const normalized = {
        code: err?.code || 'GAME_START_FAILED',
        message: err?.message || 'Unable to start the game',
      };
      setError(normalized);
      throw normalized;
    } finally {
      setIsStartingGame(false);
    }
  }, [applyGameStart]);

  const advanceTurn = useCallback(async () => {
    setIsAdvancingTurn(true);
    setError(null);
    try {
      const result = await nextTurnSocket();
      if (result?.gameState?.status === 'completed') {
        applyGameComplete(result);
      } else {
        applyGameTurn(result);
      }
      return result;
    } catch (err) {
      const normalized = {
        code: err?.code || 'NEXT_TURN_FAILED',
        message: err?.message || 'Unable to advance turn',
      };
      setError(normalized);
      throw normalized;
    } finally {
      setIsAdvancingTurn(false);
    }
  }, [applyGameTurn, applyGameComplete]);

  const clearError = useCallback(() => {
    setError(null);
  }, []);

  const currentDrawer = useMemo(
    () =>
      players.find((p) => p.playerId === gameState.currentDrawerPlayerId) || null,
    [players, gameState.currentDrawerPlayerId]
  );

  const isCurrentDrawer = Boolean(
    playerId &&
      gameState.currentDrawerPlayerId &&
      playerId === gameState.currentDrawerPlayerId
  );

  const value = useMemo(
    () => ({
      gameState,
      status: gameState.status,
      currentRound: gameState.currentRound,
      currentTurn: gameState.currentTurn,
      totalRounds: gameState.totalRounds,
      currentDrawerPlayerId: gameState.currentDrawerPlayerId,
      currentDrawer,
      isCurrentDrawer,
      isSocketConnected: isConnected,
      isStartingGame,
      isAdvancingTurn,
      gameLog,
      error,
      startGame,
      advanceTurn,
      resetGameState,
      clearError,
    }),
    [
      gameState,
      currentDrawer,
      isCurrentDrawer,
      isConnected,
      isStartingGame,
      isAdvancingTurn,
      gameLog,
      error,
      startGame,
      advanceTurn,
      resetGameState,
      clearError,
    ]
  );

  return <GameContext.Provider value={value}>{children}</GameContext.Provider>;
}
