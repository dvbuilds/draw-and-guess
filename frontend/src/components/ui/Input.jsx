export function Input({
  id,
  label,
  hint,
  error,
  rightAddon,
  className = '',
  ...props
}) {
  const errorId = error && id ? `${id}-error` : undefined;
  const hintId = hint && id ? `${id}-hint` : undefined;
  const describedBy = [errorId, hintId].filter(Boolean).join(' ') || undefined;

  return (
    <div className="space-y-1.5">
      {(label || rightAddon) && (
        <div className="flex items-center justify-between gap-2">
          {label && (
            <label htmlFor={id} className="text-sm font-bold text-slate-800">
              {label}
            </label>
          )}
          {rightAddon}
        </div>
      )}

      <input
        id={id}
        aria-invalid={Boolean(error)}
        aria-describedby={describedBy}
        className={`w-full rounded-xl border-2 bg-white px-3.5 py-2.5 text-sm font-medium text-slate-900 placeholder:text-slate-400 transition-colors focus:outline-none ${
          error
            ? 'border-rose-400 focus:border-rose-500 bg-rose-50/30'
            : 'border-slate-300 focus:border-indigo-500'
        } ${className}`}
        {...props}
      />

      {error && (
        <p id={errorId} role="alert" className="text-xs font-semibold text-rose-600">
          {error}
        </p>
      )}
      {!error && hint && (
        <p id={hintId} className="text-xs text-slate-500">
          {hint}
        </p>
      )}
    </div>
  );
}
