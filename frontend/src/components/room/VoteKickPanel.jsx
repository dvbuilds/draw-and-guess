import { Badge, Button, Card } from '../ui/index.js';

export function VoteKickPanel({
  players = [],
  currentPlayerId,
  voteKickEnabled = true,
  voteKickThreshold = 60,
  isSocketConnected = false,
  activeVoteKick = null,
  lastVoteKickResult = null,
  voteKickBusy = false,
  voteKickError = null,
  onStartVoteKick,
  onCastVoteKick,
  onDismissResult,
  onClearError,
}) {
  const candidates = players.filter((p) => p.playerId && p.playerId !== currentPlayerId);
  const connectedCount = players.filter((p) => p.isConnected).length;

  const isTargetOfActiveVote =
    Boolean(activeVoteKick) && activeVoteKick.targetPlayerId === currentPlayerId;
  const isEligibleVoter =
    Boolean(activeVoteKick) &&
    Array.isArray(activeVoteKick.eligibleVoterIds) &&
    activeVoteKick.eligibleVoterIds.includes(currentPlayerId);

  return (
    <Card className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <h2 className="text-base font-extrabold text-slate-900">VoteKick</h2>
          <p className="text-xs text-slate-500">
            Community kick threshold: {voteKickThreshold}% Yes votes
          </p>
        </div>
        <Badge variant={voteKickEnabled ? 'amber' : 'slate'}>
          {voteKickEnabled ? 'Enabled' : 'Disabled'}
        </Badge>
      </div>

      {voteKickError && (
        <div
          role="alert"
          className="flex items-center justify-between gap-2 rounded-xl border border-rose-200 bg-rose-50 px-3 py-2 text-xs font-semibold text-rose-700"
        >
          <span>{voteKickError.message}</span>
          {onClearError && (
            <button
              type="button"
              onClick={onClearError}
              className="cursor-pointer font-bold underline"
            >
              Close
            </button>
          )}
        </div>
      )}

      {lastVoteKickResult && (
        <div
          role="status"
          className={`flex flex-wrap items-center justify-between gap-2 rounded-xl border px-3 py-2.5 text-xs ${
            lastVoteKickResult.passed
              ? 'border-rose-200 bg-rose-50 text-rose-800'
              : 'border-slate-200 bg-slate-50 text-slate-700'
          }`}
        >
          <div>
            <p className="font-bold">
              VoteKick {lastVoteKickResult.passed ? 'passed' : 'failed'} for{' '}
              {lastVoteKickResult.targetDisplayName || 'player'}
            </p>
            <p className="mt-0.5 text-[11px]">
              Yes: {lastVoteKickResult.yesVotes} · No: {lastVoteKickResult.noVotes} · Required:{' '}
              {lastVoteKickResult.requiredVotes} ({lastVoteKickResult.reason?.replace(/_/g, ' ')})
            </p>
          </div>
          {onDismissResult && (
            <Button variant="ghost" size="sm" onClick={onDismissResult}>
              Dismiss
            </Button>
          )}
        </div>
      )}

      {!voteKickEnabled ? (
        <p className="rounded-xl bg-slate-50 px-3 py-2.5 text-xs text-slate-500">
          VoteKick is disabled in this room&apos;s configuration.
        </p>
      ) : activeVoteKick ? (
        <div className="space-y-3 rounded-xl border-2 border-amber-200 bg-amber-50/70 p-3.5">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <span className="text-sm font-extrabold text-amber-950">
              Kick {activeVoteKick.targetDisplayName}?
            </span>
            <Badge variant="amber">
              {activeVoteKick.yesVotes}/{activeVoteKick.requiredVotes} Yes needed
            </Badge>
          </div>

          <div className="grid grid-cols-3 gap-2 text-center text-xs">
            <div className="rounded-lg bg-white/80 px-2 py-1.5">
              <span className="block text-[10px] uppercase text-slate-400">Yes</span>
              <span className="font-extrabold text-emerald-700">{activeVoteKick.yesVotes}</span>
            </div>
            <div className="rounded-lg bg-white/80 px-2 py-1.5">
              <span className="block text-[10px] uppercase text-slate-400">No</span>
              <span className="font-extrabold text-rose-700">{activeVoteKick.noVotes}</span>
            </div>
            <div className="rounded-lg bg-white/80 px-2 py-1.5">
              <span className="block text-[10px] uppercase text-slate-400">Votes Cast</span>
              <span className="font-extrabold text-slate-800">
                {activeVoteKick.votesCast}/{activeVoteKick.eligibleVoterIds?.length || 0}
              </span>
            </div>
          </div>

          {isTargetOfActiveVote ? (
            <p className="text-xs font-semibold text-amber-900">
              A vote is currently in progress regarding you. Waiting for other players to vote.
            </p>
          ) : !isEligibleVoter ? (
            <p className="text-xs text-amber-800">
              You are not in the eligible voter list for this active vote.
            </p>
          ) : activeVoteKick.hasVoted ? (
            <p className="text-xs font-bold text-amber-900">
              Your vote ({activeVoteKick.myVote ? 'Yes' : 'No'}) has been recorded.
            </p>
          ) : (
            <div className="flex flex-wrap gap-2">
              <Button
                variant="danger"
                size="sm"
                disabled={!isSocketConnected || voteKickBusy}
                onClick={() => onCastVoteKick(true)}
              >
                Vote Yes (Kick)
              </Button>
              <Button
                variant="outline"
                size="sm"
                disabled={!isSocketConnected || voteKickBusy}
                onClick={() => onCastVoteKick(false)}
              >
                Vote No (Keep)
              </Button>
            </div>
          )}
        </div>
      ) : connectedCount < 3 ? (
        <p className="rounded-xl bg-slate-50 px-3 py-2.5 text-xs text-slate-500">
          At least 3 connected players are required to start a VoteKick.
        </p>
      ) : candidates.length === 0 ? (
        <p className="rounded-xl bg-slate-50 px-3 py-2.5 text-xs text-slate-500">
          No other players available to vote on.
        </p>
      ) : (
        <ul className="space-y-2">
          {candidates.map((player) => (
            <li
              key={player.playerId}
              className="flex items-center justify-between gap-2 rounded-xl border border-slate-200 bg-slate-50/70 px-3 py-2"
            >
              <div className="flex min-w-0 items-center gap-2">
                <span className="truncate text-xs font-bold text-slate-800">
                  {player.displayName}
                </span>
                {player.role === 'host' && <Badge variant="indigo">Host</Badge>}
              </div>
              <Button
                variant="outline"
                size="sm"
                disabled={!isSocketConnected || voteKickBusy || !player.isConnected}
                onClick={() => onStartVoteKick(player.playerId)}
              >
                Start Vote
              </Button>
            </li>
          ))}
        </ul>
      )}
    </Card>
  );
}
