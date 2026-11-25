import { createContext, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { usePlayer } from '../hooks/usePlayer.js';
import { useRoom } from '../hooks/useRoom.js';
import { useSocket } from '../hooks/useSocket.js';
import {
  clearDrawingSocket,
  nextTurnSocket,
  selectWordSocket,
  sendDrawingStrokeSocket,
  startGameSocket,
  submitGuessSocket,
  syncDrawingSocket,
  undoDrawingSocket,
} from '../services/socket.js';
import {
  applyStrokeSegment,
  applyUndoStroke,
  hydrateStrokesFromSync,
} from '../utils/drawingEngine.js';

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
  hintProgress: null, // { hintNumber, hintCount, pattern }
};

const INITIAL_TIMER_STATE = {
  durationSeconds: null,
  turnEndsAt: null,
  expired: false,
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

function leaderboardFromPlayers(playerList = []) {
  if (!playerList.length) return [];
  const sorted = [...playerList]
    .map((p) => ({
      playerId: p.playerId,
      displayName: p.displayName,
      score: Number.isFinite(p.score) ? p.score : 0,
    }))
    .sort(
      (a, b) =>
        b.score - a.score ||
        a.displayName.localeCompare(b.displayName, 'en') ||
        a.playerId.localeCompare(b.playerId)
    );
  let lastScore = null;
  let rank = 0;
  return sorted.map((p, idx) => {
    if (p.score !== lastScore) rank = idx + 1;
    lastScore = p.score;
    return { ...p, rank };
  });
}

export function GameProvider({ children }) {
  const { playerId } = usePlayer();
  const { socket, isConnected } = useSocket();
  const { roomCode, players, lobbyStatus, syncedGameState, syncPlayers } = useRoom();

  const [gameState, setGameState] = useState(INITIAL_GAME_STATE);
  const [wordState, setWordState] = useState(INITIAL_WORD_STATE);
  const [timerState, setTimerState] = useState(INITIAL_TIMER_STATE);
  const [strokes, setStrokes] = useState([]);
  const [isSyncingDrawing, setIsSyncingDrawing] = useState(false);

  // Phase 8: Guessing & Scoring state (authoritative from backend events)
  const [leaderboard, setLeaderboard] = useState([]);
  const [guessFeed, setGuessFeed] = useState([]);
  const [lastGuessFeedback, setLastGuessFeedback] = useState(null);
  const [hasGuessedCorrectly, setHasGuessedCorrectly] = useState(false);
  const [lastRoundResult, setLastRoundResult] = useState(null);
  const [finalResults, setFinalResults] = useState(null);
  const [isSubmittingGuess, setIsSubmittingGuess] = useState(false);
  const [guessError, setGuessError] = useState(null);

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
    setTimerState(INITIAL_TIMER_STATE);
    setStrokes([]);
    setLeaderboard([]);
    setGuessFeed([]);
    setLastGuessFeedback(null);
    setHasGuessedCorrectly(false);
    setLastRoundResult(null);
    setFinalResults(null);
    setGuessError(null);
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
      setTimerState(INITIAL_TIMER_STATE);
      setStrokes([]);
      setHasGuessedCorrectly(false);
      setLastGuessFeedback(null);
      setGuessError(null);
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

  const syncDrawing = useCallback(async () => {
    if (!isConnected) return null;
    setIsSyncingDrawing(true);
    try {
      const res = await syncDrawingSocket();
      setStrokes(hydrateStrokesFromSync(res?.strokes || []));
      return res;
    } catch {
      return null;
    } finally {
      setIsSyncingDrawing(false);
    }
  }, [isConnected]);

  useEffect(() => {
    if (lobbyStatus === 'joined' && isConnected && gameState.status === 'started') {
      syncDrawing();
    }
  }, [lobbyStatus, isConnected, gameState.status, syncDrawing]);

  const applyGameStart = useCallback(
    (payload) => {
      if (!payload) return;
      if (Array.isArray(payload.players)) {
        syncPlayers(payload.players);
        setLeaderboard(leaderboardFromPlayers(payload.players));
      }
      const round = payload.currentRound ?? 1;
      const turn = payload.currentTurn ?? 1;
      const drawerId = payload.currentDrawerPlayerId ?? null;
      const nextKey = turnKeyOf(round, turn, drawerId);

      if (nextKey !== currentTurnKeyRef.current) {
        currentTurnKeyRef.current = nextKey;
        setWordState(INITIAL_WORD_STATE);
        setTimerState(INITIAL_TIMER_STATE);
        setStrokes([]);
        setGuessFeed([]);
        setLastGuessFeedback(null);
        setHasGuessedCorrectly(false);
        setLastRoundResult(null);
        setFinalResults(null);
        setGuessError(null);
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
        setLeaderboard((prev) =>
          prev.length ? prev : leaderboardFromPlayers(payload.players)
        );
      }
      const round = payload.currentRound;
      const turn = payload.currentTurn;
      const drawerId = payload.currentDrawerPlayerId ?? null;
      const nextKey = turnKeyOf(round, turn, drawerId);

      if (nextKey && nextKey !== currentTurnKeyRef.current) {
        currentTurnKeyRef.current = nextKey;
        setWordState(INITIAL_WORD_STATE);
        setTimerState(INITIAL_TIMER_STATE);
        setStrokes([]);
        setLastGuessFeedback(null);
        setHasGuessedCorrectly(false);
        setGuessError(null);
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
      if (Array.isArray(payload.leaderboard)) {
        setLeaderboard(payload.leaderboard);
      }
      setFinalResults((prev) => ({
        leaderboard: payload.leaderboard || prev?.leaderboard || [],
        winners: payload.winners || prev?.winners || [],
        completedAt: payload.completedAt || new Date().toISOString(),
        reason: payload.reason || 'rounds_complete',
      }));
      currentTurnKeyRef.current = null;
      setWordState(INITIAL_WORD_STATE);
      setTimerState(INITIAL_TIMER_STATE);
      setStrokes([]);
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

  // Subscribe to backend game, word, drawing, guessing & scoring Socket.IO events
  useEffect(() => {
    const handleGameStart = (event) => applyGameStart(event);

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

    const handleGameTurn = (event) => applyGameTurn(event);
    const handleGameComplete = (event) => applyGameComplete(event);

    const handleWordOptions = (event) => {
      if (!event || !Array.isArray(event.options)) return;
      const nextKey = turnKeyOf(event.currentRound, event.currentTurn, playerId);
      if (nextKey) currentTurnKeyRef.current = nextKey;
      setWordState({
        phase: 'choosing',
        options: event.options,
        assignedWord: null,
        publicWord: null,
      });
      setError(null);
    };

    const handleWordAssigned = (event) => applyWordAssigned(event);

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

    const handleDrawingStroke = (event) => {
      if (!event) return;
      setStrokes((prev) => applyStrokeSegment(prev, event));
    };

    const handleDrawingUndone = (event) => {
      if (!event) return;
      setStrokes((prev) => applyUndoStroke(prev, event.strokeId));
    };

    const handleDrawingCleared = () => {
      setStrokes([]);
    };

    const handleGuessFeedback = (event) => {
      if (!event) return;
      setGuessFeed((prev) => [
        {
          id: `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
          ...event,
          timestamp: new Date().toISOString(),
        },
        ...prev,
      ].slice(0, 30));

      if (event.playerId === playerId) {
        setLastGuessFeedback(event);
        if (event.correct) {
          setHasGuessedCorrectly(true);
        }
      }
      if (event.correct) {
        appendLog(
          `correct:${currentTurnKeyRef.current || ''}:${event.playerId}`,
          'guess',
          `${event.displayName} guessed correctly (+${event.scoreAwarded ?? 0} pts)`
        );
      }
    };

    const handleScoreboardUpdated = (event) => {
      if (!Array.isArray(event?.leaderboard)) return;
      setLeaderboard(event.leaderboard);
    };

    const handleRoundComplete = (event) => {
      if (!event) return;
      setLastRoundResult(event);
      setTimerState((prev) => ({ ...prev, expired: true }));
      if (Array.isArray(event.leaderboard)) {
        setLeaderboard(event.leaderboard);
      }
      appendLog(
        `round-complete:${event.currentRound}:${event.currentTurn}:${event.completedAt}`,
        'round_complete',
        `Round ${event.currentRound}, Turn ${event.currentTurn} ended (${event.reason})`
      );
    };

    const handleWordHint = (event) => {
      if (!event?.pattern) return;
      setWordState((prev) => ({
        ...prev,
        assignedWord: prev.assignedWord
          ? { ...prev.assignedWord, pattern: event.pattern }
          : null,
        publicWord: prev.publicWord
          ? { ...prev.publicWord, pattern: event.pattern }
          : {
              drawerPlayerId: null,
              wordLength: [...event.pattern].filter((c) => !/\s/u.test(c)).length,
              pattern: event.pattern,
              safeHints: {},
            },
        hintProgress: {
          hintNumber: event.hintNumber,
          hintCount: event.hintCount,
          pattern: event.pattern,
        },
      }));
      appendLog(
        `hint:${event.currentRound}:${event.currentTurn}:${event.hintNumber}`,
        'hint',
        `Hint ${event.hintNumber} of ${event.hintCount} revealed`
      );
    };

    const handleTurnTimerStarted = (event) => {
      if (!event?.turnEndsAt) return;
      setTimerState({
        durationSeconds: event.durationSeconds ?? null,
        turnEndsAt: event.turnEndsAt,
        expired: false,
      });
    };

    const handleTurnTimerExpired = () => {
      setTimerState((prev) => ({
        ...prev,
        expired: true,
      }));
      appendLog(
        `timer-expired:${currentTurnKeyRef.current || ''}`,
        'timer',
        'Time expired for this turn'
      );
    };

    const handleLeaderboardFinal = (event) => {
      if (!event) return;
      if (Array.isArray(event.leaderboard)) {
        setLeaderboard(event.leaderboard);
      }
      setFinalResults((prev) => ({
        leaderboard: event.leaderboard || prev?.leaderboard || [],
        winners: event.winners || prev?.winners || [],
        completedAt: prev?.completedAt || new Date().toISOString(),
        reason: prev?.reason || 'rounds_complete',
      }));
    };

    socket.on('game_start', handleGameStart);
    socket.on('round_started', handleRoundStarted);
    socket.on('game_turn', handleGameTurn);
    socket.on('game_complete', handleGameComplete);
    socket.on('word_options', handleWordOptions);
    socket.on('word_assigned', handleWordAssigned);
    socket.on('word_selected', handleWordSelected);
    socket.on('drawing:stroke', handleDrawingStroke);
    socket.on('drawing:undone', handleDrawingUndone);
    socket.on('drawing:cleared', handleDrawingCleared);
    socket.on('guess_feedback', handleGuessFeedback);
    socket.on('scoreboard_updated', handleScoreboardUpdated);
    socket.on('round_complete', handleRoundComplete);
    socket.on('leaderboard_final', handleLeaderboardFinal);
    socket.on('word_hint', handleWordHint);
    socket.on('turn_timer_started', handleTurnTimerStarted);
    socket.on('turn_timer_expired', handleTurnTimerExpired);

    return () => {
      socket.off('game_start', handleGameStart);
      socket.off('round_started', handleRoundStarted);
      socket.off('game_turn', handleGameTurn);
      socket.off('game_complete', handleGameComplete);
      socket.off('word_options', handleWordOptions);
      socket.off('word_assigned', handleWordAssigned);
      socket.off('word_selected', handleWordSelected);
      socket.off('drawing:stroke', handleDrawingStroke);
      socket.off('drawing:undone', handleDrawingUndone);
      socket.off('drawing:cleared', handleDrawingCleared);
      socket.off('guess_feedback', handleGuessFeedback);
      socket.off('scoreboard_updated', handleScoreboardUpdated);
      socket.off('round_complete', handleRoundComplete);
      socket.off('leaderboard_final', handleLeaderboardFinal);
      socket.off('word_hint', handleWordHint);
      socket.off('turn_timer_started', handleTurnTimerStarted);
      socket.off('turn_timer_expired', handleTurnTimerExpired);
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

  const submitGuess = useCallback(async (rawGuess) => {
    setIsSubmittingGuess(true);
    setGuessError(null);
    try {
      const result = await submitGuessSocket(rawGuess);
      if (result) {
        setLastGuessFeedback(result);
        if (result.correct) {
          setHasGuessedCorrectly(true);
        }
      }
      return result;
    } catch (err) {
      const normalized = {
        code: err?.code || 'GUESS_SUBMIT_FAILED',
        message: err?.message || 'Unable to submit guess',
      };
      setGuessError(normalized);
      throw normalized;
    } finally {
      setIsSubmittingGuess(false);
    }
  }, []);

  const appendLocalSegment = useCallback((segment) => {
    setStrokes((prev) => applyStrokeSegment(prev, segment));
  }, []);

  const sendStrokeSegment = useCallback(async (segment) => {
    try {
      return await sendDrawingStrokeSocket(segment);
    } catch (err) {
      setError({
        code: err?.code || 'DRAWING_STROKE_FAILED',
        message: err?.message || 'Unable to sync drawing stroke',
      });
      throw err;
    }
  }, []);

  const undoDrawing = useCallback(async () => {
    setError(null);
    try {
      const result = await undoDrawingSocket();
      if (result?.undone) {
        setStrokes((prev) => applyUndoStroke(prev, result.strokeId));
      }
      return result;
    } catch (err) {
      setError({
        code: err?.code || 'DRAWING_UNDO_FAILED',
        message: err?.message || 'Unable to undo stroke',
      });
      throw err;
    }
  }, []);

  const clearDrawing = useCallback(async () => {
    setError(null);
    try {
      const result = await clearDrawingSocket();
      if (result?.cleared) {
        setStrokes([]);
      }
      return result;
    } catch (err) {
      setError({
        code: err?.code || 'DRAWING_CLEAR_FAILED',
        message: err?.message || 'Unable to clear canvas',
      });
      throw err;
    }
  }, []);

  const dismissRoundResult = useCallback(() => {
    setLastRoundResult(null);
  }, []);

  const clearGuessError = useCallback(() => {
    setGuessError(null);
  }, []);

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

  const effectiveLeaderboard = useMemo(() => {
    if (leaderboard.length > 0) return leaderboard;
    return leaderboardFromPlayers(players);
  }, [leaderboard, players]);

  const value = useMemo(
    () => ({
      gameState,
      wordState,
      timerState,
      strokes,
      isSyncingDrawing,
      leaderboard: effectiveLeaderboard,
      guessFeed,
      lastGuessFeedback,
      hasGuessedCorrectly,
      lastRoundResult,
      finalResults,
      isSubmittingGuess,
      guessError,
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
      submitGuess,
      dismissRoundResult,
      clearGuessError,
      appendLocalSegment,
      sendStrokeSegment,
      undoDrawing,
      clearDrawing,
      syncDrawing,
      resetGameState,
      clearError,
    }),
    [
      gameState,
      wordState,
      timerState,
      strokes,
      isSyncingDrawing,
      effectiveLeaderboard,
      guessFeed,
      lastGuessFeedback,
      hasGuessedCorrectly,
      lastRoundResult,
      finalResults,
      isSubmittingGuess,
      guessError,
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
      submitGuess,
      dismissRoundResult,
      clearGuessError,
      appendLocalSegment,
      sendStrokeSegment,
      undoDrawing,
      clearDrawing,
      syncDrawing,
      resetGameState,
      clearError,
    ]
  );

  return <GameContext.Provider value={value}>{children}</GameContext.Provider>;
}
