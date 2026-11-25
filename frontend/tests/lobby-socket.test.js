import { after, before, test } from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import http from 'node:http';
import { io as createClient } from 'socket.io-client';

let Player;
let Room;
let initSocket;
let server;
let ioServer;
let serverUrl;
let originalPlayerFindById;
let originalRoomFindOne;
let originalRoomFindById;
let originalRoomFindOneAndUpdate;

const digest = (value) => createHash('sha256').update(value).digest('hex');

const players = [
  { id: '111111111111111111111111', name: 'Host', token: 'host-token' },
  { id: '222222222222222222222222', name: 'Guest', token: 'guest-token' },
  { id: '333333333333333333333333', name: 'Reconnect', token: 'reconnect-token' },
];
const playerRows = new Map();
let room;
const clients = [];

function resetRoom() {
  room = {
    _id: 'aaaaaaaaaaaaaaaaaaaaaaaa',
    id: 'aaaaaaaaaaaaaaaaaaaaaaaa',
    code: 'LOBBY123',
    isPublic: true,
    privateInviteTokenHash: null,
    hostPlayerId: players[0].id,
    gameStatus: 'lobby',
    gameStartedAt: null,
    settings: { maxPlayers: 8 },
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
  ({ initSocket } = await import('../../backend/src/sockets/index.js'));

  originalPlayerFindById = Player.findById;
  originalRoomFindOne = Room.findOne;
  originalRoomFindById = Room.findById;
  originalRoomFindOneAndUpdate = Room.findOneAndUpdate;

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
  Room.findById = async (id) => (String(id) === room.id ? room : null);
  Room.findOneAndUpdate = async (filter, update) => {
    if (
      !filter.gameStatus.$in.includes(room.gameStatus ?? null) ||
      String(room.hostPlayerId) !== String(filter.hostPlayerId)
    ) {
      return null;
    }
    const connectedCount = room.members.filter((m) => m.isConnected).length;
    if (connectedCount < 2) return null;
    Object.assign(room, update.$set);
    return room;
  };

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
});

test('frontend socket contract handles multi-client sync, leave/disconnect, host transfer, start validation, and reconnect', async () => {
  const hostSocket = await connectSocket();
  const hostRes = await emitWithContract(hostSocket, 'lobby:join', {
    roomCode: room.code,
    playerId: players[0].id,
    identityToken: players[0].token,
  });
  assert.equal(hostRes.success, true);
  assert.equal(hostRes.data.players.find((p) => p.playerId === players[0].id).role, 'host');

  // Start requires at least 2 connected players
  const earlyStart = await emitWithContract(hostSocket, 'game:start', {});
  assert.equal(earlyStart.success, false);
  assert.equal(earlyStart.error.code, 'NOT_ENOUGH_PLAYERS');

  // Second tab joins
  const guestSocket = await connectSocket();
  const joinedBroadcast = onceEvent(hostSocket, 'player_joined');
  const guestRes = await emitWithContract(guestSocket, 'lobby:join', {
    roomCode: room.code,
    playerId: players[1].id,
    identityToken: players[1].token,
  });
  assert.equal(guestRes.success, true);
  assert.equal((await joinedBroadcast).player.playerId, players[1].id);

  // Non-host cannot start
  const guestStart = await emitWithContract(guestSocket, 'game:start', {});
  assert.equal(guestStart.success, false);
  assert.equal(guestStart.error.code, 'HOST_ONLY');

  // Third tab joins, disconnects unexpectedly, and reconnects
  const thirdSocket = await connectSocket();
  assert.equal(
    (
      await emitWithContract(thirdSocket, 'lobby:join', {
        roomCode: room.code,
        playerId: players[2].id,
        identityToken: players[2].token,
      })
    ).success,
    true
  );

  const disconnectBroadcast = onceEvent(hostSocket, 'player_left');
  thirdSocket.disconnect();
  const disconnectEvent = await disconnectBroadcast;
  assert.equal(disconnectEvent.unexpected, true);
  assert.equal(
    disconnectEvent.players.find((p) => p.playerId === players[2].id).isConnected,
    false
  );

  const thirdReconnected = await connectSocket();
  const reconnectRes = await emitWithContract(thirdReconnected, 'lobby:join', {
    roomCode: room.code,
    playerId: players[2].id,
    identityToken: players[2].token,
  });
  assert.equal(reconnectRes.success, true);
  assert.equal(reconnectRes.data.reconnected, true);

  // Host leaves explicitly -> host transfers to connected player (Guest)
  const hostLeftBroadcast = onceEvent(guestSocket, 'player_left');
  const hostLeaveRes = await emitWithContract(hostSocket, 'lobby:leave', {
    reason: 'user_left',
  });
  assert.equal(hostLeaveRes.success, true);
  const hostLeftEvent = await hostLeftBroadcast;
  assert.equal(hostLeftEvent.hostTransferredTo.playerId, players[1].id);
  assert.equal(
    hostLeftEvent.players.find((p) => p.playerId === players[1].id).role,
    'host'
  );

  // New host starts the game
  const gameStartBroadcast = onceEvent(thirdReconnected, 'game_start');
  const startRes = await emitWithContract(guestSocket, 'game:start', {});
  assert.equal(startRes.success, true);
  const startEvent = await gameStartBroadcast;
  assert.equal(startEvent.roomCode, room.code);
  assert.equal(startEvent.hostPlayerId, players[1].id);
});
