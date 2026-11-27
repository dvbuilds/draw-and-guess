import { useEffect, useRef, useState } from 'react';
import { Badge, Button, Card, Input } from '../ui/index.js';

const MAX_CHAT_LENGTH = 500;

export function ChatPanel({
  messages = [],
  currentPlayerId = null,
  isConnected = true,
  isSending = false,
  error = null,
  onSendMessage,
  onClearError,
  title = 'Room Chat',
}) {
  const [text, setText] = useState('');
  const [validationError, setValidationError] = useState(null);
  const listRef = useRef(null);

  useEffect(() => {
    const el = listRef.current;
    if (el) {
      el.scrollTop = el.scrollHeight;
    }
  }, [messages.length]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!isConnected || isSending) return;

    const trimmed = text.trim();
    if (!trimmed) {
      setValidationError('Enter a message before sending.');
      return;
    }
    if (trimmed.length > MAX_CHAT_LENGTH) {
      setValidationError(`Message must be ${MAX_CHAT_LENGTH} characters or fewer.`);
      return;
    }

    setValidationError(null);
    onClearError?.();
    try {
      await onSendMessage(trimmed);
      setText('');
    } catch {
      // Server error surfaced via error prop
    }
  };

  return (
    <Card variant="elevated" className="space-y-3">
      <div className="flex items-center justify-between border-b border-slate-100 pb-2.5">
        <h2 className="text-sm font-extrabold text-slate-900">{title}</h2>
        <Badge variant={isConnected ? 'emerald' : 'slate'}>
          {isConnected ? 'Live Chat' : 'Offline'}
        </Badge>
      </div>

      <div
        ref={listRef}
        className="max-h-52 min-h-28 space-y-2 overflow-y-auto rounded-xl border border-slate-200 bg-slate-50/70 p-3 text-xs"
      >
        {messages.length === 0 ? (
          <p className="text-slate-500">
            No messages yet. Say hello to everyone in the room!
          </p>
        ) : (
          messages.map((item) => {
            const isSelf = item.playerId === currentPlayerId;
            return (
              <div
                key={item.id}
                className={`rounded-lg px-2.5 py-1.5 ${
                  isSelf
                    ? 'bg-indigo-50/90 border border-indigo-100'
                    : 'bg-white border border-slate-100'
                }`}
              >
                <div className="flex items-baseline justify-between gap-2">
                  <span className="font-extrabold text-slate-900">
                    {item.displayName}
                    {isSelf && (
                      <span className="ml-1 text-[10px] font-bold text-indigo-600">(You)</span>
                    )}
                  </span>
                  {item.sentAt && (
                    <span className="shrink-0 font-mono text-[10px] text-slate-400">
                      {new Date(item.sentAt).toLocaleTimeString([], {
                        hour: '2-digit',
                        minute: '2-digit',
                      })}
                    </span>
                  )}
                </div>
                <p className="mt-0.5 break-words text-slate-700">{item.message}</p>
              </div>
            );
          })
        )}
      </div>

      <form onSubmit={handleSubmit} noValidate className="flex items-start gap-2">
        <div className="min-w-0 flex-1">
          <Input
            id="room-chat-input"
            name="chatMessage"
            type="text"
            autoComplete="off"
            placeholder={isConnected ? 'Send a chat message...' : 'Reconnect to chat...'}
            value={text}
            disabled={!isConnected || isSending}
            onChange={(e) => {
              setText(e.target.value);
              if (validationError) setValidationError(null);
              if (error) onClearError?.();
            }}
            error={validationError}
          />
        </div>
        <Button
          type="submit"
          variant="secondary"
          size="md"
          disabled={!isConnected || isSending}
          className="mt-0.5 shrink-0"
        >
          {isSending ? 'Sending...' : 'Send'}
        </Button>
      </form>

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
