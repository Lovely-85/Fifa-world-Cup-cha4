/**
 * Static, factual reference data about FIFA World Cup 2026 host venues.
 *
 * Source: publicly announced FIFA World Cup 2026 host city / stadium list
 * (16 venues across the United States, Mexico and Canada). Gate layouts,
 * live crowd figures, wait times and transport numbers used elsewhere in
 * this project are SIMULATED for demonstration purposes -- see
 * src/data/liveState.ts and the README "Assumptions" section.
 */

export type Country = 'USA' | 'Mexico' | 'Canada';

export interface Venue {
  id: string;
  name: string;
  city: string;
  country: Country;
  capacityApprox: number;
  timezone: string;
  /** Gate identifiers a fan might be directed to. */
  gateIds: string[];
  /** Notable operational context (altitude, roof, climate) relevant to fan guidance. */
  operationalNotes: string;
  /** Languages fans at this venue are statistically most likely to need, beyond English. */
  commonLanguages: string[];
}

export const VENUES: readonly Venue[] = [
  {
    id: 'metlife-nynj',
    name: 'MetLife Stadium',
    city: 'East Rutherford (New York/New Jersey)',
    country: 'USA',
    capacityApprox: 82500,
    timezone: 'America/New_York',
    gateIds: ['A', 'B', 'C', 'D', 'E', 'F'],
    operationalNotes: 'Hosts the FIFA World Cup 2026 final; expect the highest crowd volumes of any venue.',
    commonLanguages: ['Spanish', 'Portuguese', 'French'],
  },
  {
    id: 'att-dallas',
    name: 'AT&T Stadium',
    city: 'Arlington (Dallas)',
    country: 'USA',
    capacityApprox: 80000,
    timezone: 'America/Chicago',
    gateIds: ['A', 'B', 'C', 'D', 'E'],
    operationalNotes: 'Retractable roof; heat-safety guidance still applies to outdoor concourses and parking lots.',
    commonLanguages: ['Spanish'],
  },
  {
    id: 'mercedes-atlanta',
    name: 'Mercedes-Benz Stadium',
    city: 'Atlanta',
    country: 'USA',
    capacityApprox: 71000,
    timezone: 'America/New_York',
    gateIds: ['A', 'B', 'C', 'D'],
    operationalNotes: 'Retractable roof, high humidity summers.',
    commonLanguages: ['Spanish', 'French'],
  },
  {
    id: 'nrg-houston',
    name: 'NRG Stadium',
    city: 'Houston',
    country: 'USA',
    capacityApprox: 72200,
    timezone: 'America/Chicago',
    gateIds: ['A', 'B', 'C', 'D'],
    operationalNotes: 'High summer heat and humidity; hydration stations are safety-critical.',
    commonLanguages: ['Spanish'],
  },
  {
    id: 'arrowhead-kc',
    name: 'Arrowhead Stadium',
    city: 'Kansas City',
    country: 'USA',
    capacityApprox: 76400,
    timezone: 'America/Chicago',
    gateIds: ['A', 'B', 'C', 'D'],
    operationalNotes: 'Large surface parking lots; shuttle and rideshare coordination is a major logistics factor.',
    commonLanguages: ['Spanish'],
  },
  {
    id: 'sofi-la',
    name: 'SoFi Stadium',
    city: 'Inglewood (Los Angeles)',
    country: 'USA',
    capacityApprox: 70000,
    timezone: 'America/Los_Angeles',
    gateIds: ['A', 'B', 'C', 'D', 'E'],
    operationalNotes: 'Dense multi-event campus; wayfinding between transit hub and gates spans a long walk.',
    commonLanguages: ['Spanish', 'Korean', 'Mandarin'],
  },
  {
    id: 'hardrock-miami',
    name: 'Hard Rock Stadium',
    city: 'Miami Gardens (Miami)',
    country: 'USA',
    capacityApprox: 65300,
    timezone: 'America/New_York',
    gateIds: ['A', 'B', 'C', 'D'],
    operationalNotes: 'Extreme heat and afternoon thunderstorm risk; weather-triggered shelter guidance matters.',
    commonLanguages: ['Spanish', 'Portuguese', 'Haitian Creole'],
  },
  {
    id: 'levis-bayarea',
    name: "Levi's Stadium",
    city: 'Santa Clara (San Francisco Bay Area)',
    country: 'USA',
    capacityApprox: 68500,
    timezone: 'America/Los_Angeles',
    gateIds: ['A', 'B', 'C', 'D'],
    operationalNotes: 'Strong regional Caltrain/light-rail options; transit-first guidance reduces parking strain.',
    commonLanguages: ['Spanish', 'Mandarin', 'Vietnamese'],
  },
  {
    id: 'lumen-seattle',
    name: 'Lumen Field',
    city: 'Seattle',
    country: 'USA',
    capacityApprox: 69000,
    timezone: 'America/Los_Angeles',
    gateIds: ['A', 'B', 'C', 'D'],
    operationalNotes: 'Compact urban footprint; light rail is the primary high-capacity transit link.',
    commonLanguages: ['Spanish'],
  },
  {
    id: 'lincoln-philly',
    name: 'Lincoln Financial Field',
    city: 'Philadelphia',
    country: 'USA',
    capacityApprox: 69800,
    timezone: 'America/New_York',
    gateIds: ['A', 'B', 'C', 'D'],
    operationalNotes: 'Stadium district shared with other venues; wayfinding disambiguation matters.',
    commonLanguages: ['Spanish'],
  },
  {
    id: 'gillette-boston',
    name: 'Gillette Stadium',
    city: 'Foxborough (Boston)',
    country: 'USA',
    capacityApprox: 65900,
    timezone: 'America/New_York',
    gateIds: ['A', 'B', 'C', 'D'],
    operationalNotes: 'Limited on-site transit; shuttle bus coordination from remote lots is critical.',
    commonLanguages: ['Spanish', 'Portuguese'],
  },
  {
    id: 'azteca-mexicocity',
    name: 'Estadio Azteca',
    city: 'Mexico City',
    country: 'Mexico',
    capacityApprox: 83000,
    timezone: 'America/Mexico_City',
    gateIds: ['A', 'B', 'C', 'D', 'E'],
    operationalNotes: 'High altitude (~2,200m); advise visiting fans on hydration and gradual exertion.',
    commonLanguages: ['English'],
  },
  {
    id: 'bbva-monterrey',
    name: 'Estadio BBVA',
    city: 'Monterrey',
    country: 'Mexico',
    capacityApprox: 53500,
    timezone: 'America/Monterrey',
    gateIds: ['A', 'B', 'C', 'D'],
    operationalNotes: 'Very high summer temperatures; heat-safety messaging is a priority.',
    commonLanguages: ['English'],
  },
  {
    id: 'akron-guadalajara',
    name: 'Estadio Akron',
    city: 'Guadalajara',
    country: 'Mexico',
    capacityApprox: 48100,
    timezone: 'America/Mexico_City',
    gateIds: ['A', 'B', 'C', 'D'],
    operationalNotes: 'Smallest-capacity venue in the tournament; expect tighter concourse density per fan.',
    commonLanguages: ['English'],
  },
  {
    id: 'bcplace-vancouver',
    name: 'BC Place',
    city: 'Vancouver',
    country: 'Canada',
    capacityApprox: 54500,
    timezone: 'America/Vancouver',
    gateIds: ['A', 'B', 'C', 'D'],
    operationalNotes: 'Retractable roof; downtown location with strong SkyTrain transit access.',
    commonLanguages: ['French', 'Mandarin', 'Punjabi'],
  },
  {
    id: 'bmofield-toronto',
    name: 'BMO Field',
    city: 'Toronto',
    country: 'Canada',
    capacityApprox: 45700,
    timezone: 'America/Toronto',
    gateIds: ['A', 'B', 'C', 'D'],
    operationalNotes: 'Smallest-footprint venue; strict gate-by-ticket-sector routing reduces concourse crowding.',
    commonLanguages: ['French', 'Punjabi', 'Mandarin'],
  },
];

export const VENUE_BY_ID: ReadonlyMap<string, Venue> = new Map(
  VENUES.map((venue) => [venue.id, venue]),
);

export function findVenue(venueId: string): Venue | undefined {
  return VENUE_BY_ID.get(venueId);
}

export function listVenueSummaries(): Array<Pick<Venue, 'id' | 'name' | 'city' | 'country'>> {
  return VENUES.map(({ id, name, city, country }) => ({ id, name, city, country }));
}
