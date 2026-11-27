import { Room } from '../models/Room.js';
import { ApiError } from '../utils/ApiError.js';

const MAX_POINTS_PER_SEGMENT = 32;
const MAX_SEGMENTS_PER_STROKE = 1500;
const MAX_STROKES_PER_ROOM = 1000;
const MAX_SEGMENTS_PER_ROOM = 5000;
const drawingByRoom = new Map();
const drawingAuthRevisionByRoom = new Map();

const idOf = (value) => String(value);

function roomDrawing(roomCode) {
  let drawing = drawingByRoom.get(roomCode);
  if (!drawing) {
    drawing = { strokes: new Map(), segmentCount: 0 };
    drawingByRoom.set(roomCode, drawing);
  }
  return drawing;
}

function snapshot(roomCode) {
  const drawing = drawingByRoom.get(roomCode);
  if (!drawing) return [];
  return [...drawing.strokes.values()].flatMap((stroke) =>
    stroke.segments.map((segment) => ({
      strokeId: stroke.strokeId,
      segmentIndex: segment.segmentIndex,
      points: segment.points.map((point) => ({ ...point })),
      color: stroke.color,
      width: stroke.width,
      tool: stroke.tool,
    }))
  );
}

function validatePayload(payload) {
  const allowed = new Set(['strokeId', 'segmentIndex', 'points', 'color', 'width', 'tool']);
  if (!payload || typeof payload !== 'object' || Array.isArray(payload)
      || Object.keys(payload).some((key) => !allowed.has(key))) {
    throw new ApiError(400, 'Drawing stroke payload is malformed', 'INVALID_DRAWING_PAYLOAD');
  }
  if (typeof payload.strokeId !== 'string'
      || !/^[A-Za-z0-9_-]{8,64}$/.test(payload.strokeId)
      || !Number.isInteger(payload.segmentIndex)
      || payload.segmentIndex < 0
      || payload.segmentIndex >= MAX_SEGMENTS_PER_STROKE
      || !Array.isArray(payload.points)
      || payload.points.length < 2
      || payload.points.length > MAX_POINTS_PER_SEGMENT
      || typeof payload.color !== 'string'
      || !/^#[\da-fA-F]{6}$/.test(payload.color)
      || !Number.isFinite(payload.width)
      || payload.width < 1
      || payload.width > 40
      || !['pen', 'eraser'].includes(payload.tool)) {
    throw new ApiError(400, 'Drawing stroke values are invalid', 'INVALID_DRAWING_PAYLOAD');
  }

  const points = payload.points.map((point) => {
    if (!point || typeof point !== 'object' || Array.isArray(point)
        || Object.keys(point).some((key) => !['x', 'y'].includes(key))
        || !Number.isFinite(point.x) || !Number.isFinite(point.y)
        || point.x < 0 || point.x > 1 || point.y < 0 || point.y > 1) {
      throw new ApiError(400, 'Drawing coordinates must be numbers from 0 to 1', 'INVALID_DRAWING_PAYLOAD');
    }
    return { x: Number(point.x.toFixed(4)), y: Number(point.y.toFixed(4)) };
  });

  return {
    strokeId: payload.strokeId,
    segmentIndex: payload.segmentIndex,
    points,
    color: payload.color.toUpperCase(),
    width: Number(payload.width.toFixed(1)),
    tool: payload.tool,
  };
}

async function requireRoomMember(socket, { drawerOnly = false } = {}) {
  const session = socket.data.lobby;
  if (!session) throw new ApiError(403, 'Join a room before drawing', 'NOT_IN_ROOM');
  const room = await Room.findById(session.roomId).select('+currentWordId');
  if (!room) throw new ApiError(404, 'Room was not found', 'ROOM_NOT_FOUND');
  if (!socket.rooms.has(room.code)) {
    throw new ApiError(403, 'Socket is not connected to this room', 'NOT_IN_ROOM');
  }
  if (room.gameStatus !== 'started') {
    throw new ApiError(409, 'Drawing is only available during an active game', 'GAME_NOT_STARTED');
  }
  const member = room.members.find((item) => idOf(item.playerId) === session.playerId);
  if (!member?.isConnected || member.socketId !== socket.id) {
    throw new ApiError(403, 'This is not the active player connection', 'INVALID_ROOM_MEMBER');
  }
  if (drawerOnly) {
    if (idOf(room.currentDrawerPlayerId) !== session.playerId) {
      throw new ApiError(403, 'Only the current drawer can modify the canvas', 'DRAWER_ONLY');
    }
    if (!room.currentWordId) {
      throw new ApiError(409, 'Select a word before drawing', 'WORD_NOT_SELECTED');
    }
  }
  return { room, session };
}

export async function addDrawingSegment({ socket, io, payload }) {
  const session = socket.data.lobby;
  const cachedAuth = socket.data.drawingAuth;
  const revision = cachedAuth ? (drawingAuthRevisionByRoom.get(cachedAuth.roomCode) ?? 0) : -1;
  let room;
  if (cachedAuth
      && cachedAuth.roomId === session?.roomId
      && cachedAuth.playerId === session?.playerId
      && cachedAuth.socketId === socket.id
      && cachedAuth.revision === revision
      && socket.rooms.has(cachedAuth.roomCode)) {
    // Drawer identity, active game, selected word, and active socket were
    // checked from Mongo on the first segment of this turn. Turn transitions
    // invalidate the revision via resetRoomDrawing().
    room = { code: cachedAuth.roomCode };
  } else {
    const authorized = await requireRoomMember(socket, { drawerOnly: true });
    room = authorized.room;
    socket.data.drawingAuth = {
      roomCode: room.code,
      roomId: session.roomId,
      playerId: session.playerId,
      socketId: socket.id,
      revision: drawingAuthRevisionByRoom.get(room.code) ?? 0,
    };
  }
  const segment = validatePayload(payload);
  let drawing = drawingByRoom.get(room.code);
  let stroke = drawing?.strokes.get(segment.strokeId);

  if (!stroke) {
    if (segment.segmentIndex !== 0) {
      throw new ApiError(409, 'A stroke must begin with segmentIndex 0', 'DRAWING_SEQUENCE');
    }
    drawing ??= roomDrawing(room.code);
    if (drawing.strokes.size >= MAX_STROKES_PER_ROOM || drawing.segmentCount >= MAX_SEGMENTS_PER_ROOM) {
      throw new ApiError(429, 'Canvas drawing limit reached for this turn', 'DRAWING_LIMIT');
    }
    stroke = {
      strokeId: segment.strokeId,
      color: segment.color,
      width: segment.width,
      tool: segment.tool,
      segments: [],
    };
    drawing.strokes.set(segment.strokeId, stroke);
  }

  if (segment.segmentIndex !== stroke.segments.length
      || segment.color !== stroke.color
      || segment.width !== stroke.width
      || segment.tool !== stroke.tool) {
    throw new ApiError(409, 'Stroke segments must be sequential and use consistent styling', 'DRAWING_SEQUENCE');
  }
  if (drawing.segmentCount >= MAX_SEGMENTS_PER_ROOM) {
    throw new ApiError(429, 'Canvas drawing limit reached for this turn', 'DRAWING_LIMIT');
  }

  stroke.segments.push({ segmentIndex: segment.segmentIndex, points: segment.points });
  drawing.segmentCount += 1;
  const event = { roomCode: room.code, ...segment };
  socket.to(room.code).emit('drawing:stroke', event);
  return { accepted: true, strokeId: segment.strokeId, segmentIndex: segment.segmentIndex };
}

export async function undoDrawing({ socket, io }) {
  const { room } = await requireRoomMember(socket, { drawerOnly: true });
  const drawing = drawingByRoom.get(room.code);
  const lastStroke = drawing ? [...drawing.strokes.values()].at(-1) : null;
  if (!lastStroke) return { undone: false, strokeId: null };

  drawing.strokes.delete(lastStroke.strokeId);
  drawing.segmentCount -= lastStroke.segments.length;
  if (!drawing.strokes.size) drawingByRoom.delete(room.code);
  const event = { roomCode: room.code, strokeId: lastStroke.strokeId };
  socket.to(room.code).emit('drawing:undone', event);
  return { undone: true, strokeId: lastStroke.strokeId };
}

export async function clearDrawing({ socket, io }) {
  const { room } = await requireRoomMember(socket, { drawerOnly: true });
  const drawing = drawingByRoom.get(room.code);
  const strokesRemoved = drawing?.strokes.size ?? 0;
  drawingByRoom.delete(room.code);
  socket.to(room.code).emit('drawing:cleared', { roomCode: room.code });
  return { cleared: true, strokesRemoved };
}

export async function syncDrawing({ socket }) {
  const { room } = await requireRoomMember(socket);
  return { roomCode: room.code, strokes: snapshot(room.code) };
}

export function resetRoomDrawing(roomCode) {
  drawingByRoom.delete(roomCode);
  drawingAuthRevisionByRoom.set(roomCode, (drawingAuthRevisionByRoom.get(roomCode) ?? 0) + 1);
}
