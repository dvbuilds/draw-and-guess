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
  { id: '111111111111111111111111', name: 'DrawerOne', token: 'token-1' },
  { id: '222222222222222222222222', name: 'DrawerTwo', token: 'token-2' },
  { id: '333333333333333333333333', name: 'Spectator', token: 'token-3' },
];
const words = [
  { _id: '000000000000000000000001', text: 'Rainbow', category: 'Nature', isActive: true },
  { _id: '000000000000000000000002', text: 'Umbrella', category: 'Objects', isActive: true },
];
const playerRows = new Map();
let room;
const clients = [];

function resetRoom() {
  room = {
    _id: 'bbbbbbbbbbbbbbbbbbbbbbbb',
    id: 'bbbbbbbbbbbbbbbbbbbbbbbb',
    code: 'GAME1234',
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
    settings: { maxPlayers: 8, rounds: 2, wordChoices: 2, wordMode: 'Normal', hintsEnabled: true, hints: 2 },
    members: players.slice(0, 2).map((p, index) => ({
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

test('synchronizes game start, drawer display, round/turn transitions, reconnect state, and completion across clients', async () => {
  const host = await connectSocket();
  const guest = await connectSocket();

  assert.equal(
    (
      await emitWithContract(host, 'lobby:join', {
        roomCode: room.code,
        playerId: players[0].id,
        identityToken: players[0].token,
      })
    ).success,
    true
  );

  assert.equal(
    (
      await emitWithContract(guest, 'lobby:join', {
        roomCode: room.code,
        playerId: players[1].id,
        identityToken: players[1].token,
      })
    ).success,
    true
  );

  // Start game -> both tabs receive Round 1, Turn 1, DrawerOne
  const guestStartBroadcast = onceEvent(guest, 'game_start');
  const startAck = await emitWithContract(host, 'game:start', {});
  assert.equal(startAck.success, true);
  assert.equal(startAck.data.status, 'started');
  assert.equal(startAck.data.currentRound, 1);
  assert.equal(startAck.data.currentTurn, 1);
  assert.equal(startAck.data.totalRounds, 2);
  assert.equal(startAck.data.currentDrawerPlayerId, players[0].id);

  const guestStartPayload = await guestStartBroadcast;
  assert.equal(guestStartPayload.currentRound, 1);
  assert.equal(guestStartPayload.currentDrawerPlayerId, players[0].id);

  // Non-host cannot advance turn
  const nonHostTurn = await emitWithContract(guest, 'game:next_turn', {});
  assert.equal(nonHostTurn.success, false);
  assert.equal(nonHostTurn.error.code, 'HOST_ONLY');

  // Host advances turn -> Round 1, Turn 2, DrawerTwo
  const guestTurnBroadcast = onceEvent(guest, 'game_turn');
  const turn2Ack = await emitWithContract(host, 'game:next_turn', {});
  assert.equal(turn2Ack.success, true);
  assert.equal(turn2Ack.data.currentRound, 1);
  assert.equal(turn2Ack.data.currentTurn, 2);
  assert.equal(turn2Ack.data.currentDrawerPlayerId, players[1].id);
  assert.equal((await guestTurnBroadcast).currentDrawerPlayerId, players[1].id);

  // Guest disconnects while drawing -> round advances to Round 2 & reconnect hydrates state
  const round2Promise = onceEvent(host, 'round_started');
  const drawerDisconnectTurnPromise = onceEvent(host, 'game_turn');
  guest.disconnect();
  const round2Event = await round2Promise;
  const drawerDisconnectTurn = await drawerDisconnectTurnPromise;
  assert.equal(round2Event.currentRound, 2);
  assert.equal(round2Event.totalRounds, 2);
  assert.equal(round2Event.currentDrawerPlayerId, players[0].id);
  assert.equal(drawerDisconnectTurn.reason, 'drawer_disconnected');
  assert.equal(drawerDisconnectTurn.currentRound, 2);
  assert.equal(drawerDisconnectTurn.currentTurn, 1);

  const guestReconnected = await connectSocket();
  const rejoinAck = await emitWithContract(guestReconnected, 'lobby:join', {
    roomCode: room.code,
    playerId: players[1].id,
    identityToken: players[1].token,
  });
  assert.equal(rejoinAck.success, true);
  assert.deepEqual(rejoinAck.data.gameState, {
    status: 'started',
    currentRound: 2,
    currentTurn: 1,
    totalRounds: 2,
    currentDrawerPlayerId: players[0].id,
  });

  // Final turn in Round 2 -> host advances -> game_complete
  assert.equal((await emitWithContract(host, 'game:next_turn', {})).success, true);
  const completeBroadcast = onceEvent(guestReconnected, 'game_complete');
  const completeAck = await emitWithContract(host, 'game:next_turn', {});
  assert.equal(completeAck.success, true);
  assert.equal(completeAck.data.reason, 'rounds_complete');
  assert.equal(completeAck.data.gameState.status, 'completed');
  assert.equal((await completeBroadcast).gameState.status, 'completed');
});
