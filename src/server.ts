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
