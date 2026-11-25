import { useEffect, useState } from 'react';
import { Link, Navigate, useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { GameCompleteBanner } from '../components/game/GameCompleteBanner.jsx';
import { GamePlayerList } from '../components/game/GamePlayerList.jsx';
import { GameStagePlaceholder } from '../components/game/GameStagePlaceholder.jsx';
import { GameTurnHeader } from '../components/game/GameTurnHeader.jsx';
import { WordBlanksDisplay } from '../components/game/WordBlanksDisplay.jsx';
import { WordSelectionCard } from '../components/game/WordSelectionCard.jsx';
import { LobbyConnectionBanner } from '../components/lobby/LobbyConnectionBanner.jsx';
import { PlayerIdentityCard } from '../components/player/PlayerIdentityCard.jsx';
import { Badge, Button, Card } from '../components/ui/index.js';
import { useGame } from '../hooks/useGame.js';
import { useLobby } from '../hooks/useLobby.js';
import { usePlayer } from '../hooks/usePlayer.js';

export function GamePage() {
  const { roomCode: paramCode } = useParams();
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();

  const inviteTokenParam = (searchParams.get('inviteToken') || '').trim();
  const { playerId, hasIdentity, isRestoring } = usePlayer();

  const {
    room,
    roomCode,
    players,
    hostPlayer,
    isHost,
    lobbyStatus,
    socketStatus,
    isSocketConnected,
    reconnectAttempt,
    socketError,
    connectSocket,
    retryJoinLobby,
    leaveLobby,
    error: lobbyError,
  } = useLobby(paramCode, inviteTokenParam || undefined);

  const {
    gameState,
    wordState,
    status: gameStatus,
    currentRound,
    currentTurn,
    totalRounds,
    currentDrawerPlayerId,
    currentDrawer,
    isCurrentDrawer,
    isAdvancingTurn,
    isSelectingWord,
    gameLog,
    error: gameError,
    advanceTurn,
    selectWord,
  } = useGame();

  const [leaving, setLeaving] = useState(false);

  // If connected to room but game is still in lobby state, return to lobby
  useEffect(() => {
    if (lobbyStatus === 'joined' && gameStatus === 'lobby' && roomCode) {
      const tokenQuery = inviteTokenParam
        ? `?inviteToken=${encodeURIComponent(inviteTokenParam)}`
        : '';
      navigate(`/lobby/${roomCode}${tokenQuery}`, { replace: true });
    }
  }, [lobbyStatus, gameStatus, roomCode, inviteTokenParam, navigate]);

  const handleLeave = async () => {
    setLeaving(true);
    await leaveLobby('user_left');
    navigate('/');
  };

  if (!paramCode) {
    return <Navigate to="/" replace />;
  }

  const membershipRequired = lobbyError?.code === 'ROOM_MEMBERSHIP_REQUIRED';
  const notInGame = lobbyError?.code === 'PLAYER_NOT_IN_GAME';
  const joinLink = `/join?roomCode=${encodeURIComponent(roomCode)}${
    inviteTokenParam ? `&inviteToken=${encodeURIComponent(inviteTokenParam)}` : ''
  }`;

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="space-y-1">
          <div className="flex flex-wrap items-center gap-2">
            <Badge variant="indigo">Phase 5 · Game Screen</Badge>
            {room && (
              <Badge variant={room.isPublic ? 'slate' : 'amber'}>
                {room.isPublic ? 'Public Room' : 'Private Room'}
              </Badge>
            )}
          </div>
          <h1 className="text-2xl font-black tracking-tight text-slate-900 sm:text-3xl">
            Draw &amp; Guess · <span className="font-mono text-indigo-600">{roomCode}</span>
          </h1>
        </div>

        <Button variant="ghost" size="sm" onClick={handleLeave} disabled={leaving}>
          {leaving ? 'Leaving...' : 'Leave Game'}
        </Button>
      </div>

      <LobbyConnectionBanner
        socketStatus={socketStatus}
        lobbyStatus={lobbyStatus}
        reconnectAttempt={reconnectAttempt}
        socketError={socketError}
        onReconnect={connectSocket}
        onRetryJoin={retryJoinLobby}
      />

      {isRestoring ? (
        <Card variant="elevated">
          <p className="text-sm text-slate-600">Restoring your guest identity...</p>
        </Card>
      ) : !hasIdentity ? (
        <div className="mx-auto max-w-xl space-y-4">
          <Card variant="tinted" className="text-xs text-amber-900">
            <p className="font-bold">Guest nickname required</p>
            <p className="mt-1 text-amber-800">
              Restore or create your guest identity to reconnect to room{' '}
              <span className="font-mono font-semibold">{roomCode}</span>.
            </p>
          </Card>
          <PlayerIdentityCard />
        </div>
      ) : membershipRequired || notInGame || (lobbyStatus === 'error' && lobbyError && players.length === 0) ? (
        <Card variant="elevated" className="mx-auto max-w-xl space-y-4">
          <h2 className="text-lg font-extrabold text-slate-900">Unable to Join Match</h2>
          <p role="alert" className="text-sm font-medium text-rose-700">
            {lobbyError?.message || 'Could not reconnect to this match.'}
          </p>
          <div className="flex flex-wrap gap-3">
            {membershipRequired ? (
              <Link to={joinLink}>
                <Button variant="primary">Join Room {roomCode}</Button>
              </Link>
            ) : !notInGame ? (
              <Button variant="primary" onClick={retryJoinLobby}>
                Retry Connection
              </Button>
            ) : null}
            <Link to="/">
              <Button variant="outline">Back to Home</Button>
            </Link>
          </div>
        </Card>
      ) : (
        <div className="space-y-6">
          <GameTurnHeader
            roomCode={roomCode}
            status={gameStatus}
            currentRound={currentRound}
            totalRounds={totalRounds}
            currentTurn={currentTurn}
            currentDrawer={currentDrawer}
            isCurrentDrawer={isCurrentDrawer}
            lastTurnReason={gameState.lastTurnReason}
          />

          {gameStatus === 'completed' && (
            <GameCompleteBanner
              totalRounds={totalRounds}
              completionReason={gameState.completionReason}
              completedAt={gameState.completedAt}
              onLeaveRoom={handleLeave}
            />
          )}

          {gameStatus === 'started' && (
            isCurrentDrawer ? (
              <WordSelectionCard
                options={wordState.options}
                assignedWord={wordState.assignedWord}
                isSelectingWord={isSelectingWord}
                isSocketConnected={isSocketConnected}
                onSelectWord={selectWord}
                error={gameError}
              />
            ) : (
              <WordBlanksDisplay
                publicWord={wordState.publicWord}
                drawerName={currentDrawer?.displayName || 'the drawer'}
              />
            )
          )}

          <div className="grid gap-6 lg:grid-cols-12 lg:items-start">
            <div className="lg:col-span-8">
              <GameStagePlaceholder
                isCurrentDrawer={isCurrentDrawer}
                currentDrawer={currentDrawer}
                wordPhase={wordState.phase}
                isHost={isHost}
                hostPlayer={hostPlayer}
                isSocketConnected={isSocketConnected}
                isAdvancingTurn={isAdvancingTurn}
                gameStatus={gameStatus}
                gameLog={gameLog}
                onAdvanceTurn={advanceTurn}
                error={gameError}
              />
            </div>

            <div className="lg:col-span-4">
              <GamePlayerList
                players={players}
                currentPlayerId={playerId}
                currentDrawerPlayerId={currentDrawerPlayerId}
              />
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
