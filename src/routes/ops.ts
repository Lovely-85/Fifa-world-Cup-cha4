import { Router } from 'express';
import { z } from 'zod';
import { validateParams } from '../middleware/validateRequest';
import { getOpsInsight } from '../ai/assistantService';

const venueParamSchema = z.object({ venueId: z.string().trim().min(1).max(64) });

export const opsRouter = Router();

opsRouter.get('/:venueId/insight', validateParams(venueParamSchema), async (req, res, next) => {
  try {
    const insight = await getOpsInsight(req.params.venueId);
    res.json(insight);
  } catch (error) {
    next(error);
  }
});
