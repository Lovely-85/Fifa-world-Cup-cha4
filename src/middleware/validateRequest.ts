import type { NextFunction, Request, Response } from 'express';
import type { ZodTypeAny } from 'zod';

/**
 * Generic factory: validates req.body against the given zod schema before
 * the route handler ever sees it. Invalid requests are rejected with 400
 * and a readable error, never reaching business logic or the AI layer --
 * this bounds both attack surface and wasted Gemini API cost.
 */
export function validateBody(schema: ZodTypeAny) {
  return (req: Request, res: Response, next: NextFunction): void => {
    const parsed = schema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({
        error: 'Invalid request body.',
        details: parsed.error.flatten().fieldErrors,
      });
      return;
    }
    req.body = parsed.data;
    next();
  };
}

export function validateParams(schema: ZodTypeAny) {
  return (req: Request, res: Response, next: NextFunction): void => {
    const parsed = schema.safeParse(req.params);
    if (!parsed.success) {
      res.status(400).json({
        error: 'Invalid request parameters.',
        details: parsed.error.flatten().fieldErrors,
      });
      return;
    }
    next();
  };
}
