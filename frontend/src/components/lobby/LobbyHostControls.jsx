import { Badge, Button, Card } from '../ui/index.js';

export function LobbyHostControls({
  isHost,
  hostPlayer,
  connectedPlayersCount,
  canStartGame,
  isStartingGame,
  isSocketConnected,
  gameStatus,
  onStartGame,
  error,
}) {
  if (gameStatus === 'started') {
    return (
      <Card variant="tinted" className="space-y-2 border-emerald-300 bg-emerald-50/80">
        <div className="flex items-center justify-between">
          <h2 className="text-base font-extrabold text-emerald-900">Game Started</h2>
          <Badge variant="emerald">In Progress</Badge>
        </div>
        <p className="text-xs text-emerald-800">
          The host started the match! Phase 5 will transition players to the live drawing canvas
          and word-guessing screen.
        </p>
      </Card>
    );
  }

  return (
    <Card variant="elevated" className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-100 pb-3">
        <div>
          <h2 className="text-base font-extrabold text-slate-900">
            {isHost ? 'Host Controls' : 'Lobby Status'}
          </h2>
          <p className="text-xs text-slate-500">
            {isHost
              ? 'You control when the match begins.'
              : `Waiting for ${hostPlayer?.displayName || 'the host'} to start the game.`}
          </p>
        </div>
        <Badge variant={isHost ? 'amber' : 'slate'}>
          {isHost ? 'Host Only' : 'Player View'}
        </Badge>
      </div>

      {isHost ? (
        <div className="space-y-3">
          {connectedPlayersCount < 2 && (
            <p className="rounded-xl border border-amber-200 bg-amber-50 px-3 py-2 text-xs font-medium text-amber-900">
              At least <strong>2 connected players</strong> are required to start ({connectedPlayersCount}/2 online).
            </p>
          )}

          {!isSocketConnected && (
            <p className="rounded-xl border border-rose-200 bg-rose-50 px-3 py-2 text-xs font-medium text-rose-700">
              Reconnect to the lobby before starting the game.
            </p>
          )}

          {error && (
            <p
              role="alert"
              className="rounded-xl border border-rose-200 bg-rose-50 px-3 py-2 text-xs font-semibold text-rose-700"
            >
              {error.message}
            </p>
          )}

          <Button
            variant="primary"
            size="lg"
            className="w-full"
            onClick={onStartGame}
            disabled={!canStartGame}
          >
            {isStartingGame ? 'Starting Game...' : 'Start Game'}
          </Button>
        </div>
      ) : (
        <div className="rounded-xl border border-slate-200 bg-slate-50 p-3.5 text-xs text-slate-600">
          Only the current host (<strong>{hostPlayer?.displayName || 'Host'}</strong>) can start
          the game. If the host leaves, host control transfers automatically to the next
          connected player.
        </div>
      )}
    </Card>
  );
}
