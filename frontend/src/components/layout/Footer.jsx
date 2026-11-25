export function Footer() {
  return (
    <footer className="border-t-2 border-slate-200 bg-white/80">
      <div className="mx-auto flex max-w-6xl flex-col items-center justify-between gap-2 px-4 py-5 text-xs text-slate-500 sm:flex-row sm:px-6">
        <p className="font-medium text-slate-600">
          Draw &amp; Guess · Frontend Foundation (Phase 1)
        </p>
        <p>React · Vite · Tailwind CSS · Axios · Socket.IO</p>
      </div>
    </footer>
  );
}
