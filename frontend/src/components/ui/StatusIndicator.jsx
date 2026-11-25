const STATE_STYLES = {
  connected: { dot: 'bg-emerald-500', ring: 'bg-emerald-400', text: 'text-emerald-700' },
  connecting: { dot: 'bg-amber-500', ring: 'bg-amber-400', text: 'text-amber-700' },
  error: { dot: 'bg-rose-500', ring: 'bg-rose-400', text: 'text-rose-700' },
  disconnected: { dot: 'bg-slate-400', ring: 'bg-slate-300', text: 'text-slate-600' },
};

export function StatusIndicator({ state = 'disconnected', label }) {
  const style = STATE_STYLES[state] || STATE_STYLES.disconnected;
  const shouldPulse = state === 'connected' || state === 'connecting';

  return (
    <span className={`inline-flex items-center gap-2 text-xs font-semibold ${style.text}`}>
      <span className="relative flex h-2.5 w-2.5">
        {shouldPulse && (
          <span
            className={`absolute inline-flex h-full w-full animate-ping rounded-full opacity-75 ${style.ring}`}
          />
        )}
        <span className={`relative inline-flex h-2.5 w-2.5 rounded-full ${style.dot}`} />
      </span>
      {label && <span>{label}</span>}
    </span>
  );
}
