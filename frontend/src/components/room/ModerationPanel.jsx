import { useState } from 'react';
import { Badge, Button, Card, Input } from '../ui/index.js';

export function ModerationPanel({
  isHost,
  players = [],
  currentPlayerId,
  isSocketConnected = false,
  moderationBusy = false,
  moderationError = null,
  announcementBusy = false,
  announcementError = null,
  announcements = [],
  onKickPlayer,
  onBanPlayer,
  onSendAnnouncement,
  onClearModerationError,
  onClearAnnouncementError,
}) {
  const [announcementText, setAnnouncementText] = useState('');
  const [localError, setLocalError] = useState(null);
  const [confirmTarget, setConfirmTarget] = useState(null); // { playerId, action: 'kick' | 'ban' }

  // Strict authorization guard: host moderation controls are rendered only for the host
  if (!isHost) {
    return null;
  }

  const moderatablePlayers = players.filter((p) => p.playerId && p.playerId !== currentPlayerId);

  const handleAnnouncementSubmit = async (e) => {
    e.preventDefault();
    const trimmed = announcementText.trim();
    if (!trimmed) {
      setLocalError('Enter an announcement message before broadcasting.');
      return;
    }
    if (trimmed.length > 500) {
      setLocalError('Announcements cannot exceed 500 characters.');
      return;
    }

    setLocalError(null);
    onClearAnnouncementError?.();
    try {
      await onSendAnnouncement(trimmed);
      setAnnouncementText('');
    } catch {
      // Displayed via announcementError
    }
  };

  const handleModerationAction = async (targetPlayerId, action) => {
    onClearModerationError?.();
    try {
      if (action === 'ban') {
        await onBanPlayer(targetPlayerId);
      } else {
        await onKickPlayer(targetPlayerId);
      }
      setConfirmTarget(null);
    } catch {
      // Displayed via moderationError
    }
  };

  return (
    <Card className="space-y-5">
      <div className="flex items-center justify-between gap-2">
        <div>
          <h2 className="text-base font-extrabold text-slate-900">Host Moderation &amp; Broadcasts</h2>
          <p className="text-xs text-slate-500">
            Broadcast room-wide announcements or kick/ban players.
          </p>
        </div>
        <Badge variant="indigo">Host Only</Badge>
      </div>

      {/* Host Announcement Composer */}
      <form onSubmit={handleAnnouncementSubmit} className="space-y-2.5">
        <Input
          id="host-announcement-input"
          label="Broadcast Announcement"
          value={announcementText}
          onChange={(e) => {
            setAnnouncementText(e.target.value);
            if (localError) setLocalError(null);
            if (announcementError) onClearAnnouncementError?.();
          }}
          maxLength={500}
          placeholder="Type a message for everyone in the room..."
          disabled={!isSocketConnected || announcementBusy}
          error={localError || announcementError?.message}
        />
        <div className="flex items-center justify-between gap-2">
          <span className="text-[11px] text-slate-400">
            {announcementText.trim().length}/500 characters
          </span>
          <Button
            type="submit"
            variant="primary"
            size="sm"
            disabled={!isSocketConnected || announcementBusy || !announcementText.trim()}
          >
            {announcementBusy ? 'Sending...' : 'Send Announcement'}
          </Button>
        </div>
      </form>

      {/* Player Kick / Ban Controls */}
      <div className="space-y-2 border-t border-slate-100 pt-4">
        <h3 className="text-xs font-bold uppercase tracking-wide text-slate-500">
          Player Moderation
        </h3>

        {moderationError && (
          <p
            role="alert"
            className="rounded-xl border border-rose-200 bg-rose-50 px-3 py-2 text-xs font-semibold text-rose-700"
          >
            {moderationError.message}
          </p>
        )}

        {moderatablePlayers.length === 0 ? (
          <p className="rounded-xl bg-slate-50 px-3 py-2.5 text-xs text-slate-500">
            No other players are currently in this room.
          </p>
        ) : (
          <ul className="space-y-2">
            {moderatablePlayers.map((player) => {
              const isConfirming = confirmTarget?.playerId === player.playerId;
              return (
                <li
                  key={player.playerId}
                  className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-slate-200 bg-slate-50/70 px-3 py-2"
                >
                  <div className="flex min-w-0 items-center gap-2">
                    <span className="truncate text-xs font-bold text-slate-800">
                      {player.displayName}
                    </span>
                    <Badge variant={player.isConnected ? 'emerald' : 'slate'}>
                      {player.isConnected ? 'Online' : 'Offline'}
                    </Badge>
                  </div>

                  {isConfirming ? (
                    <div className="flex items-center gap-1.5">
                      <Button
                        variant="danger"
                        size="sm"
                        disabled={!isSocketConnected || moderationBusy}
                        onClick={() => handleModerationAction(player.playerId, confirmTarget.action)}
                      >
                        {moderationBusy
                          ? 'Applying...'
                          : confirmTarget.action === 'ban'
                            ? 'Confirm Ban'
                            : 'Confirm Kick'}
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        disabled={moderationBusy}
                        onClick={() => setConfirmTarget(null)}
                      >
                        Cancel
                      </Button>
                    </div>
                  ) : (
                    <div className="flex items-center gap-1.5">
                      <Button
                        variant="outline"
                        size="sm"
                        disabled={!isSocketConnected || moderationBusy}
                        onClick={() => setConfirmTarget({ playerId: player.playerId, action: 'kick' })}
                      >
                        Kick
                      </Button>
                      <Button
                        variant="danger"
                        size="sm"
                        disabled={!isSocketConnected || moderationBusy}
                        onClick={() => setConfirmTarget({ playerId: player.playerId, action: 'ban' })}
                      >
                        Ban
                      </Button>
                    </div>
                  )}
                </li>
              );
            })}
          </ul>
        )}
      </div>

      {announcements.length > 0 && (
        <div className="space-y-1.5 border-t border-slate-100 pt-3">
          <h3 className="text-[11px] font-bold uppercase tracking-wide text-slate-400">
            Recent Announcements
          </h3>
          <ul className="max-h-28 space-y-1 overflow-y-auto text-xs text-slate-600">
            {announcements.slice(0, 4).map((item) => (
              <li key={item.id} className="truncate">
                <span className="font-semibold text-slate-800">{item.displayName}:</span>{' '}
                {item.message}
              </li>
            ))}
          </ul>
        </div>
      )}
    </Card>
  );
}
