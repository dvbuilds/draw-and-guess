import { Badge, Button, Card } from '../ui/index.js';

export function GameStagePlaceholder({
  isCurrentDrawer,
  currentDrawer,
  wordPhase = 'idle',
  isHost,
  hostPlayer,
  isSocketConnected,
  isAdvancingTurn,
  gameStatus,
  gameLog = [],
  onAdvanceTurn,
  error,
}) {
  const stageHeadline = isCurrentDrawer
    ? wordPhase === 'selected'
      ? 'Word selected — drawing canvas arrives in the next phase'
      : 'Pick one of your word options above to begin'
    : wordPhase === 'selected'
      ? `${currentDrawer?.displayName || 'Drawer'} has selected a word`
      : `Waiting for ${currentDrawer?.displayName || 'the drawer'} to select a word`;

  return (
    <div className="space-y-6">
      {/* Main Canvas Stage Placeholder (no drawing/guessing/scoring/timers in Phase 6) */}
      <Card variant="elevated" className="space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-100 pb-3">
          <div>
            <h2 className="text-base font-extrabold text-slate-900">Game Stage</h2>
            <p className="text-xs text-slate-500">
              {isCurrentDrawer
                ? 'You are selected as the active drawer for this turn.'
                : `${currentDrawer?.displayName || 'The active drawer'} has the turn.`}
            </p>
          </div>
          <Badge variant="indigo">Phase 6 · Word Management</Badge>
        </div>

        <div className="flex min-h-56 flex-col items-center justify-center gap-3 rounded-2xl border-2 border-dashed border-slate-300 bg-slate-50/70 p-6 text-center">
          <span
            aria-hidden="true"
            className="flex h-12 w-12 items-center justify-center rounded-2xl border-2 border-indigo-200 bg-indigo-50 text-2xl text-indigo-600"
          >
            ✎
          </span>
          <div className="space-y-1 max-w-md">
            <p className="text-sm font-extrabold text-slate-800">{stageHeadline}</p>
            <p className="text-xs text-slate-500">
              Live drawing tools, guessing chat, timers, and scoring will be enabled in
              upcoming phases.
            </p>
          </div>
        </div>

        {/* Host Turn Control (triggers backend game:next_turn) */}
        {gameStatus === 'started' && (
          <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-slate-200 bg-slate-50 p-3.5">
            <div className="text-xs text-slate-600">
              {isHost ? (
                <span>
                  <strong className="text-slate-800">Host Control:</strong> Advance to the next
                  turn or round to test synchronization.
                </span>
              ) : (
                <span>
                  Only the current host (<strong>{hostPlayer?.displayName || 'Host'}</strong>) can
                  advance turns manually.
                </span>
              )}
            </div>

            {isHost && (
              <Button
                variant="secondary"
                size="sm"
                onClick={onAdvanceTurn}
                disabled={!isSocketConnected || isAdvancingTurn}
              >
                {isAdvancingTurn ? 'Advancing...' : 'Next Turn'}
              </Button>
            )}
          </div>
        )}

        {error && (
          <p
            role="alert"
            className="rounded-xl border border-rose-200 bg-rose-50 px-3 py-2 text-xs font-semibold text-rose-700"
          >
            {error.message}
          </p>
        )}
      </Card>

      {/* Real-time Turn & Round Transition Log */}
      <Card className="space-y-3">
        <h3 className="text-sm font-extrabold text-slate-900">Turn &amp; Round Events</h3>
        {gameLog.length === 0 ? (
          <p className="text-xs text-slate-500">
            Round and turn transitions will appear here in real time.
          </p>
        ) : (
          <ul className="max-h-44 space-y-1.5 overflow-y-auto pr-1 text-xs">
            {gameLog.map((entry) => (
              <li
                key={entry.id}
                className="flex items-baseline justify-between gap-2 rounded-lg bg-slate-50 px-2.5 py-1.5"
              >
                <span className="font-medium text-slate-700">{entry.message}</span>
                <span className="shrink-0 font-mono text-[10px] text-slate-400">
                  {new Date(entry.timestamp).toLocaleTimeString([], {
                    hour: '2-digit',
                    minute: '2-digit',
                    second: '2-digit',
                  })}
                </span>
              </li>
            ))}
          </ul>
        )}
      </Card>
    </div>
  );
}
