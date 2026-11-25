import { useState } from 'react';
import { Button, Input } from '../ui/index.js';
import {
  DEFAULT_ROOM_ID,
  DISPLAY_NAME_MAX_LENGTH,
  validateDisplayNameInput,
  validateRoomIdInput,
} from '../../utils/playerValidation.js';

export function PlayerNameForm({ onSubmit, isSubmitting = false, serverError = null, onClearServerError }) {
  const [displayName, setDisplayName] = useState('');
  const [roomId, setRoomId] = useState(DEFAULT_ROOM_ID);
  const [showRoomContext, setShowRoomContext] = useState(false);
  const [touched, setTouched] = useState({ displayName: false, roomId: false });
  const [fieldErrors, setFieldErrors] = useState({ displayName: null, roomId: null });

  const trimmedLength = displayName.trim().length;
  const isOverLimit = trimmedLength > DISPLAY_NAME_MAX_LENGTH;

  const handleNameChange = (e) => {
    const next = e.target.value;
    setDisplayName(next);
    if (serverError) onClearServerError?.();
    if (touched.displayName) {
      setFieldErrors((prev) => ({
        ...prev,
        displayName: validateDisplayNameInput(next).error,
      }));
    }
  };

  const handleRoomChange = (e) => {
    const next = e.target.value;
    setRoomId(next);
    if (serverError) onClearServerError?.();
    if (touched.roomId) {
      setFieldErrors((prev) => ({
        ...prev,
        roomId: validateRoomIdInput(next).error,
      }));
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setTouched({ displayName: true, roomId: true });

    const nameCheck = validateDisplayNameInput(displayName);
    const roomCheck = validateRoomIdInput(roomId);

    setFieldErrors({
      displayName: nameCheck.error,
      roomId: roomCheck.error,
    });

    if (!roomCheck.valid) {
      setShowRoomContext(true);
    }

    if (!nameCheck.valid || !roomCheck.valid) {
      return;
    }

    try {
      await onSubmit({
        displayName: nameCheck.value,
        roomId: roomCheck.value,
      });
    } catch {
      // Error surfaced via serverError prop from PlayerContext
    }
  };

  const isDuplicateError = serverError?.code === 'PLAYER_NAME_TAKEN';

  return (
    <form onSubmit={handleSubmit} noValidate className="space-y-4">
      <Input
        id="guest-display-name"
        name="displayName"
        type="text"
        autoComplete="nickname"
        placeholder="e.g. SketchMaster"
        label="Guest Display Name"
        value={displayName}
        onChange={handleNameChange}
        onBlur={() => {
          setTouched((prev) => ({ ...prev, displayName: true }));
          setFieldErrors((prev) => ({
            ...prev,
            displayName: validateDisplayNameInput(displayName).error,
          }));
        }}
        error={fieldErrors.displayName}
        hint="1–24 characters: letters, numbers, spaces, underscores, or hyphens."
        rightAddon={
          <span
            className={`text-xs font-semibold tabular-nums ${
              isOverLimit ? 'text-rose-600' : 'text-slate-400'
            }`}
          >
            {trimmedLength}/{DISPLAY_NAME_MAX_LENGTH}
          </span>
        }
      />

      <div className="space-y-2">
        <button
          type="button"
          onClick={() => setShowRoomContext((prev) => !prev)}
          className="text-xs font-semibold text-indigo-600 hover:text-indigo-500 cursor-pointer"
        >
          {showRoomContext ? 'Hide room scope' : `Room scope: ${roomId || DEFAULT_ROOM_ID} (change)`}
        </button>

        {showRoomContext && (
          <Input
            id="guest-room-id"
            name="roomId"
            type="text"
            placeholder={DEFAULT_ROOM_ID}
            label="Room Scope ID"
            value={roomId}
            onChange={handleRoomChange}
            onBlur={() => {
              setTouched((prev) => ({ ...prev, roomId: true }));
              setFieldErrors((prev) => ({
                ...prev,
                roomId: validateRoomIdInput(roomId).error,
              }));
            }}
            error={fieldErrors.roomId}
            hint="Backend scopes unique names per room ID (letters, numbers, _ and -). Phase 3 will supply active rooms."
          />
        )}
      </div>

      {serverError && (
        <div
          role="alert"
          className={`rounded-xl border-2 px-3.5 py-2.5 text-xs font-semibold ${
            isDuplicateError
              ? 'border-amber-300 bg-amber-50 text-amber-900'
              : 'border-rose-200 bg-rose-50 text-rose-700'
          }`}
        >
          <p>{serverError.message}</p>
          {isDuplicateError && (
            <p className="mt-1 font-normal text-amber-800">
              Try a different display name or change the room scope above.
            </p>
          )}
        </div>
      )}

      <Button type="submit" variant="primary" size="lg" className="w-full" disabled={isSubmitting}>
        {isSubmitting ? 'Creating Guest Identity...' : 'Continue as Guest'}
      </Button>
    </form>
  );
}
