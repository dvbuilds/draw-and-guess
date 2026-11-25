import { randomInt } from 'node:crypto';
import mongoose from 'mongoose';
import { Room } from '../models/Room.js';
import { Word, WORD_CATEGORIES } from '../models/Word.js';
import { ApiError } from '../utils/ApiError.js';

const idOf = (value) => String(value);

function eligibleCategories(wordMode) {
  if (wordMode === 'Combination') return ['Combination'];
  return WORD_CATEGORIES.filter((category) => category !== 'Combination');
}

function sampleWithoutReplacement(values, count) {
  const shuffled = [...values];
  for (let index = shuffled.length - 1; index > 0; index -= 1) {
    const other = randomInt(index + 1);
    [shuffled[index], shuffled[other]] = [shuffled[other], shuffled[index]];
  }
  return shuffled.slice(0, count);
}

export async function prepareWordOptions(settings) {
  const count = settings.wordChoices;
  if (!Number.isInteger(count) || count < 1 || count > 5) {
    throw new ApiError(500, 'Room word choice settings are invalid', 'INVALID_WORD_SETTINGS');
  }
  const categories = eligibleCategories(settings.wordMode);
  const candidates = await Word.find({ isActive: true, category: { $in: categories } });
  const options = sampleWithoutReplacement(candidates, count);
  if (options.length !== count) {
    throw new ApiError(503, `At least ${count} active words are required for this mode`, 'NOT_ENOUGH_WORDS');
  }
  return {
    wordIds: options.map((word) => word._id),
    options: options.map((word) => ({
      wordId: idOf(word._id),
      word: word.text,
      category: word.category,
    })),
  };
}

export function wordPattern(word) {
  return [...word].map((character) => /\s/u.test(character) ? ' ' : '_').join('');
}

function publicWordInfo(room, word) {
  const wordCount = word.text.trim().split(/\s+/u).length;
  const hintsEnabled = room.settings.hintsEnabled && room.settings.hints > 0;
  return {
    roomCode: room.code,
    drawerPlayerId: idOf(room.currentDrawerPlayerId),
    wordLength: [...word.text].filter((character) => !/\s/u.test(character)).length,
    pattern: wordPattern(word.text),
    safeHints: hintsEnabled
      ? { category: room.settings.wordMode === 'Hidden' ? null : word.category, wordCount }
      : {},
    wordMode: room.settings.wordMode,
  };
}

function privateWordInfo(room, word) {
  return {
    roomCode: room.code,
    wordId: idOf(word._id),
    word: word.text,
    category: word.category,
    wordLength: [...word.text].filter((character) => !/\s/u.test(character)).length,
    pattern: wordPattern(word.text),
  };
}

export function emitWordOptions(io, room, options) {
  const drawerId = idOf(room.currentDrawerPlayerId);
  const drawer = room.members.find((member) => idOf(member.playerId) === drawerId);
  if (!drawer?.isConnected || !drawer.socketId) return false;
  io.to(drawer.socketId).emit('word_options', {
    roomCode: room.code,
    currentRound: room.currentRound,
    currentTurn: room.currentTurn,
    options,
  });
  return true;
}

export async function deliverWordStateToDrawer({ io, room, socket }) {
  const drawerId = idOf(room.currentDrawerPlayerId);
  const member = room.members.find((item) => idOf(item.playerId) === drawerId);
  if (!member || member.socketId !== socket.id || !member.isConnected) return false;

  if (room.currentWordId && room.currentWordText) {
    const info = {
      roomCode: room.code,
      wordId: idOf(room.currentWordId),
      word: room.currentWordText,
      category: room.currentWordCategory,
      wordLength: [...room.currentWordText].filter((character) => !/\s/u.test(character)).length,
      pattern: wordPattern(room.currentWordText),
    };
    socket.emit('word_assigned', info);
    return true;
  }

  const ids = (room.wordOptionIds ?? []).map(idOf);
  const words = await Word.find({ _id: { $in: ids }, isActive: true });
  const byId = new Map(words.map((word) => [idOf(word._id), word]));
  const options = ids.map((id) => byId.get(id)).filter(Boolean).map((word) => ({
    wordId: idOf(word._id), word: word.text, category: word.category,
  }));
  if (options.length !== room.settings.wordChoices) {
    throw new ApiError(503, 'The current word options are unavailable', 'WORD_OPTIONS_UNAVAILABLE');
  }
  io.to(socket.id).emit('word_options', {
    roomCode: room.code,
    currentRound: room.currentRound,
    currentTurn: room.currentTurn,
    options,
  });
  return true;
}

export async function selectWord({ socket, io, payload }) {
  const session = socket.data.lobby;
  if (!session) throw new ApiError(403, 'Join a room before selecting a word', 'NOT_IN_ROOM');
  const wordId = payload?.wordId;
  if (typeof wordId !== 'string' || !mongoose.isValidObjectId(wordId)) {
    throw new ApiError(400, 'A valid wordId is required', 'INVALID_WORD_SELECTION');
  }

  const room = await Room.findById(session.roomId).select(
    '+wordOptionIds +currentWordId +currentWordText +currentWordCategory'
  );
  if (!room) throw new ApiError(404, 'Room was not found', 'ROOM_NOT_FOUND');
  if (room.gameStatus !== 'started') {
    throw new ApiError(409, 'The game is not in progress', 'GAME_NOT_STARTED');
  }
  if (idOf(room.currentDrawerPlayerId) !== session.playerId) {
    throw new ApiError(403, 'Only the current drawer can select a word', 'DRAWER_ONLY');
  }
  const member = room.members.find((item) => idOf(item.playerId) === session.playerId);
  if (!member?.isConnected || member.socketId !== socket.id) {
    throw new ApiError(403, 'This is not the active drawer connection', 'DRAWER_ONLY');
  }
  if (room.currentWordId) {
    throw new ApiError(409, 'A word has already been selected for this turn', 'WORD_ALREADY_SELECTED');
  }
  if (!(room.wordOptionIds ?? []).some((id) => idOf(id) === wordId)) {
    throw new ApiError(400, 'Select one of the word options sent to the drawer', 'INVALID_WORD_SELECTION');
  }

  const word = await Word.findOne({ _id: wordId, isActive: true });
  if (!word) throw new ApiError(400, 'Selected word is no longer available', 'INVALID_WORD_SELECTION');
  const updated = await Room.findOneAndUpdate(
    {
      _id: room._id,
      gameStatus: 'started',
      currentDrawerPlayerId: room.currentDrawerPlayerId,
      currentWordId: null,
      wordOptionIds: word._id,
      'members': { $elemMatch: { playerId: room.currentDrawerPlayerId, socketId: socket.id, isConnected: true } },
    },
    {
      $set: {
        currentWordId: word._id,
        currentWordText: word.text,
        currentWordCategory: word.category,
        wordOptionIds: [],
        roundStatus: 'guessing',
        roundCompletedAt: null,
        roundCompletionReason: null,
        eligibleGuesserIds: room.members
          .filter((item) => item.isConnected && idOf(item.playerId) !== idOf(room.currentDrawerPlayerId))
          .map((item) => item.playerId),
        correctGuesserIds: [],
      },
    },
    { new: true }
  );
  if (!updated) throw new ApiError(409, 'The turn changed or a word was already selected', 'WORD_SELECTION_EXPIRED');

  const publicInfo = publicWordInfo(updated, word);
  const privateInfo = privateWordInfo(updated, word);
  io.to(updated.code).except(socket.id).emit('word_selected', publicInfo);
  socket.emit('word_assigned', privateInfo);
  return privateInfo;
}
