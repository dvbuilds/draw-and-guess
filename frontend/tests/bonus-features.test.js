import { after, before, test } from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import http from 'node:http';
import { io as createClient } from 'socket.io-client';

import { api } from '../src/services/api.js';
import { createRoom, joinRoom } from '../src/services/roomService.js';
import { getAvailableCategories, getAvailableLanguages } from '../src/services/wordService.js';
import { SUPPORTED_LANGUAGES, getTranslations } from '../src/utils/i18n.js';
import { validateRoomSettingsInput } from '../src/utils/roomValidation.js';

let app;
let Player;
let Room;
let Word;
let initSocket;
let stopAllTurnTimers;
let server;
let ioServer;
let serverUrl;

const originals = {};
const digest = (value) => createHash('sha256').update(value).digest('hex');

const users = [
  { id: '111111111111111111111111', name: 'Host10', token: 'host10-token' },
  { id: '222222222222222222222222', name: 'Guest10A', token: 'guest10a-token' },
  { id: '333333333333333333333333', name: 'Guest10B', token: 'guest10b-token' },
  { id: '444444444444444444444444', name: 'Guest10C', token: 'guest10c-token' },
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
  { _id: '000000000000000000000101', text: 'TIGER', category: 'Animals', language: 'en', isActive: true },
  { _id: '000000000000000000000102', text: 'PIZZA', category: 'Food', language: 'en', isActive: true },
  { _id: '000000000000000000000103', text: 'TIGRE', category: 'Animals', language: 'es', isActive: true },
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
  ({ stopAllTurnTimers } = await import('../../backend/src/services/timer.service.js'));

  originals.playerFindById = Player.findById;
  originals.roomExists = Room.exists;
  originals.roomCreate = Room.create;
  originals.roomFindOne = Room.findOne;
  originals.roomFindById = Room.findById;
  originals.roomFindOneAndUpdate = Room.findOneAndUpdate;
  originals.wordFind = Word.find;
  originals.wordFindOne = Word.findOne;
  originals.wordDistinct = Word.distinct;

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
      bannedPlayerIds: data.bannedPlayerIds || [],
      kickedPlayerIds: data.kickedPlayerIds || [],
      activeVoteKick: null,
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
    if (filter['members.playerId']) {
      if (filter.bannedPlayerIds?.$ne && (doc.bannedPlayerIds || []).includes(filter.bannedPlayerIds.$ne)) {
        return null;
      }
      const incoming = update.$push.members;
      doc.members.push({
        ...incoming,
        playerId: String(incoming.playerId),
        isConnected: false,
        socketId: null,
        score: 0,
      });
      return doc;
    }
    if (filter['activeVoteKick.votes.playerId']?.$ne) {
      const voterId = String(filter['activeVoteKick.votes.playerId'].$ne);
      if (
        !doc.activeVoteKick ||
        String(doc.activeVoteKick.targetPlayerId) !== String(filter['activeVoteKick.targetPlayerId']) ||
        (doc.activeVoteKick.votes || []).some((v) => String(v.playerId) === voterId)
      ) {
        return null;
      }
      if (update.$push?.['activeVoteKick.votes']) {
        doc.activeVoteKick.votes = doc.activeVoteKick.votes || [];
        doc.activeVoteKick.votes.push(update.$push['activeVoteKick.votes']);
      }
      return doc;
    }
    if (update.$set) Object.assign(doc, update.$set);
    return doc;
  };
  Word.find = async (q) =>
    words.filter((w) => {
      if (q.language && w.language !== q.language) return false;
      if (q.category?.$in && !q.category.$in.includes(w.category)) return false;
      return w.isActive;
    });
  Word.findOne = async ({ _id }) => words.find((w) => w._id === String(_id)) ?? null;
  Word.distinct = async (field) =>
    field === 'language'
      ? ['en', 'es', 'fr']
      : ['Animals', 'Food', 'Objects', 'Nature', 'Places', 'Activities'];

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
  Word.distinct = originals.wordDistinct;
  await new Promise((resolve) => server.close(resolve));
});

test('fetches languages & categories, validates category/mode combinations, and resolves UI translations', async () => {
  const languages = await getAvailableLanguages();
  assert.deepEqual(
    languages.map((l) => l.code),
    ['en', 'es', 'fr']
  );

  const categories = await getAvailableCategories('es');
  assert.ok(categories.includes('Animals'));

  await assert.rejects(() => getAvailableCategories('de'), (err) => err?.code === 'INVALID_WORD_LANGUAGE');

  const valid = validateRoomSettingsInput({
    maxPlayers: 8,
    rounds: 3,
    drawingTime: 80,
    wordChoices: 3,
    hints: 3,
    wordMode: 'Normal',
    language: 'es',
    wordCategories: ['Animals', 'Food'],
    voteKickEnabled: true,
    voteKickThreshold: 65,
  });
  assert.equal(valid.valid, true);
  assert.deepEqual(valid.value.wordCategories, ['Animals', 'Food']);
  assert.equal(valid.value.language, 'es');

  const mismatch = validateRoomSettingsInput({
    maxPlayers: 8,
    rounds: 3,
    drawingTime: 80,
    wordChoices: 3,
    hints: 3,
    wordMode: 'Normal',
    wordCategories: ['Combination'],
  });
  assert.equal(mismatch.valid, false);
  assert.ok(mismatch.errors.wordCategories);

  assert.equal(SUPPORTED_LANGUAGES.length, 3);
  assert.equal(getTranslations('es').navCreate, 'Crear Sala');
  assert.equal(getTranslations('fr').navJoin, 'Rejoindre');
  assert.equal(getTranslations('unknown').navHome, 'Home');
});

test('supports host kick/ban moderation, host announcements, and VoteKick voting lifecycle', async () => {
  const created = await createRoom({
    playerId: users[0].id,
    identityToken: users[0].token,
    isPublic: true,
    settings: {
      maxPlayers: 8,
      rounds: 3,
      drawingTime: 60,
      wordChoices: 3,
      hints: 2,
      wordMode: 'Normal',
      language: 'en',
      wordCategories: ['Animals'],
      voteKickEnabled: true,
      voteKickThreshold: 60,
    },
  });
  assert.deepEqual(created.settings.wordCategories, ['Animals']);
  assert.equal(created.settings.language, 'en');

  for (const guest of users.slice(1)) {
    await joinRoom({
      playerId: guest.id,
      identityToken: guest.token,
      roomCode: created.roomCode,
    });
  }

  const sockets = await Promise.all(users.map(() => connectSocket()));
  for (let i = 0; i < users.length; i += 1) {
    const res = await emitWithContract(sockets[i], 'lobby:join', {
      roomCode: created.roomCode,
      playerId: users[i].id,
      identityToken: users[i].token,
    });
    assert.equal(res.success, true);
  }

  // Non-host cannot announce or kick
  const deniedAnnounce = await emitWithContract(sockets[1], 'announcement:send', {
    message: 'Unauthorized!',
  });
  assert.equal(deniedAnnounce.success, false);
  assert.equal(deniedAnnounce.error.code, 'HOST_ONLY');

  const deniedKick = await emitWithContract(sockets[1], 'moderation:kick', {
    playerId: users[2].id,
  });
  assert.equal(deniedKick.success, false);
  assert.equal(deniedKick.error.code, 'HOST_ONLY');

  // Host announcement broadcasts to room
  const announcePromise = onceEvent(sockets[1], 'room:announcement');
  const sentAnnounce = await emitWithContract(sockets[0], 'announcement:send', {
    message: 'Welcome to the room!',
  });
  assert.equal(sentAnnounce.success, true);
  const receivedAnnounce = await announcePromise;
  assert.equal(receivedAnnounce.message, 'Welcome to the room!');

  // Host bans Guest10C -> removed & cannot rejoin via HTTP joinRoom
  const removedPromise = onceEvent(sockets[3], 'moderation:removed');
  const bannedPromise = onceEvent(sockets[0], 'player_banned');
  const banRes = await emitWithContract(sockets[0], 'moderation:ban', {
    playerId: users[3].id,
  });
  assert.equal(banRes.success, true);
  const removedEvt = await removedPromise;
  const bannedEvt = await bannedPromise;
  assert.equal(removedEvt.banned, true);
  assert.equal(bannedEvt.player.playerId, users[3].id);

  await assert.rejects(
    () =>
      joinRoom({
        playerId: users[3].id,
        identityToken: users[3].token,
        roomCode: created.roomCode,
      }),
    (err) => err?.code === 'PLAYER_BANNED'
  );

  // VoteKick against Guest10B by Guest10A + Host10 -> passes and removes Guest10B
  const voteStartPromise = onceEvent(sockets[0], 'vote_kick:started');
  const startVoteRes = await emitWithContract(sockets[1], 'vote_kick:start', {
    playerId: users[2].id,
  });
  assert.equal(startVoteRes.success, true);
  const voteStarted = await voteStartPromise;
  assert.equal(voteStarted.targetPlayerId, users[2].id);
  assert.equal(voteStarted.requiredVotes, 2);

  // Initiator votes Yes, then duplicate vote is rejected
  const firstVote = await emitWithContract(sockets[1], 'vote_kick:cast', { yes: true });
  assert.equal(firstVote.success, true);

  const dupVote = await emitWithContract(sockets[1], 'vote_kick:cast', { yes: true });
  assert.equal(dupVote.success, false);
  assert.equal(dupVote.error.code, 'DUPLICATE_VOTE');

  // Target cannot vote on themselves
  const selfVote = await emitWithContract(sockets[2], 'vote_kick:cast', { yes: false });
  assert.equal(selfVote.success, false);
  assert.equal(selfVote.error.code, 'CANNOT_VOTE_SELF');

  // Host votes Yes -> threshold reached -> vote_kick:ended & player_kicked
  const voteEndedPromise = onceEvent(sockets[1], 'vote_kick:ended');
  const kickedPromise = onceEvent(sockets[1], 'player_kicked');
  const hostVote = await emitWithContract(sockets[0], 'vote_kick:cast', { yes: true });
  assert.equal(hostVote.success, true);

  const voteEnded = await voteEndedPromise;
  const kickedEvt = await kickedPromise;
  assert.equal(voteEnded.passed, true);
  assert.equal(kickedEvt.source, 'vote_kick');
  assert.equal(kickedEvt.player.playerId, users[2].id);
});
