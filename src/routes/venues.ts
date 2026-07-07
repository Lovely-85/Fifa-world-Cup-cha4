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
  res.json(listVenueSummaries());
});

venuesRouter.get('/:venueId/status', validateParams(venueParamSchema), (req, res) => {
  const { venueId } = req.params;
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
