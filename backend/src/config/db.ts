import mongoose from 'mongoose';
import { env } from './env';

declare global {
  // eslint-disable-next-line no-var
  var __tjMongoReady: Promise<typeof mongoose> | undefined;
}

export async function connectDatabase(): Promise<void> {
  mongoose.set('strictQuery', true);

  if (mongoose.connection.readyState >= 1) return;

  if (!global.__tjMongoReady) {
    global.__tjMongoReady = mongoose.connect(env.mongoUri).catch((err) => {
      global.__tjMongoReady = undefined;
      throw err;
    });
  }

  await global.__tjMongoReady;
  if (env.nodeEnv !== 'production') {
    console.log('MongoDB connected');
  }
}
