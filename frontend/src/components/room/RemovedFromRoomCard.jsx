import { Link } from 'react-router-dom';
import { Badge, Button, Card } from '../ui/index.js';

export function RemovedFromRoomCard({ removedState, onAcknowledge }) {
  if (!removedState) return null;

  const isBanned = Boolean(removedState.banned);

  return (
    <Card variant="elevated" className="mx-auto max-w-xl space-y-4">
      <div className="flex items-center gap-2">
        <Badge variant="rose">{isBanned ? 'Banned from Room' : 'Removed from Room'}</Badge>
        {removedState.roomCode && (
          <span className="font-mono text-xs font-bold text-slate-500">
            {removedState.roomCode}
          </span>
        )}
      </div>

      <h2 className="text-lg font-extrabold text-slate-900">
        {isBanned ? 'You have been banned by the host' : 'You have been removed from this room'}
      </h2>

      <p className="text-sm text-slate-600">
        {isBanned
          ? 'You cannot rejoin this room with your current player session.'
          : 'You were disconnected from the room by moderation or a VoteKick.'}
      </p>

      <div className="flex flex-wrap gap-3">
        <Link to="/join" onClick={onAcknowledge}>
          <Button variant="primary">Join Another Room</Button>
        </Link>
        <Link to="/" onClick={onAcknowledge}>
          <Button variant="outline">Back to Home</Button>
        </Link>
      </div>
    </Card>
  );
}
