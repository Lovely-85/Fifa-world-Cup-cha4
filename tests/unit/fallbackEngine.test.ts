import { generateFallbackResponse, generateFallbackOpsBriefing } from '../../src/ai/fallbackEngine';

describe('generateFallbackResponse', () => {
  it('asks the fan to specify a venue when none can be matched', () => {
    const result = generateFallbackResponse('Hello, can you help me?');
    expect(result.matchedVenueId).toBeNull();
    expect(result.finalText).toMatch(/which host city or stadium/i);
  });

  it('detects the accessibility intent and matches the venue', () => {
    const result = generateFallbackResponse('I use a wheelchair, best way into AT&T Stadium?');
    expect(result.matchedVenueId).toBe('att-dallas');
    expect(result.intent).toBe('accessibility');
    expect(result.finalText.length).toBeGreaterThan(0);
  });

  it('detects the gate/crowd intent', () => {
    const result = generateFallbackResponse('I am at AT&T Stadium in Dallas, which gate should I use?');
    expect(result.matchedVenueId).toBe('att-dallas');
    expect(result.intent).toBe('gate');
  });

  it('detects the transport intent', () => {
    const result = generateFallbackResponse('What are my parking options near Lumen Field Seattle?');
    expect(result.matchedVenueId).toBe('lumen-seattle');
    expect(result.intent).toBe('transport');
  });

  it('detects the sustainability intent', () => {
    const result = generateFallbackResponse('Whats the most eco-friendly way to reach BC Place?');
    expect(result.matchedVenueId).toBe('bcplace-vancouver');
    expect(result.intent).toBe('sustainability');
  });

  it('falls back to the general intent when a venue matches but no keyword does', () => {
    const result = generateFallbackResponse('Tell me about Gillette Stadium');
    expect(result.matchedVenueId).toBe('gillette-boston');
    expect(result.intent).toBe('general');
  });
});

describe('generateFallbackOpsBriefing', () => {
  it('returns an explanatory line for an unknown venue', () => {
    const briefing = generateFallbackOpsBriefing('not-a-venue');
    expect(briefing[0]).toMatch(/Unknown venue/);
  });

  it('returns between 1 and 5 bullet points for a valid venue', () => {
    const briefing = generateFallbackOpsBriefing('att-dallas');
    expect(briefing.length).toBeGreaterThan(0);
    expect(briefing.length).toBeLessThanOrEqual(5);
  });
});
