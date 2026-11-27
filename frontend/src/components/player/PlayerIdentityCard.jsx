import { Link } from 'react-router-dom';
import { usePlayer } from '../../hooks/usePlayer.js';
import { Badge, Button, Card } from '../ui/index.js';
import { PlayerNameForm } from './PlayerNameForm.jsx';

const AVATAR_THEMES = [
  { bg: 'bg-indigo-100 border-indigo-400', body: '#6366F1', hat: '#FBBF24', badge: 'Sketch Artist' },
  { bg: 'bg-amber-100 border-amber-400', body: '#F59E0B', hat: '#4F46E5', badge: 'Quick Guesser' },
  { bg: 'bg-emerald-100 border-emerald-400', body: '#10B981', hat: '#FBBF24', badge: 'Color Wizard' },
  { bg: 'bg-rose-100 border-rose-400', body: '#F43F5E', hat: '#6366F1', badge: 'Doodle Star' },
];

function pickAvatarTheme(name = '') {
  let hash = 0;
  for (let i = 0; i < name.length; i += 1) {
    hash = (hash * 31 + name.charCodeAt(i)) >>> 0;
  }
  return AVATAR_THEMES[hash % AVATAR_THEMES.length];
}

function CartoonPlayerAvatar({ displayName }) {
  const theme = pickAvatarTheme(displayName);
  return (
    <div
      aria-hidden="true"
      className={`flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl border-2 shadow-[0_3px_0_0_rgba(15,23,42,0.12)] ${theme.bg}`}
    >
      <svg viewBox="0 0 64 64" className="h-11 w-11">
        {/* Cute round character */}
        <circle cx="32" cy="36" r="19" fill={theme.body} stroke="#1E1B4B" strokeWidth="3" />
        {/* Beret / Party cap */}
        <path
          d="M17 24 C17 14, 47 13, 47 24 Z"
          fill={theme.hat}
          stroke="#1E1B4B"
          strokeWidth="2.8"
        />
        <circle cx="32" cy="14" r="3" fill={theme.hat} stroke="#1E1B4B" strokeWidth="2" />
        {/* Eyes & cheeks */}
        <circle cx="25" cy="34" r="2.7" fill="#1E1B4B" />
        <circle cx="39" cy="34" r="2.7" fill="#1E1B4B" />
        <circle cx="24" cy="33" r="1" fill="#FFFFFF" />
        <circle cx="38" cy="33" r="1" fill="#FFFFFF" />
        <ellipse cx="20" cy="39" rx="2.8" ry="1.6" fill="#FDA4AF" />
        <ellipse cx="44" cy="39" rx="2.8" ry="1.6" fill="#FDA4AF" />
        <path
          d="M27 40 Q32 45 37 40"
          fill="none"
          stroke="#1E1B4B"
          strokeWidth="2.6"
          strokeLinecap="round"
        />
      </svg>
    </div>
  );
}

export function PlayerIdentityCard({ showQuickActions = false }) {
  const {
    player,
    hasIdentity,
    isRestoring,
    isSubmitting,
    error,
    createIdentity,
    clearIdentity,
    clearError,
  } = usePlayer();

  if (isRestoring) {
    return (
      <Card variant="elevated" className="space-y-3">
        <div className="flex items-center justify-between gap-2">
          <h2 className="text-lg font-extrabold text-slate-900">Player Profile</h2>
          <Badge variant="amber">Preparing...</Badge>
        </div>
        <p className="text-sm text-slate-600">
          Setting up your guest nickname so you&apos;re ready to jump in...
        </p>
      </Card>
    );
  }

  if (hasIdentity && player) {
    const theme = pickAvatarTheme(player.displayName);

    return (
      <Card
        variant="elevated"
        className="space-y-5 border-indigo-200 bg-gradient-to-br from-white via-indigo-50/30 to-amber-50/40"
      >
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-100 pb-4">
          <div className="flex min-w-0 items-center gap-3.5">
            <CartoonPlayerAvatar displayName={player.displayName} />
            <div className="min-w-0">
              <p className="text-[11px] font-extrabold uppercase tracking-wider text-indigo-600">
                Welcome back!
              </p>
              <h2 className="truncate text-lg font-black text-slate-900">
                {player.displayName}
              </h2>
              <p className="text-xs font-semibold text-slate-500">{theme.badge}</p>
            </div>
          </div>

          <Badge variant="emerald">Ready to Play</Badge>
        </div>

        <div className="rounded-xl border border-amber-200 bg-amber-50/70 px-3.5 py-3 text-xs leading-relaxed text-amber-950">
          Your guest profile is saved for quick room creation and instant invite-link joins.
        </div>

        {error && (
          <p
            role="alert"
            className="rounded-xl border border-rose-200 bg-rose-50 px-3 py-2 text-xs font-semibold text-rose-700"
          >
            {error.message}
          </p>
        )}

        {showQuickActions && (
          <div className="grid gap-2.5 sm:grid-cols-2">
            <Link to="/create" className="w-full">
              <Button variant="primary" size="md" className="w-full">
                Create Room
              </Button>
            </Link>
            <Link to="/join" className="w-full">
              <Button variant="secondary" size="md" className="w-full">
                Join Room
              </Button>
            </Link>
          </div>
        )}

        <div className="flex flex-wrap items-center justify-between gap-2 pt-1">
          <span className="text-xs text-slate-500">Want a fresh nickname?</span>
          <Button
            variant="outline"
            size="sm"
            onClick={clearIdentity}
            disabled={isSubmitting}
          >
            Switch Guest Name
          </Button>
        </div>
      </Card>
    );
  }

  return (
    <Card variant="elevated" className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-100 pb-3">
        <div>
          <h2 className="text-lg font-extrabold text-slate-900">Choose Your Nickname</h2>
          <p className="text-xs text-slate-500">
            Jump in as a guest — no account or password required.
          </p>
        </div>
        <Badge variant="amber">Quick Play</Badge>
      </div>

      <PlayerNameForm
        onSubmit={createIdentity}
        isSubmitting={isSubmitting}
        serverError={error}
        onClearServerError={clearError}
      />
    </Card>
  );
}
