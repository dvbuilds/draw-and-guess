import { useEffect, useState } from 'react';
import { Link, useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { LobbyActivityFeed } from '../components/lobby/LobbyActivityFeed.jsx';
import { LobbyConnectionBanner } from '../components/lobby/LobbyConnectionBanner.jsx';
import { LobbyHostControls } from '../components/lobby/LobbyHostControls.jsx';
import { LobbyPlayerList } from '../components/lobby/LobbyPlayerList.jsx';
import { PlayerIdentityCard } from '../components/player/PlayerIdentityCard.jsx';
import { Badge, Button, Card } from '../components/ui/index.js';
import { useLobby } from '../hooks/useLobby.js';
import { usePlayer } from '../hooks/usePlayer.js';

export function LobbyPage() {
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
    connectedPlayersCount,
    lobbyStatus,
    socketStatus,
    isSocketConnected,
    reconnectAttempt,
    socketError,
    gameStatus,
    gameStartedAt,
    isStartingGame,
    canStartGame,
    activityLog,
    error,
    connectSocket,
    retryJoinLobby,
    leaveLobby,
    startGame,
  } = useLobby(paramCode, inviteTokenParam || undefined);

  const [copiedField, setCopiedField] = useState(null);
  const [leaving, setLeaving] = useState(false);

  const effectiveInviteToken = inviteTokenParam || room?.inviteToken || '';

  // Automatically transition from Lobby to Game Screen when game starts
  useEffect(() => {
    if ((gameStatus === 'started' || gameStatus === 'completed') && roomCode) {
      const tokenQuery = effectiveInviteToken
        ? `?inviteToken=${encodeURIComponent(effectiveInviteToken)}`
        : '';
      navigate(`/game/${roomCode}${tokenQuery}`, { replace: true });
    }
  }, [gameStatus, roomCode, effectiveInviteToken, navigate]);
  const shareableInviteLink =
    room?.inviteLink ||
    (roomCode
      ? `${window.location.origin}/?roomCode=${roomCode}${
          effectiveInviteToken ? `&inviteToken=${effectiveInviteToken}` : ''
        }`
      : '');

  const copyValue = async (key, text) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopiedField(key);
      setTimeout(() => setCopiedField((prev) => (prev === key ? null : prev)), 2000);
    } catch {
      setCopiedField(null);
    }
  };

  const handleLeave = async () => {
    setLeaving(true);
    await leaveLobby('user_left');
    navigate('/');
  };

  const membershipRequired = error?.code === 'ROOM_MEMBERSHIP_REQUIRED';
  const joinLink = `/join?roomCode=${encodeURIComponent(roomCode)}${
    effectiveInviteToken ? `&inviteToken=${encodeURIComponent(effectiveInviteToken)}` : ''
  }`;

  return (
    <div className="space-y-6">
      {/* Header Row */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="space-y-1">
          <div className="flex flex-wrap items-center gap-2">
            <Badge variant="indigo">Phase 4 · Multiplayer Lobby</Badge>
            {room && (
              <Badge variant={room.isPublic ? 'slate' : 'amber'}>
                {room.isPublic ? 'Public Room' : 'Private Room'}
              </Badge>
            )}
          </div>
          <h1 className="text-2xl font-black tracking-tight text-slate-900 sm:text-3xl">
            Room <span className="font-mono text-indigo-600">{roomCode}</span>
          </h1>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => copyValue('code', roomCode)}
          >
            {copiedField === 'code' ? 'Copied Code!' : 'Copy Code'}
          </Button>
          {shareableInviteLink && (
            <Button
              variant="secondary"
              size="sm"
              onClick={() => copyValue('link', shareableInviteLink)}
            >
              {copiedField === 'link' ? 'Copied Invite!' : 'Copy Invite Link'}
            </Button>
          )}
          <Button
            variant="ghost"
            size="sm"
            onClick={handleLeave}
            disabled={leaving}
          >
            {leaving ? 'Leaving...' : 'Leave Room'}
          </Button>
        </div>
      </div>

      {/* Socket & Lobby Connection State */}
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
              Create your guest identity first, then join room{' '}
              <span className="font-mono font-semibold">{roomCode}</span>.
            </p>
          </Card>
          <PlayerIdentityCard />
        </div>
      ) : membershipRequired || (lobbyStatus === 'error' && error && players.length === 0) ? (
        <Card variant="elevated" className="mx-auto max-w-xl space-y-4">
          <h2 className="text-lg font-extrabold text-slate-900">Unable to Enter Lobby</h2>
          <p role="alert" className="text-sm font-medium text-rose-700">
            {error?.message || 'Could not connect to this room lobby.'}
          </p>
          <div className="flex flex-wrap gap-3">
            {membershipRequired ? (
              <Link to={joinLink}>
                <Button variant="primary">Join Room {roomCode}</Button>
              </Link>
            ) : (
              <Button variant="primary" onClick={retryJoinLobby}>
                Retry Connection
              </Button>
            )}
            <Link to="/">
              <Button variant="outline">Back to Home</Button>
            </Link>
          </div>
        </Card>
      ) : (
        <div className="grid gap-6 lg:grid-cols-12 lg:items-start">
          {/* Left Column: Live Player Roster */}
          <div className="space-y-6 lg:col-span-7">
            <LobbyPlayerList
              players={players}
              currentPlayerId={playerId}
              maxPlayers={room?.settings?.maxPlayers}
            />
            <LobbyActivityFeed events={activityLog} />
          </div>

          {/* Right Column: Host Controls & Room Summary */}
          <div className="space-y-6 lg:col-span-5">
            <LobbyHostControls
              isHost={isHost}
              hostPlayer={hostPlayer}
              connectedPlayersCount={connectedPlayersCount}
              canStartGame={canStartGame}
              isStartingGame={isStartingGame}
              isSocketConnected={isSocketConnected}
              gameStatus={gameStatus}
              onStartGame={startGame}
              error={error}
            />

            {room?.settings && (
              <Card className="space-y-3">
                <h2 className="text-sm font-extrabold text-slate-900">Room Settings</h2>
                <dl className="grid grid-cols-2 gap-2.5 text-xs">
                  <div>
                    <dt className="text-slate-400">Max Players</dt>
                    <dd className="font-bold text-slate-800">{room.settings.maxPlayers}</dd>
                  </div>
                  <div>
                    <dt className="text-slate-400">Rounds</dt>
                    <dd className="font-bold text-slate-800">{room.settings.rounds}</dd>
                  </div>
                  <div>
                    <dt className="text-slate-400">Drawing Time</dt>
                    <dd className="font-bold text-slate-800">{room.settings.drawingTime}s</dd>
                  </div>
                  <div>
                    <dt className="text-slate-400">Word Choices</dt>
                    <dd className="font-bold text-slate-800">{room.settings.wordChoices}</dd>
                  </div>
                  <div>
                    <dt className="text-slate-400">Hints</dt>
                    <dd className="font-bold capitalize text-slate-800">
                      {String(room.settings.hints)}
                    </dd>
                  </div>
                  <div>
                    <dt className="text-slate-400">Word Mode</dt>
                    <dd className="font-bold text-slate-800">{room.settings.wordMode}</dd>
                  </div>
                </dl>
              </Card>
            )}

            {gameStatus === 'started' && gameStartedAt && (
              <Card className="text-xs text-slate-600">
                Match started at{' '}
                <span className="font-mono font-semibold text-slate-800">
                  {new Date(gameStartedAt).toLocaleTimeString()}
                </span>
              </Card>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
