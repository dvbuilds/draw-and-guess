import { useState } from 'react';
import { Button, Input } from '../ui/index.js';
import {
  DEFAULT_ROOM_ID,
  DISPLAY_NAME_MAX_LENGTH,
  validateDisplayNameInput,
} from '../../utils/playerValidation.js';

export function PlayerNameForm({ onSubmit, isSubmitting = false, serverError = null, onClearServerError }) {
  const [displayName, setDisplayName] = useState('');
  const [touched, setTouched] = useState(false);
  const [fieldError, setFieldError] = useState(null);

  const trimmedLength = displayName.trim().length;
  const isOverLimit = trimmedLength > DISPLAY_NAME_MAX_LENGTH;

  const handleNameChange = (e) => {
    const next = e.target.value;
    setDisplayName(next);
    if (serverError) onClearServerError?.();
    if (touched) {
      setFieldError(validateDisplayNameInput(next).error);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setTouched(true);

    const nameCheck = validateDisplayNameInput(displayName);
    setFieldError(nameCheck.error);
    if (!nameCheck.valid) return;

    try {
      await onSubmit({
        displayName: nameCheck.value,
        roomId: DEFAULT_ROOM_ID,
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
        label="Guest Nickname"
        value={displayName}
        onChange={handleNameChange}
        onBlur={() => {
          setTouched(true);
          setFieldError(validateDisplayNameInput(displayName).error);
        }}
        error={fieldError}
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
              Try a slightly different nickname to stand out in the room.
            </p>
          )}
        </div>
      )}

      <Button type="submit" variant="primary" size="lg" className="w-full" disabled={isSubmitting}>
        {isSubmitting ? 'Joining Party...' : 'Start Playing as Guest'}
      </Button>
    </form>
  );
}
