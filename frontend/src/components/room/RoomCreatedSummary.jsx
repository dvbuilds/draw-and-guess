import { useState } from 'react';
import { Link } from 'react-router-dom';
import { Badge, Button, Card } from '../ui/index.js';

export function RoomCreatedSummary({ room, onCreateAnother }) {
  const [copiedField, setCopiedField] = useState(null);

  const copyValue = async (key, text) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopiedField(key);
      setTimeout(() => setCopiedField((prev) => (prev === key ? null : prev)), 2000);
    } catch {
      setCopiedField(null);
    }
  };

  const settings = room.settings || {};

  return (
    <Card variant="elevated" className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-100 pb-4">
        <div>
          <Badge variant="emerald" className="mb-1.5">
            Room Created
          </Badge>
          <h2 className="text-xl font-black text-slate-900">Your room is ready!</h2>
          <p className="text-xs text-slate-500">
            Share the room code or invite link below so players can join.
          </p>
        </div>
        <Badge variant={room.isPublic ? 'indigo' : 'amber'}>
          {room.isPublic ? 'Public Room' : 'Private Room'}
        </Badge>
      </div>

      {/* Room Code */}
      <div className="rounded-2xl border-2 border-indigo-200 bg-indigo-50/60 p-4 flex flex-wrap items-center justify-between gap-3">
        <div>
          <span className="block text-[11px] font-bold uppercase tracking-wider text-indigo-700">
            Room Code
          </span>
          <span className="font-mono text-2xl font-black tracking-widest text-slate-900 sm:text-3xl">
            {room.roomCode}
          </span>
        </div>
        <Button
          variant="outline"
          size="sm"
          onClick={() => copyValue('code', room.roomCode)}
        >
          {copiedField === 'code' ? 'Copied Code!' : 'Copy Code'}
        </Button>
      </div>

      {/* Shareable Invite Link */}
      {room.inviteLink && (
        <div className="space-y-2 rounded-xl border border-slate-200 bg-slate-50/80 p-3.5">
          <div className="flex items-center justify-between gap-2">
            <span className="text-xs font-bold uppercase tracking-wide text-slate-600">
              Shareable Invite Link
            </span>
            <Button
              variant="secondary"
              size="sm"
              onClick={() => copyValue('link', room.inviteLink)}
            >
              {copiedField === 'link' ? 'Copied Link!' : 'Copy Invite Link'}
            </Button>
          </div>
          <p className="break-all rounded-lg border border-slate-200 bg-white px-3 py-2 font-mono text-xs text-slate-700">
            {room.inviteLink}
          </p>
        </div>
      )}

      {/* Private Invite Token (only returned on private room creation) */}
      {!room.isPublic && room.inviteToken && (
        <div className="space-y-2 rounded-xl border border-amber-200 bg-amber-50/70 p-3.5">
          <div className="flex items-center justify-between gap-2">
            <span className="text-xs font-bold uppercase tracking-wide text-amber-800">
              Private Invite Token
            </span>
            <Button
              variant="outline"
              size="sm"
              onClick={() => copyValue('token', room.inviteToken)}
            >
              {copiedField === 'token' ? 'Copied Token!' : 'Copy Token'}
            </Button>
          </div>
          <p className="break-all font-mono text-xs text-amber-900">{room.inviteToken}</p>
          <p className="text-[11px] text-amber-800">
            Already embedded in the invite link above. Keep it secret for private access only.
          </p>
        </div>
      )}

      {/* Settings Snapshot */}
      <div className="space-y-2">
        <h3 className="text-xs font-bold uppercase tracking-wide text-slate-500">
          Configured Settings
        </h3>
        <dl className="grid grid-cols-2 gap-2.5 rounded-xl border border-slate-200 bg-slate-50/70 p-3.5 text-xs sm:grid-cols-3">
          <div>
            <dt className="text-slate-400">Max Players</dt>
            <dd className="font-bold text-slate-800">{settings.maxPlayers}</dd>
          </div>
          <div>
            <dt className="text-slate-400">Rounds</dt>
            <dd className="font-bold text-slate-800">{settings.rounds}</dd>
          </div>
          <div>
            <dt className="text-slate-400">Drawing Time</dt>
            <dd className="font-bold text-slate-800">{settings.drawingTime}s</dd>
          </div>
          <div>
            <dt className="text-slate-400">Word Choices</dt>
            <dd className="font-bold text-slate-800">{settings.wordChoices}</dd>
          </div>
          <div>
            <dt className="text-slate-400">Hints</dt>
            <dd className="font-bold capitalize text-slate-800">{String(settings.hints)}</dd>
          </div>
          <div>
            <dt className="text-slate-400">Word Mode</dt>
            <dd className="font-bold text-slate-800">{settings.wordMode}</dd>
          </div>
        </dl>
      </div>

      {/* Host & Next Phase Note */}
      <div className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-slate-200 bg-white px-3.5 py-2.5 text-xs text-slate-600">
        <span>
          Host:{' '}
          <strong className="text-slate-900">
            {room.members?.[0]?.displayName || 'You'}
          </strong>{' '}
          ({room.members?.length || 1}/{settings.maxPlayers} joined)
        </span>
        <Badge variant="slate">Lobby arrives in Phase 4</Badge>
      </div>

      <div className="flex flex-wrap gap-3">
        <Button variant="outline" onClick={onCreateAnother}>
          Create Another Room
        </Button>
        <Link to="/">
          <Button variant="ghost">Back to Home</Button>
        </Link>
      </div>
    </Card>
  );
}
