import { useEffect, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { PlayerIdentityCard } from '../components/player/PlayerIdentityCard.jsx';
import { RoomJoinedSummary } from '../components/room/RoomJoinedSummary.jsx';
import { Badge, Button, Card, Input } from '../components/ui/index.js';
import { usePlayer } from '../hooks/usePlayer.js';
import { joinRoom } from '../services/roomService.js';
import { validateRoomCodeInput } from '../utils/roomValidation.js';

function formatJoinError(err) {
  const code = err?.code || 'JOIN_FAILED';
  switch (code) {
    case 'INVALID_ROOM_CODE':
      return { code, message: 'Enter a valid 8-character room code (letters and numbers).' };
    case 'ROOM_NOT_FOUND':
      return {
        code,
        message: 'Room code not found. Check the 8-character code and try again.',
      };
    case 'PRIVATE_ROOM':
      return {
        code,
        message:
          'This is a private room. Open the private invite link or enter a valid invite token.',
      };
    case 'ROOM_FULL':
      return {
        code,
        message: 'This room is full and has reached its maximum player capacity.',
      };
    case 'ALREADY_IN_ROOM':
      return {
        code,
        message: 'Your current guest identity is already a member of this room.',
      };
    case 'PLAYER_NAME_TAKEN':
      return {
        code,
        message:
          'Another player in this room already uses your display name. Switch your guest name to join.',
      };
    case 'INVALID_PLAYER_IDENTITY':
      return {
        code,
        message: 'Your guest session is invalid or expired. Please switch or recreate your nickname.',
      };
    default:
      return { code, message: err?.message || 'Unable to join room. Please try again.' };
  }
}

export function JoinRoomPage() {
  const [searchParams] = useSearchParams();
  const initialCode = (searchParams.get('roomCode') || '').trim().toUpperCase();
  const initialToken = (searchParams.get('inviteToken') || '').trim();

  const { playerId, displayName, identityToken, hasIdentity, isRestoring, clearIdentity } =
    usePlayer();

  const [roomCode, setRoomCode] = useState(initialCode);
  const [inviteToken, setInviteToken] = useState(initialToken);
  const [showInviteTokenField, setShowInviteTokenField] = useState(Boolean(initialToken));
  const [codeError, setCodeError] = useState(null);
  const [serverError, setServerError] = useState(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [joinedRoom, setJoinedRoom] = useState(null);

  useEffect(() => {
    const paramCode = (searchParams.get('roomCode') || '').trim().toUpperCase();
    const paramToken = (searchParams.get('inviteToken') || '').trim();
    if (paramCode) setRoomCode(paramCode);
    if (paramToken) {
      setInviteToken(paramToken);
      setShowInviteTokenField(true);
    }
  }, [searchParams]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setServerError(null);

    const validation = validateRoomCodeInput(roomCode);
    if (!validation.valid) {
      setCodeError(validation.error);
      return;
    }

    setCodeError(null);
    setIsSubmitting(true);
    try {
      const room = await joinRoom({
        playerId,
        identityToken,
        roomCode: validation.value,
        inviteToken,
      });
      setJoinedRoom(room);
    } catch (err) {
      const formatted = formatJoinError(err);
      setServerError(formatted);
      if (formatted.code === 'PRIVATE_ROOM') {
        setShowInviteTokenField(true);
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  const hasInviteLinkParams = Boolean(initialCode);

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <Badge variant="indigo" className="mb-1.5">
            Phase 3 · Room Management
          </Badge>
          <h1 className="text-2xl font-black tracking-tight text-slate-900 sm:text-3xl">
            Join a Room
          </h1>
          <p className="text-sm text-slate-600">
            Enter an 8-character room code or open an invite link to join players.
          </p>
        </div>

        <Link
          to="/create"
          className="text-xs font-bold text-indigo-600 hover:text-indigo-500"
        >
          Want to host? Create a room →
        </Link>
      </div>

      {hasInviteLinkParams && !joinedRoom && (
        <Card variant="tinted" className="flex flex-wrap items-center justify-between gap-2 text-xs text-amber-900">
          <div>
            <p className="font-bold">
              Invite link detected for room <span className="font-mono">{initialCode}</span>
            </p>
            <p className="mt-0.5 text-amber-800">
              {initialToken
                ? 'Private invite token has been pre-filled from your link.'
                : 'Room code has been pre-filled from your link.'}
            </p>
          </div>
          <Badge variant="amber">{initialToken ? 'Private Invite' : 'Public Invite'}</Badge>
        </Card>
      )}

      {isRestoring ? (
        <Card variant="elevated">
          <p className="text-sm text-slate-600">Checking your guest identity...</p>
        </Card>
      ) : !hasIdentity ? (
        <div className="space-y-4">
          <Card variant="tinted" className="text-sm text-amber-900">
            <p className="font-bold">Enter a guest nickname to join</p>
            <p className="mt-1 text-xs text-amber-800">
              Once your guest identity is ready, you can join room{' '}
              <span className="font-mono font-semibold">{roomCode || 'with your code'}</span>.
            </p>
          </Card>
          <PlayerIdentityCard />
        </div>
      ) : joinedRoom ? (
        <RoomJoinedSummary
          room={joinedRoom}
          currentPlayerId={playerId}
          onReset={() => {
            setJoinedRoom(null);
            setServerError(null);
          }}
        />
      ) : (
        <Card variant="elevated" className="space-y-5">
          <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-100 pb-3">
            <div>
              <h2 className="text-base font-extrabold text-slate-900">Enter Room Code</h2>
              <p className="text-xs text-slate-500">
                Joining as <strong className="text-slate-800">{displayName}</strong>
              </p>
            </div>
            <button
              type="button"
              onClick={clearIdentity}
              className="text-xs font-semibold text-indigo-600 hover:text-indigo-500 cursor-pointer"
            >
              Switch Guest Name
            </button>
          </div>

          <form onSubmit={handleSubmit} noValidate className="space-y-4">
            <Input
              id="join-room-code"
              name="roomCode"
              type="text"
              placeholder="e.g. A7K9P2Q4"
              label="8-Character Room Code"
              value={roomCode}
              onChange={(e) => {
                setRoomCode(e.target.value.toUpperCase());
                if (codeError) setCodeError(null);
                if (serverError) setServerError(null);
              }}
              error={codeError}
              hint="Codes are 8 letters/numbers (case-insensitive)."
              className="font-mono tracking-widest uppercase"
            />

            <div className="space-y-2">
              <button
                type="button"
                onClick={() => setShowInviteTokenField((prev) => !prev)}
                className="text-xs font-semibold text-indigo-600 hover:text-indigo-500 cursor-pointer"
              >
                {showInviteTokenField
                  ? 'Hide private invite token'
                  : 'Joining a private room with a token?'}
              </button>

              {showInviteTokenField && (
                <Input
                  id="join-invite-token"
                  name="inviteToken"
                  type="text"
                  placeholder="Paste private invite token"
                  label="Private Invite Token"
                  value={inviteToken}
                  onChange={(e) => {
                    setInviteToken(e.target.value);
                    if (serverError) setServerError(null);
                  }}
                  hint="Automatically filled when you open a private room invite link."
                  className="font-mono text-xs"
                />
              )}
            </div>

            {serverError && (
              <div
                role="alert"
                className="rounded-xl border-2 border-rose-200 bg-rose-50 px-3.5 py-2.5 text-xs font-semibold text-rose-700 space-y-1.5"
              >
                <p>{serverError.message}</p>
                {(serverError.code === 'PLAYER_NAME_TAKEN' ||
                  serverError.code === 'INVALID_PLAYER_IDENTITY') && (
                  <button
                    type="button"
                    onClick={clearIdentity}
                    className="underline font-bold text-rose-800 hover:text-rose-900 cursor-pointer"
                  >
                    Switch guest nickname now
                  </button>
                )}
              </div>
            )}

            <Button type="submit" variant="primary" size="lg" className="w-full" disabled={isSubmitting}>
              {isSubmitting ? 'Joining Room...' : 'Join Room'}
            </Button>
          </form>
        </Card>
      )}
    </div>
  );
}
