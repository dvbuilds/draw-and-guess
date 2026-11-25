import { after, before, test } from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import http from 'node:http';
import { io as createClient } from 'socket.io-client';
import { Player } from '../src/models/Player.js';
import { Room } from '../src/models/Room.js';
import { initSocket } from '../src/sockets/index.js';

const playerRows = new Map();
const originalPlayerFindById = Player.findById;
const originalRoomFindOne = Room.findOne;
const originalRoomFindById = Room.findById;
const originalRoomFindOneAndUpdate = Room.findOneAndUpdate;
const players = [
  { id: '111111111111111111111111', name: 'Host', token: 'host-token' },
  { id: '222222222222222222222222', name: 'Guest', token: 'guest-token' },
  { id: '333333333333333333333333', name: 'Reconnect', token: 'reconnect-token' },
  { id: '444444444444444444444444', name: 'Other', token: 'other-token' },
];
const digest = (value) => createHash('sha256').update(value).digest('hex');
let server;
let ioServer;
let serverUrl;
let room;
const clients = [];

function resetRoom() {
  room = {
    _id: 'aaaaaaaaaaaaaaaaaaaaaaaa',
    id: 'aaaaaaaaaaaaaaaaaaaaaaaa',
    code: 'ROOM1234',
    isPublic: true,
    privateInviteTokenHash: null,
    hostPlayerId: players[0].id,
    gameStatus: 'lobby',
    gameStartedAt: null,
    settings: { maxPlayers: 8, rounds: 2 },
    members: players.map((player, index) => ({
      playerId: player.id,
      displayName: player.name,
      normalizedDisplayName: player.name.toLowerCase(),
      role: index === 0 ? 'host' : 'player',
      isConnected: false,
      socketId: null,
      lastDisconnectedAt: null,
    })),
    save: async () => room,
  };
}

function payload(playerIndex) {
  const player = players[playerIndex];
  return { roomCode: room.code, playerId: player.id, identityToken: player.token };
}

function connectClient() {
  const client = createClient(serverUrl, { transports: ['websocket'], forceNew: true, reconnection: false });
  clients.push(client);
  return new Promise((resolve, reject) => {
    client.once('connect', () => resolve(client));
    client.once('connect_error', reject);
  });
}

function request(client, event, data) {
  return new Promise((resolve) => {
    client.timeout(2000).emit(event, data, (err, response) => {
      if (err) resolve({ success: false, error: { code: 'TIMEOUT', message: err.message } });
      else resolve(response);
    });
  });
}

function waitForEvent(client, event) {
  return new Promise((resolve) => client.once(event, resolve));
}

before(async () => {
  for (const player of players) {
    playerRows.set(player.id, {
      _id: player.id,
      id: player.id,
      displayName: player.name,
      identityTokenHash: digest(player.token),
    });
  }
  Player.findById = (id) => {
    const player = playerRows.get(String(id)) ?? null;
    return {
      select: async () => player,
      then: (resolve, reject) => Promise.resolve(player).then(resolve, reject),
    };
  };
  Room.findOne = ({ code }) => ({
    select: async () => (room.code === code ? room : null),
  });
  Room.findById = async (id) => String(id) === room.id ? room : null;
  Room.findOneAndUpdate = async (filter, update) => {
    const statusMatches = typeof filter.gameStatus === 'object'
      ? filter.gameStatus.$in.includes(room.gameStatus ?? null)
      : room.gameStatus === filter.gameStatus;
    if (!statusMatches) return null;
    if (filter.hostPlayerId && String(room.hostPlayerId) !== String(filter.hostPlayerId)) return null;
    if (filter.currentRound !== undefined && room.currentRound !== filter.currentRound) return null;
    if (filter.currentTurn !== undefined && room.currentTurn !== filter.currentTurn) return null;
    if (filter.currentDrawerPlayerId !== undefined
        && String(room.currentDrawerPlayerId) !== String(filter.currentDrawerPlayerId)) return null;
    if (filter.$expr && room.members.filter((member) => member.isConnected).length < 2) return null;
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

test('synchronizes multiple socket members, leaves, reconnects, transfers host, and validates game start', async () => {
  const host = await connectClient();
  const hostJoin = await request(host, 'lobby:join', payload(0));
  assert.equal(hostJoin.success, true);
  assert.equal(hostJoin.data.players.length, 4);
  assert.equal(room.members[0].socketId, host.id);

  const tooEarly = await request(host, 'game:start');
  assert.equal(tooEarly.error.code, 'NOT_ENOUGH_PLAYERS');

  let guest = await connectClient();
  const joinedEvent = waitForEvent(host, 'player_joined');
  const guestJoin = await request(guest, 'lobby:join', payload(1));
  assert.equal(guestJoin.success, true);
  assert.equal((await joinedEvent).player.playerId, players[1].id);
  assert.equal(room.members.filter((member) => member.isConnected).length, 2);

  const duplicateJoin = await request(guest, 'lobby:join', payload(1));
  assert.equal(duplicateJoin.success, true);
  assert.equal(duplicateJoin.data.alreadyConnected, true);

  const replacementGuest = await connectClient();
  const replacementJoin = await request(replacementGuest, 'lobby:join', payload(1));
  assert.equal(replacementJoin.success, true);
  assert.equal(guest.connected, false);
  assert.equal(room.members.find((member) => member.playerId === players[1].id).socketId, replacementGuest.id);
  guest = replacementGuest;

  const unauthorizedStart = await request(guest, 'game:start');
  assert.equal(unauthorizedStart.error.code, 'HOST_ONLY');
  const invalidIdentity = await request(await connectClient(), 'lobby:join', {
    ...payload(1), identityToken: 'wrong-token',
  });
  assert.equal(invalidIdentity.error.code, 'INVALID_PLAYER_IDENTITY');

  const other = await connectClient();
  assert.equal((await request(other, 'lobby:join', payload(3))).success, true);
  const leftEvent = waitForEvent(host, 'player_left');
  const left = await request(guest, 'lobby:leave', { reason: 'user_left' });
  assert.equal(left.success, true);
  assert.equal((await leftEvent).player.playerId, players[1].id);
  assert.equal(room.members.some((member) => member.playerId === players[1].id), false);

  const temporary = await connectClient();
  assert.equal((await request(temporary, 'lobby:join', payload(2))).success, true);
  const disconnectedEvent = waitForEvent(host, 'player_left');
  temporary.disconnect();
  const disconnected = await disconnectedEvent;
  assert.equal(disconnected.unexpected, true);
  assert.equal(room.members.find((member) => member.playerId === players[2].id).isConnected, false);

  const reconnected = await connectClient();
  const reconnectResponse = await request(reconnected, 'lobby:join', payload(2));
  assert.equal(reconnectResponse.success, true);
  assert.equal(reconnectResponse.data.reconnected, true);
  assert.equal(room.members.filter((member) => member.playerId === players[2].id).length, 1);

  const hostLeftEvent = waitForEvent(other, 'player_left');
  const hostLeave = await request(host, 'lobby:leave', { reason: 'host_left' });
  assert.equal(hostLeave.success, true);
  const hostLeft = await hostLeftEvent;
  assert.equal(hostLeft.hostTransferredTo.playerId, players[2].id);
  assert.equal(room.hostPlayerId, players[2].id);
  assert.equal(room.members.find((member) => member.playerId === players[2].id).role, 'host');

  const startedEvent = waitForEvent(other, 'game_start');
  const started = await request(reconnected, 'game:start');
  assert.equal(started.success, true);
  const initialGame = await startedEvent;
  assert.equal(initialGame.roomCode, room.code);
  assert.equal(initialGame.currentRound, 1);
  assert.equal(initialGame.currentTurn, 1);
  assert.equal(initialGame.totalRounds, 2);
  assert.equal(initialGame.currentDrawerPlayerId, players[2].id);
  assert.deepEqual(room.turnOrder.map(String), [players[2].id, players[3].id]);
  assert.equal(room.gameStatus, 'started');

  const duplicateStart = await request(reconnected, 'game:start');
  assert.equal(duplicateStart.error.code, 'GAME_ALREADY_STARTED');
  const nextTurnEvent = waitForEvent(other, 'game_turn');
  const nextTurn = await request(reconnected, 'game:next_turn');
  assert.equal(nextTurn.success, true);
  assert.equal((await nextTurnEvent).currentDrawerPlayerId, players[3].id);
  assert.equal(room.currentTurn, 2);

  const disconnectedTurnEvent = waitForEvent(reconnected, 'game_turn');
  const roundEvent = waitForEvent(reconnected, 'round_started');
  other.disconnect();
  const skippedDrawer = await disconnectedTurnEvent;
  assert.equal(skippedDrawer.reason, 'drawer_disconnected');
  assert.equal(skippedDrawer.currentRound, 2);
  assert.equal(skippedDrawer.currentDrawerPlayerId, players[2].id);
  assert.equal((await roundEvent).currentRound, 2);

  const completedEvent = waitForEvent(reconnected, 'game_complete');
  const completed = await request(reconnected, 'game:next_turn');
  assert.equal(completed.success, true);
  assert.equal(completed.data.reason, 'rounds_complete');
  assert.equal((await completedEvent).gameState.status, 'completed');
  assert.equal(room.gameStatus, 'completed');
});
