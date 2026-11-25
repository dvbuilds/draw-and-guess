import mongoose from 'mongoose';
import { env } from './env.js';

export async function connectDB() {
  mongoose.connection.on('disconnected', () =>
    console.warn('[db] MongoDB disconnected')
  );
  mongoose.connection.on('reconnected', () =>
    console.log('[db] MongoDB reconnected')
  );

  await mongoose.connect(env.MONGO_URI);
  console.log(`[db] MongoDB connected: ${mongoose.connection.name}`);
}

export async function disconnectDB() {
  await mongoose.connection.close();
}