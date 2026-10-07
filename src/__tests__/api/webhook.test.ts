import { describe, it, expect, vi, beforeEach } from 'vitest';
import { NextRequest } from 'next/server';
import { POST } from '@/app/api/webhook/route';
import { verifyLineSignature } from '@/lib/line/signature';
import { processWebhookEvents } from '@/lib/line/dispatcher';
import { after } from 'next/server';

vi.mock('@/lib/line/signature', () => ({
  verifyLineSignature: vi.fn(),
}));

vi.mock('@/lib/line/dispatcher', () => ({
  processWebhookEvents: vi.fn(),
}));

vi.mock('next/server', async (importOriginal) => {
  const actual = await importOriginal<typeof import('next/server')>();
  return {
    ...actual,
    after: vi.fn((cb: () => void | Promise<void>) => {
      // Execute callback or record call
      if (typeof cb === 'function') {
        cb();
      }
    }),
  };
});

describe('POST /api/webhook', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('returns 401 when signature verification fails', async () => {
    vi.mocked(verifyLineSignature).mockReturnValue(false);

    const request = new NextRequest('http://localhost:3000/api/webhook', {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        'x-line-signature': 'invalid-sig',
      },
      body: JSON.stringify({ events: [] }),
    });

    const response = await POST(request);
    const body = await response.json();

    expect(response.status).toBe(401);
    expect(body).toEqual({ error: 'Invalid signature' });
    expect(after).not.toHaveBeenCalled();
    expect(processWebhookEvents).not.toHaveBeenCalled();
  });

  it('returns 401 when x-line-signature header is missing', async () => {
    vi.mocked(verifyLineSignature).mockReturnValue(false);

    const request = new NextRequest('http://localhost:3000/api/webhook', {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
      },
      body: JSON.stringify({ events: [] }),
    });

    const response = await POST(request);
    const body = await response.json();

    expect(response.status).toBe(401);
    expect(body).toEqual({ error: 'Invalid signature' });
    expect(verifyLineSignature).toHaveBeenCalledWith(JSON.stringify({ events: [] }), null);
    expect(after).not.toHaveBeenCalled();
  });

  it('returns 400 when payload is not valid JSON', async () => {
    vi.mocked(verifyLineSignature).mockReturnValue(true);

    const request = new NextRequest('http://localhost:3000/api/webhook', {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        'x-line-signature': 'valid-sig',
      },
      body: '{ not-a-json',
    });

    const response = await POST(request);
    const body = await response.json();

    expect(response.status).toBe(400);
    expect(body).toEqual({ error: 'Invalid JSON payload' });
    expect(after).not.toHaveBeenCalled();
  });

  it('returns 200 immediately and schedules background execution for valid requests', async () => {
    vi.mocked(verifyLineSignature).mockReturnValue(true);

    const payload = {
      destination: 'U12345678901234567890123456789012',
      events: [
        {
          type: 'message',
          replyToken: 'token-abc',
          message: { id: 'm1', type: 'text', text: 'สวัสดี' },
        },
      ],
    };

    const request = new NextRequest('http://localhost:3000/api/webhook', {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        'x-line-signature': 'valid-sig',
      },
      body: JSON.stringify(payload),
    });

    const response = await POST(request);
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body).toEqual({ status: 'ok' });
    expect(after).toHaveBeenCalledTimes(1);
    expect(processWebhookEvents).toHaveBeenCalledWith(payload.events);
  });

  it('handles payload without events property gracefully', async () => {
    vi.mocked(verifyLineSignature).mockReturnValue(true);

    const request = new NextRequest('http://localhost:3000/api/webhook', {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        'x-line-signature': 'valid-sig',
      },
      body: JSON.stringify({ destination: 'U123' }),
    });

    const response = await POST(request);
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body).toEqual({ status: 'ok' });
    expect(after).toHaveBeenCalledTimes(1);
    expect(processWebhookEvents).toHaveBeenCalledWith([]);
  });
});
