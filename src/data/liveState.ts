import { findVenue } from './venues';

/**
 * Simulated "live" stadium data.
 *
 * There is no public real-time feed for FIFA World Cup 2026 gate-level
 * crowd density, so this module deterministically DERIVES plausible,
 * bounded values from (venueId, gateId, minute-of-day) using a seeded
 * pseudo-random function. Two important properties fall out of that
 * design, both load-bearing for the rest of the app:
 *
 *  1. Deterministic + pure: the same inputs always produce the same
 *     output, so unit tests can assert exact behaviour without flakiness
 *     or mocking Math.random / Date.now.
 *  2. Bounded + safe: outputs are clamped to sane ranges, so downstream
 *     consumers (the AI tool layer, the fallback engine) never have to
 *     defend against NaN/negative/out-of-range values.
 *
 * Swapping this module for a real venue operations feed later would not
 * require changing any calling code, since the exported function
 * signatures are the integration seam.
 */

export type DensityLevel = 'low' | 'moderate' | 'high' | 'critical';

export interface GateSnapshot {
  venueId: string;
  gateId: string;
  densityPct: number;
  densityLevel: DensityLevel;
  waitMinutes: number;
  elevatorOperational: boolean;
  wheelchairShuttleWaitMinutes: number;
  asOfMinuteBucket: number;
}

export interface TransportSnapshot {
  venueId: string;
  shuttleEtaMinutes: number;
  parkingOccupancyPct: number;
  transitStatus: 'normal' | 'minor_delay' | 'disrupted';
  rideshareZoneWaitMinutes: number;
  asOfMinuteBucket: number;
}

export interface AccessibilityInfo {
  venueId: string;
  accessibleSeatingNote: string;
  sensoryRoomAvailable: boolean;
  wheelchairRentalGate: string;
  gateElevatorStatus: Array<{ gateId: string; elevatorOperational: boolean }>;
}

/** FNV-1a style string hash -> 32-bit unsigned integer. Deterministic, dependency-free. */
function hashString(input: string): number {
  let hash = 0x811c9dc5;
  for (let i = 0; i < input.length; i += 1) {
    hash ^= input.charCodeAt(i);
    hash = Math.imul(hash, 0x01000193);
  }
  return hash >>> 0;
}

/** mulberry32 PRNG: deterministic, seedable, good-enough statistical spread for simulation. */
function mulberry32(seed: number): () => number {
  let a = seed;
  return () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** Deterministic pseudo-random number in [min, max) seeded by `key`. */
function seededRange(key: string, min: number, max: number): number {
  const rand = mulberry32(hashString(key))();
  return min + rand * (max - min);
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

function minuteBucket(now: number): number {
  return Math.floor(now / 60_000);
}

function densityLevelFromPct(pct: number): DensityLevel {
  if (pct >= 90) return 'critical';
  if (pct >= 70) return 'high';
  if (pct >= 40) return 'moderate';
  return 'low';
}

export function getGateSnapshot(
  venueId: string,
  gateId: string,
  now: number = Date.now(),
): GateSnapshot | null {
  const venue = findVenue(venueId);
  if (!venue || !venue.gateIds.includes(gateId)) return null;

  const bucket = minuteBucket(now);
  const key = `${venueId}:${gateId}:${bucket}`;
  const densityPct = clamp(Math.round(seededRange(`${key}:density`, 15, 98)), 0, 100);
  const waitMinutes = clamp(Math.round((densityPct / 100) * 22 + seededRange(`${key}:wait`, 0, 4)), 0, 45);
  const elevatorOperational = seededRange(`${key}:elevator`, 0, 1) > 0.08; // ~92% uptime
  const wheelchairShuttleWaitMinutes = clamp(
    Math.round(seededRange(`${key}:shuttle`, 2, 12)),
    0,
    30,
  );

  return {
    venueId,
    gateId,
    densityPct,
    densityLevel: densityLevelFromPct(densityPct),
    waitMinutes,
    elevatorOperational,
    wheelchairShuttleWaitMinutes,
    asOfMinuteBucket: bucket,
  };
}

export function getVenueGateSnapshots(venueId: string, now: number = Date.now()): GateSnapshot[] {
  const venue = findVenue(venueId);
  if (!venue) return [];
  return venue.gateIds
    .map((gateId) => getGateSnapshot(venueId, gateId, now))
    .filter((snapshot): snapshot is GateSnapshot => snapshot !== null);
}

export interface LeastCrowdedGateOptions {
  requireOperationalElevator?: boolean;
}

export function getLeastCrowdedGate(
  venueId: string,
  now: number = Date.now(),
  options: LeastCrowdedGateOptions = {},
): GateSnapshot | null {
  const snapshots = getVenueGateSnapshots(venueId, now).filter(
    (snapshot) => !options.requireOperationalElevator || snapshot.elevatorOperational,
  );
  if (snapshots.length === 0) return null;
  return snapshots.reduce((best, current) => (current.densityPct < best.densityPct ? current : best));
}

export function getTransportSnapshot(venueId: string, now: number = Date.now()): TransportSnapshot | null {
  const venue = findVenue(venueId);
  if (!venue) return null;

  const bucket = minuteBucket(now);
  const key = `${venueId}:transport:${bucket}`;
  const parkingOccupancyPct = clamp(Math.round(seededRange(`${key}:parking`, 40, 100)), 0, 100);
  const shuttleEtaMinutes = clamp(Math.round(seededRange(`${key}:shuttle`, 3, 20)), 1, 40);
  const rideshareZoneWaitMinutes = clamp(Math.round(seededRange(`${key}:rideshare`, 4, 25)), 1, 45);
  const transitRoll = seededRange(`${key}:transit`, 0, 1);
  const transitStatus: TransportSnapshot['transitStatus'] =
    transitRoll > 0.93 ? 'disrupted' : transitRoll > 0.75 ? 'minor_delay' : 'normal';

  return {
    venueId,
    shuttleEtaMinutes,
    parkingOccupancyPct,
    transitStatus,
    rideshareZoneWaitMinutes,
    asOfMinuteBucket: bucket,
  };
}

export function getAccessibilityInfo(venueId: string, now: number = Date.now()): AccessibilityInfo | null {
  const venue = findVenue(venueId);
  if (!venue) return null;

  const gateElevatorStatus = getVenueGateSnapshots(venueId, now).map((snapshot) => ({
    gateId: snapshot.gateId,
    elevatorOperational: snapshot.elevatorOperational,
  }));

  return {
    venueId,
    accessibleSeatingNote:
      'Accessible and companion seating is located on the main concourse level, adjacent to every gate.',
    sensoryRoomAvailable: true,
    wheelchairRentalGate: venue.gateIds[0],
    gateElevatorStatus,
  };
}

export function isHeatAdvisoryActive(venueId: string, now: number = Date.now()): boolean {
  const venue = findVenue(venueId);
  if (!venue) return false;
  const notesLower = venue.operationalNotes.toLowerCase();
  const heatSensitive = notesLower.includes('heat') || notesLower.includes('humid') || notesLower.includes('altitude');
  if (!heatSensitive) return false;

  const localHour = new Date(now).getUTCHours(); // coarse approximation, documented assumption
  return localHour >= 16 && localHour <= 23; // roughly midday-to-evening across covered timezones
}

export interface SustainabilityTip {
  tip: string;
  reason: string;
}

export function getSustainabilityTip(venueId: string, now: number = Date.now()): SustainabilityTip | null {
  const transport = getTransportSnapshot(venueId, now);
  if (!transport) return null;

  if (transport.parkingOccupancyPct >= 85) {
    return {
      tip: 'Consider the shuttle or public transit instead of driving.',
      reason: `On-site parking is around ${transport.parkingOccupancyPct}% full, so transit avoids circling for a spot and cuts per-fan emissions.`,
    };
  }
  if (transport.transitStatus === 'disrupted') {
    return {
      tip: 'Group up for rideshare or use the official shuttle rather than several single-occupant cars.',
      reason: 'Transit is currently disrupted, so consolidating trips reduces both congestion and emissions.',
    };
  }
  return {
    tip: 'Public transit or the official shuttle is available and is the lowest-emission way to reach the venue.',
    reason: `Transit status is currently ${transport.transitStatus.replace('_', ' ')}.`,
  };
}
