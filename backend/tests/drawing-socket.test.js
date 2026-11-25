import { after, before, test } from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import http from 'node:http';
import { io as createClient } from 'socket.io-client';
import { Player } from '../src/models/Player.js';
import { Room } from '../src/models/Room.js';
import { initSocket } from '../src/sockets/index.js';

const players = [
  { id: '111111111111111111111111', name: 'Drawer', token: 'drawer-token' },
  { id: '222222222222222222222222', name: 'Viewer', token: 'viewer-token' },
  { id: '333333333333333333333333', name: 'OtherRoom', token: 'other-token' },
];
const playerRows = new Map(players.map((player) => [player.id, {
  _id: player.id,
  id: player.id,
  displayName: player.name,
  identityTokenHash: createHash('sha256').update(player.token).digest('hex'),
}]));
const originalPlayerFindById = Player.findById;
const originalRoomFindById = Room.findById;
const originalRoomFindOne = Room.findOne;
let server;
let ioServer;
let serverUrl;
const clients = [];
const roomRows = new Map();

function makeRoom({ id, code, drawerId, memberIds }) {
  const room = {
    _id: id,
    id,
    code,
    isPublic: true,
    gameStatus: 'started',
    currentDrawerPlayerId: drawerId,
    currentWordId: 'eeeeeeeeeeeeeeeeeeeeeeee',
    currentWordText: 'Rainbow',
    currentWordCategory: 'Nature',
    currentRound: 1,
    currentTurn: 1,
    totalRounds: 2,
    turnOrder: memberIds,
    settings: { wordChoices: 2, wordMode: 'Normal', hintsEnabled: true, hints: 1 },
    hostPlayerId: drawerId,
    members: memberIds.map((playerId) => ({
      playerId,
      displayName: players.find((player) => player.id === playerId).name,
      normalizedDisplayName: players.find((player) => player.id === playerId).name.toLowerCase(),
      role: playerId === drawerId ? 'host' : 'player',
      isConnected: false,
      socketId: null,
    })),
    save: async () => room,
  };
  roomRows.set(id, room);
  return room;
}

function connectClient() {
  const client = createClient(serverUrl, { transports: ['websocket'], forceNew: true, reconnection: false });
  clients.push(client);
  return new Promise((resolve, reject) => {
    client.once('connect', () => resolve(client));
    client.once('connect_error', reject);
  });
}

function emit(client, event, payload = {}) {
  return new Promise((resolve) => {
    client.timeout(2000).emit(event, payload, (err, response) => {
      if (err) resolve({ success: false, error: { code: 'TIMEOUT', message: err.message } });
      else resolve(response);
    });
  });
}

function once(client, event) {
  return new Promise((resolve) => client.once(event, resolve));
}

async function join(client, player, roomCode) {
  return emit(client, 'lobby:join', {
    roomCode,
    playerId: player.id,
    identityToken: player.token,
  });
}

before(async () => {
  Player.findById = (id) => {
    const row = playerRows.get(String(id)) ?? null;
    return {
      select: async () => row,
      then: (resolve, reject) => Promise.resolve(row).then(resolve, reject),
    };
  };
  Room.findOne = ({ code }) => ({
    select: async () => [...roomRows.values()].find((room) => room.code === code) ?? null,
  });
  Room.findById = (id) => {
    const room = roomRows.get(String(id)) ?? null;
    return {
      select: async () => room,
      then: (resolve, reject) => Promise.resolve(room).then(resolve, reject),
    };
  };
  makeRoom({
    id: 'aaaaaaaaaaaaaaaaaaaaaaaa',
    code: 'DRAW1234',
    drawerId: players[0].id,
    memberIds: [players[0].id, players[1].id],
  });
  makeRoom({
    id: 'bbbbbbbbbbbbbbbbbbbbbbbb',
    code: 'OTHER123',
    drawerId: players[2].id,
    memberIds: [players[2].id],
  });
  server = http.createServer();
  ioServer = initSocket(server);
  await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
  serverUrl = `http://127.0.0.1:${server.address().port}`;
});

after(async () => {
  for (const socket of ioServer.sockets.sockets.values()) delete socket.data.lobby;
  for (const client of clients) client.disconnect();
  await new Promise((resolve) => ioServer.close(resolve));
  Player.findById = originalPlayerFindById;
  Room.findById = originalRoomFindById;
  Room.findOne = originalRoomFindOne;
});

test('synchronizes strokes, eraser, undo, and clear only inside the room with drawer permissions', async () => {
  const drawer = await connectClient();
  const viewer = await connectClient();
  const otherRoomPlayer = await connectClient();
  assert.equal((await join(drawer, players[0], 'DRAW1234')).success, true);
  assert.equal((await join(viewer, players[1], 'DRAW1234')).success, true);
  assert.equal((await join(otherRoomPlayer, players[2], 'OTHER123')).success, true);

  const receivedStrokes = [];
  viewer.on('drawing:stroke', (payload) => receivedStrokes.push(payload));
  let drawerReceivedEcho = false;
  drawer.on('drawing:stroke', () => { drawerReceivedEcho = true; });
  let unrelatedRoomReceived = false;
  otherRoomPlayer.on('drawing:stroke', () => { unrelatedRoomReceived = true; });

  const first = {
    strokeId: 'stroke_01', segmentIndex: 0,
    points: [{ x: 0.1, y: 0.2 }, { x: 0.2, y: 0.3 }],
    color: '#123ABC', width: 5, tool: 'pen',
  };
  const second = {
    ...first, segmentIndex: 1,
    points: [{ x: 0.2, y: 0.3 }, { x: 0.3, y: 0.4 }],
  };
  const firstBroadcast = once(viewer, 'drawing:stroke');
  assert.equal((await emit(drawer, 'drawing:stroke', first)).success, true);
  assert.equal((await firstBroadcast).segmentIndex, 0);
  const secondBroadcast = once(viewer, 'drawing:stroke');
  assert.equal((await emit(drawer, 'drawing:stroke', second)).success, true);
  assert.equal((await secondBroadcast).segmentIndex, 1);
  assert.equal(receivedStrokes.length, 2);
  await new Promise((resolve) => setTimeout(resolve, 25));
  assert.equal(drawerReceivedEcho, false);

  const sync = await emit(viewer, 'drawing:sync');
  assert.equal(sync.success, true);
  assert.equal(sync.data.strokes.length, 2);
  await new Promise((resolve) => setTimeout(resolve, 25));
  assert.equal(unrelatedRoomReceived, false);

  const undoBroadcast = once(viewer, 'drawing:undone');
  const undo = await emit(drawer, 'drawing:undo');
  assert.deepEqual(undo.data, { undone: true, strokeId: 'stroke_01' });
  assert.equal((await undoBroadcast).strokeId, 'stroke_01');

  const eraser = { ...first, strokeId: 'eraser_01', segmentIndex: 0, tool: 'eraser' };
  const eraserBroadcast = once(viewer, 'drawing:stroke');
  assert.equal((await emit(drawer, 'drawing:stroke', eraser)).success, true);
  assert.equal((await eraserBroadcast).tool, 'eraser');

  const deniedStroke = await emit(viewer, 'drawing:stroke', { ...first, strokeId: 'denied_01' });
  assert.equal(deniedStroke.error.code, 'DRAWER_ONLY');
  const deniedEraser = await emit(viewer, 'drawing:stroke', { ...first, strokeId: 'denied_eraser', tool: 'eraser' });
  assert.equal(deniedEraser.error.code, 'DRAWER_ONLY');
  assert.equal((await emit(viewer, 'drawing:undo')).error.code, 'DRAWER_ONLY');
  assert.equal((await emit(viewer, 'drawing:clear')).error.code, 'DRAWER_ONLY');

  const malformed = await emit(drawer, 'drawing:stroke', {
    ...first, strokeId: 'malformed_01', points: [{ x: 2, y: 0 }, { x: 0, y: 1 }],
  });
  assert.equal(malformed.error.code, 'INVALID_DRAWING_PAYLOAD');
  const clearBroadcast = once(viewer, 'drawing:cleared');
  const clear = await emit(drawer, 'drawing:clear');
  assert.equal(clear.success, true);
  assert.equal(clear.data.cleared, true);
  await clearBroadcast;
  assert.equal((await emit(viewer, 'drawing:sync')).data.strokes.length, 0);
});
