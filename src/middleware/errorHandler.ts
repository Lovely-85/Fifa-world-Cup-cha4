import type { NextFunction, Request, Response } from 'express';
import { logger } from '../utils/logger';
import { env } from '../config/env';

/**
 * Last-resort error handler. Internal error details (stack traces, raw
 * error messages that might mention file paths or library internals) are
 * logged server-side but never sent to the client -- only a generic
 * message, so nothing about the server's internals leaks to callers.
 */
export function errorHandler(err: unknown, req: Request, res: Response, _next: NextFunction): void {
  const error = err as Error;
  logger.error('Unhandled request error', { message: error.message, path: req.path });

  if (res.headersSent) {
    return;
  }

  const isCorsRejection = error.message?.includes('not allowed by CORS policy');
  res.status(isCorsRejection ? 403 : 500).json({
    error: isCorsRejection ? 'Origin not allowed.' : 'Something went wrong. Please try again.',
    ...(env.NODE_ENV !== 'production' ? { debug: error.message } : {}),
  });
}

export function notFoundHandler(req: Request, res: Response): void {
  res.status(404).json({ error: `Not found: ${req.method} ${req.path}` });
}
