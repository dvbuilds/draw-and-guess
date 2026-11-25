import { useState } from 'react';
import { Link } from 'react-router-dom';
import { PlayerIdentityCard } from '../components/player/PlayerIdentityCard.jsx';
import { RoomCreatedSummary } from '../components/room/RoomCreatedSummary.jsx';
import { RoomSettingsForm } from '../components/room/RoomSettingsForm.jsx';
import { Badge, Card } from '../components/ui/index.js';
import { usePlayer } from '../hooks/usePlayer.js';
import { createRoom } from '../services/roomService.js';

export function CreateRoomPage() {
  const { playerId, displayName, identityToken, hasIdentity, isRestoring } = usePlayer();
  const [createdRoom, setCreatedRoom] = useState(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [serverError, setServerError] = useState(null);

  const handleCreateRoom = async ({ isPublic, settings }) => {
    setIsSubmitting(true);
    setServerError(null);
    try {
      const room = await createRoom({
        playerId,
        identityToken,
        isPublic,
        settings,
      });
      setCreatedRoom(room);
      return room;
    } catch (err) {
      setServerError({
        code: err?.code || 'CREATE_ROOM_FAILED',
        message: err?.message || 'Unable to create room. Please try again.',
      });
      throw err;
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <Badge variant="indigo" className="mb-1.5">
            Phase 3 · Room Management
          </Badge>
          <h1 className="text-2xl font-black tracking-tight text-slate-900 sm:text-3xl">
            Create a Room
          </h1>
          <p className="text-sm text-slate-600">
            Configure game rules, choose public or private access, and generate your invite link.
          </p>
        </div>

        <Link
          to="/join"
          className="text-xs font-bold text-indigo-600 hover:text-indigo-500"
        >
          Have a room code? Join instead →
        </Link>
      </div>

      {isRestoring ? (
        <Card variant="elevated">
          <p className="text-sm text-slate-600">Checking your guest identity...</p>
        </Card>
      ) : !hasIdentity ? (
        <div className="space-y-4">
          <Card variant="tinted" className="text-sm text-amber-900">
            <p className="font-bold">Guest nickname required before creating a room</p>
            <p className="mt-1 text-xs text-amber-800">
              Your guest identity is used to assign you as the room host.
            </p>
          </Card>
          <PlayerIdentityCard />
        </div>
      ) : createdRoom ? (
        <RoomCreatedSummary
          room={createdRoom}
          onCreateAnother={() => {
            setCreatedRoom(null);
            setServerError(null);
          }}
        />
      ) : (
        <Card variant="elevated" className="space-y-5">
          <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-100 pb-3">
            <div>
              <h2 className="text-base font-extrabold text-slate-900">Room Settings</h2>
              <p className="text-xs text-slate-500">
                Creating as host <strong className="text-slate-800">{displayName}</strong>
              </p>
            </div>
            <Badge variant="emerald">Host Ready</Badge>
          </div>

          <RoomSettingsForm
            onSubmit={handleCreateRoom}
            isSubmitting={isSubmitting}
            serverError={serverError}
            onClearServerError={() => setServerError(null)}
          />
        </Card>
      )}
    </div>
  );
}
