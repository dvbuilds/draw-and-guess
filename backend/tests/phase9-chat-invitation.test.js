import { after, before, test } from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import http from 'node:http';
import { io as createClient } from 'socket.io-client';
import { Player } from '../src/models/Player.js';
import { Room } from '../src/models/Room.js';
import { initSocket } from '../src/sockets/index.js';

const users = [
  { id: '111111111111111111111111', name: 'Host', token: 'host-token' },
  { id: '222222222222222222222222', name: 'Guest', token: 'guest-token' },
  { id: '333333333333333333333333', name: 'Elsewhere', token: 'other-token' },
];
const digest = (value) => createHash('sha256').update(value).digest('hex');
const playerRows = new Map(users.map((user) => [user.id, {
  _id: user.id, id: user.id, displayName: user.name,
  identityTokenHash: digest(user.token),
}]));

function roomFixture({ id, code, isPublic, memberIndexes, inviteToken }) {
  const room = {
    _id: id, code, isPublic,
    privateInviteTokenHash: inviteToken ? digest(inviteToken) : null,
    hostPlayerId: users[memberIndexes[0]].id,
    gameStatus: 'lobby',
    members: memberIndexes.map((index) => ({
      playerId: users[index].id, displayName: users[index].name,
      normalizedDisplayName: users[index].name.toLowerCase(),
      role: index === memberIndexes[0] ? 'host' : 'player',
      isConnected: false, socketId: null, lastDisconnectedAt: null,
    })),
  };
  room.save = async () => room;
  return room;
}

const rooms = new Map([
  ['CHAT1234', roomFixture({ id: 'aaaaaaaaaaaaaaaaaaaaaaaa', code: 'CHAT1234', isPublic: true, memberIndexes: [0, 1] })],
  ['OTHER123', roomFixture({ id: 'bbbbbbbbbbbbbbbbbbbbbbbb', code: 'OTHER123', isPublic: true, memberIndexes: [2] })],
  ['PRIV1234', roomFixture({ id: 'cccccccccccccccccccccccc', code: 'PRIV1234', isPublic: false, memberIndexes: [0, 1], inviteToken: 'invite-secret' })],
]);
const originals = {
  playerFindById: Player.findById,
  roomFindOne: Room.findOne,
  roomFindById: Room.findById,
};
let server;
let ioServer;
let serverUrl;
const clients = [];

function query(value) {
  return { select: async () => value, then: (resolve, reject) => Promise.resolve(value).then(resolve, reject) };
}

function connect() {
  const client = createClient(serverUrl, { transports: ['websocket'], forceNew: true, reconnection: false });
  clients.push(client);
  return new Promise((resolve, reject) => {
    client.once('connect', () => resolve(client));
    client.once('connect_error', reject);
  });
}

function request(client, event, payload) {
  return new Promise((resolve) => client.timeout(2000).emit(event, payload, (err, response) => {
    resolve(err ? { success: false, error: { code: 'TIMEOUT' } } : response);
  }));
}

function on(client, event) {
  return new Promise((resolve) => client.once(event, resolve));
}

function joinPayload(user, roomCode, inviteToken) {
  return { roomCode, playerId: user.id, identityToken: user.token, inviteToken };
}

before(async () => {
  Player.findById = (id) => query(playerRows.get(String(id)) ?? null);
  Room.findOne = ({ code }) => query(rooms.get(code) ?? null);
  Room.findById = (id) => query([...rooms.values()].find((room) => room._id === String(id)) ?? null);
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
});

test('synchronizes validated chat only among room members', async () => {
  const host = await connect();
  const guest = await connect();
  const elsewhere = await connect();
  const outsider = await connect();
  assert.equal((await request(host, 'lobby:join', joinPayload(users[0], 'CHAT1234'))).success, true);
  assert.equal((await request(guest, 'lobby:join', joinPayload(users[1], 'CHAT1234'))).success, true);
  assert.equal((await request(elsewhere, 'lobby:join', joinPayload(users[2], 'OTHER123'))).success, true);

  const receivedByHost = on(host, 'chat:message');
  const receivedByGuest = on(guest, 'chat:message');
  let unrelatedReceived = false;
  elsewhere.on('chat:message', () => { unrelatedReceived = true; });
  const sent = await request(host, 'chat:send', { message: '  Hello, room!  ' });
  assert.equal(sent.success, true);
  assert.equal(sent.data.message, 'Hello, room!');
  assert.equal((await receivedByHost).playerId, users[0].id);
  assert.deepEqual(await receivedByGuest, sent.data);
  await new Promise((resolve) => setTimeout(resolve, 20));
  assert.equal(unrelatedReceived, false);

  for (const message of ['', '   ', 'x'.repeat(501)]) {
    const response = await request(guest, 'chat:send', { message });
    assert.equal(response.success, false);
    assert.equal(response.error.code, 'INVALID_CHAT_MESSAGE');
  }
  const unauthorized = await request(outsider, 'chat:send', { message: 'intrusion' });
  assert.equal(unauthorized.success, false);
  assert.equal(unauthorized.error.code, 'NOT_IN_ROOM');
});

test('requires the private invitation token to join a private room socket', async () => {
  const guest = await connect();
  const denied = await request(guest, 'lobby:join', joinPayload(users[1], 'PRIV1234'));
  assert.equal(denied.success, false);
  assert.equal(denied.error.code, 'PRIVATE_ROOM');

  const wrong = await request(guest, 'lobby:join', joinPayload(users[1], 'PRIV1234', 'wrong-token'));
  assert.equal(wrong.success, false);
  assert.equal(wrong.error.code, 'PRIVATE_ROOM');

  const allowed = await request(guest, 'lobby:join', joinPayload(users[1], 'PRIV1234', 'invite-secret'));
  assert.equal(allowed.success, true);
  assert.equal(allowed.data.roomCode, 'PRIV1234');
});
