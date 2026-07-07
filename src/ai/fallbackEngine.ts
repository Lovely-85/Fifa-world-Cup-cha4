import { VENUES, Venue, findVenue, listVenueSummaries } from '../data/venues';
import {
  getAccessibilityInfo,
  getLeastCrowdedGate,
  getSustainabilityTip,
  getTransportSnapshot,
  getVenueGateSnapshots,
  isHeatAdvisoryActive,
} from '../data/liveState';

/**
 * Deterministic, dependency-free responder used whenever the Gemini API is
 * not configured (no GEMINI_API_KEY) or a live call fails. This guarantees
 * the assistant is always demoable -- reviewers who clone the repo without
 * setting up billing still see real, contextual answers, just without free-
 * form generative language.
 *
 * Scope is intentionally narrower than the full Gemini-backed assistant:
 * English only, and intent detection is keyword-based rather than true
 * language understanding. That trade-off is documented in the README so it
 * reads as an explicit design decision, not a hidden limitation.
 */

export type Intent = 'accessibility' | 'gate' | 'transport' | 'sustainability' | 'general';

export interface FallbackResult {
  finalText: string;
  matchedVenueId: string | null;
  intent: Intent;
}

const ACCESSIBILITY_KEYWORDS = ['wheelchair', 'accessib', 'disab', 'mobility', 'sensory', 'deaf', 'blind'];
const GATE_KEYWORDS = ['gate', 'crowd', 'busy', 'line', 'queue', 'entrance', 'entry'];
const TRANSPORT_KEYWORDS = ['parking', 'shuttle', 'transit', 'bus', 'train', 'uber', 'lyft', 'rideshare', 'taxi'];
const SUSTAINABILITY_KEYWORDS = ['eco', 'sustainab', 'carbon', 'green', 'emission'];

function detectIntent(lowerText: string): Intent {
  if (ACCESSIBILITY_KEYWORDS.some((kw) => lowerText.includes(kw))) return 'accessibility';
  if (GATE_KEYWORDS.some((kw) => lowerText.includes(kw))) return 'gate';
  if (TRANSPORT_KEYWORDS.some((kw) => lowerText.includes(kw))) return 'transport';
  if (SUSTAINABILITY_KEYWORDS.some((kw) => lowerText.includes(kw))) return 'sustainability';
  return 'general';
}

function venueMatchTokens(venue: Venue): string[] {
  const raw = [venue.name, venue.city, ...venue.city.split(/[()/,]/)];
  return raw.map((token) => token.trim().toLowerCase()).filter((token) => token.length >= 4);
}

function findVenueFromText(lowerText: string): Venue | undefined {
  return VENUES.find((venue) => venueMatchTokens(venue).some((token) => lowerText.includes(token)));
}

function suggestVenueList(): string {
  const sample = listVenueSummaries()
    .slice(0, 4)
    .map((v) => `${v.name} (${v.city})`)
    .join(', ');
  return `Could you tell me which host city or stadium you're at? For example: ${sample}, and 12 more across the US, Mexico and Canada.`;
}

export function generateFallbackResponse(userMessage: string): FallbackResult {
  const lowerText = userMessage.toLowerCase();
  const venue = findVenueFromText(lowerText);
  const intent = detectIntent(lowerText);

  if (!venue) {
    return { finalText: suggestVenueList(), matchedVenueId: null, intent };
  }

  const heatAdvisory = isHeatAdvisoryActive(venue.id);
  const heatNote = heatAdvisory
    ? ` Note: a heat/altitude advisory is active at ${venue.name} right now -- stay hydrated and pace yourself.`
    : '';

  switch (intent) {
    case 'accessibility': {
      const accessibility = getAccessibilityInfo(venue.id);
      const bestGate = getLeastCrowdedGate(venue.id, Date.now(), { requireOperationalElevator: true });
      const gateLine = bestGate
        ? `Gate ${bestGate.gateId} currently has a working elevator and ${bestGate.densityLevel} crowd density (about a ${bestGate.waitMinutes}-minute wait).`
        : 'All gate elevators are showing limited availability right now -- ask any staff member for the nearest accessible route.';
      return {
        finalText:
          `${gateLine} ${accessibility?.accessibleSeatingNote ?? ''} A wheelchair rental point is available at Gate ${accessibility?.wheelchairRentalGate ?? venue.gateIds[0]}, and a sensory-friendly quiet room is available on request.${heatNote}`.trim(),
        matchedVenueId: venue.id,
        intent,
      };
    }
    case 'gate': {
      const bestGate = getLeastCrowdedGate(venue.id);
      const gateLine = bestGate
        ? `Gate ${bestGate.gateId} is currently your best option: ${bestGate.densityLevel} density with roughly a ${bestGate.waitMinutes}-minute wait.`
        : 'Gate data is temporarily unavailable.';
      return { finalText: `${gateLine}${heatNote}`, matchedVenueId: venue.id, intent };
    }
    case 'transport': {
      const transport = getTransportSnapshot(venue.id);
      const tip = getSustainabilityTip(venue.id);
      const transportLine = transport
        ? `Shuttle ETA is about ${transport.shuttleEtaMinutes} minutes, parking is around ${transport.parkingOccupancyPct}% full, and transit status is ${transport.transitStatus.replace('_', ' ')}.`
        : 'Transport data is temporarily unavailable.';
      return {
        finalText: `${transportLine}${tip ? ` Tip: ${tip.tip}` : ''}${heatNote}`,
        matchedVenueId: venue.id,
        intent,
      };
    }
    case 'sustainability': {
      const tip = getSustainabilityTip(venue.id);
      return {
        finalText: tip ? `${tip.tip} ${tip.reason}` : 'Sustainability data is temporarily unavailable.',
        matchedVenueId: venue.id,
        intent,
      };
    }
    default: {
      return {
        finalText:
          `You're near ${venue.name} in ${venue.city}. I can help with the least crowded gate, accessibility services, transport and parking, or low-emission travel options -- what would be most useful?${heatNote}`,
        matchedVenueId: venue.id,
        intent,
      };
    }
  }
}

/**
 * Deterministic staff/volunteer briefing used when Gemini is unavailable.
 * Mirrors the structure the Gemini-generated briefing follows (see
 * OPS_INSIGHT_SYSTEM_PROMPT) so the UI looks consistent either way.
 */
export function generateFallbackOpsBriefing(venueId: string): string[] {
  const venue = findVenue(venueId);
  if (!venue) return [`Unknown venue "${venueId}".`];

  const bullets: string[] = [];
  const gates = getVenueGateSnapshots(venueId);
  const hotGates = gates.filter((g) => g.densityLevel === 'high' || g.densityLevel === 'critical');
  const calmGates = gates
    .filter((g) => g.densityLevel === 'low' || g.densityLevel === 'moderate')
    .sort((a, b) => a.densityPct - b.densityPct);

  if (hotGates.length > 0) {
    const worst = hotGates.sort((a, b) => b.densityPct - a.densityPct)[0];
    const alt = calmGates[0];
    bullets.push(
      `Gate ${worst.gateId} is at ${worst.densityLevel} density (${worst.densityPct}%).` +
        (alt ? ` Redirect incoming fans toward Gate ${alt.gateId} (${alt.densityLevel}, ${alt.densityPct}%).` : ''),
    );
  } else {
    bullets.push('All gates are currently at low or moderate density. No redirection needed.');
  }

  const transport = getTransportSnapshot(venueId);
  if (transport) {
    if (transport.transitStatus !== 'normal') {
      bullets.push(`Transit status: ${transport.transitStatus.replace('_', ' ')}. Consider messaging fans to allow extra time.`);
    }
    if (transport.parkingOccupancyPct >= 85) {
      bullets.push(`Parking is ${transport.parkingOccupancyPct}% full. Consider opening overflow parking or boosting shuttle frequency.`);
    }
  }

  if (isHeatAdvisoryActive(venueId)) {
    bullets.push(`Heat/altitude advisory active at ${venue.name}. Increase hydration station staffing and signage.`);
  }

  return bullets.slice(0, 5);
}
