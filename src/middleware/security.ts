import cors from 'cors';
import helmet from 'helmet';
import rateLimit from 'express-rate-limit';
import type { RequestHandler } from 'express';
import { allowedOrigins, env } from '../config/env';

/**
 * Strict Content-Security-Policy: this app serves only its own static
 * assets and calls only its own /api/* endpoints, so every directive can
 * be locked to 'self' with no external script/style/image origins and no
 * inline script execution.
 */
export const securityHeaders: RequestHandler = helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      scriptSrc: ["'self'"],
      styleSrc: ["'self'"],
      imgSrc: ["'self'", 'data:'],
      connectSrc: ["'self'"],
      objectSrc: ["'none'"],
      frameAncestors: ["'none'"],
      baseUri: ["'self'"],
      formAction: ["'self'"],
    },
  },
  crossOriginEmbedderPolicy: false,
});

export const corsMiddleware: RequestHandler = cors({
  origin(origin, callback) {
    // Allow same-origin / non-browser requests (no Origin header) and any
    // explicitly allowlisted origin from ALLOWED_ORIGINS.
    if (!origin || allowedOrigins.includes(origin) || allowedOrigins.includes('*')) {
      callback(null, true);
      return;
    }
    callback(new Error(`Origin ${origin} is not allowed by CORS policy.`));
  },
  methods: ['GET', 'POST'],
});

/** Protects the AI endpoints from abuse and unbounded Gemini API cost. */
export const chatRateLimiter: RequestHandler = rateLimit({
  windowMs: 60_000,
  limit: env.CHAT_RATE_LIMIT_PER_MINUTE,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Too many requests. Please wait a moment before trying again.' },
});
