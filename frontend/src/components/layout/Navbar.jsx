import { Link, NavLink } from 'react-router-dom';
import { useGame } from '../../hooks/useGame.js';
import { useLanguage } from '../../hooks/useLanguage.js';
import { usePlayer } from '../../hooks/usePlayer.js';
import { useRoom } from '../../hooks/useRoom.js';
import { useSocket } from '../../hooks/useSocket.js';
import { Badge, StatusIndicator } from '../ui/index.js';

const SOCKET_LABELS = {
  connected: 'Socket Online',
  connecting: 'Connecting...',
  reconnecting: 'Reconnecting...',
  error: 'Socket Error',
  disconnected: 'Socket Offline',
};

const navLinkClass = ({ isActive }) =>
  `rounded-lg px-2.5 py-1.5 text-xs font-bold transition-colors ${
    isActive
      ? 'bg-indigo-50 text-indigo-700'
      : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900'
  }`;

export function Navbar() {
  const { status } = useSocket();
  const { displayName, hasIdentity } = usePlayer();
  const { roomCode } = useRoom();
  const { status: gameStatus } = useGame();
  const { language, setLanguage, languages, t } = useLanguage();

  return (
    <header className="sticky top-0 z-30 border-b-2 border-slate-200 bg-white/90 backdrop-blur-md">
      <div className="mx-auto flex h-16 max-w-6xl items-center justify-between gap-3 px-4 sm:px-6">
        <div className="flex items-center gap-4 sm:gap-6">
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
                {t.appTagline}
              </span>
            </div>
          </Link>

          <nav aria-label="Primary" className="flex items-center gap-1">
            <NavLink to="/" end className={navLinkClass}>
              {t.navHome}
            </NavLink>
            <NavLink to="/create" className={navLinkClass}>
              {t.navCreate}
            </NavLink>
            <NavLink to="/join" className={navLinkClass}>
              {t.navJoin}
            </NavLink>
            {roomCode && (
              <NavLink
                to={
                  gameStatus === 'completed'
                    ? `/results/${roomCode}`
                    : gameStatus === 'started'
                      ? `/game/${roomCode}`
                      : `/lobby/${roomCode}`
                }
                className={navLinkClass}
              >
                {gameStatus === 'completed'
                  ? `Results (${roomCode})`
                  : gameStatus === 'started'
                    ? `Game (${roomCode})`
                    : `Lobby (${roomCode})`}
              </NavLink>
            )}
          </nav>
        </div>

        <div className="flex items-center gap-2 sm:gap-3">
          {hasIdentity && displayName && (
            <Badge variant="emerald" className="hidden md:inline-flex max-w-36 truncate">
              Player: {displayName}
            </Badge>
          )}

          <label className="flex items-center gap-1.5 rounded-full border border-slate-200 bg-slate-50 px-2.5 py-1 text-xs font-bold text-slate-700">
            <span className="sr-only">{t.languageLabel}</span>
            <span aria-hidden="true" className="text-[11px] text-slate-500">
              🌐
            </span>
            <select
              aria-label={t.languageLabel}
              value={language}
              onChange={(e) => setLanguage(e.target.value)}
              className="cursor-pointer bg-transparent text-xs font-bold text-slate-800 focus:outline-none"
            >
              {languages.map((lang) => (
                <option key={lang.code} value={lang.code}>
                  {lang.name}
                </option>
              ))}
            </select>
          </label>

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
