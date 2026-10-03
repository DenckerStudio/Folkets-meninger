import { NextResponse } from 'next/server';
import { cronAuthResponse, verifyCronAuth } from '@/lib/cron-auth';
import { deliverOpsNotify, parseOpsNotifyPayload } from '@/lib/n8n/ops-notify';

export const dynamic = 'force-dynamic';

export async function POST(request: Request) {
  const auth = verifyCronAuth(request);
  if (!auth.ok) {
    return cronAuthResponse(auth);
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Ugyldig JSON' }, { status: 400 });
  }

  const parsed = parseOpsNotifyPayload(body);
  if ('error' in parsed) {
    return NextResponse.json({ error: parsed.error }, { status: 400 });
  }

  const result = await deliverOpsNotify(parsed);
  return NextResponse.json({ ok: true, ...result });
}
