import cors from 'cors';
import express from 'express';
import helmet from 'helmet';
import morgan from 'morgan';
import { env } from '@/config/env.js';
import { authenticate } from '@/middleware/auth.js';
import { errorHandler, notFoundHandler } from '@/middleware/errors.js';
import adminRoutes from '@/routes/admin.js';
import authRoutes from '@/routes/auth.js';
import consignmentRoutes from '@/routes/consignments.js';
import exportRoutes from '@/routes/exports.js';
import fileRoutes from '@/routes/files.js';
import masterRoutes from '@/routes/masters.js';
import salesRoutes from '@/routes/sales.js';
import stockRoutes from '@/routes/stock.js';
import tripRoutes from '@/routes/trips.js';
import userRoutes from '@/routes/users.js';

export function createApp() {
  const app = express();
  app.set('trust proxy', 1);
  app.disable('x-powered-by');
  app.use(helmet({ crossOriginResourcePolicy: { policy: 'cross-origin' } }));
  app.use(
    cors({
      origin: (origin, cb) => cb(null, !origin || env.corsOrigins.includes(origin)),
      exposedHeaders: ['Content-Disposition'],
    }),
  );
  app.use(express.json({ limit: '1mb' }));
  app.use(morgan(env.isProd ? 'combined' : 'dev'));

  app.get('/api/health', (_req, res) => res.json({ ok: true, time: new Date() }));
  app.use('/api/auth', authRoutes);
  app.use('/api/files', fileRoutes);

  const api = express.Router();
  api.use(authenticate);
  api.use('/users', userRoutes);
  api.use('/masters', masterRoutes);
  api.use('/consignments', consignmentRoutes);
  api.use('/trips', tripRoutes);
  api.use('/sales', salesRoutes);
  api.use('/stock', stockRoutes);
  api.use('/exports', exportRoutes);
  api.use('/admin', adminRoutes);
  app.use('/api', api);

  app.use(notFoundHandler);
  app.use(errorHandler);
  return app;
}
