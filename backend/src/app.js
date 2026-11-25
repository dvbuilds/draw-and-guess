import express from 'express';
import cors from 'cors';
import { env } from './config/env.js';
import healthRoutes from './routes/health.routes.js';
import { notFound, errorHandler } from './middleware/errorHandler.js';

const app = express();

app.use(cors({ origin: env.CLIENT_URL, credentials: true }));
app.use(express.json({ limit: '100kb' }));

app.use('/api/health', healthRoutes);
// Later modules mount here, e.g. app.use('/api/players', playerRoutes);

app.use(notFound);
app.use(errorHandler);

export default app;