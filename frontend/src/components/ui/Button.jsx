const VARIANTS = {
  primary:
    'bg-indigo-600 text-white border-indigo-700 hover:bg-indigo-500 active:translate-y-0.5 shadow-[0_3px_0_0_#3730a3]',
  secondary:
    'bg-amber-400 text-slate-900 border-amber-500 hover:bg-amber-300 active:translate-y-0.5 shadow-[0_3px_0_0_#d97706]',
  outline:
    'bg-white text-slate-800 border-slate-300 hover:bg-slate-50 active:translate-y-0.5 shadow-[0_3px_0_0_#cbd5e1]',
  ghost: 'bg-transparent text-slate-700 border-transparent hover:bg-slate-100',
};

const SIZES = {
  sm: 'px-3 py-1.5 text-xs',
  md: 'px-4 py-2 text-sm',
  lg: 'px-6 py-3 text-base',
};

export function Button({
  children,
  variant = 'primary',
  size = 'md',
  type = 'button',
  disabled = false,
  className = '',
  ...props
}) {
  return (
    <button
      type={type}
      disabled={disabled}
      className={`inline-flex items-center justify-center gap-2 rounded-xl border-2 font-bold transition-all cursor-pointer disabled:cursor-not-allowed disabled:opacity-50 disabled:shadow-none disabled:translate-y-0 ${
        VARIANTS[variant] || VARIANTS.primary
      } ${SIZES[size] || SIZES.md} ${className}`}
      {...props}
    >
      {children}
    </button>
  );
}
