import { Badge, Button } from '../ui/index.js';

export function AnnouncementBanner({ announcement, onDismiss }) {
  if (!announcement?.message) return null;

  return (
    <div
      role="status"
      aria-live="polite"
      className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border-2 border-amber-300 bg-amber-50 px-4 py-3 shadow-sm"
    >
      <div className="min-w-0 flex-1 space-y-0.5">
        <div className="flex flex-wrap items-center gap-2">
          <Badge variant="amber">Host Announcement</Badge>
          {announcement.displayName && (
            <span className="text-xs font-bold text-amber-900">
              From {announcement.displayName}
            </span>
          )}
          {announcement.sentAt && (
            <span className="text-[11px] text-amber-700">
              {new Date(announcement.sentAt).toLocaleTimeString([], {
                hour: '2-digit',
                minute: '2-digit',
              })}
            </span>
          )}
        </div>
        <p className="break-words text-sm font-semibold text-amber-950">
          {announcement.message}
        </p>
      </div>
      {onDismiss && (
        <Button variant="ghost" size="sm" onClick={onDismiss}>
          Dismiss
        </Button>
      )}
    </div>
  );
}
