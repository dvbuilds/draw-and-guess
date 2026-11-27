import { after, before, test } from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import http from 'node:http';
import app from '../src/app.js';
import { Player } from '../src/models/Player.js';
import { Room } from '../src/models/Room.js';

const players = new Map();
const rooms = new Map();
const originalPlayerFindById = Player.findById;
const originalRoomExists = Room.exists;
const originalRoomCreate = Room.create;
const originalRoomFindOne = Room.findOne;
const originalRoomFindOneAndUpdate = Room.findOneAndUpdate;
const originalRoomFindById = Room.findById;
let server;
let baseUrl;
let nextRoomId = 1;
let nextCode = 0;

function digest(token) {
  return createHash('sha256').update(token).digest('hex');
}

function addPlayer(id, displayName, identityToken) {
  players.set(id, {
    _id: id,
    id,
    displayName,
    normalizedDisplayName: displayName.toLocaleLowerCase('en'),
    identityTokenHash: digest(identityToken),
  });
}

function roomDocument(data) {
  return {
    ...data,
    id: String(nextRoomId++).padStart(24, '0'),
    _id: String(nextRoomId - 1).padStart(24, '0'),
    members: data.members.map((member) => ({ ...member, playerId: String(member.playerId) })),
  };
}

before(async () => {
  addPlayer('111111111111111111111111', 'Host', 'host-secret');
  addPlayer('222222222222222222222222', 'Guest', 'guest-secret');
  addPlayer('333333333333333333333333', 'Host', 'same-name-secret');
  addPlayer('444444444444444444444444', 'Third', 'third-secret');

  Player.findById = (id) => {
    const player = players.get(String(id)) ?? null;
    return {
      select: async () => player,
      then: (resolve, reject) => Promise.resolve(player).then(resolve, reject),
    };
  };
  Room.exists = async ({ code }) => [...rooms.values()].some((room) => room.code === code);
  Room.create = async (data) => {
    if ([...rooms.values()].some((room) => room.code === data.code)) {
      const err = new Error('duplicate');
      err.code = 11000;
      err.keyPattern = { code: 1 };
      throw err;
    }
    const room = roomDocument(data);
    rooms.set(room.id, room);
    return room;
  };
  Room.findOne = ({ code }) => ({ select: async () => [...rooms.values()].find((room) => room.code === code) ?? null });
  Room.findById = async (id) => rooms.get(String(id)) ?? null;
  Room.findOneAndUpdate = async (filter, update) => {
    const room = rooms.get(String(filter._id));
    if (!room) return null;
    const incoming = update.$push.members;
    if (room.members.some((member) => member.playerId === String(incoming.playerId))) return null;
    if (room.members.some((member) => member.normalizedDisplayName === incoming.normalizedDisplayName)) return null;
    if (room.members.length >= room.settings.maxPlayers) return null;
    room.members.push({ ...incoming, playerId: String(incoming.playerId) });
    return room;
  };

  server = http.createServer(app);
  await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
  baseUrl = `http://127.0.0.1:${server.address().port}/api/rooms`;
});

after(async () => {
  await new Promise((resolve) => server.close(resolve));
  Player.findById = originalPlayerFindById;
  Room.exists = originalRoomExists;
  Room.create = originalRoomCreate;
  Room.findOne = originalRoomFindOne;
  Room.findOneAndUpdate = originalRoomFindOneAndUpdate;
  Room.findById = originalRoomFindById;
});

async function post(path, body) {
  return fetch(`${baseUrl}${path}`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(body),
  });
}

function identity(id = '111111111111111111111111', token = 'host-secret') {
  return { playerId: id, identityToken: token };
}

test('creates public and private rooms, validates settings, and assigns creator as host', async () => {
  const publicResponse = await post('/', {
    ...identity(),
    settings: { maxPlayers: 20, rounds: 10, drawingTime: 240, wordChoices: 5, hints: 0, wordMode: 'Combination', language: 'es', wordCategories: ['Combination'], voteKickEnabled: true, voteKickThreshold: 75 },
  });
  assert.equal(publicResponse.status, 201);
  const publicRoom = (await publicResponse.json()).data;
  assert.match(publicRoom.roomCode, /^[A-Z2-9]{8}$/);
  assert.equal(publicRoom.hostPlayerId, '111111111111111111111111');
  assert.equal(publicRoom.members[0].role, 'host');
  assert.equal(publicRoom.settings.hints, 0);
  assert.equal(publicRoom.settings.language, 'es');
  assert.deepEqual(publicRoom.settings.wordCategories, ['Combination']);
  assert.equal(publicRoom.settings.voteKickThreshold, 75);
  assert.equal(typeof publicRoom.inviteLink, 'string');
  assert.equal(publicRoom.inviteToken, undefined);

  const privateResponse = await post('/', { ...identity(), isPublic: false, settings: { hints: 'disabled' } });
  assert.equal(privateResponse.status, 201);
  const privateRoom = (await privateResponse.json()).data;
  assert.equal(privateRoom.isPublic, false);
  assert.equal(privateRoom.settings.hints, 'disabled');
  assert.equal(typeof privateRoom.inviteToken, 'string');
  assert.match(privateRoom.inviteLink, new RegExp(`inviteToken=${privateRoom.inviteToken}`));

  for (const settings of [
    { maxPlayers: 1 }, { maxPlayers: 21 }, { rounds: 1 }, { rounds: 11 },
    { drawingTime: 14 }, { drawingTime: 241 }, { wordChoices: 0 }, { wordChoices: 6 },
    { hints: -1 }, { hints: 6 }, { wordMode: 'Other' },
    { language: 'de' }, { wordCategories: ['Unknown'] },
    { wordMode: 'Normal', wordCategories: ['Combination'] }, { voteKickThreshold: 101 },
  ]) {
    const response = await post('/', { ...identity(), settings });
    assert.equal(response.status, 400, JSON.stringify(settings));
    assert.equal((await response.json()).error.code, 'VALIDATION_ERROR');
  }
});

test('joins by code, restores the same room member, and rejects invalid, same-name, and full-room joins', async () => {
  const create = async (settings = {}, isPublic = true) => {
    const response = await post('/', { ...identity(), settings, isPublic });
    return (await response.json()).data;
  };

  const invalid = await post('/join', { ...identity('222222222222222222222222', 'guest-secret'), roomCode: 'bad' });
  assert.equal(invalid.status, 400);
  assert.equal((await invalid.json()).error.code, 'INVALID_ROOM_CODE');
  const missing = await post('/join', { ...identity('222222222222222222222222', 'guest-secret'), roomCode: 'ZZZZZZZZ' });
  assert.equal(missing.status, 404);
  assert.equal((await missing.json()).error.code, 'ROOM_NOT_FOUND');

  const privateRoom = await create({}, false);
  const denied = await post('/join', {
    ...identity('222222222222222222222222', 'guest-secret'), roomCode: privateRoom.roomCode,
  });
  assert.equal(denied.status, 403);
  assert.equal((await denied.json()).error.code, 'PRIVATE_ROOM');
  const wrongInvite = await post('/join', {
    ...identity('222222222222222222222222', 'guest-secret'), roomCode: privateRoom.roomCode,
    inviteToken: 'invalid-invite-token',
  });
  assert.equal(wrongInvite.status, 403);
  const allowed = await post('/join', {
    ...identity('222222222222222222222222', 'guest-secret'), roomCode: privateRoom.roomCode,
    inviteToken: privateRoom.inviteToken,
  });
  assert.equal(allowed.status, 200);
  assert.equal((await allowed.json()).data.members[1].role, 'player');
  const duplicate = await post('/join', {
    ...identity('222222222222222222222222', 'guest-secret'), roomCode: privateRoom.roomCode,
    inviteToken: privateRoom.inviteToken,
  });
  assert.equal(duplicate.status, 200);
  assert.equal((await duplicate.json()).data.members.length, 2);
  assert.equal(rooms.get(privateRoom.roomId).members.length, 2);
  rooms.get(privateRoom.roomId).gameStatus = 'started';
  const sameMemberDuringGame = await post('/join', {
    ...identity('222222222222222222222222', 'guest-secret'), roomCode: privateRoom.roomCode,
    inviteToken: privateRoom.inviteToken,
  });
  assert.equal(sameMemberDuringGame.status, 200);
  const newPlayerDuringGame = await post('/join', {
    ...identity('444444444444444444444444', 'third-secret'), roomCode: privateRoom.roomCode,
    inviteToken: privateRoom.inviteToken,
  });
  assert.equal(newPlayerDuringGame.status, 409);
  assert.equal((await newPlayerDuringGame.json()).error.code, 'GAME_ALREADY_STARTED');

  const sameNameRoom = await create();
  const sameName = await post('/join', {
    ...identity('333333333333333333333333', 'same-name-secret'), roomCode: sameNameRoom.roomCode,
  });
  assert.equal(sameName.status, 409);
  assert.equal((await sameName.json()).error.code, 'PLAYER_NAME_TAKEN');

  const fullRoom = await create({ maxPlayers: 2 });
  const joins = await post('/join', {
    ...identity('222222222222222222222222', 'guest-secret'), roomCode: fullRoom.roomCode,
  });
  assert.equal(joins.status, 200);
  const full = await post('/join', {
    ...identity('444444444444444444444444', 'third-secret'), roomCode: fullRoom.roomCode,
  });
  assert.equal(full.status, 409);
  assert.equal((await full.json()).error.code, 'ROOM_FULL');
});
