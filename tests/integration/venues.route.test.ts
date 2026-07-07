import request from 'supertest';
import { createApp } from '../../src/app';

const app = createApp();

describe('GET /api/venues', () => {
  it('returns all 16 FIFA World Cup 2026 host venues', async () => {
    const res = await request(app).get('/api/venues');
    expect(res.status).toBe(200);
    expect(res.body.length).toBe(16);
  });
});

describe('GET /api/venues/:venueId/status', () => {
  it('returns live status for a valid venue', async () => {
    const res = await request(app).get('/api/venues/sofi-la/status');
    expect(res.status).toBe(200);
    expect(res.body.venue.id).toBe('sofi-la');
    expect(Array.isArray(res.body.gates)).toBe(true);
    expect(res.body.gates.length).toBeGreaterThan(0);
  });

  it('returns 404 for an unknown venue', async () => {
    const res = await request(app).get('/api/venues/not-a-venue/status');
    expect(res.status).toBe(404);
  });
});

describe('GET /api/ops/:venueId/insight', () => {
  it('returns a briefing for a valid venue', async () => {
    const res = await request(app).get('/api/ops/sofi-la/insight');
    expect(res.status).toBe(200);
    expect(Array.isArray(res.body.briefing)).toBe(true);
    expect(res.body.briefing.length).toBeGreaterThan(0);
  });
});

describe('unmatched routes', () => {
  it('returns a JSON 404 instead of an HTML error page', async () => {
    const res = await request(app).get('/api/this-does-not-exist');
    expect(res.status).toBe(404);
    expect(res.body.error).toMatch(/Not found/);
  });
});
