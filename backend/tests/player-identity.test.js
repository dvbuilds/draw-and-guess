import { after, before, test } from 'node:test';
import assert from 'node:assert/strict';
import http from 'node:http';
import app from '../src/app.js';
import { Player } from '../src/models/Player.js';

let server;
let baseUrl;
const originalCreate = Player.create;
const originalFindById = Player.findById;
const records = new Map();
const names = new Set();

before(async () => {
  Player.create = async (data) => {
    const key = `${data.roomId}:${data.normalizedDisplayName}`;
    if (names.has(key)) {
      const err = new Error('duplicate');
      err.code = 11000;
      err.keyPattern = { roomId: 1, normalizedDisplayName: 1 };
      throw err;
    }
    names.add(key);
    const record = { ...data, id: '0123456789abcdef01234567' };
    records.set(record.id, record);
    return record;
  };
  Player.findById = (id) => ({
    select: async () => records.get(id) ?? null,
  });
  server = http.createServer(app);
  await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
  baseUrl = `http://127.0.0.1:${server.address().port}/api/players`;
});

after(async () => {
  await new Promise((resolve) => server.close(resolve));
  Player.create = originalCreate;
  Player.findById = originalFindById;
});

async function post(path, body) {
  return fetch(`${baseUrl}${path}`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(body),
  });
}

test('creates guest identity and validates its reconnect token', async () => {
  const created = await post('/', { displayName: '  Casey  ', roomId: 'room-1' });
  assert.equal(created.status, 201);
  const { data } = (await created.json());
  assert.equal(data.displayName, 'Casey');
  assert.equal(data.roomId, 'room-1');
  assert.equal(typeof data.identityToken, 'string');
  assert.equal(data.identityToken.length, 43);

  const valid = await post('/validate', { playerId: data.playerId, identityToken: data.identityToken });
  assert.deepEqual((await valid.json()).data, {
    valid: true,
    player: { playerId: data.playerId, displayName: 'Casey', roomId: 'room-1' },
  });
  const invalid = await post('/validate', { playerId: data.playerId, identityToken: 'wrong-token' });
  assert.deepEqual((await invalid.json()).data, { valid: false, player: null });
});

test('rejects invalid names and duplicate names only within the same room', async () => {
  const missing = await post('/', { roomId: 'room-2' });
  assert.equal(missing.status, 400);
  assert.equal((await missing.json()).error.code, 'VALIDATION_ERROR');
  const illegal = await post('/', { displayName: 'bad/name', roomId: 'room-2' });
  assert.equal(illegal.status, 400);

  const first = await post('/', { displayName: 'Morgan', roomId: 'room-2' });
  assert.equal(first.status, 201);
  const duplicate = await post('/', { displayName: ' morgan ', roomId: 'room-2' });
  assert.equal(duplicate.status, 409);
  assert.equal((await duplicate.json()).error.code, 'PLAYER_NAME_TAKEN');
  const otherRoom = await post('/', { displayName: 'Morgan', roomId: 'room-3' });
  assert.equal(otherRoom.status, 201);
});
