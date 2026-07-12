/**
 * @fileoverview Process entrypoint: loads .env, builds the app, and starts
 * the HTTP listener. Kept separate from app.ts so tests never bind a real
 * port (see app.ts's own file overview).
 */
import 'dotenv/config';
import { createApp } from './app';
import { env, isGeminiConfigured } from './config/env';
import { logger } from './utils/logger';

const app = createApp();

app.listen(env.PORT, () => {
  logger.info(`FIFA World Cup 2026 Fan Assistant listening on port ${env.PORT}`, {
    mode: isGeminiConfigured() ? 'gemini' : 'fallback (no GEMINI_API_KEY set)',
  });
});
