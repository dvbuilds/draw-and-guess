import { Badge, Card, StatusIndicator } from '../ui/index.js';

function getInitials(name) {
  if (!name) return '?';
  const parts = name.trim().split(/\s+/);
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return `${parts[0][0]}${parts[1][0]}`.toUpperCase();
}

export function LobbyPlayerList({
  players = [],
  currentPlayerId = null,
  maxPlayers = null,
}) {
  const connectedCount = players.filter((p) => p.isConnected).length;

  return (
    <Card variant="elevated" className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-100 pb-3">
        <div>
          <h2 className="text-base font-extrabold text-slate-900">Lobby Players</h2>
          <p className="text-xs text-slate-500">
            {connectedCount} online · {players.length}
            {maxPlayers ? ` / ${maxPlayers}` : ''} in room
          </p>
        </div>
        <Badge variant="indigo">Live Roster</Badge>
      </div>

      {players.length === 0 ? (
        <p className="rounded-xl border border-dashed border-slate-200 bg-slate-50 p-4 text-center text-xs text-slate-500">
          Waiting for players to sync...
        </p>
      ) : (
        <ul className="space-y-2.5">
          {players.map((member) => {
            const isSelf = member.playerId === currentPlayerId;
            const isHost = member.role === 'host';

            return (
              <li
                key={member.playerId}
                className={`flex flex-wrap items-center justify-between gap-3 rounded-xl border-2 px-3.5 py-2.5 transition-colors ${
                  isSelf
                    ? 'border-indigo-200 bg-indigo-50/40'
                    : 'border-slate-200 bg-white'
                }`}
              >
                <div className="flex items-center gap-3 min-w-0">
                  <div
                    aria-hidden="true"
                    className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border-2 text-xs font-black ${
                      isHost
                        ? 'border-amber-500 bg-amber-400 text-slate-900'
                        : 'border-slate-300 bg-slate-100 text-slate-700'
                    }`}
                  >
                    {getInitials(member.displayName)}
                  </div>
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-1.5">
                      <span className="truncate text-sm font-extrabold text-slate-900">
                        {member.displayName}
                      </span>
                      {isSelf && (
                        <Badge variant="indigo" className="text-[10px]">
                          You
                        </Badge>
                      )}
                      {isHost && (
                        <Badge variant="amber" className="text-[10px]">
                          Host
                        </Badge>
                      )}
                    </div>
                  </div>
                </div>

                <StatusIndicator
                  state={member.isConnected ? 'connected' : 'disconnected'}
                  label={member.isConnected ? 'Connected' : 'Disconnected'}
                />
              </li>
            );
          })}
        </ul>
      )}
    </Card>
  );
}
