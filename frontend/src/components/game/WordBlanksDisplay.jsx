import { Badge, Card } from '../ui/index.js';

export function WordBlanksDisplay({
  publicWord = null,
  hintProgress = null,
  drawerName = 'the drawer',
}) {
  if (!publicWord) {
    return (
      <Card variant="tinted" className="border-slate-200 bg-slate-50/80 space-y-2">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <p className="text-sm font-extrabold text-slate-800">
            Waiting for {drawerName} to select a word...
          </p>
          <Badge variant="amber">Choosing Word</Badge>
        </div>
        <p className="text-xs text-slate-500">
          Word blanks and any safe hints will appear here once the drawer chooses.
        </p>
      </Card>
    );
  }

  const pattern = hintProgress?.pattern || publicWord.pattern || '';
  const wordGroups = pattern.split(' ');
  const safeHints = publicWord.safeHints || {};
  const hasWordCount = typeof safeHints.wordCount === 'number';
  const hasCategory = typeof safeHints.category === 'string' && safeHints.category.length > 0;

  return (
    <Card variant="elevated" className="space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-xs font-bold uppercase tracking-wider text-slate-500">
            Word Clues
          </span>
          {publicWord.wordMode && (
            <Badge variant="slate">{publicWord.wordMode} Mode</Badge>
          )}
          {hintProgress && (
            <Badge variant="amber">
              Hint {hintProgress.hintNumber} of {hintProgress.hintCount}
            </Badge>
          )}
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <Badge variant="indigo">{publicWord.wordLength} letters</Badge>
          {hasWordCount && (
            <Badge variant="slate">
              {safeHints.wordCount} {safeHints.wordCount === 1 ? 'word' : 'words'}
            </Badge>
          )}
          {hasCategory ? (
            <Badge variant="emerald">Category: {safeHints.category}</Badge>
          ) : publicWord.wordMode === 'Hidden' ? (
            <Badge variant="amber">Category Hidden</Badge>
          ) : null}
        </div>
      </div>

      {/* Render blanks and progressive hint letters grouped by word */}
      <div
        aria-label={`Word blanks, ${publicWord.wordLength} letters`}
        className="flex flex-wrap items-center justify-center gap-x-5 gap-y-2 rounded-2xl border-2 border-slate-200 bg-slate-50/80 px-4 py-4"
      >
        {wordGroups.map((group, groupIdx) => (
          <div key={`${groupIdx}-${group.length}`} className="flex items-center gap-1.5">
            {[...group].map((char, charIdx) => {
              const isRevealed = char !== '_';
              return (
                <span
                  key={`${groupIdx}-${charIdx}`}
                  className={`inline-flex h-8 w-6 items-center justify-center border-b-2 font-mono text-lg font-black ${
                    isRevealed
                      ? 'border-indigo-500 text-indigo-700'
                      : 'border-slate-800 text-slate-900'
                  }`}
                >
                  {isRevealed ? char : ''}
                </span>
              );
            })}
          </div>
        ))}
      </div>
    </Card>
  );
}
