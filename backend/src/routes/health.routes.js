import { Router } from 'express';
import mongoose from 'mongoose';

const router = Router();

const DB_STATES = ['disconnected', 'connected', 'connecting', 'disconnecting'];

router.get('/', (req, res) => {
  res.json({
    success: true,
    data: {
      status: 'ok',
      uptime: Math.round(process.uptime()),
      db: DB_STATES[mongoose.connection.readyState],
      timestamp: new Date().toISOString(),
    },
  });
});

export default router;