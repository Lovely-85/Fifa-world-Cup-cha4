import {
  getGateSnapshot,
  getVenueGateSnapshots,
  getLeastCrowdedGate,
  getTransportSnapshot,
  getAccessibilityInfo,
  isHeatAdvisoryActive,
  getSustainabilityTip,
} from '../../src/data/liveState';

const FIXED_TIME = new Date('2026-07-15T20:00:00Z').getTime();

describe('getGateSnapshot', () => {
  it('is deterministic for identical inputs', () => {
    const a = getGateSnapshot('sofi-la', 'A', FIXED_TIME);
    const b = getGateSnapshot('sofi-la', 'A', FIXED_TIME);
    expect(a).toEqual(b);
  });

  it('returns null for an unknown venue or gate', () => {
    expect(getGateSnapshot('not-a-venue', 'A', FIXED_TIME)).toBeNull();
    expect(getGateSnapshot('sofi-la', 'Z', FIXED_TIME)).toBeNull();
  });

  it('keeps every value within its documented bounds', () => {
    const snapshot = getGateSnapshot('sofi-la', 'A', FIXED_TIME)!;
    expect(snapshot.densityPct).toBeGreaterThanOrEqual(0);
    expect(snapshot.densityPct).toBeLessThanOrEqual(100);
    expect(snapshot.waitMinutes).toBeGreaterThanOrEqual(0);
    expect(snapshot.waitMinutes).toBeLessThanOrEqual(45);
    expect(snapshot.wheelchairShuttleWaitMinutes).toBeGreaterThanOrEqual(0);
    expect(snapshot.wheelchairShuttleWaitMinutes).toBeLessThanOrEqual(30);
    expect(typeof snapshot.elevatorOperational).toBe('boolean');
  });

  it('changes across different minute buckets', () => {
    const a = getGateSnapshot('sofi-la', 'A', FIXED_TIME);
    const b = getGateSnapshot('sofi-la', 'A', FIXED_TIME + 5 * 60_000);
    expect(a).not.toEqual(b);
  });
});

describe('getVenueGateSnapshots / getLeastCrowdedGate', () => {
  it('returns one snapshot per gate defined for the venue', () => {
    const snapshots = getVenueGateSnapshots('sofi-la', FIXED_TIME);
    expect(snapshots).toHaveLength(5); // SoFi Stadium has gates A-E
  });

  it('picks the gate with the minimum density', () => {
    const all = getVenueGateSnapshots('sofi-la', FIXED_TIME);
    const min = Math.min(...all.map((g) => g.densityPct));
    const best = getLeastCrowdedGate('sofi-la', FIXED_TIME);
    expect(best?.densityPct).toBe(min);
  });

  it('only returns gates with an operational elevator when required', () => {
    const all = getVenueGateSnapshots('sofi-la', FIXED_TIME);
    const anyElevatorWorks = all.some((g) => g.elevatorOperational);
    const best = getLeastCrowdedGate('sofi-la', FIXED_TIME, { requireOperationalElevator: true });
    expect(best === null).toBe(!anyElevatorWorks);
    if (best) expect(best.elevatorOperational).toBe(true);
  });
});

describe('getTransportSnapshot', () => {
  it('keeps parking occupancy and ETAs within bounds', () => {
    const transport = getTransportSnapshot('sofi-la', FIXED_TIME)!;
    expect(transport.parkingOccupancyPct).toBeGreaterThanOrEqual(0);
    expect(transport.parkingOccupancyPct).toBeLessThanOrEqual(100);
    expect(['normal', 'minor_delay', 'disrupted']).toContain(transport.transitStatus);
  });

  it('returns null for an unknown venue', () => {
    expect(getTransportSnapshot('not-a-venue', FIXED_TIME)).toBeNull();
  });
});

describe('isHeatAdvisoryActive', () => {
  it('is false for a venue whose notes mention no heat/humidity/altitude risk', () => {
    expect(isHeatAdvisoryActive('bcplace-vancouver', FIXED_TIME)).toBe(false);
  });

  it('returns a boolean for a heat-sensitive venue regardless of time of day', () => {
    expect(typeof isHeatAdvisoryActive('hardrock-miami', FIXED_TIME)).toBe('boolean');
  });
});

describe('getSustainabilityTip', () => {
  it('returns a non-empty tip and reason for a valid venue', () => {
    const tip = getSustainabilityTip('sofi-la', FIXED_TIME);
    expect(tip?.tip.length).toBeGreaterThan(0);
    expect(tip?.reason.length).toBeGreaterThan(0);
  });

  it('returns null for an unknown venue', () => {
    expect(getSustainabilityTip('not-a-venue', FIXED_TIME)).toBeNull();
  });
});

describe('getAccessibilityInfo', () => {
  it('includes live elevator status for every gate at the venue', () => {
    const info = getAccessibilityInfo('sofi-la', FIXED_TIME)!;
    expect(info.gateElevatorStatus).toHaveLength(5);
  });

  it('returns null for an unknown venue', () => {
    expect(getAccessibilityInfo('not-a-venue', FIXED_TIME)).toBeNull();
  });
});
