import { useState } from 'react';
import { Link, NavLink } from 'react-router-dom';
import { useGame } from '../../hooks/useGame.js';
import { useLanguage } from '../../hooks/useLanguage.js';
import { usePlayer } from '../../hooks/usePlayer.js';
import { useRoom } from '../../hooks/useRoom.js';
import { useSocket } from '../../hooks/useSocket.js';
import { Badge, StatusIndicator } from '../ui/index.js';

const CONNECTION_LABELS = {
  connected: 'Online',
  connecting: 'Connecting...',
  reconnecting: 'Reconnecting...',
  error: 'Offline',
  disconnected: 'Offline',
};

const navLinkClass = ({ isActive }) =>
  `block rounded-xl px-3 py-2 text-xs font-bold transition-colors md:inline-block md:rounded-lg md:px-2.5 md:py-1.5 ${
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
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  const activeRoomPath = roomCode
    ? gameStatus === 'completed'
      ? `/results/${roomCode}`
      : gameStatus === 'started'
        ? `/game/${roomCode}`
        : `/lobby/${roomCode}`
    : null;

  const activeRoomLabel = roomCode
    ? gameStatus === 'completed'
      ? `${t.navResults} (${roomCode})`
      : gameStatus === 'started'
        ? `${t.navGame} (${roomCode})`
        : `${t.navLobby} (${roomCode})`
    : null;

  return (
    <header className="sticky top-0 z-30 border-b-2 border-slate-200 bg-white/95 backdrop-blur-md">
      <div className="mx-auto flex min-h-16 max-w-6xl items-center justify-between gap-2 px-3 sm:px-6">
        <div className="flex min-w-0 items-center gap-3 lg:gap-6">
          <Link
            to="/"
            onClick={() => setMobileMenuOpen(false)}
            className="flex min-w-0 items-center gap-2 group"
          >
            <span
              aria-hidden="true"
              className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border-2 border-indigo-700 bg-indigo-600 text-lg text-white shadow-[0_2px_0_0_#3730a3] transition-transform group-hover:-rotate-6"
            >
              ✎
            </span>
            <div className="min-w-0 leading-tight">
              <span className="block truncate text-sm font-black tracking-tight text-slate-900 sm:text-lg">
                DoodleDash
              </span>
              <span className="hidden text-[11px] font-medium text-slate-500 lg:block">
                {t.appTagline}
              </span>
            </div>
          </Link>

          <nav aria-label="Primary" className="hidden items-center gap-1 md:flex">
            <NavLink to="/" end className={navLinkClass}>
              {t.navHome}
            </NavLink>
            <NavLink to="/create" className={navLinkClass}>
              {t.navCreate}
            </NavLink>
            <NavLink to="/join" className={navLinkClass}>
              {t.navJoin}
            </NavLink>
            {activeRoomPath && (
              <NavLink to={activeRoomPath} className={navLinkClass}>
                {activeRoomLabel}
              </NavLink>
            )}
          </nav>
        </div>

        <div className="flex shrink-0 items-center gap-1.5 sm:gap-2.5">
          {hasIdentity && displayName && (
            <Badge variant="emerald" className="hidden max-w-32 truncate lg:inline-flex">
              {displayName}
            </Badge>
          )}

          <label className="flex items-center gap-1 rounded-full border border-slate-200 bg-slate-50 px-2 py-1 text-xs font-bold text-slate-700">
            <span className="sr-only">{t.languageLabel}</span>
            <span aria-hidden="true" className="text-[11px] text-slate-500">
              🌐
            </span>
            <select
              aria-label={t.languageLabel}
              value={language}
              onChange={(e) => setLanguage(e.target.value)}
              className="max-w-18 cursor-pointer bg-transparent text-xs font-bold text-slate-800 focus:outline-none sm:max-w-none"
            >
              {languages.map((lang) => (
                <option key={lang.code} value={lang.code}>
                  {lang.name}
                </option>
              ))}
            </select>
          </label>

          <div className="rounded-full border border-slate-200 bg-slate-50 px-2.5 py-1">
            <StatusIndicator
              state={status}
              label={CONNECTION_LABELS[status] || 'Offline'}
            />
          </div>

          <button
            type="button"
            aria-expanded={mobileMenuOpen}
            aria-controls="mobile-nav-menu"
            aria-label={mobileMenuOpen ? 'Close navigation menu' : 'Open navigation menu'}
            onClick={() => setMobileMenuOpen((prev) => !prev)}
            className="inline-flex h-9 w-9 cursor-pointer items-center justify-center rounded-xl border-2 border-slate-200 bg-white text-slate-700 hover:bg-slate-50 md:hidden"
          >
            <span className="text-base font-black">{mobileMenuOpen ? '✕' : '☰'}</span>
          </button>
        </div>
      </div>

      {/* Mobile Collapsible Navigation Drawer */}
      {mobileMenuOpen && (
        <div
          id="mobile-nav-menu"
          className="border-t border-slate-200 bg-white px-3 py-3 md:hidden"
        >
          <nav aria-label="Mobile navigation" className="flex flex-col gap-1">
            <NavLink to="/" end className={navLinkClass} onClick={() => setMobileMenuOpen(false)}>
              {t.navHome}
            </NavLink>
            <NavLink to="/create" className={navLinkClass} onClick={() => setMobileMenuOpen(false)}>
              {t.navCreate}
            </NavLink>
            <NavLink to="/join" className={navLinkClass} onClick={() => setMobileMenuOpen(false)}>
              {t.navJoin}
            </NavLink>
            {activeRoomPath && (
              <NavLink
                to={activeRoomPath}
                className={navLinkClass}
                onClick={() => setMobileMenuOpen(false)}
              >
                {activeRoomLabel}
              </NavLink>
            )}
          </nav>

          {hasIdentity && displayName && (
            <div className="mt-2.5 flex items-center justify-between rounded-xl border border-emerald-200 bg-emerald-50/70 px-3 py-2 text-xs">
              <span className="font-semibold text-emerald-900">Playing as</span>
              <span className="truncate font-black text-emerald-950">{displayName}</span>
            </div>
          )}
        </div>
      )}
    </header>
  );
}
