import { after, test } from 'node:test';
import assert from 'node:assert/strict';
import { Room } from '../src/models/Room.js';
import { Word } from '../src/models/Word.js';
import { prepareWordOptions, selectWord, wordPattern } from '../src/services/wordSelection.service.js';

const originalWordFind = Word.find;
const originalWordFindOne = Word.findOne;
const originalRoomFindById = Room.findById;
const originalRoomFindOneAndUpdate = Room.findOneAndUpdate;
const wordRows = [
  { _id: '000000000000000000000011', text: 'Rainbow', category: 'Nature', isActive: true },
  { _id: '000000000000000000000012', text: 'Mountain', category: 'Nature', isActive: true },
  { _id: '000000000000000000000013', text: 'Fire truck', category: 'Combination', isActive: true },
  { _id: '000000000000000000000014', text: 'Ice cream', category: 'Combination', isActive: true },
];

after(() => {
  Word.find = originalWordFind;
  Word.findOne = originalWordFindOne;
  Room.findById = originalRoomFindById;
  Room.findOneAndUpdate = originalRoomFindOneAndUpdate;
});

test('word options respect choice count and configured word modes', async () => {
  Word.find = async ({ category }) => wordRows.filter((word) => category.$in.includes(word.category));

  const normal = await prepareWordOptions({ wordChoices: 2, wordMode: 'Normal' });
  assert.equal(normal.options.length, 2);
  assert.equal(normal.options.every((option) => option.category !== 'Combination'), true);

  const hidden = await prepareWordOptions({ wordChoices: 2, wordMode: 'Hidden' });
  assert.equal(hidden.options.length, 2);
  assert.equal(hidden.options.every((option) => option.category !== 'Combination'), true);

  const combination = await prepareWordOptions({ wordChoices: 2, wordMode: 'Combination' });
  assert.equal(combination.options.length, 2);
  assert.equal(combination.options.every((option) => option.category === 'Combination'), true);
  assert.equal(wordPattern('ice cream'), '___ _____');
});

test('hidden mode broadcasts blanks and metadata without the selected word', async () => {
  const chosen = wordRows[0];
  const room = {
    _id: 'aaaaaaaaaaaaaaaaaaaaaaaa',
    code: 'HIDDEN12',
    gameStatus: 'started',
    currentDrawerPlayerId: '111111111111111111111111',
    currentRound: 1,
    currentTurn: 1,
    currentWordId: null,
    wordOptionIds: [chosen._id],
    settings: { wordMode: 'Hidden', hintsEnabled: true, hints: 3 },
    members: [{
      playerId: '111111111111111111111111',
      isConnected: true,
      socketId: 'drawer-socket',
    }],
  };
  Room.findById = () => ({ select: async () => room });
  Word.findOne = async ({ _id }) => wordRows.find((word) => word._id === String(_id)) ?? null;
  Room.findOneAndUpdate = async (_filter, update) => {
    Object.assign(room, update.$set);
    return room;
  };

  const broadcasts = [];
  const privateEvents = [];
  const socket = {
    id: 'drawer-socket',
    data: { lobby: { roomId: room._id, roomCode: room.code, playerId: room.currentDrawerPlayerId } },
    emit: (event, payload) => privateEvents.push({ event, payload }),
  };
  const io = {
    to: (target) => ({
      except: (socketId) => ({ emit: (event, payload) => broadcasts.push({ target, socketId, event, payload }) }),
    }),
  };

  const privateResult = await selectWord({ socket, io, payload: { wordId: chosen._id } });
  const publicEvent = broadcasts.find((item) => item.event === 'word_selected');
  assert.equal(privateResult.word, 'Rainbow');
  assert.equal(privateEvents.find((item) => item.event === 'word_assigned').payload.word, 'Rainbow');
  assert.equal(publicEvent.payload.word, undefined);
  assert.equal(publicEvent.payload.wordLength, 7);
  assert.equal(publicEvent.payload.pattern, '_______');
  assert.equal(publicEvent.payload.safeHints.category, null);
  assert.equal(JSON.stringify(publicEvent.payload).includes('Rainbow'), false);
  assert.equal(room.currentWordText, 'Rainbow');
});
