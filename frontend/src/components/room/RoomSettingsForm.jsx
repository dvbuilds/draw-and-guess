import { useEffect, useMemo, useState } from 'react';
import { useLanguage } from '../../hooks/useLanguage.js';
import { getAvailableCategories, getAvailableLanguages } from '../../services/wordService.js';
import { Button, Input, Select } from '../ui/index.js';
import {
  DEFAULT_ROOM_SETTINGS,
  ROOM_LIMITS,
  WORD_CATEGORIES,
  WORD_LANGUAGES,
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
  const { language: uiLanguage } = useLanguage();
  const [isPublic, setIsPublic] = useState(true);
  const [availableLanguages, setAvailableLanguages] = useState(WORD_LANGUAGES);
  const [availableCategories, setAvailableCategories] = useState(WORD_CATEGORIES);
  const [formValues, setFormValues] = useState({
    maxPlayers: String(DEFAULT_ROOM_SETTINGS.maxPlayers),
    rounds: String(DEFAULT_ROOM_SETTINGS.rounds),
    drawingTime: String(DEFAULT_ROOM_SETTINGS.drawingTime),
    wordChoices: String(DEFAULT_ROOM_SETTINGS.wordChoices),
    hints: String(DEFAULT_ROOM_SETTINGS.hints),
    wordMode: DEFAULT_ROOM_SETTINGS.wordMode,
    language: uiLanguage || DEFAULT_ROOM_SETTINGS.language,
    wordCategories: DEFAULT_ROOM_SETTINGS.wordCategories,
    voteKickEnabled: DEFAULT_ROOM_SETTINGS.voteKickEnabled,
    voteKickThreshold: String(DEFAULT_ROOM_SETTINGS.voteKickThreshold),
  });
  const [fieldErrors, setFieldErrors] = useState({});

  useEffect(() => {
    let active = true;
    getAvailableLanguages()
      .then((langs) => {
        if (active && Array.isArray(langs) && langs.length > 0) {
          setAvailableLanguages(langs);
        }
      })
      .catch(() => {});
    return () => {
      active = false;
    };
  }, []);

  useEffect(() => {
    let active = true;
    getAvailableCategories(formValues.language)
      .then((cats) => {
        if (active && Array.isArray(cats) && cats.length > 0) {
          setAvailableCategories(cats);
        }
      })
      .catch(() => {});
    return () => {
      active = false;
    };
  }, [formValues.language]);

  const selectableCategories = useMemo(() => {
    if (formValues.wordMode === 'Combination') {
      return availableCategories.filter((cat) => cat === 'Combination');
    }
    return availableCategories.filter((cat) => cat !== 'Combination');
  }, [availableCategories, formValues.wordMode]);

  const languageOptions = useMemo(
    () => availableLanguages.map((lang) => ({ value: lang.code, label: lang.name })),
    [availableLanguages]
  );

  const updateField = (field, value) => {
    setFormValues((prev) => {
      const next = { ...prev, [field]: value };
      if (field === 'wordMode') {
        if (value === 'Combination') {
          next.wordCategories = prev.wordCategories.filter((c) => c === 'Combination');
        } else {
          next.wordCategories = prev.wordCategories.filter((c) => c !== 'Combination');
        }
      }
      return next;
    });
    if (serverError) onClearServerError?.();
    if (fieldErrors[field] || fieldErrors.wordCategories) {
      setFieldErrors((prev) => ({ ...prev, [field]: undefined, wordCategories: undefined }));
    }
  };

  const toggleCategory = (category) => {
    setFormValues((prev) => {
      const exists = prev.wordCategories.includes(category);
      return {
        ...prev,
        wordCategories: exists
          ? prev.wordCategories.filter((item) => item !== category)
          : [...prev.wordCategories, category],
      };
    });
    if (serverError) onClearServerError?.();
    if (fieldErrors.wordCategories) {
      setFieldErrors((prev) => ({ ...prev, wordCategories: undefined }));
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
      language: formValues.language,
      wordCategories: formValues.wordCategories,
      voteKickEnabled: Boolean(formValues.voteKickEnabled),
      voteKickThreshold:
        formValues.voteKickThreshold === '' ? NaN : Number(formValues.voteKickThreshold),
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

        <Select
          id="room-word-language"
          name="language"
          label="Word Language"
          value={formValues.language}
          onChange={(e) => updateField('language', e.target.value)}
          options={languageOptions}
          error={fieldErrors.language}
          hint="Language used for generated drawing words."
        />
      </div>

      {/* Word Category Selection */}
      <div className="space-y-2">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <span className="block text-sm font-bold text-slate-800">Word Categories</span>
          {formValues.wordCategories.length > 0 && (
            <button
              type="button"
              onClick={() => updateField('wordCategories', [])}
              className="cursor-pointer text-xs font-bold text-indigo-600 hover:text-indigo-700"
            >
              Reset to all categories
            </button>
          )}
        </div>
        <div className="flex flex-wrap gap-2">
          {selectableCategories.map((category) => {
            const selected = formValues.wordCategories.includes(category);
            return (
              <button
                key={category}
                type="button"
                aria-pressed={selected}
                onClick={() => toggleCategory(category)}
                className={`cursor-pointer rounded-xl border-2 px-3 py-1.5 text-xs font-bold transition-all ${
                  selected
                    ? 'border-indigo-600 bg-indigo-600 text-white shadow-[0_2px_0_0_#3730a3]'
                    : 'border-slate-200 bg-white text-slate-700 hover:border-slate-300'
                }`}
              >
                {category}
              </button>
            );
          })}
        </div>
        <p className="text-xs text-slate-500">
          {formValues.wordCategories.length === 0
            ? formValues.wordMode === 'Combination'
              ? 'Defaulting to Combination prompts.'
              : 'Leave unselected to include words from all standard categories.'
            : `Selected: ${formValues.wordCategories.join(', ')}`}
        </p>
        {fieldErrors.wordCategories && (
          <p role="alert" className="text-xs font-semibold text-rose-600">
            {fieldErrors.wordCategories}
          </p>
        )}
      </div>

      {/* VoteKick Moderation Settings */}
      <div className="grid gap-4 rounded-xl border-2 border-slate-200 bg-slate-50/70 p-4 sm:grid-cols-2 sm:items-center">
        <label className="flex cursor-pointer items-start gap-3">
          <input
            type="checkbox"
            checked={formValues.voteKickEnabled}
            onChange={(e) => updateField('voteKickEnabled', e.target.checked)}
            className="mt-0.5 h-4 w-4 rounded border-slate-300 text-indigo-600 focus:ring-indigo-500"
          />
          <div>
            <span className="block text-sm font-bold text-slate-800">Enable VoteKick</span>
            <span className="block text-xs text-slate-500">
              Let players vote to remove disruptive members.
            </span>
          </div>
        </label>

        <Input
          id="room-votekick-threshold"
          name="voteKickThreshold"
          type="number"
          min={ROOM_LIMITS.voteKickThreshold.min}
          max={ROOM_LIMITS.voteKickThreshold.max}
          label="VoteKick Threshold (%)"
          disabled={!formValues.voteKickEnabled}
          value={formValues.voteKickThreshold}
          onChange={(e) => updateField('voteKickThreshold', e.target.value)}
          error={fieldErrors.voteKickThreshold}
          hint={`${ROOM_LIMITS.voteKickThreshold.min}%–${ROOM_LIMITS.voteKickThreshold.max}% Yes votes required`}
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
