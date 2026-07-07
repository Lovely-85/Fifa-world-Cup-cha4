import request from 'supertest';
import { createApp } from '../../src/app';

const app = createApp();

describe('POST /api/chat', () => {
  it('returns a fallback-mode reply for a valid message', async () => {
    const res = await request(app)
      .post('/api/chat')
      .send({ message: 'Which gate at AT&T Stadium Dallas has the shortest wait?' });

    expect(res.status).toBe(200);
    expect(res.body.mode).toBe('fallback');
    expect(typeof res.body.reply).toBe('string');
    expect(res.body.reply.length).toBeGreaterThan(0);
  });

  it('rejects an empty message with 400', async () => {
    const res = await request(app).post('/api/chat').send({ message: '' });
    expect(res.status).toBe(400);
  });

  it('rejects a message over the length limit with 400', async () => {
    const res = await request(app)
      .post('/api/chat')
      .send({ message: 'a'.repeat(2001) });
    expect(res.status).toBe(400);
  });

  it('rejects a malformed history entry with 400', async () => {
    const res = await request(app)
      .post('/api/chat')
      .send({ message: 'hello', history: [{ role: 'narrator', text: 'not a valid role' }] });
    expect(res.status).toBe(400);
  });

  it('sets a strict Content-Security-Policy header', async () => {
    const res = await request(app).post('/api/chat').send({ message: 'hello there' });
    expect(res.headers['content-security-policy']).toContain("default-src 'self'");
  });
});
