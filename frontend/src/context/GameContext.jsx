import { createContext, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { usePlayer } from '../hooks/usePlayer.js';
import { useRoom } from '../hooks/useRoom.js';
import { useSocket } from '../hooks/useSocket.js';
import {
  nextTurnSocket,
  selectWordSocket,
  startGameSocket,
} from '../services/socket.js';

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

const INITIAL_WORD_STATE = {
  phase: 'idle', // idle | choosing | selected
  options: [], // drawer-only word choices
  assignedWord: null, // drawer-only { wordId, word, category, wordLength, pattern }
  publicWord: null, // non-drawer { drawerPlayerId, wordLength, pattern, safeHints, wordMode }
};

function createLogEntry(type, message) {
  return {
    id: `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
    type,
    message,
    timestamp: new Date().toISOString(),
  };
}

function turnKeyOf(round, turn, drawerId) {
  if (round == null || turn == null || !drawerId) return null;
  return `${round}:${turn}:${drawerId}`;
}

export function GameProvider({ children }) {
  const { playerId } = usePlayer();
  const { socket, isConnected } = useSocket();
  const { roomCode, players, syncedGameState, syncPlayers } = useRoom();

  const [gameState, setGameState] = useState(INITIAL_GAME_STATE);
  const [wordState, setWordState] = useState(INITIAL_WORD_STATE);
  const [gameLog, setGameLog] = useState([]);
  const [isStartingGame, setIsStartingGame] = useState(false);
  const [isAdvancingTurn, setIsAdvancingTurn] = useState(false);
  const [isSelectingWord, setIsSelectingWord] = useState(false);
  const [error, setError] = useState(null);

  const lastLogKeyRef = useRef(null);
  const currentTurnKeyRef = useRef(null);
  const previousRoomCodeRef = useRef(roomCode);

  const appendLog = useCallback((dedupeKey, type, message) => {
    if (dedupeKey && lastLogKeyRef.current === dedupeKey) return;
    if (dedupeKey) lastLogKeyRef.current = dedupeKey;
    setGameLog((prev) => [createLogEntry(type, message), ...prev].slice(0, 20));
  }, []);

  const resetGameState = useCallback(() => {
    setGameState(INITIAL_GAME_STATE);
    setWordState(INITIAL_WORD_STATE);
    setGameLog([]);
    setError(null);
    lastLogKeyRef.current = null;
    currentTurnKeyRef.current = null;
  }, []);

  useEffect(() => {
    if (previousRoomCodeRef.current !== roomCode) {
      previousRoomCodeRef.current = roomCode;
      resetGameState();
    }
  }, [roomCode, resetGameState]);

  // Hydrate game state returned by lobby:join ack (e.g., on reconnect or page reload)
  useEffect(() => {
    if (!syncedGameState) return;
    const nextKey = turnKeyOf(
      syncedGameState.currentRound,
      syncedGameState.currentTurn,
      syncedGameState.currentDrawerPlayerId
    );
    if (nextKey && nextKey !== currentTurnKeyRef.current) {
      currentTurnKeyRef.current = nextKey;
      setWordState(INITIAL_WORD_STATE);
    }
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
      const round = payload.currentRound ?? 1;
      const turn = payload.currentTurn ?? 1;
      const drawerId = payload.currentDrawerPlayerId ?? null;
      const nextKey = turnKeyOf(round, turn, drawerId);

      // Only reset word state when entering a new turn (prevents ack wiping word_options)
      if (nextKey !== currentTurnKeyRef.current) {
        currentTurnKeyRef.current = nextKey;
        setWordState(INITIAL_WORD_STATE);
      }

      setGameState({
        status: payload.status || 'started',
        currentRound: round,
        currentTurn: turn,
        totalRounds: payload.totalRounds ?? null,
        currentDrawerPlayerId: drawerId,
        startedAt: payload.startedAt || new Date().toISOString(),
        completedAt: null,
        completionReason: null,
        lastTurnReason: 'game_started',
      });
      setError(null);
      appendLog(
        `start:${payload.startedAt || ''}`,
        'start',
        `Game started · Round ${round} of ${payload.totalRounds ?? '?'}`
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
      const round = payload.currentRound;
      const turn = payload.currentTurn;
      const drawerId = payload.currentDrawerPlayerId ?? null;
      const nextKey = turnKeyOf(round, turn, drawerId);

      if (nextKey && nextKey !== currentTurnKeyRef.current) {
        currentTurnKeyRef.current = nextKey;
        setWordState(INITIAL_WORD_STATE);
      }

      setGameState((prev) => ({
        ...prev,
        status: 'started',
        currentRound: round ?? prev.currentRound,
        currentTurn: turn ?? prev.currentTurn,
        totalRounds: payload.totalRounds ?? prev.totalRounds,
        currentDrawerPlayerId: drawerId,
        lastTurnReason: payload.reason || null,
      }));
      setError(null);

      const drawerName =
        (payload.players || players).find((p) => p.playerId === drawerId)?.displayName ||
        'Next player';

      appendLog(
        `turn:${round}:${turn}:${drawerId}`,
        'turn',
        `Round ${round}, Turn ${turn}: ${drawerName} is drawing`
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
      currentTurnKeyRef.current = null;
      setWordState(INITIAL_WORD_STATE);
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

  const applyWordAssigned = useCallback(
    (payload) => {
      if (!payload?.word) return;
      setWordState({
        phase: 'selected',
        options: [],
        assignedWord: {
          wordId: payload.wordId,
          word: payload.word,
          category: payload.category ?? null,
          wordLength: payload.wordLength,
          pattern: payload.pattern,
        },
        publicWord: {
          drawerPlayerId: playerId,
          wordLength: payload.wordLength,
          pattern: payload.pattern,
          safeHints: { category: payload.category ?? null },
        },
      });
      setError(null);
    },
    [playerId]
  );

  // Subscribe to backend game & word management Socket.IO broadcasts
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

    // Sent privately to the active drawer's socket
    const handleWordOptions = (event) => {
      if (!event || !Array.isArray(event.options)) return;
      const nextKey = turnKeyOf(
        event.currentRound,
        event.currentTurn,
        playerId
      );
      if (nextKey) currentTurnKeyRef.current = nextKey;
      setWordState({
        phase: 'choosing',
        options: event.options,
        assignedWord: null,
        publicWord: null,
      });
      setError(null);
    };

    // Sent privately to the active drawer's socket
    const handleWordAssigned = (event) => {
      applyWordAssigned(event);
    };

    // Broadcast to non-drawer players (never includes the actual word)
    const handleWordSelected = (event) => {
      if (!event) return;
      setWordState({
        phase: 'selected',
        options: [],
        assignedWord: null,
        publicWord: {
          drawerPlayerId: event.drawerPlayerId,
          wordLength: event.wordLength,
          pattern: event.pattern,
          safeHints: event.safeHints || {},
          wordMode: event.wordMode || null,
        },
      });
      setError(null);
      appendLog(
        `word-selected:${currentTurnKeyRef.current || ''}:${event.pattern}`,
        'word',
        `Drawer selected a ${event.wordLength}-letter word`
      );
    };

    socket.on('game_start', handleGameStart);
    socket.on('round_started', handleRoundStarted);
    socket.on('game_turn', handleGameTurn);
    socket.on('game_complete', handleGameComplete);
    socket.on('word_options', handleWordOptions);
    socket.on('word_assigned', handleWordAssigned);
    socket.on('word_selected', handleWordSelected);

    return () => {
      socket.off('game_start', handleGameStart);
      socket.off('round_started', handleRoundStarted);
      socket.off('game_turn', handleGameTurn);
      socket.off('game_complete', handleGameComplete);
      socket.off('word_options', handleWordOptions);
      socket.off('word_assigned', handleWordAssigned);
      socket.off('word_selected', handleWordSelected);
    };
  }, [
    socket,
    playerId,
    applyGameStart,
    applyGameTurn,
    applyGameComplete,
    applyWordAssigned,
    appendLog,
  ]);

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

  const selectWord = useCallback(
    async (wordId) => {
      setIsSelectingWord(true);
      setError(null);
      try {
        const result = await selectWordSocket(wordId);
        applyWordAssigned(result);
        return result;
      } catch (err) {
        const normalized = {
          code: err?.code || 'WORD_SELECT_FAILED',
          message: err?.message || 'Unable to select word',
        };
        setError(normalized);
        throw normalized;
      } finally {
        setIsSelectingWord(false);
      }
    },
    [applyWordAssigned]
  );

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
      wordState,
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
      isSelectingWord,
      gameLog,
      error,
      startGame,
      advanceTurn,
      selectWord,
      resetGameState,
      clearError,
    }),
    [
      gameState,
      wordState,
      currentDrawer,
      isCurrentDrawer,
      isConnected,
      isStartingGame,
      isAdvancingTurn,
      isSelectingWord,
      gameLog,
      error,
      startGame,
      advanceTurn,
      selectWord,
      resetGameState,
      clearError,
    ]
  );

  return <GameContext.Provider value={value}>{children}</GameContext.Provider>;
}
