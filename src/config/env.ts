/**
 * @fileoverview Validates and exposes all runtime configuration in one
 * place, so every other module reads already-validated env vars instead of
 * touching `process.env` directly.
 */
import { z } from 'zod';

/**
 * All runtime configuration is validated once at startup so the process
 * fails fast with a clear message instead of behaving unpredictably later.
 * GEMINI_API_KEY is intentionally optional: its absence flips the assistant
 * into deterministic fallback mode (see src/ai/fallbackEngine.ts) rather
 * than crashing the app.
 */
const envSchema = z.object({
  GEMINI_API_KEY: z.string().trim().optional().default(''),
  GEMINI_MODEL: z.string().trim().min(1).default('gemini-2.5-flash'),
  PORT: z.coerce.number().int().positive().default(3000),
  ALLOWED_ORIGINS: z.string().trim().default('http://localhost:3000'),
  CHAT_RATE_LIMIT_PER_MINUTE: z.coerce.number().int().positive().default(20),
  NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),
});

export type AppEnv = z.infer<typeof envSchema>;

function loadEnv(): AppEnv {
  const parsed = envSchema.safeParse(process.env);
  if (!parsed.success) {
    console.error('Invalid environment configuration:', parsed.error.flatten().fieldErrors);
    throw new Error('Invalid environment configuration. Check .env against .env.example.');
  }
  return parsed.data;
}

export const env = loadEnv();

export const isGeminiConfigured = (): boolean => env.GEMINI_API_KEY.length > 0;

export const allowedOrigins: string[] = env.ALLOWED_ORIGINS.split(',')
  .map((origin) => origin.trim())
  .filter(Boolean);
