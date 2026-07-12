/**
 * @fileoverview GET /api/venues and /api/venues/:venueId/status -- static
 * venue reference data plus live (simulated) per-venue status.
 */
import { Router } from 'express';
import { z } from 'zod';
import { validateParams } from '../middleware/validateRequest';
import { findVenue, listVenueSummaries } from '../data/venues';
import {
  getAccessibilityInfo,
  getTransportSnapshot,
  getVenueGateSnapshots,
  isHeatAdvisoryActive,
} from '../data/liveState';

const venueParamSchema = z.object({ venueId: z.string().trim().min(1).max(64) });

export const venuesRouter = Router();

venuesRouter.get('/', (_req, res) => {
  // The 16-venue list is fixed reference data for the lifetime of the
  // process (see src/data/venues.ts) -- unlike /status below, it is safe
  // and worthwhile to let clients and any intermediate cache reuse this
  // response for a short window instead of re-fetching it every load.
  res.set('Cache-Control', 'public, max-age=60');
  res.json(listVenueSummaries());
});

venuesRouter.get('/:venueId/status', validateParams(venueParamSchema), (req, res) => {
  // See the comment in routes/ops.ts: re-parsing gives a precisely-typed
  // `venueId: string` instead of Express's untyped params index signature.
  const { venueId } = venueParamSchema.parse(req.params);
  const venue = findVenue(venueId);
  if (!venue) {
    res.status(404).json({ error: `Unknown venue "${venueId}".` });
    return;
  }

  res.json({
    venue,
    gates: getVenueGateSnapshots(venueId),
    transport: getTransportSnapshot(venueId),
    accessibility: getAccessibilityInfo(venueId),
    heatAdvisoryActive: isHeatAdvisoryActive(venueId),
  });
});
