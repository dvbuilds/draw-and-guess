import { after, before, test } from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import http from 'node:http';
import { io as createClient } from 'socket.io-client';
import { Player } from '../src/models/Player.js';
import { Room } from '../src/models/Room.js';
import { initSocket } from '../src/sockets/index.js';
import { completeRound } from '../src/services/scoring.service.js';

const people = [
  { id: '111111111111111111111111', name: 'Ava', token: 'ava-token' },
  { id: '222222222222222222222222', name: 'Bea', token: 'bea-token' },
  { id: '333333333333333333333333', name: 'Cal', token: 'cal-token' },
];
const room = {
  _id: 'aaaaaaaaaaaaaaaaaaaaaaaa', code: 'GUESS123', isPublic: true,
  privateInviteTokenHash: null, hostPlayerId: people[2].id,
  gameStatus: 'started', currentRound: 2, currentTurn: 3, totalRounds: 2,
  currentDrawerPlayerId: people[2].id, turnOrder: people.map((person) => person.id),
  roundStatus: 'guessing', currentWordId: 'eeeeeeeeeeeeeeeeeeeeeeee',
  currentWordText: 'Rainbow', currentWordCategory: 'Nature',
  eligibleGuesserIds: [people[0].id, people[1].id], correctGuesserIds: [],
  settings: { rounds: 2, wordChoices: 2, wordMode: 'Normal', scoring: { correctGuessPoints: 20, drawerPointsPerCorrectGuess: 5 } },
  members: people.map((person, index) => ({
    playerId: person.id, displayName: person.name, normalizedDisplayName: person.name.toLowerCase(),
    role: index === 2 ? 'host' : 'player', isConnected: false, socketId: null,
    score: 0,
  })),
  save: async () => room,
};
const playerRows = new Map(people.map((person) => [person.id, {
  _id: person.id, id: person.id, displayName: person.name,
  identityTokenHash: createHash('sha256').update(person.token).digest('hex'),
}]));
const originals = {
  playerFindById: Player.findById,
  roomFindOne: Room.findOne,
  roomFindById: Room.findById,
  roomFindOneAndUpdate: Room.findOneAndUpdate,
};
let server;
let ioServer;
let serverUrl;
const clients = [];

function objectQuery(value) {
  return { select: async () => value, then: (resolve, reject) => Promise.resolve(value).then(resolve, reject) };
}

function matches(filter) {
  if (filter.gameStatus && room.gameStatus !== filter.gameStatus) return false;
  for (const key of ['currentRound', 'currentTurn', 'roundStatus']) {
    if (filter[key] !== undefined && room[key] !== filter[key]) return false;
  }
  for (const key of ['currentDrawerPlayerId', 'currentWordId']) {
    if (filter[key] !== undefined && String(room[key]) !== String(filter[key])) return false;
  }
  if (filter.eligibleGuesserIds && !room.eligibleGuesserIds.some((id) => String(id) === String(filter.eligibleGuesserIds))) return false;
  if (filter.correctGuesserIds?.$ne
      && room.correctGuesserIds.some((id) => String(id) === String(filter.correctGuesserIds.$ne))) return false;
  const socketMember = filter.members?.$elemMatch;
  if (socketMember && !room.members.some((member) => String(member.playerId) === String(socketMember.playerId)
      && member.socketId === socketMember.socketId && member.isConnected === socketMember.isConnected)) return false;
  return true;
}

function applyUpdate(update, options) {
  if (update.$set) Object.assign(room, update.$set);
  if (update.$addToSet?.correctGuesserIds) room.correctGuesserIds.push(update.$addToSet.correctGuesserIds);
  if (update.$inc) {
    for (const [path, amount] of Object.entries(update.$inc)) {
      const target = path.includes('[drawer]')
        ? options.arrayFilters.find((filter) => filter['drawer.playerId'])['drawer.playerId']
        : options.arrayFilters.find((filter) => filter['guesser.playerId'])['guesser.playerId'];
      const member = room.members.find((item) => String(item.playerId) === String(target));
      member.score += amount;
    }
  }
  return room;
}

function connect() {
  const client = createClient(serverUrl, { transports: ['websocket'], forceNew: true, reconnection: false });
  clients.push(client);
  return new Promise((resolve, reject) => {
    client.once('connect', () => resolve(client));
    client.once('connect_error', reject);
  });
}

function request(client, event, data) {
  return new Promise((resolve) => client.timeout(2000).emit(event, data, (err, response) => {
    resolve(err ? { success: false, error: { code: 'TIMEOUT' } } : response);
  }));
}

function listen(client, event) {
  return new Promise((resolve) => client.once(event, resolve));
}

async function join(client, person) {
  return request(client, 'lobby:join', {
    roomCode: room.code, playerId: person.id, identityToken: person.token,
  });
}

before(async () => {
  Player.findById = (id) => objectQuery(playerRows.get(String(id)) ?? null);
  Room.findOne = () => ({ select: async () => room });
  Room.findById = (id) => objectQuery(String(id) === String(room._id) ? room : null);
  Room.findOneAndUpdate = async (filter, update, options = {}) => matches(filter) ? applyUpdate(update, options) : null;
  server = http.createServer();
  ioServer = initSocket(server);
  await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
  serverUrl = `http://127.0.0.1:${server.address().port}`;
});

after(async () => {
  for (const socket of ioServer.sockets.sockets.values()) delete socket.data.lobby;
  for (const client of clients) client.disconnect();
  await new Promise((resolve) => ioServer.close(resolve));
  Player.findById = originals.playerFindById;
  Room.findOne = originals.roomFindOne;
  Room.findById = originals.roomFindById;
  Room.findOneAndUpdate = originals.roomFindOneAndUpdate;
});

test('validates guesses, scores once, completes the round, and broadcasts final winners', async () => {
  const [ava, bea, cal] = await Promise.all(people.map(() => connect()));
  assert.equal((await join(ava, people[0])).success, true);
  assert.equal((await join(bea, people[1])).success, true);
  assert.equal((await join(cal, people[2])).success, true);

  const wrongFeedback = listen(ava, 'guess_feedback');
  const wrongAck = await request(ava, 'guess:submit', { guess: 'banana' });
  assert.deepEqual(wrongAck.data, { correct: false, playerId: people[0].id, displayName: 'Ava', message: 'Incorrect guess' });
  const wrongEvent = await wrongFeedback;
  assert.equal(JSON.stringify(wrongEvent).includes('Rainbow'), false);
  assert.equal(room.members.reduce((sum, member) => sum + member.score, 0), 0);

  const drawerGuess = await request(cal, 'guess:submit', { guess: 'Rainbow' });
  assert.equal(drawerGuess.success, false);
  assert.equal(drawerGuess.error.code, 'DRAWER_CANNOT_GUESS');
  const emptyGuess = await request(bea, 'guess:submit', { guess: '   ' });
  assert.equal(emptyGuess.success, false);
  assert.equal(emptyGuess.error.code, 'INVALID_GUESS');

  const liveBoard = listen(bea, 'scoreboard_updated');
  const correctFeedback = listen(ava, 'guess_feedback');
  const correctAck = await request(ava, 'guess:submit', { guess: '  RAINBOW  ' });
  assert.equal(correctAck.data.correct, true);
  assert.equal((await correctFeedback).correct, true);
  assert.deepEqual((await liveBoard).leaderboard.map((entry) => entry.score), [20, 5, 0]);

  const duplicate = await request(ava, 'guess:submit', { guess: 'rainbow' });
  assert.equal(duplicate.success, false);
  assert.equal(duplicate.error.code, 'ALREADY_GUESSED');
  assert.equal(room.members.find((member) => member.playerId === people[0].id).score, 20);

  const roundComplete = listen(bea, 'round_complete');
  const finalBoard = listen(ava, 'leaderboard_final');
  const gameComplete = listen(cal, 'game_complete');
  const secondCorrect = await request(bea, 'guess:submit', { guess: 'Rainbow' });
  assert.equal(secondCorrect.success, true);
  assert.equal(secondCorrect.data.roundComplete, true);
  const round = await roundComplete;
  assert.equal(round.reason, 'all_guessed');
  assert.deepEqual(round.missedGuesserIds, []);
  const leaderboard = await finalBoard;
  assert.deepEqual(leaderboard.winners.map((winner) => winner.playerId), [people[0].id, people[1].id]);
  const completion = await gameComplete;
  assert.equal(completion.gameState.status, 'completed');
  assert.equal(room.gameStatus, 'completed');
  assert.deepEqual(room.winnerPlayerIds, [people[0].id, people[1].id]);
});

test('reports eligible players who did not guess when a round ends', async () => {
  const roundRoom = {
    ...room,
    gameStatus: 'started', roundStatus: 'guessing', currentRound: 1, currentTurn: 1,
    currentDrawerPlayerId: people[2].id,
    eligibleGuesserIds: [people[0].id, people[1].id], correctGuesserIds: [people[0].id],
    roundCompletedAt: null, roundCompletionReason: null,
    members: room.members.map((member) => ({ ...member })),
  };
  const emitted = [];
  const original = Room.findOneAndUpdate;
  Room.findOneAndUpdate = async (_filter, update) => Object.assign(roundRoom, update.$set);
  try {
    const result = await completeRound({
      io: { to: () => ({ emit: (event, payload) => emitted.push({ event, payload }) }) },
      room: roundRoom,
      reason: 'host_advanced',
    });
    assert.equal(result.completed, true);
    assert.deepEqual(emitted[0].payload.correctGuesserIds, [people[0].id]);
    assert.deepEqual(emitted[0].payload.missedGuesserIds, [people[1].id]);
  } finally {
    Room.findOneAndUpdate = original;
  }
});
