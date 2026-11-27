import { useEffect, useState } from 'react';
import { Link, Navigate, useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { RoundResultsBanner } from '../components/game/RoundResultsBanner.jsx';
import { Badge, Button, Card } from '../components/ui/index.js';
import { useGame } from '../hooks/useGame.js';
import { useLobby } from '../hooks/useLobby.js';
import { usePlayer } from '../hooks/usePlayer.js';

export function ResultsPage() {
  const { roomCode: paramCode } = useParams();
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();

  const inviteTokenParam = (searchParams.get('inviteToken') || '').trim();
  const { playerId } = usePlayer();

  const { roomCode, players, lobbyStatus, leaveLobby } = useLobby(
    paramCode,
    inviteTokenParam || undefined
  );

  const {
    status: gameStatus,
    totalRounds,
    leaderboard,
    finalResults,
    lastRoundResult,
  } = useGame();

  const [leaving, setLeaving] = useState(false);

  // If the room is still in lobby or active game, redirect to the matching screen
  useEffect(() => {
    if (lobbyStatus === 'joined' && roomCode) {
      const tokenQuery = inviteTokenParam
        ? `?inviteToken=${encodeURIComponent(inviteTokenParam)}`
        : '';
      if (gameStatus === 'lobby') {
        navigate(`/lobby/${roomCode}${tokenQuery}`, { replace: true });
      } else if (gameStatus === 'started') {
        navigate(`/game/${roomCode}${tokenQuery}`, { replace: true });
      }
    }
  }, [lobbyStatus, gameStatus, roomCode, inviteTokenParam, navigate]);

  if (!paramCode) {
    return <Navigate to="/" replace />;
  }

  const finalLeaderboard =
    finalResults?.leaderboard?.length > 0 ? finalResults.leaderboard : leaderboard;
  const winners =
    finalResults?.winners?.length > 0
      ? finalResults.winners
      : finalLeaderboard.length > 0
        ? finalLeaderboard.filter((entry) => entry.score === finalLeaderboard[0].score)
        : [];

  const isTie = winners.length > 1;
  const reasonText =
    finalResults?.reason === 'no_connected_players'
      ? 'Match ended because no connected players remained.'
      : `All ${totalRounds ?? ''} rounds completed!`;

  const handleLeaveHome = async () => {
    setLeaving(true);
    await leaveLobby('user_left');
    navigate('/');
  };

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <Badge variant="emerald" className="mb-1.5">
            Final Results
          </Badge>
          <h1 className="text-2xl font-black tracking-tight text-slate-900 sm:text-3xl">
            Match Results · <span className="font-mono text-indigo-600">{roomCode}</span>
          </h1>
          <p className="text-xs text-slate-500">{reasonText}</p>
        </div>

        <Button variant="outline" size="sm" onClick={handleLeaveHome} disabled={leaving}>
          {leaving ? 'Leaving...' : 'Leave Room'}
        </Button>
      </div>

      {/* Winner Spotlight */}
      <Card variant="tinted" className="border-amber-300 bg-amber-50/80 space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <Badge variant="amber">{isTie ? 'Co-Winners' : 'Winner'}</Badge>
          {finalResults?.completedAt && (
            <span className="font-mono text-xs text-amber-900">
              Finished at {new Date(finalResults.completedAt).toLocaleTimeString()}
            </span>
          )}
        </div>

        {winners.length > 0 ? (
          <div className="flex flex-wrap items-center justify-between gap-4">
            <div>
              <p className="text-2xl font-black text-slate-900 sm:text-3xl">
                {winners.map((w) => w.displayName).join(' & ')}
              </p>
              <p className="text-xs font-semibold text-amber-900">
                {isTie ? 'Tied for 1st place!' : '1st place champion!'}
              </p>
            </div>
            <div className="rounded-2xl border-2 border-amber-400 bg-white px-4 py-2 text-center">
              <span className="block text-[10px] font-bold uppercase text-amber-700">
                Winning Score
              </span>
              <span className="font-mono text-2xl font-black text-slate-900">
                {winners[0].score} pts
              </span>
            </div>
          </div>
        ) : (
          <p className="text-sm font-semibold text-amber-900">
            Final winner data unavailable.
          </p>
        )}
      </Card>

      {/* Final Leaderboard */}
      <Card variant="elevated" className="space-y-4">
        <div className="flex items-center justify-between border-b border-slate-100 pb-3">
          <h2 className="text-base font-extrabold text-slate-900">Final Leaderboard</h2>
          <Badge variant="indigo">{finalLeaderboard.length} Players</Badge>
        </div>

        {finalLeaderboard.length === 0 ? (
          <p className="text-xs text-slate-500">No final leaderboard entries recorded.</p>
        ) : (
          <ol className="space-y-2.5">
            {finalLeaderboard.map((entry) => {
              const isWinner = winners.some((w) => w.playerId === entry.playerId);
              const isSelf = entry.playerId === playerId;
              return (
                <li
                  key={entry.playerId}
                  className={`flex items-center justify-between gap-3 rounded-xl border-2 px-4 py-3 ${
                    isWinner
                      ? 'border-amber-300 bg-amber-50/60'
                      : isSelf
                        ? 'border-indigo-200 bg-indigo-50/40'
                        : 'border-slate-200 bg-white'
                  }`}
                >
                  <div className="flex items-center gap-3 min-w-0">
                    <span
                      className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border text-xs font-black ${
                        entry.rank === 1
                          ? 'border-amber-400 bg-amber-300 text-slate-900'
                          : 'border-slate-200 bg-slate-100 text-slate-700'
                      }`}
                    >
                      #{entry.rank}
                    </span>
                    <div className="flex flex-wrap items-center gap-1.5 min-w-0">
                      <span className="truncate text-sm font-extrabold text-slate-900">
                        {entry.displayName}
                      </span>
                      {isSelf && (
                        <Badge variant="indigo" className="text-[10px]">
                          You
                        </Badge>
                      )}
                      {isWinner && (
                        <Badge variant="amber" className="text-[10px]">
                          Winner
                        </Badge>
                      )}
                    </div>
                  </div>

                  <span className="font-mono text-base font-black text-slate-900">
                    {entry.score}{' '}
                    <span className="text-xs font-semibold text-slate-500">pts</span>
                  </span>
                </li>
              );
            })}
          </ol>
        )}
      </Card>

      {lastRoundResult && (
        <RoundResultsBanner result={lastRoundResult} players={players} />
      )}

      <div className="flex flex-wrap gap-3">
        <Button variant="primary" onClick={handleLeaveHome} disabled={leaving}>
          Back to Home
        </Button>
        <Link to="/create">
          <Button variant="secondary">Create New Room</Button>
        </Link>
      </div>
    </div>
  );
}
