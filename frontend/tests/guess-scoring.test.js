import { after, before, test } from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import http from 'node:http';
import { io as createClient } from 'socket.io-client';

let Player;
let Room;
let Word;
let initSocket;
let server;
let ioServer;
let serverUrl;
let originalPlayerFindById;
let originalRoomFindOne;
let originalRoomFindById;
let originalRoomFindOneAndUpdate;
let originalWordFind;
let originalWordFindOne;

const digest = (value) => createHash('sha256').update(value).digest('hex');

const people = [
  { id: '111111111111111111111111', name: 'Ava', token: 'ava-token' },
  { id: '222222222222222222222222', name: 'Bea', token: 'bea-token' },
  { id: '333333333333333333333333', name: 'Cal', token: 'cal-token' },
];
const words = [
  { _id: '000000000000000000000031', text: 'Rainbow', category: 'Nature', isActive: true },
  { _id: '000000000000000000000032', text: 'Compass', category: 'Objects', isActive: true },
];
const playerRows = new Map();
let room;
const clients = [];

function resetRoom() {
  room = {
    _id: 'eeeeeeeeeeeeeeeeeeeeeeee',
    id: 'eeeeeeeeeeeeeeeeeeeeeeee',
    code: 'GUESS789',
    isPublic: true,
    privateInviteTokenHash: null,
    hostPlayerId: people[2].id,
    gameStatus: 'started',
    currentRound: 2,
    currentTurn: 3,
    totalRounds: 2,
    currentDrawerPlayerId: people[2].id,
    turnOrder: people.map((p) => p.id),
    roundStatus: 'guessing',
    roundCompletedAt: null,
    roundCompletionReason: null,
    currentWordId: words[0]._id,
    currentWordText: words[0].text,
    currentWordCategory: words[0].category,
    wordOptionIds: [],
    eligibleGuesserIds: [people[0].id, people[1].id],
    correctGuesserIds: [],
    finalLeaderboard: [],
    winnerPlayerIds: [],
    settings: {
      maxPlayers: 8,
      rounds: 2,
      wordChoices: 2,
      wordMode: 'Normal',
      hintsEnabled: true,
      hints: 2,
      scoring: { correctGuessPoints: 25, drawerPointsPerCorrectGuess: 10 },
    },
    members: people.map((p, index) => ({
      playerId: p.id,
      displayName: p.name,
      normalizedDisplayName: p.name.toLowerCase(),
      role: index === 2 ? 'host' : 'player',
      isConnected: false,
      socketId: null,
      lastDisconnectedAt: null,
      score: 0,
    })),
    save: async () => room,
  };
}

function objectQuery(value) {
  return {
    select: async () => value,
    then: (resolve, reject) => Promise.resolve(value).then(resolve, reject),
  };
}

function matches(filter) {
  if (filter.gameStatus) {
    const ok =
      typeof filter.gameStatus === 'object'
        ? filter.gameStatus.$in.includes(room.gameStatus ?? null)
        : room.gameStatus === filter.gameStatus;
    if (!ok) return false;
  }
  for (const key of ['currentRound', 'currentTurn', 'roundStatus']) {
    if (filter[key] !== undefined && room[key] !== filter[key]) return false;
  }
  for (const key of ['currentDrawerPlayerId', 'currentWordId', 'hostPlayerId']) {
    if (filter[key] !== undefined && String(room[key]) !== String(filter[key])) return false;
  }
  if (
    filter.eligibleGuesserIds &&
    !room.eligibleGuesserIds.some((id) => String(id) === String(filter.eligibleGuesserIds))
  ) {
    return false;
  }
  if (
    filter.correctGuesserIds?.$ne &&
    room.correctGuesserIds.some((id) => String(id) === String(filter.correctGuesserIds.$ne))
  ) {
    return false;
  }
  const socketMember = filter.members?.$elemMatch;
  if (
    socketMember &&
    !room.members.some(
      (m) =>
        String(m.playerId) === String(socketMember.playerId) &&
        m.socketId === socketMember.socketId &&
        m.isConnected === socketMember.isConnected
    )
  ) {
    return false;
  }
  return true;
}

function applyUpdate(update, options = {}) {
  if (update.$set) Object.assign(room, update.$set);
  if (update.$addToSet?.correctGuesserIds) {
    room.correctGuesserIds.push(update.$addToSet.correctGuesserIds);
  }
  if (update.$inc) {
    for (const [path, amount] of Object.entries(update.$inc)) {
      const target = path.includes('[drawer]')
        ? options.arrayFilters.find((f) => f['drawer.playerId'])['drawer.playerId']
        : options.arrayFilters.find((f) => f['guesser.playerId'])['guesser.playerId'];
      const member = room.members.find((m) => String(m.playerId) === String(target));
      member.score += amount;
    }
  }
  return room;
}

function connectSocket() {
  const client = createClient(serverUrl, {
    transports: ['websocket'],
    forceNew: true,
    reconnection: false,
  });
  clients.push(client);
  return new Promise((resolve, reject) => {
    client.once('connect', () => resolve(client));
    client.once('connect_error', reject);
  });
}

function emitWithContract(client, event, payload = {}) {
  return new Promise((resolve) => {
    client.timeout(2000).emit(event, payload, (err, res) => {
      if (err) resolve({ success: false, error: { code: 'TIMEOUT', message: err.message } });
      else resolve(res);
    });
  });
}

function onceEvent(client, event) {
  return new Promise((resolve) => client.once(event, resolve));
}

before(async () => {
  process.env.MONGO_URI ||= 'mongodb://127.0.0.1:27017/draw-and-guess-test';
  ({ Player } = await import('../../backend/src/models/Player.js'));
  ({ Room } = await import('../../backend/src/models/Room.js'));
  ({ Word } = await import('../../backend/src/models/Word.js'));
  ({ initSocket } = await import('../../backend/src/sockets/index.js'));

  originalPlayerFindById = Player.findById;
  originalRoomFindOne = Room.findOne;
  originalRoomFindById = Room.findById;
  originalRoomFindOneAndUpdate = Room.findOneAndUpdate;
  originalWordFind = Word.find;
  originalWordFindOne = Word.findOne;

  for (const p of people) {
    playerRows.set(p.id, {
      _id: p.id,
      id: p.id,
      displayName: p.name,
      identityTokenHash: digest(p.token),
    });
  }

  Player.findById = (id) => objectQuery(playerRows.get(String(id)) ?? null);
  Room.findOne = ({ code }) => ({
    select: async () => (room.code === code ? room : null),
  });
  Room.findById = (id) => objectQuery(String(id) === String(room._id) ? room : null);
  Room.findOneAndUpdate = async (filter, update, options = {}) =>
    matches(filter) ? applyUpdate(update, options) : null;
  Word.find = async (query) =>
    words.filter((w) => {
      if (query.category?.$in && !query.category.$in.includes(w.category)) return false;
      if (query._id?.$in && !query._id.$in.some((id) => String(id) === w._id)) return false;
      return w.isActive;
    });
  Word.findOne = async ({ _id }) => words.find((w) => w._id === String(_id)) ?? null;

  resetRoom();
  server = http.createServer();
  ioServer = initSocket(server);
  await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
  serverUrl = `http://127.0.0.1:${server.address().port}`;
});

after(async () => {
  for (const client of clients) client.disconnect();
  await new Promise((resolve) => ioServer.close(resolve));
  Player.findById = originalPlayerFindById;
  Room.findOne = originalRoomFindOne;
  Room.findById = originalRoomFindById;
  Room.findOneAndUpdate = originalRoomFindOneAndUpdate;
  Word.find = originalWordFind;
  Word.findOne = originalWordFindOne;
});

test('handles incorrect/correct guesses, drawer blocks, duplicate guesses, live scores, round results, and final winners', async () => {
  resetRoom();
  const [ava, bea, cal] = await Promise.all([
    connectSocket(),
    connectSocket(),
    connectSocket(),
  ]);

  for (const [sock, person] of [
    [ava, people[0]],
    [bea, people[1]],
    [cal, people[2]],
  ]) {
    assert.equal(
      (
        await emitWithContract(sock, 'lobby:join', {
          roomCode: room.code,
          playerId: person.id,
          identityToken: person.token,
        })
      ).success,
      true
    );
  }

  // Incorrect guess -> guess_feedback broadcast, no score awarded, word stays secret
  const wrongFeedbackPromise = onceEvent(bea, 'guess_feedback');
  const wrongAck = await emitWithContract(ava, 'guess:submit', { guess: 'banana' });
  assert.equal(wrongAck.success, true);
  assert.deepEqual(wrongAck.data, {
    correct: false,
    playerId: people[0].id,
    displayName: 'Ava',
    message: 'Incorrect guess',
  });
  const wrongBroadcast = await wrongFeedbackPromise;
  assert.equal(wrongBroadcast.correct, false);
  assert.equal(JSON.stringify(wrongBroadcast).includes('Rainbow'), false);

  // Drawer cannot guess own word
  const drawerGuess = await emitWithContract(cal, 'guess:submit', { guess: 'Rainbow' });
  assert.equal(drawerGuess.success, false);
  assert.equal(drawerGuess.error.code, 'DRAWER_CANNOT_GUESS');

  // Empty guess rejected
  const emptyGuess = await emitWithContract(bea, 'guess:submit', { guess: '   ' });
  assert.equal(emptyGuess.success, false);
  assert.equal(emptyGuess.error.code, 'INVALID_GUESS');

  // First correct guess -> guess_feedback + scoreboard_updated
  const liveScorePromise = onceEvent(cal, 'scoreboard_updated');
  const correctFeedbackPromise = onceEvent(bea, 'guess_feedback');
  const correctAck = await emitWithContract(ava, 'guess:submit', { guess: '  rainbow ' });
  assert.equal(correctAck.success, true);
  assert.equal(correctAck.data.correct, true);
  assert.equal(correctAck.data.scoreAwarded, 25);
  assert.equal(correctAck.data.drawerScoreAwarded, 10);

  assert.equal((await correctFeedbackPromise).correct, true);
  const scoreUpdate = await liveScorePromise;
  assert.deepEqual(
    scoreUpdate.leaderboard.map((row) => ({
      name: row.displayName,
      score: row.score,
      rank: row.rank,
    })),
    [
      { name: 'Ava', score: 25, rank: 1 },
      { name: 'Cal', score: 10, rank: 2 },
      { name: 'Bea', score: 0, rank: 3 },
    ]
  );

  // Duplicate guess by Ava rejected with ALREADY_GUESSED, scores unchanged
  const duplicate = await emitWithContract(ava, 'guess:submit', { guess: 'Rainbow' });
  assert.equal(duplicate.success, false);
  assert.equal(duplicate.error.code, 'ALREADY_GUESSED');

  // Second guesser gets it right -> round_complete + leaderboard_final + game_complete
  const roundCompletePromise = onceEvent(cal, 'round_complete');
  const finalLeaderboardPromise = onceEvent(ava, 'leaderboard_final');
  const gameCompletePromise = onceEvent(bea, 'game_complete');

  const secondAck = await emitWithContract(bea, 'guess:submit', { guess: 'RAINBOW' });
  assert.equal(secondAck.success, true);
  assert.equal(secondAck.data.roundComplete, true);

  const roundResult = await roundCompletePromise;
  assert.equal(roundResult.reason, 'all_guessed');
  assert.deepEqual(roundResult.correctGuesserIds, [people[0].id, people[1].id]);
  assert.deepEqual(roundResult.missedGuesserIds, []);

  const finalBoard = await finalLeaderboardPromise;
  assert.deepEqual(
    finalBoard.winners.map((w) => ({ id: w.playerId, score: w.score })),
    [
      { id: people[0].id, score: 25 },
      { id: people[1].id, score: 25 },
    ]
  );

  const completed = await gameCompletePromise;
  assert.equal(completed.gameState.status, 'completed');
  assert.equal(completed.winners.length, 2);
});
