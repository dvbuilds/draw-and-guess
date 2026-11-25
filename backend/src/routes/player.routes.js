import { Router } from 'express';
import { createGuestIdentity, validateGuestIdentity } from '../services/playerIdentity.service.js';

const router = Router();

router.post('/', async (req, res) => {
  const identity = await createGuestIdentity(req.body ?? {});
  res.status(201).json({ success: true, data: identity });
});

router.post('/validate', async (req, res) => {
  const result = await validateGuestIdentity(req.body ?? {});
  res.json({ success: true, data: result });
});

export default router;
