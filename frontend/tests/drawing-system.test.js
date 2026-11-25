import { after, before, test } from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import http from 'node:http';
import { io as createClient } from 'socket.io-client';

import {
  applyStrokeSegment,
  applyUndoStroke,
  clampPoint,
  generateStrokeId,
  hydrateStrokesFromSync,
} from '../src/utils/drawingEngine.js';

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
  { id: '111111111111111111111111', name: 'Drawer1', token: 'drawer-token-1' },
  { id: '222222222222222222222222', name: 'Viewer1', token: 'viewer-token-1' },
];
const words = [
  { _id: '000000000000000000000021', text: 'Rainbow', category: 'Nature', isActive: true },
  { _id: '000000000000000000000022', text: 'Compass', category: 'Objects', isActive: true },
];
const playerRows = new Map();
let room;
const clients = [];

function resetRoom() {
  room = {
    _id: 'dddddddddddddddddddddddd',
    id: 'dddddddddddddddddddddddd',
    code: 'DRAW7890',
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

test('drawingEngine normalizes coordinates and merges, syncs, and undoes strokes idempotently', () => {
  assert.deepEqual(clampPoint({ x: -0.25, y: 1.4 }), { x: 0, y: 1 });
  const id = generateStrokeId();
  assert.match(id, /^[A-Za-z0-9_-]{8,64}$/);

  const seg0 = {
    strokeId: id,
    segmentIndex: 0,
    points: [{ x: 0.1, y: 0.1 }, { x: 0.2, y: 0.2 }],
    color: '#EF4444',
    width: 8,
    tool: 'pen',
  };
  const seg1 = {
    strokeId: id,
    segmentIndex: 1,
    points: [{ x: 0.2, y: 0.2 }, { x: 0.3, y: 0.3 }],
    color: '#EF4444',
    width: 8,
    tool: 'pen',
  };

  let state = applyStrokeSegment([], seg0);
  state = applyStrokeSegment(state, seg1);
  // Duplicate segmentIndex ignored
  state = applyStrokeSegment(state, seg1);
  assert.equal(state.length, 1);
  assert.equal(state[0].segments.length, 2);

  const hydrated = hydrateStrokesFromSync([seg0, seg1]);
  assert.deepEqual(hydrated, state);

  const undone = applyUndoStroke(state, id);
  assert.equal(undone.length, 0);
});

test('synchronizes live pen/eraser strokes, undo, clear, and enforces drawer permissions across clients', async () => {
  resetRoom();
  const drawer = await connectSocket();
  const viewer = await connectSocket();

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
      await emitWithContract(viewer, 'lobby:join', {
        roomCode: room.code,
        playerId: players[1].id,
        identityToken: players[1].token,
      })
    ).success,
    true
  );

  const optionsPromise = onceEvent(drawer, 'word_options');
  assert.equal((await emitWithContract(drawer, 'game:start', {})).success, true);
  const { options } = await optionsPromise;

  // Cannot draw before selecting a word
  const preWordStroke = {
    strokeId: 'preword_01',
    segmentIndex: 0,
    points: [{ x: 0.1, y: 0.1 }, { x: 0.2, y: 0.2 }],
    color: '#0F172A',
    width: 6,
    tool: 'pen',
  };
  const preWordRes = await emitWithContract(drawer, 'drawing:stroke', preWordStroke);
  assert.equal(preWordRes.success, false);
  assert.equal(preWordRes.error.code, 'WORD_NOT_SELECTED');

  // Drawer selects a word
  assert.equal(
    (await emitWithContract(drawer, 'word:select', { wordId: options[0].wordId })).success,
    true
  );

  // Non-drawer is blocked from drawing, erasing, undoing, and clearing
  assert.equal(
    (await emitWithContract(viewer, 'drawing:stroke', preWordStroke)).error.code,
    'DRAWER_ONLY'
  );
  assert.equal((await emitWithContract(viewer, 'drawing:undo', {})).error.code, 'DRAWER_ONLY');
  assert.equal((await emitWithContract(viewer, 'drawing:clear', {})).error.code, 'DRAWER_ONLY');

  // Drawer emits pen stroke -> viewer receives real-time drawing:stroke
  const stroke1 = {
    strokeId: 'pen_stroke_1',
    segmentIndex: 0,
    points: [{ x: 0.15, y: 0.25 }, { x: 0.45, y: 0.55 }],
    color: '#3B82F6',
    width: 12,
    tool: 'pen',
  };
  const viewerPenPromise = onceEvent(viewer, 'drawing:stroke');
  assert.equal((await emitWithContract(drawer, 'drawing:stroke', stroke1)).success, true);
  const viewerPen = await viewerPenPromise;
  assert.equal(viewerPen.strokeId, 'pen_stroke_1');
  assert.equal(viewerPen.tool, 'pen');
  assert.equal(viewerPen.color, '#3B82F6');

  // Drawer emits eraser stroke -> viewer receives eraser stroke
  const eraser1 = {
    strokeId: 'eraser_stroke_1',
    segmentIndex: 0,
    points: [{ x: 0.2, y: 0.2 }, { x: 0.3, y: 0.3 }],
    color: '#FFFFFF',
    width: 20,
    tool: 'eraser',
  };
  const viewerEraserPromise = onceEvent(viewer, 'drawing:stroke');
  assert.equal((await emitWithContract(drawer, 'drawing:stroke', eraser1)).success, true);
  assert.equal((await viewerEraserPromise).tool, 'eraser');

  // Undo removes last stroke (eraser_stroke_1) and syncs
  const undonePromise = onceEvent(viewer, 'drawing:undone');
  const undoAck = await emitWithContract(drawer, 'drawing:undo', {});
  assert.deepEqual(undoAck.data, { undone: true, strokeId: 'eraser_stroke_1' });
  assert.equal((await undonePromise).strokeId, 'eraser_stroke_1');

  const syncAfterUndo = await emitWithContract(viewer, 'drawing:sync', {});
  assert.equal(syncAfterUndo.success, true);
  assert.equal(syncAfterUndo.data.strokes.length, 1);
  assert.equal(syncAfterUndo.data.strokes[0].strokeId, 'pen_stroke_1');

  // Clear removes remaining strokes and syncs
  const clearedPromise = onceEvent(viewer, 'drawing:cleared');
  const clearAck = await emitWithContract(drawer, 'drawing:clear', {});
  assert.equal(clearAck.success, true);
  assert.equal(clearAck.data.cleared, true);
  await clearedPromise;
  assert.equal((await emitWithContract(viewer, 'drawing:sync', {})).data.strokes.length, 0);
});
