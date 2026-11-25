import { Badge, Card, StatusIndicator } from '../ui/index.js';

export function ScoreboardCard({
  leaderboard = [],
  players = [],
  currentPlayerId = null,
  currentDrawerPlayerId = null,
}) {
  const playerMap = new Map(players.map((p) => [p.playerId, p]));

  return (
    <Card variant="elevated" className="space-y-3">
      <div className="flex items-center justify-between border-b border-slate-100 pb-2.5">
        <h2 className="text-sm font-extrabold text-slate-900">Live Scoreboard</h2>
        <Badge variant="amber">Points</Badge>
      </div>

      {leaderboard.length === 0 ? (
        <p className="text-xs text-slate-500">Waiting for player scores...</p>
      ) : (
        <ul className="space-y-2">
          {leaderboard.map((entry) => {
            const member = playerMap.get(entry.playerId);
            const isSelf = entry.playerId === currentPlayerId;
            const isDrawer = entry.playerId === currentDrawerPlayerId;
            const isHost = member?.role === 'host';
            const isOnline = member ? member.isConnected : true;

            return (
              <li
                key={entry.playerId}
                className={`flex items-center justify-between gap-2 rounded-xl border-2 px-3 py-2 ${
                  isDrawer
                    ? 'border-indigo-400 bg-indigo-50/60'
                    : isSelf
                      ? 'border-emerald-200 bg-emerald-50/30'
                      : 'border-slate-200 bg-white'
                }`}
              >
                <div className="flex items-center gap-2.5 min-w-0">
                  <span
                    className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-lg border text-xs font-black ${
                      entry.rank === 1 && entry.score > 0
                        ? 'border-amber-400 bg-amber-300 text-slate-900'
                        : 'border-slate-200 bg-slate-100 text-slate-700'
                    }`}
                  >
                    #{entry.rank}
                  </span>

                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-1">
                      <span className="truncate text-sm font-bold text-slate-900">
                        {entry.displayName}
                      </span>
                      {isSelf && (
                        <Badge variant="slate" className="text-[10px]">
                          You
                        </Badge>
                      )}
                      {isDrawer && (
                        <Badge variant="indigo" className="text-[10px]">
                          Drawing
                        </Badge>
                      )}
                      {isHost && (
                        <Badge variant="amber" className="text-[10px]">
                          Host
                        </Badge>
                      )}
                    </div>
                    <StatusIndicator
                      state={isOnline ? 'connected' : 'disconnected'}
                      label={isOnline ? 'Online' : 'Offline'}
                    />
                  </div>
                </div>

                <span className="shrink-0 font-mono text-sm font-black text-slate-900">
                  {entry.score} <span className="text-[11px] font-semibold text-slate-500">pts</span>
                </span>
              </li>
            );
          })}
        </ul>
      )}
    </Card>
  );
}
