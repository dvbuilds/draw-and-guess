import { Router } from 'express';
import { createRoomController, joinRoomController } from '../controllers/room.controller.js';

const router = Router();

router.post('/', createRoomController);
router.post('/join', joinRoomController);

export default router;
