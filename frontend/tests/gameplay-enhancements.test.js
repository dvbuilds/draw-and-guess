import { after, before, test } from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import http from 'node:http';
import { io as createClient } from 'socket.io-client';

import { api } from '../src/services/api.js';
import { createRoom, joinRoom } from '../src/services/roomService.js';

let app;
let Player;
let Room;
let Word;
let initSocket;
let startTurnTimer;
let stopAllTurnTimers;
let server;
let ioServer;
let serverUrl;

const originals = {};
const digest = (value) => createHash('sha256').update(value).digest('hex');

const users = [
  { id: '111111111111111111111111', name: 'Host9', token: 'host9-token' },
  { id: '222222222222222222222222', name: 'Guest9', token: 'guest9-token' },
  { id: '333333333333333333333333', name: 'Other9', token: 'other9-token' },
];
const playerRows = new Map(
  users.map((u) => [
    u.id,
    {
      _id: u.id,
      id: u.id,
      displayName: u.name,
      normalizedDisplayName: u.name.toLowerCase(),
      identityTokenHash: digest(u.token),
    },
  ])
);
const words = [
  { _id: '000000000000000000000041', text: 'CAT', category: 'Animals', isActive: true },
  { _id: '000000000000000000000042', text: 'DOG', category: 'Animals', isActive: true },
];
const roomsById = new Map();
let nextRoomSeq = 1;
const clients = [];

function query(value) {
  return {
    select: async () => value,
    then: (resolve, reject) => Promise.resolve(value).then(resolve, reject),
  };
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
      resolve(err ? { success: false, error: { code: 'TIMEOUT' } } : res);
    });
  });
}

function onceEvent(client, event) {
  return new Promise((resolve) => client.once(event, resolve));
}

before(async () => {
  process.env.MONGO_URI ||= 'mongodb://127.0.0.1:27017/draw-and-guess-test';
  ({ default: app } = await import('../../backend/src/app.js'));
  ({ Player } = await import('../../backend/src/models/Player.js'));
  ({ Room } = await import('../../backend/src/models/Room.js'));
  ({ Word } = await import('../../backend/src/models/Word.js'));
  ({ initSocket } = await import('../../backend/src/sockets/index.js'));
  ({ startTurnTimer, stopAllTurnTimers } = await import('../../backend/src/services/timer.service.js'));

  originals.playerFindById = Player.findById;
  originals.roomExists = Room.exists;
  originals.roomCreate = Room.create;
  originals.roomFindOne = Room.findOne;
  originals.roomFindById = Room.findById;
  originals.roomFindOneAndUpdate = Room.findOneAndUpdate;
  originals.wordFind = Word.find;
  originals.wordFindOne = Word.findOne;

  Player.findById = (id) => query(playerRows.get(String(id)) ?? null);
  Room.exists = async ({ code }) =>
    [...roomsById.values()].some((r) => r.code === code);
  Room.create = async (data) => {
    const id = String(nextRoomSeq++).padStart(24, '0');
    const doc = {
      ...data,
      _id: id,
      id,
      gameStatus: 'lobby',
      members: data.members.map((m) => ({
        ...m,
        playerId: String(m.playerId),
        isConnected: false,
        socketId: null,
        score: 0,
      })),
      save: async () => doc,
    };
    roomsById.set(id, doc);
    return doc;
  };
  Room.findOne = ({ code }) =>
    query([...roomsById.values()].find((r) => r.code === code) ?? null);
  Room.findById = (id) => query(roomsById.get(String(id)) ?? null);
  Room.findOneAndUpdate = async (filter, update) => {
    const doc = roomsById.get(String(filter._id));
    if (!doc) return null;
    if (filter.$expr && filter['members.playerId']) {
      const incoming = update.$push.members;
      doc.members.push({ ...incoming, playerId: String(incoming.playerId), isConnected: false, socketId: null, score: 0 });
      return doc;
    }
    if (update.$set) Object.assign(doc, update.$set);
    if (
      update.$addToSet?.revealedLetterPositions !== undefined &&
      !doc.revealedLetterPositions.includes(update.$addToSet.revealedLetterPositions)
    ) {
      doc.revealedLetterPositions.push(update.$addToSet.revealedLetterPositions);
    }
    return doc;
  };
  Word.find = async (q) =>
    words.filter((w) => {
      if (q.category?.$in && !q.category.$in.includes(w.category)) return false;
      if (q._id?.$in && !q._id.$in.some((id) => String(id) === w._id)) return false;
      return w.isActive;
    });
  Word.findOne = async ({ _id }) => words.find((w) => w._id === String(_id)) ?? null;

  server = http.createServer(app);
  ioServer = initSocket(server);
  await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
  const { port } = server.address();
  serverUrl = `http://127.0.0.1:${port}`;
  api.defaults.baseURL = `${serverUrl}/api`;
});

after(async () => {
  stopAllTurnTimers();
  for (const client of clients) client.disconnect();
  await new Promise((resolve) => ioServer.close(resolve));
  Player.findById = originals.playerFindById;
  Room.exists = originals.roomExists;
  Room.create = originals.roomCreate;
  Room.findOne = originals.roomFindOne;
  Room.findById = originals.roomFindById;
  Room.findOneAndUpdate = originals.roomFindOneAndUpdate;
  Word.find = originals.wordFind;
  Word.findOne = originals.wordFindOne;
});

test('supports private invite links, live room chat, synchronized countdown timer, and progressive hints', async () => {
  // 1. Host creates a private room -> receives inviteLink with roomCode + inviteToken
  const created = await createRoom({
    playerId: users[0].id,
    identityToken: users[0].token,
    isPublic: false,
    settings: {
      maxPlayers: 6,
      rounds: 2,
      drawingTime: 30,
      wordChoices: 2,
      hints: 1,
      wordMode: 'Normal',
    },
  });
  assert.equal(created.isPublic, false);
  assert.ok(created.inviteToken);
  const parsedInvite = new URL(created.inviteLink);
  assert.equal(parsedInvite.searchParams.get('roomCode'), created.roomCode);
  assert.equal(parsedInvite.searchParams.get('inviteToken'), created.inviteToken);

  // 2. Guest joins via parsed inviteLink params
  const joined = await joinRoom({
    playerId: users[1].id,
    identityToken: users[1].token,
    roomCode: parsedInvite.searchParams.get('roomCode'),
    inviteToken: parsedInvite.searchParams.get('inviteToken'),
  });
  assert.equal(joined.roomCode, created.roomCode);

  const hostSock = await connectSocket();
  const guestSock = await connectSocket();

  // Private socket join without token is rejected
  const denied = await emitWithContract(guestSock, 'lobby:join', {
    roomCode: created.roomCode,
    playerId: users[1].id,
    identityToken: users[1].token,
  });
  assert.equal(denied.success, false);
  assert.equal(denied.error.code, 'PRIVATE_ROOM');

  // Both join private lobby with inviteToken
  assert.equal(
    (
      await emitWithContract(hostSock, 'lobby:join', {
        roomCode: created.roomCode,
        playerId: users[0].id,
        identityToken: users[0].token,
        inviteToken: created.inviteToken,
      })
    ).success,
    true
  );
  assert.equal(
    (
      await emitWithContract(guestSock, 'lobby:join', {
        roomCode: created.roomCode,
        playerId: users[1].id,
        identityToken: users[1].token,
        inviteToken: created.inviteToken,
      })
    ).success,
    true
  );

  // 3. Real-time chat synchronization & validation
  const guestChatPromise = onceEvent(guestSock, 'chat:message');
  const chatAck = await emitWithContract(hostSock, 'chat:send', { message: '  Ready to play!  ' });
  assert.equal(chatAck.success, true);
  assert.equal(chatAck.data.message, 'Ready to play!');
  const guestChat = await guestChatPromise;
  assert.equal(guestChat.displayName, 'Host9');
  assert.equal(guestChat.message, 'Ready to play!');

  const badChat = await emitWithContract(guestSock, 'chat:send', { message: '   ' });
  assert.equal(badChat.success, false);
  assert.equal(badChat.error.code, 'INVALID_CHAT_MESSAGE');

  // 4. Start game, select word -> turn_timer_started emitted to all players
  const optionsPromise = onceEvent(hostSock, 'word_options');
  assert.equal((await emitWithContract(hostSock, 'game:start', {})).success, true);
  const { options } = await optionsPromise;

  const guestTimerPromise = onceEvent(guestSock, 'turn_timer_started');
  assert.equal(
    (await emitWithContract(hostSock, 'word:select', { wordId: options[0].wordId })).success,
    true
  );
  const timerEvent = await guestTimerPromise;
  assert.equal(timerEvent.durationSeconds, 30);
  assert.ok(Date.parse(timerEvent.turnEndsAt) > Date.now());

  // 5. Verify progressive word_hint & turn_timer_expired delivery via timer service
  const roomDoc = roomsById.get(created.roomId);
  let now = Date.now();
  roomDoc.turnEndsAt = new Date(now + 30_000);
  const jobs = [];
  startTurnTimer({
    io: ioServer,
    room: roomDoc,
    schedule: (cb, delay) => {
      const job = { cb, delay, unref() {} };
      jobs.push(job);
      return job;
    },
    clear: () => {},
    now: () => now,
  });

  const hintPromise = onceEvent(guestSock, 'word_hint');
  await jobs[0].cb();
  const hintEvent = await hintPromise;
  assert.equal(hintEvent.hintNumber, 1);
  assert.equal(hintEvent.hintCount, 1);
  assert.equal([...hintEvent.pattern].filter((c) => c !== '_').length, 1);

  const expiredPromise = onceEvent(guestSock, 'turn_timer_expired');
  now += 30_000;
  await jobs[1].cb();
  const expiredEvent = await expiredPromise;
  assert.equal(expiredEvent.roomCode, created.roomCode);
});
