import { after, before, test } from 'node:test';
import assert from 'node:assert/strict';
import http from 'node:http';

// Point frontend API client to our test server dynamically in before()
import { api } from '../src/services/api.js';
import { createGuestIdentity, validateGuestIdentity } from '../src/services/playerService.js';
import {
  clearStoredPlayerIdentity,
  loadStoredPlayerIdentity,
  saveStoredPlayerIdentity,
} from '../src/utils/playerStorage.js';
import {
  validateDisplayNameInput,
  validateRoomIdInput,
} from '../src/utils/playerValidation.js';

// Load backend app & Player model dynamically after ensuring MONGO_URI is defined
let app;
let Player;
let server;
let originalCreate;
let originalFindById;
const records = new Map();
const names = new Set();
let seq = 1;

function createMemoryStorage() {
  const store = new Map();
  return {
    getItem: (k) => (store.has(k) ? store.get(k) : null),
    setItem: (k, v) => store.set(k, String(v)),
    removeItem: (k) => store.delete(k),
  };
}

before(async () => {
  process.env.MONGO_URI ||= 'mongodb://127.0.0.1:27017/draw-and-guess-test';
  ({ default: app } = await import('../../backend/src/app.js'));
  ({ Player } = await import('../../backend/src/models/Player.js'));

  originalCreate = Player.create;
  originalFindById = Player.findById;
  globalThis.window = { localStorage: createMemoryStorage() };

  Player.create = async (data) => {
    const key = `${data.roomId}:${data.normalizedDisplayName}`;
    if (names.has(key)) {
      const err = new Error('duplicate');
      err.code = 11000;
      err.keyPattern = { roomId: 1, normalizedDisplayName: 1 };
      throw err;
    }
    names.add(key);
    const id = String(seq++).padStart(24, '0');
    const record = { ...data, id };
    records.set(id, record);
    return record;
  };

  Player.findById = (id) => ({
    select: async () => records.get(id) ?? null,
  });

  server = http.createServer(app);
  await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
  const { port } = server.address();
  api.defaults.baseURL = `http://127.0.0.1:${port}/api`;
});

after(async () => {
  await new Promise((resolve) => server.close(resolve));
  Player.create = originalCreate;
  Player.findById = originalFindById;
  delete globalThis.window;
});

test('client-side validation accepts valid names and rejects empty/invalid names', () => {
  assert.deepEqual(validateDisplayNameInput('  Sketch_Ace-1  '), {
    valid: true,
    value: 'Sketch_Ace-1',
    error: null,
  });
  assert.equal(validateDisplayNameInput('').valid, false);
  assert.equal(validateDisplayNameInput('   ').valid, false);
  assert.equal(validateDisplayNameInput('a'.repeat(25)).valid, false);
  assert.equal(validateDisplayNameInput('bad/name!').valid, false);
  assert.equal(validateRoomIdInput('lobby-1').valid, true);
  assert.equal(validateRoomIdInput('bad room').valid, false);
});

test('creates different player identities and restores guest session from storage', async () => {
  clearStoredPlayerIdentity();

  const p1 = await createGuestIdentity({ displayName: '  Alice  ', roomId: 'lobby' });
  assert.equal(p1.displayName, 'Alice');
  assert.equal(p1.roomId, 'lobby');
  assert.ok(p1.playerId);
  assert.ok(p1.identityToken);

  saveStoredPlayerIdentity(p1);
  const loaded = loadStoredPlayerIdentity();
  assert.deepEqual(loaded, {
    playerId: p1.playerId,
    displayName: 'Alice',
    roomId: 'lobby',
    identityToken: p1.identityToken,
  });

  const restored = await validateGuestIdentity({
    playerId: loaded.playerId,
    identityToken: loaded.identityToken,
  });
  assert.deepEqual(restored, {
    valid: true,
    player: { playerId: p1.playerId, displayName: 'Alice', roomId: 'lobby' },
  });

  const p2 = await createGuestIdentity({ displayName: 'Bob_99', roomId: 'lobby' });
  assert.equal(p2.displayName, 'Bob_99');
  assert.notEqual(p2.playerId, p1.playerId);
});

test('rejects invalid names and duplicate names within the same room via backend API', async () => {
  await assert.rejects(
    () => createGuestIdentity({ displayName: '   ', roomId: 'lobby' }),
    (err) => err.code === 'VALIDATION_ERROR' && err.status === 400
  );

  await assert.rejects(
    () => createGuestIdentity({ displayName: 'bad/name', roomId: 'lobby' }),
    (err) => err.code === 'VALIDATION_ERROR' && err.status === 400
  );

  await createGuestIdentity({ displayName: 'Morgan', roomId: 'room-alpha' });

  await assert.rejects(
    () => createGuestIdentity({ displayName: ' morgan ', roomId: 'room-alpha' }),
    (err) =>
      err.code === 'PLAYER_NAME_TAKEN' &&
      err.status === 409 &&
      err.message === 'That display name is already in use in this room'
  );

  const differentRoom = await createGuestIdentity({ displayName: 'Morgan', roomId: 'room-beta' });
  assert.equal(differentRoom.displayName, 'Morgan');
  assert.equal(differentRoom.roomId, 'room-beta');
});

test('fails validation cleanly for tampered token', async () => {
  const created = await createGuestIdentity({ displayName: 'Taylor', roomId: 'room-gamma' });
  const result = await validateGuestIdentity({
    playerId: created.playerId,
    identityToken: 'tampered-token',
  });
  assert.deepEqual(result, { valid: false, player: null });
});
