import { Link } from 'react-router-dom';
import { useSocket } from '../../hooks/useSocket.js';
import { Badge, StatusIndicator } from '../ui/index.js';

const SOCKET_LABELS = {
  connected: 'Socket Online',
  connecting: 'Connecting...',
  error: 'Socket Error',
  disconnected: 'Socket Offline',
};

export function Navbar() {
  const { status } = useSocket();

  return (
    <header className="sticky top-0 z-30 border-b-2 border-slate-200 bg-white/90 backdrop-blur-md">
      <div className="mx-auto flex h-16 max-w-6xl items-center justify-between px-4 sm:px-6">
        <Link to="/" className="flex items-center gap-2.5 group">
          <span
            aria-hidden="true"
            className="flex h-9 w-9 items-center justify-center rounded-xl border-2 border-indigo-700 bg-indigo-600 text-lg text-white shadow-[0_2px_0_0_#3730a3] transition-transform group-hover:-rotate-6"
          >
            ✎
          </span>
          <div className="leading-tight">
            <span className="block text-base font-extrabold tracking-tight text-slate-900 sm:text-lg">
              Draw &amp; Guess
            </span>
            <span className="hidden text-[11px] font-medium text-slate-500 sm:block">
              Real-time Multiplayer Sketch Party
            </span>
          </div>
        </Link>

        <div className="flex items-center gap-3">
          <Badge variant="indigo" className="hidden sm:inline-flex">
            Phase 1 · Foundation
          </Badge>
          <div className="rounded-full border border-slate-200 bg-slate-50 px-3 py-1">
            <StatusIndicator
              state={status}
              label={SOCKET_LABELS[status] || 'Socket Offline'}
            />
          </div>
        </div>
      </div>
    </header>
  );
}
