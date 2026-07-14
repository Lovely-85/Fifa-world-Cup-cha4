/**
 * @fileoverview Assembles the Express application: security middleware,
 * static frontend, and the three feature routes (chat, venues, ops).
 */
import express, { type Express } from 'express';
import path from 'path';
import compression from 'compression';
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
  // gzip/brotli-negotiated compression on every response this app sends
  // (JSON API replies and the static frontend alike) -- a standard,
  // essentially free reduction in bytes-over-the-wire for a request path
  // this frequent.
  app.use(compression());
  app.use(express.json({ limit: '32kb' }));

  // Static assets (CSS/JS) are content-addressed by nothing fancier than a
  // filename here, so a short cache window is a safe, simple efficiency
  // win: repeat visits within the demo don't re-fetch unchanged files.
  // `index: false` keeps the two HTML entry points (index.html, ops.html)
  // off this cache path since they're the one thing worth always
  // revalidating.
  app.use(
    express.static(path.join(__dirname, '..', 'public'), {
      maxAge: '10m',
      index: false,
      setHeaders: (res, filePath) => {
        if (filePath.endsWith('.html')) {
          res.setHeader('Cache-Control', 'no-cache');
        }
      },
    }),
  );

  app.get('/api/health', (_req, res) => {
    res.json({ status: 'ok' });
  });

  app.get('/', (_req, res) => {
    res.set('Cache-Control', 'no-cache');
    res.sendFile(path.join(__dirname, '..', 'public', 'index.html'));
  });

  app.use('/api/chat', chatRouter);
  app.use('/api/venues', venuesRouter);
  app.use('/api/ops', opsRouter);

  app.use(notFoundHandler);
  app.use(errorHandler);

  return app;
}
