import { Badge, Button, Card } from '../ui/index.js';

const REASON_LABELS = {
  all_guessed: 'Everyone guessed the word!',
  host_advanced: 'Host ended the turn',
  drawer_disconnected: 'Drawer disconnected',
  drawer_left: 'Drawer left the room',
};

export function RoundResultsBanner({
  result,
  players = [],
  onDismiss,
}) {
  if (!result) return null;

  const nameById = new Map(players.map((p) => [p.playerId, p.displayName]));
  for (const row of result.leaderboard || []) {
    if (!nameById.has(row.playerId)) nameById.set(row.playerId, row.displayName);
  }

  const drawerName = nameById.get(result.drawerPlayerId) || 'Drawer';
  const correctNames = (result.correctGuesserIds || []).map(
    (id) => nameById.get(id) || id
  );
  const missedNames = (result.missedGuesserIds || []).map(
    (id) => nameById.get(id) || id
  );

  return (
    <Card variant="tinted" className="border-indigo-200 bg-indigo-50/70 space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex flex-wrap items-center gap-2">
          <Badge variant="indigo">
            Round {result.currentRound} · Turn {result.currentTurn} Results
          </Badge>
          <span className="text-xs font-bold text-slate-800">
            {REASON_LABELS[result.reason] || result.reason}
          </span>
        </div>
        {onDismiss && (
          <Button variant="ghost" size="sm" onClick={onDismiss} className="px-2 py-1 text-xs">
            Dismiss
          </Button>
        )}
      </div>

      <div className="grid gap-2 text-xs sm:grid-cols-3">
        <div className="rounded-xl border border-indigo-100 bg-white/80 p-2.5">
          <span className="block text-[10px] font-bold uppercase text-slate-400">Drawer</span>
          <span className="font-bold text-slate-900">{drawerName}</span>
        </div>
        <div className="rounded-xl border border-emerald-200 bg-emerald-50/70 p-2.5">
          <span className="block text-[10px] font-bold uppercase text-emerald-700">
            Guessed Correctly ({correctNames.length})
          </span>
          <span className="font-semibold text-emerald-900">
            {correctNames.length > 0 ? correctNames.join(', ') : 'None'}
          </span>
        </div>
        <div className="rounded-xl border border-slate-200 bg-white/80 p-2.5">
          <span className="block text-[10px] font-bold uppercase text-slate-400">
            Missed ({missedNames.length})
          </span>
          <span className="font-semibold text-slate-700">
            {missedNames.length > 0 ? missedNames.join(', ') : 'None'}
          </span>
        </div>
      </div>
    </Card>
  );
}
