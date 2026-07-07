import { z } from 'zod';
import { findVenue, listVenueSummaries } from '../data/venues';
import {
  getAccessibilityInfo,
  getGateSnapshot,
  getLeastCrowdedGate,
  getSustainabilityTip,
  getTransportSnapshot,
  isHeatAdvisoryActive,
} from '../data/liveState';

/**
 * The model's ENTIRE capability surface is this fixed set of read-only,
 * schema-validated functions over local in-memory simulated state. There is
 * no filesystem, network, shell, or database access exposed to the model,
 * and every argument the model supplies is validated with zod before it
 * touches any application logic. This is the primary defense against
 * prompt injection: even a fully "jailbroken" model response can only ever
 * call one of these seven functions with well-typed arguments -- there is
 * no dangerous action for it to take.
 */

// ---------------------------------------------------------------------------
// Function declarations, in the shape the Gemini API function-calling
// contract expects (type: 'function', name, description, parameters as a
// JSON-schema-like object).
// ---------------------------------------------------------------------------

export const TOOL_DECLARATIONS = [
  {
    type: 'function',
    name: 'list_venues',
    description:
      'Lists all 16 FIFA World Cup 2026 host venues with their id, name, city and country. ' +
      'Always call this first if you do not already know the exact venue id for the city or ' +
      'stadium name the fan mentioned.',
    parameters: { type: 'object', properties: {}, required: [] },
  },
  {
    type: 'function',
    name: 'get_venue_details',
    description:
      'Returns static details for one venue (capacity, timezone, operational notes) plus whether ' +
      'a heat/altitude advisory is currently active there.',
    parameters: {
      type: 'object',
      properties: { venueId: { type: 'string', description: 'Venue id from list_venues.' } },
      required: ['venueId'],
    },
  },
  {
    type: 'function',
    name: 'get_gate_status',
    description: 'Returns simulated live crowd density, wait time and elevator status for one specific gate.',
    parameters: {
      type: 'object',
      properties: {
        venueId: { type: 'string', description: 'Venue id from list_venues.' },
        gateId: { type: 'string', description: 'Gate letter, e.g. "A".' },
      },
      required: ['venueId', 'gateId'],
    },
  },
  {
    type: 'function',
    name: 'get_least_crowded_gate',
    description:
      'Returns the currently least-crowded gate at a venue. Set requireOperationalElevator to true ' +
      'for fans who need step-free / wheelchair access.',
    parameters: {
      type: 'object',
      properties: {
        venueId: { type: 'string', description: 'Venue id from list_venues.' },
        requireOperationalElevator: {
          type: 'boolean',
          description: 'True if the fan needs a gate with a working elevator.',
        },
      },
      required: ['venueId'],
    },
  },
  {
    type: 'function',
    name: 'get_transport_options',
    description: 'Returns simulated shuttle ETA, parking occupancy, transit status and rideshare wait for a venue.',
    parameters: {
      type: 'object',
      properties: { venueId: { type: 'string', description: 'Venue id from list_venues.' } },
      required: ['venueId'],
    },
  },
  {
    type: 'function',
    name: 'get_accessibility_services',
    description:
      'Returns accessible seating info, sensory room availability, wheelchair rental location and ' +
      'live per-gate elevator status for a venue.',
    parameters: {
      type: 'object',
      properties: { venueId: { type: 'string', description: 'Venue id from list_venues.' } },
      required: ['venueId'],
    },
  },
  {
    type: 'function',
    name: 'get_sustainability_tip',
    description: 'Returns one contextual, low-emission travel recommendation for reaching a venue right now.',
    parameters: {
      type: 'object',
      properties: { venueId: { type: 'string', description: 'Venue id from list_venues.' } },
      required: ['venueId'],
    },
  },
] as const;

export type ToolName = (typeof TOOL_DECLARATIONS)[number]['name'];

export interface ToolResult {
  ok: boolean;
  data?: unknown;
  error?: string;
}

const venueIdSchema = z.object({ venueId: z.string().trim().min(1).max(64) });
const gateStatusSchema = venueIdSchema.extend({ gateId: z.string().trim().min(1).max(8) });
const leastCrowdedSchema = venueIdSchema.extend({ requireOperationalElevator: z.boolean().optional() });

function requireVenue(venueId: string) {
  const venue = findVenue(venueId);
  if (!venue) {
    return { ok: false as const, error: `Unknown venueId "${venueId}". Call list_venues to get valid ids.` };
  }
  return { ok: true as const, venue };
}

/**
 * Executes a named tool with unvalidated, model-supplied arguments.
 * Never throws: any failure (bad shape, unknown venue/gate, unknown tool
 * name) comes back as a structured { ok: false, error } result so the
 * calling AI orchestration loop can hand the error back to the model or
 * degrade gracefully, instead of the request crashing.
 */
export function executeTool(name: string, rawArgs: unknown): ToolResult {
  try {
    switch (name as ToolName) {
      case 'list_venues': {
        return { ok: true, data: listVenueSummaries() };
      }
      case 'get_venue_details': {
        const parsed = venueIdSchema.safeParse(rawArgs);
        if (!parsed.success) return { ok: false, error: 'Invalid arguments for get_venue_details.' };
        const found = requireVenue(parsed.data.venueId);
        if (!found.ok) return found;
        return {
          ok: true,
          data: {
            ...found.venue,
            heatOrAltitudeAdvisoryActive: isHeatAdvisoryActive(parsed.data.venueId),
          },
        };
      }
      case 'get_gate_status': {
        const parsed = gateStatusSchema.safeParse(rawArgs);
        if (!parsed.success) return { ok: false, error: 'Invalid arguments for get_gate_status.' };
        const found = requireVenue(parsed.data.venueId);
        if (!found.ok) return found;
        const snapshot = getGateSnapshot(parsed.data.venueId, parsed.data.gateId);
        if (!snapshot) {
          return { ok: false, error: `Unknown gateId "${parsed.data.gateId}" for this venue.` };
        }
        return { ok: true, data: snapshot };
      }
      case 'get_least_crowded_gate': {
        const parsed = leastCrowdedSchema.safeParse(rawArgs);
        if (!parsed.success) return { ok: false, error: 'Invalid arguments for get_least_crowded_gate.' };
        const found = requireVenue(parsed.data.venueId);
        if (!found.ok) return found;
        const snapshot = getLeastCrowdedGate(parsed.data.venueId, Date.now(), {
          requireOperationalElevator: parsed.data.requireOperationalElevator,
        });
        if (!snapshot) return { ok: false, error: 'No gate currently matches the requested constraints.' };
        return { ok: true, data: snapshot };
      }
      case 'get_transport_options': {
        const parsed = venueIdSchema.safeParse(rawArgs);
        if (!parsed.success) return { ok: false, error: 'Invalid arguments for get_transport_options.' };
        const found = requireVenue(parsed.data.venueId);
        if (!found.ok) return found;
        return { ok: true, data: getTransportSnapshot(parsed.data.venueId) };
      }
      case 'get_accessibility_services': {
        const parsed = venueIdSchema.safeParse(rawArgs);
        if (!parsed.success) return { ok: false, error: 'Invalid arguments for get_accessibility_services.' };
        const found = requireVenue(parsed.data.venueId);
        if (!found.ok) return found;
        return { ok: true, data: getAccessibilityInfo(parsed.data.venueId) };
      }
      case 'get_sustainability_tip': {
        const parsed = venueIdSchema.safeParse(rawArgs);
        if (!parsed.success) return { ok: false, error: 'Invalid arguments for get_sustainability_tip.' };
        const found = requireVenue(parsed.data.venueId);
        if (!found.ok) return found;
        return { ok: true, data: getSustainabilityTip(parsed.data.venueId) };
      }
      default:
        return { ok: false, error: `Unknown tool "${name}".` };
    }
  } catch (error) {
    return { ok: false, error: `Tool execution failed: ${(error as Error).message}` };
  }
}
