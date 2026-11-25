import { after, before, test } from 'node:test';
import assert from 'node:assert/strict';
import http from 'node:http';

import { api } from '../src/services/api.js';
import { createGuestIdentity } from '../src/services/playerService.js';
import { createRoom, joinRoom } from '../src/services/roomService.js';
import {
  validateRoomCodeInput,
  validateRoomSettingsInput,
} from '../src/utils/roomValidation.js';

let app;
let Player;
let Room;
let server;
let originalPlayerCreate;
let originalPlayerFindById;
let originalRoomExists;
let originalRoomCreate;
let originalRoomFindOne;
let originalRoomFindById;
let originalRoomFindOneAndUpdate;

const players = new Map();
const playerNames = new Set();
const rooms = new Map();
let seq = 1;
let roomSeq = 1;

before(async () => {
  process.env.MONGO_URI ||= 'mongodb://127.0.0.1:27017/draw-and-guess-test';
  ({ default: app } = await import('../../backend/src/app.js'));
  ({ Player } = await import('../../backend/src/models/Player.js'));
  ({ Room } = await import('../../backend/src/models/Room.js'));

  originalPlayerCreate = Player.create;
  originalPlayerFindById = Player.findById;
  originalRoomExists = Room.exists;
  originalRoomCreate = Room.create;
  originalRoomFindOne = Room.findOne;
  originalRoomFindById = Room.findById;
  originalRoomFindOneAndUpdate = Room.findOneAndUpdate;

  Player.create = async (data) => {
    const key = `${data.roomId}:${data.normalizedDisplayName}`;
    if (playerNames.has(key)) {
      const err = new Error('duplicate');
      err.code = 11000;
      err.keyPattern = { roomId: 1, normalizedDisplayName: 1 };
      throw err;
    }
    playerNames.add(key);
    const id = String(seq++).padStart(24, '0');
    const record = { ...data, id, _id: id };
    players.set(id, record);
    return record;
  };

  Player.findById = (id) => {
    const player = players.get(String(id)) ?? null;
    return {
      select: async () => player,
      then: (resolve, reject) => Promise.resolve(player).then(resolve, reject),
    };
  };

  Room.exists = async ({ code }) => [...rooms.values()].some((r) => r.code === code);
  Room.create = async (data) => {
    const id = String(roomSeq++).padStart(24, '0');
    const room = {
      ...data,
      id,
      _id: id,
      members: data.members.map((m) => ({ ...m, playerId: String(m.playerId) })),
    };
    rooms.set(id, room);
    return room;
  };
  Room.findOne = ({ code }) => ({
    select: async () => [...rooms.values()].find((r) => r.code === code) ?? null,
  });
  Room.findById = async (id) => rooms.get(String(id)) ?? null;
  Room.findOneAndUpdate = async (filter, update) => {
    const room = rooms.get(String(filter._id));
    if (!room) return null;
    const incoming = update.$push.members;
    if (room.members.some((m) => m.playerId === String(incoming.playerId))) return null;
    if (room.members.some((m) => m.normalizedDisplayName === incoming.normalizedDisplayName)) return null;
    if (room.members.length >= room.settings.maxPlayers) return null;
    room.members.push({ ...incoming, playerId: String(incoming.playerId) });
    return room;
  };

  server = http.createServer(app);
  await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
  api.defaults.baseURL = `http://127.0.0.1:${server.address().port}/api`;
});

after(async () => {
  await new Promise((resolve) => server.close(resolve));
  Player.create = originalPlayerCreate;
  Player.findById = originalPlayerFindById;
  Room.exists = originalRoomExists;
  Room.create = originalRoomCreate;
  Room.findOne = originalRoomFindOne;
  Room.findById = originalRoomFindById;
  Room.findOneAndUpdate = originalRoomFindOneAndUpdate;
});

test('validates all room settings boundaries and room code format client-side', () => {
  const validAll = validateRoomSettingsInput({
    maxPlayers: 20,
    rounds: 10,
    drawingTime: 240,
    wordChoices: 5,
    hints: 0,
    wordMode: 'Combination',
  });
  assert.equal(validAll.valid, true);

  const validDisabledHints = validateRoomSettingsInput({
    maxPlayers: 2,
    rounds: 2,
    drawingTime: 15,
    wordChoices: 1,
    hints: 'disabled',
    wordMode: 'Hidden',
  });
  assert.equal(validDisabledHints.valid, true);
  assert.equal(validDisabledHints.value.hints, 'disabled');

  const invalidAll = validateRoomSettingsInput({
    maxPlayers: 21,
    rounds: 1,
    drawingTime: 14,
    wordChoices: 6,
    hints: 6,
    wordMode: 'Invalid',
  });
  assert.equal(invalidAll.valid, false);
  assert.ok(invalidAll.errors.maxPlayers);
  assert.ok(invalidAll.errors.rounds);
  assert.ok(invalidAll.errors.drawingTime);
  assert.ok(invalidAll.errors.wordChoices);
  assert.ok(invalidAll.errors.hints);
  assert.ok(invalidAll.errors.wordMode);

  assert.deepEqual(validateRoomCodeInput(' abcd1234 '), {
    valid: true,
    value: 'ABCD1234',
    error: null,
  });
  assert.equal(validateRoomCodeInput('short').valid, false);
});

test('creates public and private rooms with every setting and invite link format', async () => {
  const host = await createGuestIdentity({ displayName: 'HostOne', roomId: 'lobby' });

  const publicRoom = await createRoom({
    playerId: host.playerId,
    identityToken: host.identityToken,
    isPublic: true,
    settings: {
      maxPlayers: 12,
      rounds: 6,
      drawingTime: 120,
      wordChoices: 4,
      hints: 2,
      wordMode: 'Normal',
    },
  });

  assert.match(publicRoom.roomCode, /^[A-Z2-9]{8}$/);
  assert.equal(publicRoom.isPublic, true);
  assert.deepEqual(publicRoom.settings, {
    maxPlayers: 12,
    rounds: 6,
    drawingTime: 120,
    wordChoices: 4,
    hints: 2,
    wordMode: 'Normal',
    scoring: {
      correctGuessPoints: 100,
      drawerPointsPerCorrectGuess: 50,
    },
  });
  assert.ok(publicRoom.inviteLink.endsWith(`/?roomCode=${publicRoom.roomCode}`));
  assert.equal(publicRoom.inviteToken, undefined);

  const privateRoom = await createRoom({
    playerId: host.playerId,
    identityToken: host.identityToken,
    isPublic: false,
    settings: {
      maxPlayers: 2,
      rounds: 10,
      drawingTime: 240,
      wordChoices: 5,
      hints: 'disabled',
      wordMode: 'Combination',
    },
  });

  assert.equal(privateRoom.isPublic, false);
  assert.equal(privateRoom.settings.hints, 'disabled');
  assert.equal(privateRoom.settings.wordMode, 'Combination');
  assert.ok(privateRoom.inviteToken);
  const parsedInvite = new URL(privateRoom.inviteLink);
  assert.equal(parsedInvite.searchParams.get('roomCode'), privateRoom.roomCode);
  assert.equal(parsedInvite.searchParams.get('inviteToken'), privateRoom.inviteToken);
});

test('handles joining via code & invite link, invalid codes, private auth errors, and full rooms', async () => {
  const host = await createGuestIdentity({ displayName: 'RoomHost', roomId: 'scope-a' });
  const guest1 = await createGuestIdentity({ displayName: 'GuestOne', roomId: 'scope-a' });
  const guest2 = await createGuestIdentity({ displayName: 'GuestTwo', roomId: 'scope-a' });

  const publicRoom = await createRoom({
    playerId: host.playerId,
    identityToken: host.identityToken,
    isPublic: true,
    settings: { maxPlayers: 2, rounds: 3, drawingTime: 80, wordChoices: 3, hints: 3, wordMode: 'Hidden' },
  });

  // Invalid format
  await assert.rejects(
    () => joinRoom({ playerId: guest1.playerId, identityToken: guest1.identityToken, roomCode: 'BAD' }),
    (err) => err.code === 'INVALID_ROOM_CODE' && err.status === 400
  );

  // Unknown code
  await assert.rejects(
    () => joinRoom({ playerId: guest1.playerId, identityToken: guest1.identityToken, roomCode: 'ZZZZZZZZ' }),
    (err) => err.code === 'ROOM_NOT_FOUND' && err.status === 404
  );

  // Join public room by code (lowercase accepted & uppercased by backend)
  const joinedPublic = await joinRoom({
    playerId: guest1.playerId,
    identityToken: guest1.identityToken,
    roomCode: publicRoom.roomCode.toLowerCase(),
  });
  assert.equal(joinedPublic.members.length, 2);

  // Full room
  await assert.rejects(
    () =>
      joinRoom({
        playerId: guest2.playerId,
        identityToken: guest2.identityToken,
        roomCode: publicRoom.roomCode,
      }),
    (err) => err.code === 'ROOM_FULL' && err.status === 409
  );

  // Private room unauthorized without token & with wrong token
  const privateRoom = await createRoom({
    playerId: host.playerId,
    identityToken: host.identityToken,
    isPublic: false,
    settings: { maxPlayers: 4, rounds: 3, drawingTime: 80, wordChoices: 3, hints: 1, wordMode: 'Normal' },
  });

  await assert.rejects(
    () =>
      joinRoom({
        playerId: guest1.playerId,
        identityToken: guest1.identityToken,
        roomCode: privateRoom.roomCode,
      }),
    (err) => err.code === 'PRIVATE_ROOM' && err.status === 403
  );

  await assert.rejects(
    () =>
      joinRoom({
        playerId: guest1.playerId,
        identityToken: guest1.identityToken,
        roomCode: privateRoom.roomCode,
        inviteToken: 'wrong-token',
      }),
    (err) => err.code === 'PRIVATE_ROOM' && err.status === 403
  );

  // Join private room via parsed invite link params
  const inviteUrl = new URL(privateRoom.inviteLink);
  const joinedPrivate = await joinRoom({
    playerId: guest1.playerId,
    identityToken: guest1.identityToken,
    roomCode: inviteUrl.searchParams.get('roomCode'),
    inviteToken: inviteUrl.searchParams.get('inviteToken'),
  });
  assert.equal(joinedPrivate.roomCode, privateRoom.roomCode);
  assert.equal(joinedPrivate.members.length, 2);
});
