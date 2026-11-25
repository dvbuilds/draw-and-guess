import { createHash, randomBytes, timingSafeEqual } from 'node:crypto';
import { env } from '../config/env.js';
import { Player } from '../models/Player.js';
import { Room } from '../models/Room.js';
import { validateGuestIdentity } from './playerIdentity.service.js';
import { ApiError } from '../utils/ApiError.js';

const DEFAULT_SETTINGS = {
  maxPlayers: 8,
  rounds: 3,
  drawingTime: 80,
  wordChoices: 3,
  hints: 3,
  hintsEnabled: true,
  wordMode: 'Normal',
  scoring: { correctGuessPoints: 100, drawerPointsPerCorrectGuess: 50 },
};
const WORD_MODES = new Set(['Normal', 'Hidden', 'Combination']);
const ROOM_CODE_ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';

const hash = (value) => createHash('sha256').update(value).digest('hex');
const normalizeName = (value) => value.toLocaleLowerCase('en');

function validateInteger(settings, key, min, max, fallback) {
  const value = settings[key] ?? fallback;
  if (!Number.isInteger(value) || value < min || value > max) {
    throw new ApiError(400, `${key} must be an integer from ${min} to ${max}`, 'VALIDATION_ERROR');
  }
  return value;
}

export function validateRoomSettings(input = {}) {
  if (!input || typeof input !== 'object' || Array.isArray(input)) {
    throw new ApiError(400, 'Settings must be an object', 'VALIDATION_ERROR');
  }
  const hintsValue = input.hints ?? DEFAULT_SETTINGS.hints;
  const hintsEnabled = hintsValue !== 'disabled' && hintsValue !== false;
  const hints = hintsEnabled ? validateInteger({ hints: hintsValue }, 'hints', 0, 5) : 0;
  const wordMode = input.wordMode ?? DEFAULT_SETTINGS.wordMode;
  if (!WORD_MODES.has(wordMode)) {
    throw new ApiError(400, 'wordMode must be Normal, Hidden, or Combination', 'VALIDATION_ERROR');
  }
  const scoringInput = input.scoring ?? {};
  if (!scoringInput || typeof scoringInput !== 'object' || Array.isArray(scoringInput)) {
    throw new ApiError(400, 'scoring must be an object', 'VALIDATION_ERROR');
  }
  return {
    maxPlayers: validateInteger(input, 'maxPlayers', 2, 20, DEFAULT_SETTINGS.maxPlayers),
    rounds: validateInteger(input, 'rounds', 2, 10, DEFAULT_SETTINGS.rounds),
    drawingTime: validateInteger(input, 'drawingTime', 15, 240, DEFAULT_SETTINGS.drawingTime),
    wordChoices: validateInteger(input, 'wordChoices', 1, 5, DEFAULT_SETTINGS.wordChoices),
    hints,
    hintsEnabled,
    wordMode,
    scoring: {
      correctGuessPoints: validateInteger(scoringInput, 'correctGuessPoints', 1, 1000, DEFAULT_SETTINGS.scoring.correctGuessPoints),
      drawerPointsPerCorrectGuess: validateInteger(scoringInput, 'drawerPointsPerCorrectGuess', 0, 1000, DEFAULT_SETTINGS.scoring.drawerPointsPerCorrectGuess),
    },
  };
}

function roomCode() {
  const bytes = randomBytes(8);
  return [...bytes].map((byte) => ROOM_CODE_ALPHABET[byte % ROOM_CODE_ALPHABET.length]).join('');
}

async function uniqueRoomCode() {
  for (let attempt = 0; attempt < 5; attempt += 1) {
    const code = roomCode();
    if (!(await Room.exists({ code }))) return code;
  }
  throw new ApiError(503, 'Could not generate a room code; try again', 'ROOM_CODE_UNAVAILABLE');
}

async function requirePlayerIdentity({ playerId, identityToken }) {
  const result = await validateGuestIdentity({ playerId, identityToken });
  if (!result.valid) throw new ApiError(400, 'Player identity is invalid', 'INVALID_PLAYER_IDENTITY');
  const player = await Player.findById(playerId);
  if (!player) throw new ApiError(400, 'Player identity is invalid', 'INVALID_PLAYER_IDENTITY');
  return player;
}

function memberRecord(player, role) {
  return {
    playerId: player._id,
    displayName: player.displayName,
    normalizedDisplayName: player.normalizedDisplayName || normalizeName(player.displayName),
    role,
  };
}

function roomResponse(room, inviteToken) {
  const response = {
    roomId: room.id,
    roomCode: room.code,
    isPublic: room.isPublic,
    settings: {
      maxPlayers: room.settings.maxPlayers,
      rounds: room.settings.rounds,
      drawingTime: room.settings.drawingTime,
      wordChoices: room.settings.wordChoices,
      hints: room.settings.hintsEnabled ? room.settings.hints : 'disabled',
      wordMode: room.settings.wordMode,
      scoring: {
        correctGuessPoints: room.settings.scoring.correctGuessPoints,
        drawerPointsPerCorrectGuess: room.settings.scoring.drawerPointsPerCorrectGuess,
      },
    },
    hostPlayerId: String(room.hostPlayerId),
    members: room.members.map(({ playerId, displayName, role }) => ({
      playerId: String(playerId), displayName, role,
    })),
  };
  if (room.isPublic) response.inviteLink = `${env.CLIENT_URL}/?roomCode=${room.code}`;
  else if (inviteToken) {
    response.inviteLink = `${env.CLIENT_URL}/?roomCode=${room.code}&inviteToken=${inviteToken}`;
    response.inviteToken = inviteToken;
  }
  return response;
}

export async function createRoom(input = {}) {
  const player = await requirePlayerIdentity(input);
  const settings = validateRoomSettings(input.settings ?? {});
  const isPublic = input.isPublic ?? true;
  if (typeof isPublic !== 'boolean') {
    throw new ApiError(400, 'isPublic must be a boolean', 'VALIDATION_ERROR');
  }

  const code = await uniqueRoomCode();
  const inviteToken = isPublic ? undefined : randomBytes(32).toString('base64url');
  const room = await Room.create({
    code,
    isPublic,
    settings,
    hostPlayerId: player._id,
    members: [memberRecord(player, 'host')],
    ...(inviteToken ? { privateInviteTokenHash: hash(inviteToken) } : {}),
  });
  return roomResponse(room, inviteToken);
}

function tokenMatches(expectedHash, suppliedToken) {
  if (!expectedHash || typeof suppliedToken !== 'string' || !suppliedToken) return false;
  const expected = Buffer.from(expectedHash, 'hex');
  const actual = Buffer.from(hash(suppliedToken), 'hex');
  return expected.length === actual.length && timingSafeEqual(expected, actual);
}

export async function joinRoom(input = {}) {
  const { roomCode: inputCode, inviteToken } = input;
  if (typeof inputCode !== 'string' || !/^[A-Za-z0-9]{8}$/.test(inputCode.trim())) {
    throw new ApiError(400, 'A valid 8-character roomCode is required', 'INVALID_ROOM_CODE');
  }
  const code = inputCode.trim().toUpperCase();
  const player = await requirePlayerIdentity(input);
  const room = await Room.findOne({ code }).select('+privateInviteTokenHash');
  if (!room) throw new ApiError(404, 'Room code was not found', 'ROOM_NOT_FOUND');
  if (!room.isPublic && !tokenMatches(room.privateInviteTokenHash, inviteToken)) {
    throw new ApiError(403, 'A valid invite token is required for this private room', 'PRIVATE_ROOM');
  }
  if (room.gameStatus && room.gameStatus !== 'lobby') {
    throw new ApiError(409, 'Players cannot join after the game has started', 'GAME_ALREADY_STARTED');
  }

  const playerId = String(player._id);
  const existing = room.members.find((member) => String(member.playerId) === playerId);
  if (existing) throw new ApiError(409, 'Player is already a member of this room', 'ALREADY_IN_ROOM');
  const normalizedDisplayName = normalizeName(player.displayName);
  if (room.members.some((member) => member.normalizedDisplayName === normalizedDisplayName)) {
    throw new ApiError(409, 'That display name is already in use in this room', 'PLAYER_NAME_TAKEN');
  }
  if (room.members.length >= room.settings.maxPlayers) {
    throw new ApiError(409, 'Room is at capacity', 'ROOM_FULL');
  }

  const updatedRoom = await Room.findOneAndUpdate(
    {
      _id: room._id,
      'members.playerId': { $ne: player._id },
      'members.normalizedDisplayName': { $ne: normalizedDisplayName },
      $expr: { $lt: [{ $size: '$members' }, '$settings.maxPlayers'] },
    },
    { $push: { members: memberRecord(player, 'player') } },
    { new: true }
  );
  if (!updatedRoom) {
    const current = await Room.findById(room._id);
    if (current?.members.some((member) => String(member.playerId) === playerId)) {
      throw new ApiError(409, 'Player is already a member of this room', 'ALREADY_IN_ROOM');
    }
    if (current?.members.some((member) => member.normalizedDisplayName === normalizedDisplayName)) {
      throw new ApiError(409, 'That display name is already in use in this room', 'PLAYER_NAME_TAKEN');
    }
    throw new ApiError(409, 'Room is at capacity', 'ROOM_FULL');
  }

  return roomResponse(updatedRoom);
}
