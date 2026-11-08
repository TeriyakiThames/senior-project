import { describe, it, expect, vi } from 'vitest';
import middleware from '@/middleware';
import { NextRequest } from 'next/server';

vi.mock('next-intl/middleware', () => {
  return {
    default: vi.fn(() => (req: NextRequest) => {
      return new Response('intl response', { status: 200 });
    }),
  };
});

describe('Security Middleware (middleware.ts)', () => {
  it('blocks double-slash open redirect attempts (//evil.com)', () => {
    const req = new NextRequest('http://localhost:3000//evil.com/liff');
    const res = middleware(req);
    expect(res.status).toBe(400);
  });

  it('blocks backslash host injection attempts (\\evil.com)', () => {
    const req = new NextRequest('http://localhost:3000/liff/\\evil.com');
    const res = middleware(req);
    expect(res.status).toBe(400);
  });

  it('blocks encoded backslash and path traversal attempts (%5c, %2f, %00)', () => {
    const reqBackslash = new NextRequest('http://localhost:3000/liff/%5cevil.com');
    expect(middleware(reqBackslash).status).toBe(400);

    const reqNull = new NextRequest('http://localhost:3000/liff/%00evil');
    expect(middleware(reqNull).status).toBe(400);

    const reqSlash = new NextRequest('http://localhost:3000/liff/%2fevil');
    expect(middleware(reqSlash).status).toBe(400);
  });

  it('allows safe legitimate paths through to intlMiddleware', () => {
    const req = new NextRequest('http://localhost:3000/th/liff');
    const res = middleware(req);
    expect(res.status).toBe(200);
  });
});
