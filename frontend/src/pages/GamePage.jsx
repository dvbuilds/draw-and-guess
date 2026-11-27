import { useEffect, useState } from 'react';
import { Link, Navigate, useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { ChatPanel } from '../components/game/ChatPanel.jsx';
import { GameCompleteBanner } from '../components/game/GameCompleteBanner.jsx';
import { GameStagePlaceholder } from '../components/game/GameStagePlaceholder.jsx';
import { GameTurnHeader } from '../components/game/GameTurnHeader.jsx';
import { GuessInputPanel } from '../components/game/GuessInputPanel.jsx';
import { RoundResultsBanner } from '../components/game/RoundResultsBanner.jsx';
import { ScoreboardCard } from '../components/game/ScoreboardCard.jsx';
import { WordBlanksDisplay } from '../components/game/WordBlanksDisplay.jsx';
import { WordSelectionCard } from '../components/game/WordSelectionCard.jsx';
import { LobbyConnectionBanner } from '../components/lobby/LobbyConnectionBanner.jsx';
import { PlayerIdentityCard } from '../components/player/PlayerIdentityCard.jsx';
import { AnnouncementBanner } from '../components/room/AnnouncementBanner.jsx';
import { ModerationPanel } from '../components/room/ModerationPanel.jsx';
import { RemovedFromRoomCard } from '../components/room/RemovedFromRoomCard.jsx';
import { VoteKickPanel } from '../components/room/VoteKickPanel.jsx';
import { Badge, Button, Card } from '../components/ui/index.js';
import { useGame } from '../hooks/useGame.js';
import { useLobby } from '../hooks/useLobby.js';
import { usePlayer } from '../hooks/usePlayer.js';
import { useRoom } from '../hooks/useRoom.js';

export function GamePage() {
  const { roomCode: paramCode } = useParams();
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();

  const inviteTokenParam = (searchParams.get('inviteToken') || '').trim();
  const { playerId, hasIdentity, isRestoring } = usePlayer();
  const {
    chatMessages,
    isSendingChat,
    chatError,
    sendChatMessage,
    clearChatError,
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
  } = useRoom();

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
    timerState,
    strokes,
    isSyncingDrawing,
    leaderboard,
    guessFeed,
    lastGuessFeedback,
    hasGuessedCorrectly,
    lastRoundResult,
    isSubmittingGuess,
    guessError,
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
    submitGuess,
    dismissRoundResult,
    clearGuessError,
    appendLocalSegment,
    sendStrokeSegment,
    undoDrawing,
    clearDrawing,
  } = useGame();

  const [leaving, setLeaving] = useState(false);

  // Redirect between lobby, active game, and final results screens
  useEffect(() => {
    if (!roomCode) return;
    const tokenQuery = inviteTokenParam
      ? `?inviteToken=${encodeURIComponent(inviteTokenParam)}`
      : '';
    if (lobbyStatus === 'joined' && gameStatus === 'lobby') {
      navigate(`/lobby/${roomCode}${tokenQuery}`, { replace: true });
    } else if (gameStatus === 'completed') {
      navigate(`/results/${roomCode}${tokenQuery}`, { replace: true });
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
            <Badge variant="indigo">Live Match</Badge>
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

      <AnnouncementBanner
        announcement={latestAnnouncement}
        onDismiss={dismissAnnouncement}
      />

      {removedState ? (
        <RemovedFromRoomCard
          removedState={removedState}
          onAcknowledge={clearRemovedState}
        />
      ) : isRestoring ? (
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
            timerState={timerState}
            wordPhase={wordState.phase}
          />

          {lastRoundResult && (
            <RoundResultsBanner
              result={lastRoundResult}
              players={players}
              onDismiss={dismissRoundResult}
            />
          )}

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
                hintProgress={wordState.hintProgress}
                isSelectingWord={isSelectingWord}
                isSocketConnected={isSocketConnected}
                onSelectWord={selectWord}
                error={gameError}
              />
            ) : (
              <WordBlanksDisplay
                publicWord={wordState.publicWord}
                hintProgress={wordState.hintProgress}
                drawerName={currentDrawer?.displayName || 'the drawer'}
              />
            )
          )}

          <div className="grid gap-6 lg:grid-cols-12 lg:items-start">
            <div className="min-w-0 lg:col-span-8">
              <GameStagePlaceholder
                isCurrentDrawer={isCurrentDrawer}
                currentDrawer={currentDrawer}
                wordPhase={wordState.phase}
                strokes={strokes}
                isSyncingDrawing={isSyncingDrawing}
                isHost={isHost}
                hostPlayer={hostPlayer}
                isSocketConnected={isSocketConnected}
                isAdvancingTurn={isAdvancingTurn}
                gameStatus={gameStatus}
                gameLog={gameLog}
                onAdvanceTurn={advanceTurn}
                onStrokeSegment={appendLocalSegment}
                onEmitSegment={sendStrokeSegment}
                onUndoDrawing={undoDrawing}
                onClearDrawing={clearDrawing}
                error={gameError}
              />
            </div>

            <div className="min-w-0 space-y-6 lg:col-span-4">
              <GuessInputPanel
                isCurrentDrawer={isCurrentDrawer}
                wordPhase={wordState.phase}
                gameStatus={gameStatus}
                isSocketConnected={isSocketConnected}
                hasGuessedCorrectly={hasGuessedCorrectly}
                isSubmittingGuess={isSubmittingGuess}
                lastGuessFeedback={lastGuessFeedback}
                guessFeed={guessFeed}
                guessError={guessError}
                onSubmitGuess={submitGuess}
                onClearGuessError={clearGuessError}
              />

              <ScoreboardCard
                leaderboard={leaderboard}
                players={players}
                currentPlayerId={playerId}
                currentDrawerPlayerId={currentDrawerPlayerId}
              />

              <ChatPanel
                title="Room Chat"
                messages={chatMessages}
                currentPlayerId={playerId}
                isConnected={isSocketConnected && lobbyStatus === 'joined'}
                isSending={isSendingChat}
                error={chatError}
                onSendMessage={sendChatMessage}
                onClearError={clearChatError}
              />

              <ModerationPanel
                isHost={isHost}
                players={players}
                currentPlayerId={playerId}
                isSocketConnected={isSocketConnected && lobbyStatus === 'joined'}
                moderationBusy={moderationBusy}
                moderationError={moderationError}
                announcementBusy={announcementBusy}
                announcementError={announcementError}
                announcements={announcements}
                onKickPlayer={kickPlayer}
                onBanPlayer={banPlayer}
                onSendAnnouncement={sendAnnouncement}
                onClearModerationError={clearModerationError}
                onClearAnnouncementError={clearAnnouncementError}
              />

              <VoteKickPanel
                players={players}
                currentPlayerId={playerId}
                voteKickEnabled={room?.settings?.voteKickEnabled ?? true}
                voteKickThreshold={room?.settings?.voteKickThreshold ?? 60}
                isSocketConnected={isSocketConnected && lobbyStatus === 'joined'}
                activeVoteKick={activeVoteKick}
                lastVoteKickResult={lastVoteKickResult}
                voteKickBusy={voteKickBusy}
                voteKickError={voteKickError}
                onStartVoteKick={startVoteKick}
                onCastVoteKick={castVoteKick}
                onDismissResult={dismissVoteKickResult}
                onClearError={clearVoteKickError}
              />
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
