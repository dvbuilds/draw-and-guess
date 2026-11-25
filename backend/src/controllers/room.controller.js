import { createRoom, joinRoom } from '../services/room.service.js';

export async function createRoomController(req, res) {
  const room = await createRoom(req.body ?? {});
  res.status(201).json({ success: true, data: room });
}

export async function joinRoomController(req, res) {
  const room = await joinRoom(req.body ?? {});
  res.status(200).json({ success: true, data: room });
}
