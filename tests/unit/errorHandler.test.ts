import type { Request, Response, NextFunction } from 'express';
import { errorHandler, notFoundHandler } from '../../src/middleware/errorHandler';

function createMockRes() {
  const res: Partial<Response> & { headersSent: boolean } = {
    headersSent: false,
    status: jest.fn().mockReturnThis(),
    json: jest.fn().mockReturnThis(),
  };
  return res as Response & { status: jest.Mock; json: jest.Mock };
}

describe('errorHandler', () => {
  it('returns a generic 500 for an ordinary error, without leaking the raw message in production', () => {
    const res = createMockRes();
    const req = { path: '/api/chat' } as Request;

    errorHandler(new Error('some internal detail'), req, res, jest.fn() as NextFunction);

    expect(res.status).toHaveBeenCalledWith(500);
    const payload = res.json.mock.calls[0][0];
    expect(payload.error).toBe('Something went wrong. Please try again.');
  });

  it('returns 403 for a CORS rejection error', () => {
    const res = createMockRes();
    const req = { path: '/api/chat' } as Request;

    errorHandler(
      new Error('Origin https://evil.example is not allowed by CORS policy.'),
      req,
      res,
      jest.fn() as NextFunction,
    );

    expect(res.status).toHaveBeenCalledWith(403);
    expect(res.json.mock.calls[0][0].error).toBe('Origin not allowed.');
  });

  it('does nothing further if headers were already sent', () => {
    const res = createMockRes();
    res.headersSent = true;
    const req = { path: '/api/chat' } as Request;

    errorHandler(new Error('too late'), req, res, jest.fn() as NextFunction);

    expect(res.status).not.toHaveBeenCalled();
  });
});

describe('notFoundHandler', () => {
  it('returns a JSON 404 including the method and path', () => {
    const res = createMockRes();
    const req = { method: 'GET', path: '/api/nope' } as Request;

    notFoundHandler(req, res);

    expect(res.status).toHaveBeenCalledWith(404);
    expect(res.json.mock.calls[0][0].error).toContain('GET /api/nope');
  });
});
