import { after, test } from 'node:test';
import assert from 'node:assert/strict';
import { Room } from '../src/models/Room.js';
import { startTurnTimer, stopTurnTimer } from '../src/services/timer.service.js';
import { buildHintPattern } from '../src/services/hint.service.js';

const originalFindById = Room.findById;
const originalFindOneAndUpdate = Room.findOneAndUpdate;

after(() => {
  Room.findById = originalFindById;
  Room.findOneAndUpdate = originalFindOneAndUpdate;
});

test('issues progressive safe hints and automatically completes an expired turn', async () => {
  let now = 100_000;
  const room = {
    _id: 'aaaaaaaaaaaaaaaaaaaaaaaa', code: 'TIMER123',
    gameStatus: 'started', roundStatus: 'guessing',
    currentRound: 2, currentTurn: 3, totalRounds: 2,
    currentDrawerPlayerId: '333333333333333333333333',
    turnOrder: ['111111111111111111111111', '222222222222222222222222', '333333333333333333333333'],
    currentWordId: 'eeeeeeeeeeeeeeeeeeeeeeee', currentWordText: 'CAT',
    turnEndsAt: new Date(now + 30_000), hintLevel: 0, revealedLetterPositions: [],
    eligibleGuesserIds: ['111111111111111111111111', '222222222222222222222222'],
    correctGuesserIds: ['111111111111111111111111'],
    settings: { drawingTime: 30, hints: 2, hintsEnabled: true },
    members: [
      { playerId: '111111111111111111111111', displayName: 'Ava', score: 10, isConnected: true },
      { playerId: '222222222222222222222222', displayName: 'Bea', score: 0, isConnected: true },
      { playerId: '333333333333333333333333', displayName: 'Cal', score: 5, isConnected: true },
    ],
  };
  Room.findById = () => ({
    select: async () => room,
    then: (resolve, reject) => Promise.resolve(room).then(resolve, reject),
  });
  Room.findOneAndUpdate = async (_filter, update) => {
    if (update.$set) Object.assign(room, update.$set);
    if (update.$addToSet?.revealedLetterPositions !== undefined
        && !room.revealedLetterPositions.includes(update.$addToSet.revealedLetterPositions)) {
      room.revealedLetterPositions.push(update.$addToSet.revealedLetterPositions);
    }
    return room;
  };

  const jobs = [];
  const cleared = [];
  const events = [];
  const io = { to: () => ({ emit: (event, payload) => events.push({ event, payload }) }) };
  const schedule = (callback, delay) => {
    const job = { callback, delay, cancelled: false, unref() {} };
    jobs.push(job);
    return job;
  };
  const clear = (job) => { job.cancelled = true; cleared.push(job); };

  assert.equal(startTurnTimer({ io, room, schedule, clear, now: () => now }), true);
  assert.equal(events[0].event, 'turn_timer_started');
  assert.equal(events[0].payload.durationSeconds, 30);
  assert.deepEqual(jobs.map((job) => job.delay), [10_000, 20_000, 30_000]);

  await jobs[0].callback();
  const firstHint = events.find((item) => item.event === 'word_hint').payload;
  assert.equal(firstHint.hintNumber, 1);
  assert.equal([...firstHint.pattern].filter((character) => character !== '_').length, 1);
  assert.notEqual(firstHint.pattern, 'CAT');

  await jobs[1].callback();
  const hints = events.filter((item) => item.event === 'word_hint').map((item) => item.payload);
  assert.equal(hints[1].hintNumber, 2);
  assert.equal([...hints[1].pattern].filter((character) => character !== '_').length, 2);
  assert.notEqual(hints[1].pattern, 'CAT');
  assert.equal(buildHintPattern('CAT', room.revealedLetterPositions), hints[1].pattern);

  now += 30_000;
  await jobs[2].callback();
  assert.equal(events.some((item) => item.event === 'turn_timer_expired'), true);
  assert.equal(room.roundStatus, 'completed');
  assert.equal(room.gameStatus, 'completed');
  assert.equal(events.some((item) => item.event === 'game_complete'), true);
  assert.equal(cleared.length, 3);
});

test('respects disabled hints while keeping the configured turn timer', () => {
  const jobs = [];
  const room = {
    _id: 'bbbbbbbbbbbbbbbbbbbbbbbb', code: 'NOHINT12',
    gameStatus: 'started', roundStatus: 'guessing', currentRound: 1, currentTurn: 1,
    currentDrawerPlayerId: '333333333333333333333333', currentWordId: 'eeeeeeeeeeeeeeeeeeeeeeee',
    currentWordText: 'TREE', turnEndsAt: new Date(200_000 + 15_000),
    settings: { drawingTime: 15, hints: 0, hintsEnabled: false },
  };
  const events = [];
  const io = { to: () => ({ emit: (event, payload) => events.push({ event, payload }) }) };
  const schedule = (callback, delay) => {
    const job = { callback, delay, unref() {} };
    jobs.push(job);
    return job;
  };
  assert.equal(startTurnTimer({ io, room, schedule, clear: () => {}, now: () => 200_000 }), true);
  assert.equal(jobs.length, 1);
  assert.equal(jobs[0].delay, 15_000);
  assert.equal(events[0].payload.durationSeconds, 15);
  assert.equal(stopTurnTimer(room._id), true);
});
