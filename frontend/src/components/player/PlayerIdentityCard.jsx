import { useState } from 'react';
import { usePlayer } from '../../hooks/usePlayer.js';
import { Badge, Button, Card } from '../ui/index.js';
import { PlayerNameForm } from './PlayerNameForm.jsx';

function getInitials(name) {
  if (!name) return '?';
  const parts = name.trim().split(/\s+/);
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return `${parts[0][0]}${parts[1][0]}`.toUpperCase();
}

export function PlayerIdentityCard() {
  const {
    player,
    identityToken,
    hasIdentity,
    isRestoring,
    isSubmitting,
    restoredFromStorage,
    error,
    createIdentity,
    revalidateCurrentIdentity,
    clearIdentity,
    clearError,
  } = usePlayer();

  const [showToken, setShowToken] = useState(false);
  const [validationNotice, setValidationNotice] = useState(null);

  const handleRevalidate = async () => {
    setValidationNotice(null);
    try {
      const result = await revalidateCurrentIdentity();
      if (result?.valid) {
        setValidationNotice('Identity token verified with backend.');
      }
    } catch {
      // Error is handled by context
    }
  };

  const handleClear = () => {
    setValidationNotice(null);
    setShowToken(false);
    clearIdentity();
  };

  if (isRestoring) {
    return (
      <Card variant="elevated" className="space-y-3">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-extrabold text-slate-900">Guest Identity</h2>
          <Badge variant="amber">Restoring...</Badge>
        </div>
        <p className="text-sm text-slate-600">
          Checking your saved guest session with the server...
        </p>
      </Card>
    );
  }

  if (hasIdentity && player) {
    const maskedToken = identityToken
      ? `${identityToken.slice(0, 6)}••••••••${identityToken.slice(-4)}`
      : '—';

    return (
      <Card variant="elevated" className="space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-100 pb-3">
          <div className="flex items-center gap-3">
            <div
              aria-hidden="true"
              className="flex h-11 w-11 items-center justify-center rounded-xl border-2 border-indigo-700 bg-indigo-600 text-sm font-black text-white shadow-[0_2px_0_0_#3730a3]"
            >
              {getInitials(player.displayName)}
            </div>
            <div>
              <h2 className="text-base font-extrabold text-slate-900">{player.displayName}</h2>
              <p className="text-xs text-slate-500">
                Room Scope: <span className="font-mono font-semibold text-slate-700">{player.roomId}</span>
              </p>
            </div>
          </div>

          <Badge variant="emerald">
            {restoredFromStorage ? 'Session Restored' : 'Active Guest'}
          </Badge>
        </div>

        <dl className="grid gap-2 rounded-xl border border-slate-200 bg-slate-50/70 p-3 text-xs sm:grid-cols-2">
          <div>
            <dt className="text-slate-400">Player ID</dt>
            <dd className="truncate font-mono font-semibold text-slate-800">{player.playerId}</dd>
          </div>
          <div>
            <dt className="flex items-center justify-between text-slate-400">
              <span>Identity Token</span>
              <button
                type="button"
                onClick={() => setShowToken((prev) => !prev)}
                className="font-semibold text-indigo-600 hover:text-indigo-500 cursor-pointer"
              >
                {showToken ? 'Hide' : 'Show'}
              </button>
            </dt>
            <dd className="truncate font-mono font-semibold text-slate-800">
              {showToken ? identityToken : maskedToken}
            </dd>
          </div>
        </dl>

        {validationNotice && (
          <p className="rounded-xl border border-emerald-200 bg-emerald-50 px-3 py-2 text-xs font-semibold text-emerald-700">
            {validationNotice}
          </p>
        )}

        {error && (
          <p
            role="alert"
            className="rounded-xl border border-rose-200 bg-rose-50 px-3 py-2 text-xs font-semibold text-rose-700"
          >
            {error.message}
          </p>
        )}

        <div className="flex flex-wrap gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={handleRevalidate}
            disabled={isSubmitting}
          >
            {isSubmitting ? 'Validating...' : 'Validate Session'}
          </Button>
          <Button
            variant="ghost"
            size="sm"
            onClick={handleClear}
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
      <div className="flex items-center justify-between border-b border-slate-100 pb-3">
        <div>
          <h2 className="text-lg font-extrabold text-slate-900">Choose Your Nickname</h2>
          <p className="text-xs text-slate-500">
            Jump in as a guest — no account or password required.
          </p>
        </div>
        <Badge variant="indigo">Phase 2</Badge>
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
