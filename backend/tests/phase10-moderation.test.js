import { after, before, test } from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import http from 'node:http';
import { io as createClient } from 'socket.io-client';
import { Player } from '../src/models/Player.js';
import { Room } from '../src/models/Room.js';
import { initSocket } from '../src/sockets/index.js';

const people = [
  { id: '111111111111111111111111', name: 'Host', token: 'host-token' },
  { id: '222222222222222222222222', name: 'Guest', token: 'guest-token' },
  { id: '333333333333333333333333', name: 'Target', token: 'target-token' },
  { id: '444444444444444444444444', name: 'Fourth', token: 'fourth-token' },
  { id: '555555555555555555555555', name: 'Elsewhere', token: 'elsewhere-token' },
];
const digest = (value) => createHash('sha256').update(value).digest('hex');
const playerRows = new Map(people.map((person) => [person.id, {
  _id: person.id, id: person.id, displayName: person.name,
  identityTokenHash: digest(person.token),
}]));

function makeRoom({ id, code, playerIndexes, isPublic = true }) {
  const room = {
    _id: id, code, isPublic, privateInviteTokenHash: null,
    hostPlayerId: people[playerIndexes[0]].id, gameStatus: 'lobby',
    settings: { voteKickEnabled: true, voteKickThreshold: 60 },
    bannedPlayerIds: [], activeVoteKick: null,
    members: playerIndexes.map((index, order) => ({
      playerId: people[index].id, displayName: people[index].name,
      normalizedDisplayName: people[index].name.toLowerCase(), role: order === 0 ? 'host' : 'player',
      isConnected: false, socketId: null, lastDisconnectedAt: null,
    })),
    save: async () => room,
  };
  return room;
}

const room = makeRoom({ id: 'aaaaaaaaaaaaaaaaaaaaaaaa', code: 'MODER123', playerIndexes: [0, 1, 2, 3] });
const otherRoom = makeRoom({ id: 'bbbbbbbbbbbbbbbbbbbbbbbb', code: 'OTHER123', playerIndexes: [4] });
const rooms = new Map([[room.code, room], [otherRoom.code, otherRoom]]);
const originals = {
  playerFindById: Player.findById,
  roomFindOne: Room.findOne,
  roomFindById: Room.findById,
  roomFindOneAndUpdate: Room.findOneAndUpdate,
};
let server;
let ioServer;
let serverUrl;
const clients = [];

function query(value) {
  return { select: async () => value, then: (resolve, reject) => Promise.resolve(value).then(resolve, reject) };
}

function matches(filter) {
  if (filter.activeVoteKick === null && room.activeVoteKick !== null) return false;
  if (filter['activeVoteKick.targetPlayerId']
      && String(room.activeVoteKick?.targetPlayerId) !== String(filter['activeVoteKick.targetPlayerId'])) return false;
  const voterNe = filter['activeVoteKick.votes.playerId']?.$ne;
  if (voterNe && room.activeVoteKick?.votes.some((vote) => String(vote.playerId) === String(voterNe))) return false;
  const memberCheck = filter.members?.$elemMatch;
  if (memberCheck && !room.members.some((member) => String(member.playerId) === String(memberCheck.playerId)
      && member.socketId === memberCheck.socketId && member.isConnected === memberCheck.isConnected)) return false;
  return true;
}

function connect() {
  const client = createClient(serverUrl, { transports: ['websocket'], forceNew: true, reconnection: false });
  clients.push(client);
  return new Promise((resolve, reject) => {
    client.once('connect', () => resolve(client));
    client.once('connect_error', reject);
  });
}

function request(client, event, payload = {}) {
  return new Promise((resolve) => client.timeout(2000).emit(event, payload, (err, response) => {
    resolve(err ? { success: false, error: { code: 'TIMEOUT' } } : response);
  }));
}

function on(client, event) {
  return new Promise((resolve) => client.once(event, resolve));
}

function joinData(person, roomCode) {
  return { roomCode, playerId: person.id, identityToken: person.token };
}

before(async () => {
  Player.findById = (id) => query(playerRows.get(String(id)) ?? null);
  Room.findOne = ({ code }) => ({ select: async () => rooms.get(code) ?? null });
  Room.findById = (id) => query([...rooms.values()].find((item) => item._id === String(id)) ?? null);
  Room.findOneAndUpdate = async (filter, update) => {
    if (!matches(filter)) return null;
    if (update.$set) {
      for (const [key, value] of Object.entries(update.$set)) {
        if (key === 'activeVoteKick') room.activeVoteKick = value;
        else if (key === 'updatedAt') continue;
        else room[key] = value;
      }
    }
    if (update.$push?.['activeVoteKick.votes']) room.activeVoteKick.votes.push(update.$push['activeVoteKick.votes']);
    return filter.activeVoteKick === null || update.$set?.activeVoteKick === null
      ? { ...room, activeVoteKick: update.$set?.activeVoteKick === null ? null : room.activeVoteKick }
      : room;
  };
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
  Room.findOneAndUpdate = originals.roomFindOneAndUpdate;
});

test('restricts announcements and host moderation, then completes threshold-based VoteKick once', async () => {
  const [host, guest, target, fourth, elsewhere] = await Promise.all(people.map(() => connect()));
  for (const [client, person, roomCode] of [
    [host, people[0], room.code], [guest, people[1], room.code],
    [target, people[2], room.code], [fourth, people[3], room.code],
    [elsewhere, people[4], otherRoom.code],
  ]) assert.equal((await request(client, 'lobby:join', joinData(person, roomCode))).success, true);

  const unauthorizedAnnouncement = await request(guest, 'announcement:send', { message: 'Only host?' });
  assert.equal(unauthorizedAnnouncement.success, false);
  assert.equal(unauthorizedAnnouncement.error.code, 'HOST_ONLY');
  const announcementHost = on(host, 'room:announcement');
  const announcementGuest = on(guest, 'room:announcement');
  let leakedAnnouncement = false;
  elsewhere.on('room:announcement', () => { leakedAnnouncement = true; });
  const announcement = await request(host, 'announcement:send', { message: '  Welcome!  ' });
  assert.equal(announcement.success, true);
  assert.equal(announcement.data.message, 'Welcome!');
  assert.deepEqual(await announcementHost, announcement.data);
  assert.deepEqual(await announcementGuest, announcement.data);
  await new Promise((resolve) => setTimeout(resolve, 20));
  assert.equal(leakedAnnouncement, false);

  const unauthorizedKick = await request(guest, 'moderation:kick', { playerId: people[3].id });
  assert.equal(unauthorizedKick.success, false);
  assert.equal(unauthorizedKick.error.code, 'HOST_ONLY');

  const voteStarted = on(guest, 'vote_kick:started');
  const started = await request(guest, 'vote_kick:start', { playerId: people[2].id });
  assert.equal(started.success, true);
  assert.equal(started.data.requiredVotes, 2);
  await voteStarted;
  const selfVote = await request(target, 'vote_kick:cast', { yes: true });
  assert.equal(selfVote.success, false);
  assert.equal(selfVote.error.code, 'CANNOT_VOTE_SELF');

  const firstVote = await request(host, 'vote_kick:cast', { yes: true });
  assert.equal(firstVote.success, true);
  assert.equal(firstVote.data.yesVotes, 1);
  const duplicateVote = await request(host, 'vote_kick:cast', { yes: true });
  assert.equal(duplicateVote.success, false);
  assert.equal(duplicateVote.error.code, 'DUPLICATE_VOTE');

  const endedEvent = on(fourth, 'vote_kick:ended');
  const kickedEvent = on(guest, 'player_kicked');
  const passedVote = await request(guest, 'vote_kick:cast', { yes: true });
  assert.equal(passedVote.success, true);
  assert.equal(passedVote.data.passed, true);
  assert.equal((await endedEvent).yesVotes, 2);
  assert.equal((await kickedEvent).player.playerId, people[2].id);
  assert.equal(room.members.some((member) => String(member.playerId) === people[2].id), false);

  const noVoteStarted = await request(host, 'vote_kick:start', { playerId: people[3].id });
  assert.equal(noVoteStarted.success, true);
  assert.equal((await request(host, 'vote_kick:cast', { yes: false })).data.votesCast, 1);
  const rejectedVote = await request(guest, 'vote_kick:cast', { yes: false });
  assert.equal(rejectedVote.success, true);
  assert.equal(rejectedVote.data.passed, false);
  assert.equal(room.members.some((member) => String(member.playerId) === people[3].id), true);

  const kickEvent = on(guest, 'player_kicked');
  const kicked = await request(host, 'moderation:kick', { playerId: people[3].id });
  assert.equal(kicked.success, true);
  assert.equal((await kickEvent).player.playerId, people[3].id);

  const bannedEvent = on(host, 'player_banned');
  const banned = await request(host, 'moderation:ban', { playerId: people[1].id });
  assert.equal(banned.success, true);
  assert.equal((await bannedEvent).player.playerId, people[1].id);
  assert.equal(room.bannedPlayerIds.some((id) => String(id) === people[1].id), true);
  const bannedReconnect = await connect();
  const denied = await request(bannedReconnect, 'lobby:join', joinData(people[1], room.code));
  assert.equal(denied.success, false);
  assert.equal(denied.error.code, 'PLAYER_BANNED');
});
