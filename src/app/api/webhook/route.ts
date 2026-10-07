import { NextRequest, NextResponse, after } from 'next/server';
import { verifyLineSignature } from '@/lib/line/signature';
import { processWebhookEvents } from '@/lib/line/dispatcher';
import type { webhook } from '@line/bot-sdk';

export async function POST(request: NextRequest) {
  try {
    const body = await request.text();
    const signature = request.headers.get('x-line-signature');

    // 1. Validate signature against raw string before parsing
    if (!verifyLineSignature(body, signature)) {
      return NextResponse.json({ error: 'Invalid signature' }, { status: 401 });
    }

    // 2. Parse JSON payload
    let payload: webhook.CallbackRequest;
    try {
      payload = JSON.parse(body) as webhook.CallbackRequest;
    } catch {
      return NextResponse.json({ error: 'Invalid JSON payload' }, { status: 400 });
    }

    const events = Array.isArray(payload.events) ? payload.events : [];

    // 3. Delegate background execution via Next.js after()
    after(async () => {
      try {
        await processWebhookEvents(events);
      } catch (backgroundError) {
        console.error('Unhandled background error in webhook processing:', backgroundError);
      }
    });

    // 4. Return HTTP 200 immediately to LINE edge
    return NextResponse.json({ status: 'ok' }, { status: 200 });
  } catch (error) {
    console.error('Unhandled error in webhook ingress route:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
