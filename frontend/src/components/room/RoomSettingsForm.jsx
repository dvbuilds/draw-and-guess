import { useState } from 'react';
import { Button, Input, Select } from '../ui/index.js';
import {
  DEFAULT_ROOM_SETTINGS,
  ROOM_LIMITS,
  WORD_MODES,
  validateRoomSettingsInput,
} from '../../utils/roomValidation.js';

const HINT_OPTIONS = [
  { value: 'disabled', label: 'Disabled (no hints)' },
  { value: '0', label: '0 hints' },
  { value: '1', label: '1 hint' },
  { value: '2', label: '2 hints' },
  { value: '3', label: '3 hints (default)' },
  { value: '4', label: '4 hints' },
  { value: '5', label: '5 hints' },
];

const WORD_MODE_OPTIONS = WORD_MODES.map((mode) => ({
  value: mode,
  label:
    mode === 'Normal'
      ? 'Normal (standard word blanks)'
      : mode === 'Hidden'
        ? 'Hidden (no blanks revealed)'
        : 'Combination (mixed word challenges)',
}));

export function RoomSettingsForm({
  onSubmit,
  isSubmitting = false,
  serverError = null,
  onClearServerError,
}) {
  const [isPublic, setIsPublic] = useState(true);
  const [formValues, setFormValues] = useState({
    maxPlayers: String(DEFAULT_ROOM_SETTINGS.maxPlayers),
    rounds: String(DEFAULT_ROOM_SETTINGS.rounds),
    drawingTime: String(DEFAULT_ROOM_SETTINGS.drawingTime),
    wordChoices: String(DEFAULT_ROOM_SETTINGS.wordChoices),
    hints: String(DEFAULT_ROOM_SETTINGS.hints),
    wordMode: DEFAULT_ROOM_SETTINGS.wordMode,
  });
  const [fieldErrors, setFieldErrors] = useState({});

  const updateField = (field, value) => {
    setFormValues((prev) => ({ ...prev, [field]: value }));
    if (serverError) onClearServerError?.();
    if (fieldErrors[field]) {
      setFieldErrors((prev) => ({ ...prev, [field]: undefined }));
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();

    const parsedInput = {
      maxPlayers: formValues.maxPlayers === '' ? NaN : Number(formValues.maxPlayers),
      rounds: formValues.rounds === '' ? NaN : Number(formValues.rounds),
      drawingTime: formValues.drawingTime === '' ? NaN : Number(formValues.drawingTime),
      wordChoices: formValues.wordChoices === '' ? NaN : Number(formValues.wordChoices),
      hints: formValues.hints === 'disabled' ? 'disabled' : Number(formValues.hints),
      wordMode: formValues.wordMode,
    };

    const validation = validateRoomSettingsInput(parsedInput);
    if (!validation.valid) {
      setFieldErrors(validation.errors);
      return;
    }

    setFieldErrors({});
    try {
      await onSubmit({
        isPublic,
        settings: validation.value,
      });
    } catch {
      // Server error is handled and passed down by parent
    }
  };

  return (
    <form onSubmit={handleSubmit} noValidate className="space-y-6">
      {/* Public / Private Room Visibility Selection */}
      <div className="space-y-2">
        <span className="block text-sm font-bold text-slate-800">Room Visibility</span>
        <div className="grid gap-3 sm:grid-cols-2">
          <button
            type="button"
            onClick={() => {
              setIsPublic(true);
              if (serverError) onClearServerError?.();
            }}
            className={`rounded-xl border-2 p-3.5 text-left transition-all cursor-pointer ${
              isPublic
                ? 'border-indigo-600 bg-indigo-50/70 shadow-[0_3px_0_0_rgba(79,70,229,0.2)]'
                : 'border-slate-200 bg-white hover:border-slate-300'
            }`}
          >
            <div className="flex items-center justify-between">
              <span className="text-sm font-extrabold text-slate-900">Public Room</span>
              <span
                className={`h-3.5 w-3.5 rounded-full border-2 ${
                  isPublic ? 'border-indigo-600 bg-indigo-600' : 'border-slate-300'
                }`}
              />
            </div>
            <p className="mt-1 text-xs text-slate-600">
              Anyone with the 8-character room code or invite link can join.
            </p>
          </button>

          <button
            type="button"
            onClick={() => {
              setIsPublic(false);
              if (serverError) onClearServerError?.();
            }}
            className={`rounded-xl border-2 p-3.5 text-left transition-all cursor-pointer ${
              !isPublic
                ? 'border-indigo-600 bg-indigo-50/70 shadow-[0_3px_0_0_rgba(79,70,229,0.2)]'
                : 'border-slate-200 bg-white hover:border-slate-300'
            }`}
          >
            <div className="flex items-center justify-between">
              <span className="text-sm font-extrabold text-slate-900">Private Room</span>
              <span
                className={`h-3.5 w-3.5 rounded-full border-2 ${
                  !isPublic ? 'border-indigo-600 bg-indigo-600' : 'border-slate-300'
                }`}
              />
            </div>
            <p className="mt-1 text-xs text-slate-600">
              Requires the private invite link or secret invite token to join.
            </p>
          </button>
        </div>
      </div>

      {/* Room Settings Grid */}
      <div className="grid gap-4 sm:grid-cols-2">
        <Input
          id="room-max-players"
          name="maxPlayers"
          type="number"
          min={ROOM_LIMITS.maxPlayers.min}
          max={ROOM_LIMITS.maxPlayers.max}
          label="Max Players"
          value={formValues.maxPlayers}
          onChange={(e) => updateField('maxPlayers', e.target.value)}
          error={fieldErrors.maxPlayers}
          hint={`${ROOM_LIMITS.maxPlayers.min}–${ROOM_LIMITS.maxPlayers.max} players`}
        />

        <Input
          id="room-rounds"
          name="rounds"
          type="number"
          min={ROOM_LIMITS.rounds.min}
          max={ROOM_LIMITS.rounds.max}
          label="Rounds"
          value={formValues.rounds}
          onChange={(e) => updateField('rounds', e.target.value)}
          error={fieldErrors.rounds}
          hint={`${ROOM_LIMITS.rounds.min}–${ROOM_LIMITS.rounds.max} rounds`}
        />

        <Input
          id="room-drawing-time"
          name="drawingTime"
          type="number"
          min={ROOM_LIMITS.drawingTime.min}
          max={ROOM_LIMITS.drawingTime.max}
          label="Drawing Time (seconds)"
          value={formValues.drawingTime}
          onChange={(e) => updateField('drawingTime', e.target.value)}
          error={fieldErrors.drawingTime}
          hint={`${ROOM_LIMITS.drawingTime.min}–${ROOM_LIMITS.drawingTime.max} seconds per turn`}
        />

        <Input
          id="room-word-choices"
          name="wordChoices"
          type="number"
          min={ROOM_LIMITS.wordChoices.min}
          max={ROOM_LIMITS.wordChoices.max}
          label="Word Choices"
          value={formValues.wordChoices}
          onChange={(e) => updateField('wordChoices', e.target.value)}
          error={fieldErrors.wordChoices}
          hint={`${ROOM_LIMITS.wordChoices.min}–${ROOM_LIMITS.wordChoices.max} choices per turn`}
        />

        <Select
          id="room-hints"
          name="hints"
          label="Letter Hints"
          value={formValues.hints}
          onChange={(e) => updateField('hints', e.target.value)}
          options={HINT_OPTIONS}
          error={fieldErrors.hints}
          hint="Set hint count (0–5) or disable hints."
        />

        <Select
          id="room-word-mode"
          name="wordMode"
          label="Word Mode"
          value={formValues.wordMode}
          onChange={(e) => updateField('wordMode', e.target.value)}
          options={WORD_MODE_OPTIONS}
          error={fieldErrors.wordMode}
          hint="Controls how words are presented during rounds."
        />
      </div>

      {serverError && (
        <div
          role="alert"
          className="rounded-xl border-2 border-rose-200 bg-rose-50 px-3.5 py-2.5 text-xs font-semibold text-rose-700"
        >
          {serverError.message}
        </div>
      )}

      <Button type="submit" variant="primary" size="lg" className="w-full" disabled={isSubmitting}>
        {isSubmitting ? 'Creating Room...' : `Create ${isPublic ? 'Public' : 'Private'} Room`}
      </Button>
    </form>
  );
}
