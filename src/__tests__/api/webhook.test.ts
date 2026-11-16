import { describe, it, expect, vi, beforeEach } from 'vitest';
import { NextRequest } from 'next/server';
import { POST, maxDuration } from '@/app/api/webhook/route';
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

  it('exports maxDuration configured to 60 for serverless execution (R2)', () => {
    expect(maxDuration).toBe(60);
  });

  it('returns 413 when payload exceeds maximum size limit (DoS hardening)', async () => {
    const request = new NextRequest('http://localhost:3000/api/webhook', {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        'content-length': '9999999',
        'x-line-signature': 'some-sig',
      },
      body: JSON.stringify({ events: [] }),
    });

    const response = await POST(request);
    expect(response.status).toBe(413);
    const body = await response.json();
    expect(body).toEqual({ error: 'Payload too large' });
  });

  it('returns 413 when body length exceeds 512KB even if content-length header is absent (chunked DoS hardening)', async () => {
    const request = new NextRequest('http://localhost:3000/api/webhook', {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        'x-line-signature': 'some-sig',
      },
      body: 'a'.repeat(512 * 1024 + 1),
    });

    const response = await POST(request);
    expect(response.status).toBe(413);
    const body = await response.json();
    expect(body).toEqual({ error: 'Payload too large' });
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
    expect(verifyLineSignature).toHaveBeenCalledWith(
      Buffer.from(JSON.stringify({ events: [] })),
      null,
    );
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
