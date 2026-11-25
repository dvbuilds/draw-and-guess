import { Badge, Button, Card } from '../ui/index.js';

export function GameCompleteBanner({
  totalRounds,
  completionReason,
  completedAt,
  onLeaveRoom,
}) {
  const reasonText =
    completionReason === 'no_connected_players'
      ? 'Match ended because no connected players remained.'
      : `All ${totalRounds ?? ''} rounds have been completed.`;

  return (
    <Card variant="tinted" className="border-emerald-300 bg-emerald-50/80 space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <Badge variant="emerald" className="mb-1.5">
            Game Complete
          </Badge>
          <h2 className="text-xl font-black text-emerald-950">Match Finished!</h2>
          <p className="text-xs text-emerald-800">{reasonText}</p>
        </div>
        {completedAt && (
          <span className="font-mono text-xs font-semibold text-emerald-800">
            Finished at {new Date(completedAt).toLocaleTimeString()}
          </span>
        )}
      </div>

      <div>
        <Button variant="primary" size="sm" onClick={onLeaveRoom}>
          Leave Room &amp; Return Home
        </Button>
      </div>
    </Card>
  );
}
