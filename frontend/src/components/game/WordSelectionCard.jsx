import { Badge, Button, Card } from '../ui/index.js';

export function WordSelectionCard({
  options = [],
  assignedWord = null,
  hintProgress = null,
  isSelectingWord = false,
  isSocketConnected = true,
  onSelectWord,
  error = null,
}) {
  if (assignedWord) {
    return (
      <Card variant="tinted" className="border-indigo-300 bg-indigo-50/80 space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div>
            <p className="text-[11px] font-bold uppercase tracking-wider text-indigo-700">
              Your Secret Word
            </p>
            <p className="text-2xl font-black tracking-tight text-slate-900">
              {assignedWord.word}
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            {assignedWord.category && (
              <Badge variant="indigo">{assignedWord.category}</Badge>
            )}
            <Badge variant="emerald">{assignedWord.wordLength} letters</Badge>
            {hintProgress && (
              <Badge variant="amber">
                Hint {hintProgress.hintNumber}/{hintProgress.hintCount}
              </Badge>
            )}
          </div>
        </div>
        <p className="text-xs text-indigo-900">
          Guessers currently see:{' '}
          <span className="font-mono font-bold tracking-widest">
            {hintProgress?.pattern || assignedWord.pattern}
          </span>
        </p>
      </Card>
    );
  }

  return (
    <Card variant="elevated" className="border-amber-300 bg-amber-50/70 space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-amber-200/80 pb-3">
        <div>
          <h2 className="text-base font-extrabold text-slate-900">
            Choose a Word to Draw
          </h2>
          <p className="text-xs text-amber-900">
            Only you can see these word options. Pick one to begin your turn.
          </p>
        </div>
        <Badge variant="amber">Drawer Only</Badge>
      </div>

      {options.length === 0 ? (
        <p className="text-xs font-medium text-amber-900">
          Waiting for word options from the server...
        </p>
      ) : (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {options.map((option) => (
            <Button
              key={option.wordId}
              variant="outline"
              size="lg"
              disabled={!isSocketConnected || isSelectingWord}
              onClick={() => onSelectWord(option.wordId)}
              className="flex-col items-start justify-between gap-1.5 border-amber-300 bg-white px-4 py-3 text-left hover:border-indigo-500 hover:bg-indigo-50/40"
            >
              <span className="text-base font-black text-slate-900">
                {option.word}
              </span>
              {option.category && (
                <span className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">
                  {option.category}
                </span>
              )}
            </Button>
          ))}
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
  );
}
