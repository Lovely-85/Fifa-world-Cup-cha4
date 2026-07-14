/**
 * @fileoverview GET /api/ops/:venueId/insight -- the staff/volunteer
 * operational-intelligence briefing endpoint.
 */
import { Router } from 'express';
import { z } from 'zod';
import { validateParams } from '../middleware/validateRequest';
import { getOpsInsight } from '../ai/assistantService';

const venueParamSchema = z.object({ venueId: z.string().trim().min(1).max(64) });

export const opsRouter = Router();

opsRouter.get('/:venueId/insight', validateParams(venueParamSchema), async (req, res, next) => {
  try {
    // validateParams has already confirmed req.params matches venueParamSchema
    // and rejected the request with 400 otherwise; re-parsing here (cheap for
    // a one-field object) gives a precisely-typed `venueId: string` instead
    // of Express's untyped params index signature.
    const { venueId } = venueParamSchema.parse(req.params);
    const insight = await getOpsInsight(venueId);
    res.json(insight);
  } catch (error) {
    next(error);
  }
});
