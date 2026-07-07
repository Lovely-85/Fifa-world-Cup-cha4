import express, { type Express } from 'express';
import path from 'path';
import { securityHeaders, corsMiddleware } from './middleware/security';
import { errorHandler, notFoundHandler } from './middleware/errorHandler';
import { chatRouter } from './routes/chat';
import { venuesRouter } from './routes/venues';
import { opsRouter } from './routes/ops';

/**
 * Builds and returns the Express application without starting a listener.
 * Kept separate from server.ts so integration tests (supertest) can import
 * this directly instead of binding a real port.
 */
export function createApp(): Express {
  const app = express();

  app.use(securityHeaders);
  app.use(corsMiddleware);
  app.use(express.json({ limit: '32kb' }));
  app.use(express.static(path.join(__dirname, '..', 'public')));

  app.get('/api/health', (_req, res) => {
    res.json({ status: 'ok' });
  });

  app.use('/api/chat', chatRouter);
  app.use('/api/venues', venuesRouter);
  app.use('/api/ops', opsRouter);

  app.use(notFoundHandler);
  app.use(errorHandler);

  return app;
}
