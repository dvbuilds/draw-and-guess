import { Link } from 'react-router-dom';
import { Badge, Button, Card } from '../ui/index.js';

export function RoomJoinedSummary({ room, currentPlayerId, onReset }) {
  const settings = room.settings || {};
  const members = room.members || [];

  return (
    <Card variant="elevated" className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-100 pb-4">
        <div>
          <Badge variant="emerald" className="mb-1.5">
            Joined Room
          </Badge>
          <h2 className="text-xl font-black text-slate-900">
            Connected to <span className="font-mono">{room.roomCode}</span>
          </h2>
          <p className="text-xs text-slate-500">
            Your guest identity has been registered in this room.
          </p>
        </div>
        <Badge variant={room.isPublic ? 'indigo' : 'amber'}>
          {room.isPublic ? 'Public Room' : 'Private Room'}
        </Badge>
      </div>

      {/* Room Settings */}
      <div className="space-y-2">
        <h3 className="text-xs font-bold uppercase tracking-wide text-slate-500">
          Room Rules
        </h3>
        <dl className="grid grid-cols-2 gap-2.5 rounded-xl border border-slate-200 bg-slate-50/70 p-3.5 text-xs sm:grid-cols-3">
          <div>
            <dt className="text-slate-400">Capacity</dt>
            <dd className="font-bold text-slate-800">
              {members.length}/{settings.maxPlayers} players
            </dd>
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

      {/* Members Snapshot */}
      <div className="space-y-2">
        <h3 className="text-xs font-bold uppercase tracking-wide text-slate-500">
          Players in Room ({members.length})
        </h3>
        <ul className="divide-y divide-slate-100 rounded-xl border border-slate-200 bg-white">
          {members.map((member) => {
            const isSelf = member.playerId === currentPlayerId;
            return (
              <li
                key={member.playerId}
                className="flex items-center justify-between px-3.5 py-2.5 text-sm"
              >
                <span className="font-bold text-slate-800">
                  {member.displayName}
                  {isSelf && (
                    <span className="ml-1.5 text-xs font-semibold text-indigo-600">(You)</span>
                  )}
                </span>
                <Badge variant={member.role === 'host' ? 'amber' : 'slate'}>
                  {member.role === 'host' ? 'Host' : 'Player'}
                </Badge>
              </li>
            );
          })}
        </ul>
      </div>

      <div className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-slate-200 bg-slate-50 px-3.5 py-2.5 text-xs text-slate-600">
        <span>Real-time lobby &amp; game start controls will arrive in Phase 4.</span>
        <Badge variant="slate">Phase 3 Complete</Badge>
      </div>

      <div className="flex flex-wrap gap-3">
        <Button variant="outline" onClick={onReset}>
          Join Another Room
        </Button>
        <Link to="/">
          <Button variant="ghost">Back to Home</Button>
        </Link>
      </div>
    </Card>
  );
}
