const VARIANTS = {
  default: 'bg-white border-slate-200 shadow-[0_4px_0_0_rgba(15,23,42,0.06)]',
  elevated: 'bg-white border-slate-900/15 shadow-[0_6px_0_0_rgba(15,23,42,0.08)]',
  tinted: 'bg-amber-50/70 border-amber-200 shadow-[0_4px_0_0_rgba(217,119,6,0.08)]',
};

export function Card({ children, variant = 'default', className = '' }) {
  return (
    <div
      className={`rounded-2xl border-2 p-4 sm:p-6 ${
        VARIANTS[variant] || VARIANTS.default
      } ${className}`}
    >
      {children}
    </div>
  );
}
