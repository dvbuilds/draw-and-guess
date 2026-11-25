import { Card } from '../ui/index.js';

const TYPE_STYLES = {
  join: 'text-emerald-700',
  reconnect: 'text-indigo-700',
  leave: 'text-slate-600',
  disconnect: 'text-amber-700',
  host: 'text-amber-800 font-bold',
  start: 'text-emerald-800 font-bold',
};

export function LobbyActivityFeed({ events = [] }) {
  return (
    <Card className="space-y-3">
      <h2 className="text-sm font-extrabold text-slate-900">Lobby Activity</h2>
      {events.length === 0 ? (
        <p className="text-xs text-slate-500">
          Real-time join, leave, disconnect, and host transfer updates will appear here.
        </p>
      ) : (
        <ul className="max-h-44 space-y-1.5 overflow-y-auto pr-1 text-xs">
          {events.map((item) => (
            <li
              key={item.id}
              className="flex items-baseline justify-between gap-2 rounded-lg bg-slate-50 px-2.5 py-1.5"
            >
              <span className={TYPE_STYLES[item.type] || 'text-slate-700'}>
                {item.message}
              </span>
              <span className="shrink-0 font-mono text-[10px] text-slate-400">
                {new Date(item.timestamp).toLocaleTimeString([], {
                  hour: '2-digit',
                  minute: '2-digit',
                  second: '2-digit',
                })}
              </span>
            </li>
          ))}
        </ul>
      )}
    </Card>
  );
}
