import { Badge, Card } from '../ui/index.js';
import { CountdownTimer } from './CountdownTimer.jsx';

const REASON_LABELS = {
  game_started: 'Match initialized',
  host_advanced: 'Host advanced turn',
  all_guessed: 'All players guessed the word',
  timer_expired: 'Turn timer expired',
  drawer_disconnected: 'Previous drawer disconnected — turn advanced',
  drawer_left: 'Previous drawer left — turn advanced',
};

export function GameTurnHeader({
  roomCode,
  status,
  currentRound,
  totalRounds,
  currentTurn,
  currentDrawer,
  isCurrentDrawer,
  lastTurnReason,
  timerState,
  wordPhase,
}) {
  return (
    <Card variant="elevated" className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-100 pb-3">
        <div className="flex flex-wrap items-center gap-2">
          <Badge variant="indigo">Room {roomCode}</Badge>
          <Badge variant={status === 'completed' ? 'emerald' : 'amber'}>
            {status === 'completed' ? 'Match Completed' : 'Game In Progress'}
          </Badge>
        </div>

        <div className="flex flex-wrap items-center gap-3 text-sm font-black text-slate-900">
          {status === 'started' && (
            <CountdownTimer timerState={timerState} wordPhase={wordPhase} />
          )}
          <span className="rounded-xl border-2 border-slate-200 bg-slate-50 px-3 py-1">
            Round {currentRound ?? '—'} / {totalRounds ?? '—'}
          </span>
          <span className="rounded-xl border-2 border-slate-200 bg-slate-50 px-3 py-1">
            Turn #{currentTurn ?? '—'}
          </span>
        </div>
      </div>

      {status === 'started' && (
        <div
          className={`flex flex-wrap items-center justify-between gap-3 rounded-2xl border-2 px-4 py-3 ${
            isCurrentDrawer
              ? 'border-indigo-300 bg-indigo-50/70'
              : 'border-amber-200 bg-amber-50/70'
          }`}
        >
          <div className="space-y-0.5">
            <p className="text-[11px] font-bold uppercase tracking-wider text-slate-500">
              Current Drawer
            </p>
            <p className="text-lg font-black text-slate-900">
              {currentDrawer ? (
                <>
                  {currentDrawer.displayName}
                  {isCurrentDrawer && (
                    <span className="ml-2 text-sm font-extrabold text-indigo-600">
                      (Your Turn!)
                    </span>
                  )}
                </>
              ) : (
                'Waiting for drawer assignment...'
              )}
            </p>
          </div>

          {lastTurnReason && (
            <Badge variant="slate">
              {REASON_LABELS[lastTurnReason] || lastTurnReason}
            </Badge>
          )}
        </div>
      )}
    </Card>
  );
}
