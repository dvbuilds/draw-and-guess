import { Badge, Card, StatusIndicator } from '../ui/index.js';

function getInitials(name) {
  if (!name) return '?';
  const parts = name.trim().split(/\s+/);
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return `${parts[0][0]}${parts[1][0]}`.toUpperCase();
}

export function GamePlayerList({
  players = [],
  currentPlayerId = null,
  currentDrawerPlayerId = null,
}) {
  return (
    <Card variant="elevated" className="space-y-3">
      <div className="flex items-center justify-between border-b border-slate-100 pb-2.5">
        <h2 className="text-sm font-extrabold text-slate-900">Turn Roster</h2>
        <Badge variant="slate">{players.length} Players</Badge>
      </div>

      <ul className="space-y-2">
        {players.map((member) => {
          const isSelf = member.playerId === currentPlayerId;
          const isDrawer = member.playerId === currentDrawerPlayerId;
          const isHost = member.role === 'host';

          return (
            <li
              key={member.playerId}
              className={`flex flex-wrap items-center justify-between gap-2 rounded-xl border-2 px-3 py-2 transition-colors ${
                isDrawer
                  ? 'border-indigo-400 bg-indigo-50/60'
                  : 'border-slate-200 bg-white'
              }`}
            >
              <div className="flex items-center gap-2.5 min-w-0">
                <span
                  aria-hidden="true"
                  className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border-2 text-xs font-black ${
                    isDrawer
                      ? 'border-indigo-700 bg-indigo-600 text-white'
                      : 'border-slate-300 bg-slate-100 text-slate-700'
                  }`}
                >
                  {isDrawer ? '✎' : getInitials(member.displayName)}
                </span>

                <div className="flex flex-wrap items-center gap-1.5 min-w-0">
                  <span className="truncate text-sm font-bold text-slate-900">
                    {member.displayName}
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
              </div>

              <StatusIndicator
                state={member.isConnected ? 'connected' : 'disconnected'}
                label={member.isConnected ? 'Online' : 'Offline'}
              />
            </li>
          );
        })}
      </ul>
    </Card>
  );
}
