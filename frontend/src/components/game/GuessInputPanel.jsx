import { useState } from 'react';
import { Badge, Button, Card, Input } from '../ui/index.js';

export function GuessInputPanel({
  isCurrentDrawer = false,
  wordPhase = 'idle',
  gameStatus = 'lobby',
  isSocketConnected = true,
  hasGuessedCorrectly = false,
  isSubmittingGuess = false,
  lastGuessFeedback = null,
  guessFeed = [],
  guessError = null,
  onSubmitGuess,
  onClearGuessError,
}) {
  const [guessText, setGuessText] = useState('');
  const [validationError, setValidationError] = useState(null);

  const canSubmit =
    !isCurrentDrawer &&
    gameStatus === 'started' &&
    wordPhase === 'selected' &&
    !hasGuessedCorrectly &&
    isSocketConnected &&
    !isSubmittingGuess;

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!canSubmit) return;

    const trimmed = guessText.trim();
    if (!trimmed) {
      setValidationError('Enter a word or phrase before guessing.');
      return;
    }
    if (trimmed.length > 64) {
      setValidationError('Guess must be 64 characters or fewer.');
      return;
    }

    setValidationError(null);
    onClearGuessError?.();
    try {
      await onSubmitGuess(trimmed);
      setGuessText('');
    } catch {
      // Error surfaced via guessError
    }
  };

  return (
    <Card variant="elevated" className="space-y-4">
      <div className="flex items-center justify-between border-b border-slate-100 pb-2.5">
        <h2 className="text-sm font-extrabold text-slate-900">Guess &amp; Feedback</h2>
        {hasGuessedCorrectly ? (
          <Badge variant="emerald">Guessed!</Badge>
        ) : isCurrentDrawer ? (
          <Badge variant="indigo">Drawer</Badge>
        ) : (
          <Badge variant="slate">Guesser</Badge>
        )}
      </div>

      {isCurrentDrawer ? (
        <div className="rounded-xl border border-indigo-200 bg-indigo-50/70 px-3.5 py-2.5 text-xs font-medium text-indigo-900">
          You are the drawer this turn — guessing is disabled while you draw.
        </div>
      ) : (
        <form onSubmit={handleSubmit} noValidate className="space-y-2.5">
          <div className="flex gap-2 items-start">
            <div className="flex-1">
              <Input
                id="guess-input"
                name="guess"
                type="text"
                autoComplete="off"
                placeholder={
                  wordPhase !== 'selected'
                    ? 'Wait for drawer to pick a word...'
                    : hasGuessedCorrectly
                      ? 'You already guessed correctly!'
                      : 'Type your guess...'
                }
                value={guessText}
                disabled={!canSubmit}
                onChange={(e) => {
                  setGuessText(e.target.value);
                  if (validationError) setValidationError(null);
                  if (guessError) onClearGuessError?.();
                }}
                error={validationError}
              />
            </div>
            <Button
              type="submit"
              variant="primary"
              size="md"
              disabled={!canSubmit}
              className="mt-0.5 shrink-0"
            >
              {isSubmittingGuess ? 'Sending...' : 'Guess'}
            </Button>
          </div>
        </form>
      )}

      {/* Personal Guess Feedback Banner */}
      {lastGuessFeedback && (
        <div
          role="status"
          className={`rounded-xl border px-3 py-2 text-xs font-bold ${
            lastGuessFeedback.correct
              ? 'border-emerald-300 bg-emerald-50 text-emerald-800'
              : 'border-rose-200 bg-rose-50 text-rose-700'
          }`}
        >
          {lastGuessFeedback.correct
            ? `Correct! You earned +${lastGuessFeedback.scoreAwarded ?? 0} pts.`
            : 'Incorrect guess — try again!'}
        </div>
      )}

      {guessError && (
        <p
          role="alert"
          className="rounded-xl border border-rose-200 bg-rose-50 px-3 py-2 text-xs font-semibold text-rose-700"
        >
          {guessError.message}
        </p>
      )}

      {/* Live Room Guess Feed */}
      <div className="space-y-1.5">
        <p className="text-[11px] font-bold uppercase tracking-wider text-slate-400">
          Guess Activity
        </p>
        {guessFeed.length === 0 ? (
          <p className="text-xs text-slate-500">No guesses submitted yet this game.</p>
        ) : (
          <ul className="max-h-44 space-y-1.5 overflow-y-auto pr-1 text-xs">
            {guessFeed.map((item) => (
              <li
                key={item.id}
                className={`flex items-center justify-between gap-2 rounded-lg px-2.5 py-1.5 ${
                  item.correct
                    ? 'bg-emerald-50 text-emerald-800 font-bold'
                    : 'bg-slate-50 text-slate-600'
                }`}
              >
                <span className="truncate">
                  <strong className="text-slate-900">{item.displayName}:</strong>{' '}
                  {item.correct
                    ? `Guessed the word! (+${item.scoreAwarded ?? 0} pts)`
                    : item.message || 'Incorrect guess'}
                </span>
              </li>
            ))}
          </ul>
        )}
      </div>
    </Card>
  );
}
