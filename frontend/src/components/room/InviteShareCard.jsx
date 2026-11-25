import { useState } from 'react';
import { Badge, Button, Card } from '../ui/index.js';

export function InviteShareCard({
  roomCode,
  isPublic = true,
  inviteLink = '',
  inviteToken = '',
}) {
  const [feedback, setFeedback] = useState(null);

  const setTempFeedback = (key) => {
    setFeedback(key);
    window.setTimeout(() => {
      setFeedback((prev) => (prev === key ? null : prev));
    }, 2000);
  };

  const copyText = async (key, value) => {
    if (!value) return;
    try {
      await navigator.clipboard.writeText(value);
      setTempFeedback(key);
    } catch {
      setFeedback('error');
    }
  };

  const handleShare = async () => {
    if (!inviteLink) return;
    if (typeof navigator !== 'undefined' && typeof navigator.share === 'function') {
      try {
        await navigator.share({
          title: `Join Draw & Guess Room ${roomCode}`,
          text: isPublic
            ? `Join my Draw & Guess room with code ${roomCode}!`
            : `You're invited to my private Draw & Guess room (${roomCode})!`,
          url: inviteLink,
        });
        setTempFeedback('shared');
        return;
      } catch (err) {
        if (err?.name === 'AbortError') return;
      }
    }
    await copyText('link', inviteLink);
  };

  return (
    <Card className="space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <h2 className="text-sm font-extrabold text-slate-900">Invite Friends</h2>
          <p className="text-xs text-slate-500">
            {isPublic
              ? 'Public room — share the code or invite URL.'
              : 'Private room — invite link includes the required secret token.'}
          </p>
        </div>
        <Badge variant={isPublic ? 'indigo' : 'amber'}>
          {isPublic ? 'Public Link' : 'Private Invite'}
        </Badge>
      </div>

      <div className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-slate-200 bg-slate-50 px-3 py-2">
        <div className="text-xs">
          <span className="text-slate-400">Room Code: </span>
          <span className="font-mono font-black tracking-wider text-slate-900">{roomCode}</span>
        </div>
        <Button variant="outline" size="sm" onClick={() => copyText('code', roomCode)}>
          {feedback === 'code' ? 'Copied Code!' : 'Copy Code'}
        </Button>
      </div>

      {inviteLink && (
        <div className="space-y-2 rounded-xl border border-slate-200 bg-slate-50/70 p-3">
          <p className="break-all rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 font-mono text-[11px] text-slate-700">
            {inviteLink}
          </p>
          <div className="flex flex-wrap gap-2">
            <Button variant="secondary" size="sm" onClick={() => copyText('link', inviteLink)}>
              {feedback === 'link' ? 'Copied Link!' : 'Copy Invite Link'}
            </Button>
            <Button variant="outline" size="sm" onClick={handleShare}>
              {feedback === 'shared' ? 'Shared!' : 'Share Invite'}
            </Button>
          </div>
        </div>
      )}

      {!isPublic && inviteToken && (
        <div className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-amber-200 bg-amber-50/70 px-3 py-2 text-xs">
          <span className="truncate font-mono text-amber-900">
            Token: {inviteToken.slice(0, 8)}••••{inviteToken.slice(-4)}
          </span>
          <Button variant="ghost" size="sm" onClick={() => copyText('token', inviteToken)}>
            {feedback === 'token' ? 'Copied Token!' : 'Copy Token'}
          </Button>
        </div>
      )}

      {feedback === 'error' && (
        <p className="text-[11px] font-semibold text-rose-600">
          Clipboard permission unavailable — copy the invite link manually above.
        </p>
      )}
    </Card>
  );
}
