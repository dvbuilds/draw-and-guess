export const WORD_MODES = ['Normal', 'Hidden', 'Combination'];
export const WORD_LANGUAGES = [
  { code: 'en', name: 'English' },
  { code: 'es', name: 'Español' },
  { code: 'fr', name: 'Français' },
];
export const WORD_LANGUAGE_CODES = WORD_LANGUAGES.map((l) => l.code);
export const WORD_CATEGORIES = [
  'Animals',
  'Food',
  'Objects',
  'Nature',
  'Places',
  'Activities',
  'Combination',
];

export const ROOM_LIMITS = {
  maxPlayers: { min: 2, max: 20, default: 8 },
  rounds: { min: 2, max: 10, default: 3 },
  drawingTime: { min: 15, max: 240, default: 80 },
  wordChoices: { min: 1, max: 5, default: 3 },
  hints: { min: 0, max: 5, default: 3 },
  voteKickThreshold: { min: 50, max: 100, default: 60 },
};

export const DEFAULT_ROOM_SETTINGS = {
  maxPlayers: ROOM_LIMITS.maxPlayers.default,
  rounds: ROOM_LIMITS.rounds.default,
  drawingTime: ROOM_LIMITS.drawingTime.default,
  wordChoices: ROOM_LIMITS.wordChoices.default,
  hints: ROOM_LIMITS.hints.default,
  wordMode: 'Normal',
  language: 'en',
  wordCategories: [],
  voteKickEnabled: true,
  voteKickThreshold: ROOM_LIMITS.voteKickThreshold.default,
};

const ROOM_CODE_PATTERN = /^[A-Za-z0-9]{8}$/;

function validateIntField(rawValue, label, min, max) {
  const num = typeof rawValue === 'number' ? rawValue : Number(rawValue);
  if (!Number.isInteger(num) || num < min || num > max) {
    return {
      valid: false,
      value: rawValue,
      error: `${label} must be a whole number from ${min} to ${max}`,
    };
  }
  return { valid: true, value: num, error: null };
}

export function validateRoomSettingsInput(settings = {}) {
  const errors = {};

  const maxPlayers = validateIntField(
    settings.maxPlayers,
    'Max players',
    ROOM_LIMITS.maxPlayers.min,
    ROOM_LIMITS.maxPlayers.max
  );
  if (!maxPlayers.valid) errors.maxPlayers = maxPlayers.error;

  const rounds = validateIntField(
    settings.rounds,
    'Rounds',
    ROOM_LIMITS.rounds.min,
    ROOM_LIMITS.rounds.max
  );
  if (!rounds.valid) errors.rounds = rounds.error;

  const drawingTime = validateIntField(
    settings.drawingTime,
    'Drawing time',
    ROOM_LIMITS.drawingTime.min,
    ROOM_LIMITS.drawingTime.max
  );
  if (!drawingTime.valid) errors.drawingTime = drawingTime.error;

  const wordChoices = validateIntField(
    settings.wordChoices,
    'Word choices',
    ROOM_LIMITS.wordChoices.min,
    ROOM_LIMITS.wordChoices.max
  );
  if (!wordChoices.valid) errors.wordChoices = wordChoices.error;

  let hintsValue = settings.hints;
  if (hintsValue === 'disabled' || hintsValue === false) {
    hintsValue = 'disabled';
  } else {
    const hints = validateIntField(
      hintsValue,
      'Hints',
      ROOM_LIMITS.hints.min,
      ROOM_LIMITS.hints.max
    );
    if (!hints.valid) {
      errors.hints = 'Hints must be disabled or a whole number from 0 to 5';
    } else {
      hintsValue = hints.value;
    }
  }

  const wordMode = settings.wordMode;
  if (!WORD_MODES.includes(wordMode)) {
    errors.wordMode = 'Word mode must be Normal, Hidden, or Combination';
  }

  const language = settings.language ?? DEFAULT_ROOM_SETTINGS.language;
  if (!WORD_LANGUAGE_CODES.includes(language)) {
    errors.language = 'Language must be English (en), Español (es), or Français (fr)';
  }

  let wordCategories = [];
  if (settings.wordCategories !== undefined) {
    if (!Array.isArray(settings.wordCategories)) {
      errors.wordCategories = 'Word categories must be a list of category names';
    } else {
      const uniqueCategories = Array.from(
        new Set(settings.wordCategories.map((c) => String(c || '').trim()).filter(Boolean))
      );
      const invalidCategories = uniqueCategories.filter((c) => !WORD_CATEGORIES.includes(c));
      if (invalidCategories.length > 0) {
        errors.wordCategories = `Unsupported word category: ${invalidCategories.join(', ')}`;
      } else if (wordMode === 'Combination' && uniqueCategories.some((c) => c !== 'Combination')) {
        errors.wordCategories = 'Combination word mode only supports the Combination category';
      } else if (wordMode !== 'Combination' && uniqueCategories.includes('Combination')) {
        errors.wordCategories = 'The Combination category is only valid when Word Mode is Combination';
      }
      wordCategories = uniqueCategories;
    }
  }

  const voteKickEnabled =
    settings.voteKickEnabled === undefined ? DEFAULT_ROOM_SETTINGS.voteKickEnabled : settings.voteKickEnabled;
  if (typeof voteKickEnabled !== 'boolean') {
    errors.voteKickEnabled = 'VoteKick enabled must be true or false';
  }

  const rawThreshold =
    settings.voteKickThreshold === undefined
      ? DEFAULT_ROOM_SETTINGS.voteKickThreshold
      : settings.voteKickThreshold;
  const voteKickThreshold = validateIntField(
    rawThreshold,
    'VoteKick threshold',
    ROOM_LIMITS.voteKickThreshold.min,
    ROOM_LIMITS.voteKickThreshold.max
  );
  if (!voteKickThreshold.valid) {
    errors.voteKickThreshold = `VoteKick threshold must be a whole number from ${ROOM_LIMITS.voteKickThreshold.min}% to ${ROOM_LIMITS.voteKickThreshold.max}%`;
  }

  return {
    valid: Object.keys(errors).length === 0,
    errors,
    value: {
      maxPlayers: maxPlayers.value,
      rounds: rounds.value,
      drawingTime: drawingTime.value,
      wordChoices: wordChoices.value,
      hints: hintsValue,
      wordMode,
      language,
      wordCategories,
      voteKickEnabled: Boolean(voteKickEnabled),
      voteKickThreshold: voteKickThreshold.value,
    },
  };
}

export function validateRoomCodeInput(rawCode) {
  if (typeof rawCode !== 'string') {
    return {
      valid: false,
      value: '',
      error: 'Enter an 8-character room code (letters and numbers)',
    };
  }

  const normalized = rawCode.trim().toUpperCase();
  if (!ROOM_CODE_PATTERN.test(normalized)) {
    return {
      valid: false,
      value: normalized,
      error: 'Room code must be exactly 8 letters or numbers',
    };
  }

  return { valid: true, value: normalized, error: null };
}
