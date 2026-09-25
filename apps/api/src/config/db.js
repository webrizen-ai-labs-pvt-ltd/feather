import mongoose from 'mongoose';
import { env } from '@/config/env.js';

mongoose.set('strictQuery', true);

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

/** Connect with retries — a single network blip at start-up should not kill the server. */
export async function connectDb({ attempts = 6 } = {}) {
  for (let i = 1; ; i += 1) {
    try {
      await mongoose.connect(env.mongoUri, { autoIndex: true, serverSelectionTimeoutMS: 15_000 });
      console.log(`[db] connected to ${mongoose.connection.name}`);
      return mongoose.connection;
    } catch (err) {
      if (i >= attempts) throw err;
      const wait = Math.min(30_000, 1000 * 2 ** i);
      console.warn(`[db] connect failed (${err.message}). Retry ${i}/${attempts - 1} in ${wait / 1000}s`);
      await mongoose.disconnect().catch(() => {});
      await sleep(wait);
    }
  }
}

export const disconnectDb = () => mongoose.disconnect();
