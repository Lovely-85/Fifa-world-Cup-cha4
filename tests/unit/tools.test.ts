import { executeTool } from '../../src/ai/tools';

describe('executeTool: list_venues', () => {
  it('returns all 16 host venues', () => {
    const result = executeTool('list_venues', {});
    expect(result.ok).toBe(true);
    expect(Array.isArray(result.data)).toBe(true);
    expect((result.data as unknown[]).length).toBe(16);
  });
});

describe('executeTool: get_venue_details', () => {
  it('returns details for a valid venue id', () => {
    const result = executeTool('get_venue_details', { venueId: 'sofi-la' });
    expect(result.ok).toBe(true);
    expect((result.data as { name: string }).name).toBe('SoFi Stadium');
  });

  it('returns a structured error for an unknown venue id', () => {
    const result = executeTool('get_venue_details', { venueId: 'not-a-venue' });
    expect(result.ok).toBe(false);
    expect(result.error).toMatch(/Unknown venueId/);
  });

  it('rejects malformed arguments instead of throwing', () => {
    const result = executeTool('get_venue_details', { venueId: 12345 });
    expect(result.ok).toBe(false);
  });
});

describe('executeTool: get_gate_status', () => {
  it('returns a snapshot for a valid gate', () => {
    const result = executeTool('get_gate_status', { venueId: 'sofi-la', gateId: 'A' });
    expect(result.ok).toBe(true);
  });

  it('rejects an unknown gate id for a valid venue', () => {
    const result = executeTool('get_gate_status', { venueId: 'sofi-la', gateId: 'Z' });
    expect(result.ok).toBe(false);
    expect(result.error).toMatch(/Unknown gateId/);
  });

  it('rejects an unknown venue before checking the gate', () => {
    const result = executeTool('get_gate_status', { venueId: 'not-a-venue', gateId: 'A' });
    expect(result.ok).toBe(false);
    expect(result.error).toMatch(/Unknown venueId/);
  });
});

describe('executeTool: get_least_crowded_gate', () => {
  it('honours the requireOperationalElevator flag', () => {
    const result = executeTool('get_least_crowded_gate', {
      venueId: 'sofi-la',
      requireOperationalElevator: true,
    });
    expect(result.ok).toBe(true);
  });
});

describe('executeTool: get_transport_options / get_accessibility_services / get_sustainability_tip', () => {
  it('all return ok:true for a valid venue', () => {
    expect(executeTool('get_transport_options', { venueId: 'sofi-la' }).ok).toBe(true);
    expect(executeTool('get_accessibility_services', { venueId: 'sofi-la' }).ok).toBe(true);
    expect(executeTool('get_sustainability_tip', { venueId: 'sofi-la' }).ok).toBe(true);
  });
});

describe('executeTool: robustness', () => {
  it('rejects malformed arguments rather than throwing', () => {
    const result = executeTool('get_gate_status', { venueId: 123, gateId: null });
    expect(result.ok).toBe(false);
  });

  it('returns a structured error for an unrecognized tool name', () => {
    const result = executeTool('drop_database', {});
    expect(result.ok).toBe(false);
    expect(result.error).toMatch(/Unknown tool/);
  });

  it('never throws even when given completely invalid input', () => {
    expect(() => executeTool('get_gate_status', 'not an object')).not.toThrow();
    expect(() => executeTool('get_gate_status', undefined)).not.toThrow();
  });
});
