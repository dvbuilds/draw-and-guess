import { useEffect, useState } from 'react';

function computeRemainingSeconds(turnEndsAt, expired) {
  if (expired || !turnEndsAt) return 0;
  const endMs = new Date(turnEndsAt).getTime();
  if (!Number.isFinite(endMs)) return 0;
  return Math.max(0, Math.ceil((endMs - Date.now()) / 1000));
}

export function CountdownTimer({ timerState, wordPhase = 'idle' }) {
  const { durationSeconds, turnEndsAt, expired } = timerState || {};
  const [remainingSeconds, setRemainingSeconds] = useState(() =>
    computeRemainingSeconds(turnEndsAt, expired)
  );

  useEffect(() => {
    setRemainingSeconds(computeRemainingSeconds(turnEndsAt, expired));
    if (!turnEndsAt || expired) return undefined;

    const interval = window.setInterval(() => {
      setRemainingSeconds(computeRemainingSeconds(turnEndsAt, false));
    }, 250);

    return () => window.clearInterval(interval);
  }, [turnEndsAt, expired]);

  if (!turnEndsAt) {
    return (
      <div className="inline-flex items-center gap-2 rounded-xl border-2 border-slate-200 bg-slate-50 px-3 py-1.5 text-xs font-bold text-slate-500">
        <span aria-hidden="true">⏱</span>
        <span>{wordPhase === 'selected' ? 'Syncing timer...' : 'Timer paused'}</span>
      </div>
    );
  }

  const total = Math.max(1, Number(durationSeconds) || 1);
  const progressPct = Math.min(100, Math.max(0, (remainingSeconds / total) * 100));
  const isExpired = expired || remainingSeconds === 0;
  const isUrgent = !isExpired && remainingSeconds <= 5;
  const isWarning = !isExpired && !isUrgent && remainingSeconds <= 15;

  const badgeColors = isExpired || isUrgent
    ? 'border-rose-300 bg-rose-50 text-rose-700'
    : isWarning
      ? 'border-amber-300 bg-amber-50 text-amber-800'
      : 'border-indigo-200 bg-indigo-50 text-indigo-700';

  const barColors = isExpired || isUrgent
    ? 'bg-rose-500'
    : isWarning
      ? 'bg-amber-400'
      : 'bg-indigo-600';

  return (
    <div className="w-full min-w-0 space-y-1 sm:w-auto sm:min-w-36">
      <div
        role="timer"
        aria-live="off"
        className={`flex items-center justify-between gap-2 rounded-xl border-2 px-3 py-1 text-xs font-black ${badgeColors}`}
      >
        <span className="flex items-center gap-1.5">
          <span aria-hidden="true">⏱</span>
          <span>{isExpired ? "Time's up!" : `${remainingSeconds}s`}</span>
        </span>
        {durationSeconds && (
          <span className="font-mono text-[10px] opacity-75">/ {durationSeconds}s</span>
        )}
      </div>
      <div className="h-1.5 w-full overflow-hidden rounded-full bg-slate-200">
        <div
          style={{ width: `${progressPct}%` }}
          className={`h-full transition-all duration-200 ${barColors}`}
        />
      </div>
    </div>
  );
}
