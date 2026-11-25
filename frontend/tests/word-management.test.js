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

const players = [
  { id: '111111111111111111111111', name: 'DrawerA', token: 'token-a' },
  { id: '222222222222222222222222', name: 'GuesserB', token: 'token-b' },
];
const words = [
  { _id: '000000000000000000000011', text: 'Silver elephant', category: 'Animals', isActive: true },
  { _id: '000000000000000000000012', text: 'Golden compass', category: 'Objects', isActive: true },
  { _id: '000000000000000000000013', text: 'Fire truck', category: 'Combination', isActive: true },
];
const playerRows = new Map();
let room;
const clients = [];

function resetRoom(settingsOverride = {}) {
  room = {
    _id: 'cccccccccccccccccccccccc',
    id: 'cccccccccccccccccccccccc',
    code: 'WORD1234',
    isPublic: true,
    privateInviteTokenHash: null,
    hostPlayerId: players[0].id,
    gameStatus: 'lobby',
    gameStartedAt: null,
    gameCompletedAt: null,
    totalRounds: null,
    currentRound: null,
    currentTurn: null,
    turnOrder: [],
    currentDrawerPlayerId: null,
    wordOptionIds: [],
    currentWordId: null,
    currentWordText: null,
    currentWordCategory: null,
    settings: {
      maxPlayers: 8,
      rounds: 2,
      wordChoices: 2,
      wordMode: 'Normal',
      hintsEnabled: true,
      hints: 2,
      ...settingsOverride,
    },
    members: players.map((p, index) => ({
      playerId: p.id,
      displayName: p.name,
      normalizedDisplayName: p.name.toLowerCase(),
      role: index === 0 ? 'host' : 'player',
      isConnected: false,
      socketId: null,
      lastDisconnectedAt: null,
    })),
    save: async () => room,
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

  for (const p of players) {
    playerRows.set(p.id, {
      _id: p.id,
      id: p.id,
      displayName: p.name,
      identityTokenHash: digest(p.token),
    });
  }

  Player.findById = (id) => {
    const row = playerRows.get(String(id)) ?? null;
    return {
      select: async () => row,
      then: (resolve, reject) => Promise.resolve(row).then(resolve, reject),
    };
  };
  Room.findOne = ({ code }) => ({
    select: async () => (room.code === code ? room : null),
  });
  Room.findById = (id) => {
    const res = String(id) === room.id ? room : null;
    return {
      select: async () => res,
      then: (resolve, reject) => Promise.resolve(res).then(resolve, reject),
    };
  };
  Room.findOneAndUpdate = async (filter, update) => {
    const statusMatches =
      typeof filter.gameStatus === 'object'
        ? filter.gameStatus.$in.includes(room.gameStatus ?? null)
        : room.gameStatus === filter.gameStatus;
    if (!statusMatches) return null;
    if (filter.hostPlayerId && String(room.hostPlayerId) !== String(filter.hostPlayerId)) return null;
    if (filter.currentRound !== undefined && room.currentRound !== filter.currentRound) return null;
    if (filter.currentTurn !== undefined && room.currentTurn !== filter.currentTurn) return null;
    if (
      filter.currentDrawerPlayerId !== undefined &&
      String(room.currentDrawerPlayerId) !== String(filter.currentDrawerPlayerId)
    ) {
      return null;
    }
    if (filter.currentWordId === null && room.currentWordId != null) return null;
    if (
      filter.wordOptionIds &&
      !room.wordOptionIds.some((id) => String(id) === String(filter.wordOptionIds))
    ) {
      return null;
    }
    if (filter.$expr && room.members.filter((m) => m.isConnected).length < 2) return null;
    Object.assign(room, update.$set);
    return room;
  };
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

test('delivers options only to drawer, enforces selection permissions, keeps word secret, and updates blanks', async () => {
  resetRoom({ wordMode: 'Normal' });
  const drawer = await connectSocket();
  const guesser = await connectSocket();

  assert.equal(
    (
      await emitWithContract(drawer, 'lobby:join', {
        roomCode: room.code,
        playerId: players[0].id,
        identityToken: players[0].token,
      })
    ).success,
    true
  );
  assert.equal(
    (
      await emitWithContract(guesser, 'lobby:join', {
        roomCode: room.code,
        playerId: players[1].id,
        identityToken: players[1].token,
      })
    ).success,
    true
  );

  let guesserGotOptions = false;
  guesser.on('word_options', () => {
    guesserGotOptions = true;
  });

  const drawerOptionsPromise = onceEvent(drawer, 'word_options');
  assert.equal((await emitWithContract(drawer, 'game:start', {})).success, true);

  const drawerOptions = await drawerOptionsPromise;
  assert.equal(drawerOptions.options.length, 2);
  await new Promise((r) => setTimeout(r, 30));
  assert.equal(guesserGotOptions, false);

  // Non-drawer cannot select a word
  const forbidden = await emitWithContract(guesser, 'word:select', {
    wordId: drawerOptions.options[0].wordId,
  });
  assert.equal(forbidden.success, false);
  assert.equal(forbidden.error.code, 'DRAWER_ONLY');

  // Drawer selects a word -> receives private word_assigned; guesser receives blanks without word
  const chosen = drawerOptions.options[0];
  const guesserWordSelectedPromise = onceEvent(guesser, 'word_selected');
  const drawerAssignedPromise = onceEvent(drawer, 'word_assigned');
  const selectAck = await emitWithContract(drawer, 'word:select', {
    wordId: chosen.wordId,
  });

  assert.equal(selectAck.success, true);
  assert.equal(selectAck.data.word, chosen.word);

  const assigned = await drawerAssignedPromise;
  assert.equal(assigned.word, chosen.word);

  const publicSelected = await guesserWordSelectedPromise;
  assert.equal(publicSelected.word, undefined);
  assert.equal(JSON.stringify(publicSelected).includes(chosen.word), false);
  assert.match(publicSelected.pattern, /^[_ ]+$/);
  assert.equal(publicSelected.wordLength, chosen.word.replace(/\s+/g, '').length);
  assert.equal(publicSelected.safeHints.category, chosen.category);
  assert.equal(publicSelected.safeHints.wordCount, chosen.word.trim().split(/\s+/).length);

  // Drawer reconnect after word selection re-receives word_assigned privately
  const drawerReconnected = await connectSocket();
  const reconnectedAssignedPromise = onceEvent(drawerReconnected, 'word_assigned');
  assert.equal(
    (
      await emitWithContract(drawerReconnected, 'lobby:join', {
        roomCode: room.code,
        playerId: players[0].id,
        identityToken: players[0].token,
      })
    ).success,
    true
  );
  const reconnectedAssigned = await reconnectedAssignedPromise;
  assert.equal(reconnectedAssigned.word, chosen.word);
});
