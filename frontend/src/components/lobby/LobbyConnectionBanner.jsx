import { Button, StatusIndicator } from '../ui/index.js';

export function LobbyConnectionBanner({
  socketStatus,
  lobbyStatus,
  reconnectAttempt = 0,
  socketError = null,
  onReconnect,
  onRetryJoin,
}) {
  if (socketStatus === 'connected' && lobbyStatus === 'joined') {
    return (
      <div className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-emerald-200 bg-emerald-50/70 px-3.5 py-2.5 text-xs">
        <StatusIndicator state="connected" label="Connected to live lobby" />
        <span className="font-medium text-emerald-800">
          Real-time updates active
        </span>
      </div>
    );
  }

  if (socketStatus === 'connecting' || lobbyStatus === 'joining') {
    return (
      <div className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-amber-200 bg-amber-50/80 px-3.5 py-2.5 text-xs">
        <StatusIndicator state="connecting" label="Connecting to room lobby..." />
        <span className="font-medium text-amber-800">Syncing player roster</span>
      </div>
    );
  }

  if (socketStatus === 'reconnecting') {
    return (
      <div className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-amber-300 bg-amber-50 px-3.5 py-2.5 text-xs">
        <StatusIndicator
          state="connecting"
          label={`Connection lost — reconnecting${reconnectAttempt > 0 ? ` (attempt ${reconnectAttempt})` : '...'}`}
        />
        <span className="font-medium text-amber-800">
          Waiting for server connection
        </span>
      </div>
    );
  }

  const isError = socketStatus === 'error' || lobbyStatus === 'error';

  return (
    <div className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-rose-200 bg-rose-50 px-3.5 py-2.5 text-xs">
      <StatusIndicator
        state={isError ? 'error' : 'disconnected'}
        label={
          socketError ||
          (socketStatus === 'disconnected'
            ? 'Disconnected from lobby server'
            : 'Lobby connection interrupted')
        }
      />
      <div className="flex items-center gap-2">
        {socketStatus !== 'connected' ? (
          <Button variant="outline" size="sm" onClick={onReconnect}>
            Reconnect
          </Button>
        ) : (
          <Button variant="outline" size="sm" onClick={onRetryJoin}>
            Retry Lobby Sync
          </Button>
        )}
      </div>
    </div>
  );
}
