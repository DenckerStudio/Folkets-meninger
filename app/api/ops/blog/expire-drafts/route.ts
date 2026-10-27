import { NextResponse } from 'next/server';
import { cronAuthResponse } from '@/lib/cron-auth';
import { expireStaleBlogDrafts } from '@/lib/blog/expire-stale-drafts';
import { verifyOpsSecret } from '@/lib/ops-auth';

export const dynamic = 'force-dynamic';

export async function POST(request: Request) {
  const auth = verifyOpsSecret(request);
  if (!auth.ok) {
    return cronAuthResponse(auth);
  }

  let body: unknown = {};
  try {
    const text = await request.text();
    if (text.trim()) {
      body = JSON.parse(text) as unknown;
    }
  } catch {
    return NextResponse.json({ error: 'Ugyldig JSON' }, { status: 400 });
  }

  const dryRun =
    typeof body === 'object' &&
    body !== null &&
    !Array.isArray(body) &&
    (body as { dryRun?: unknown }).dryRun === true;

  try {
    const result = await expireStaleBlogDrafts({ dryRun });
    return NextResponse.json(result);
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Uventet feil';
    if (message.includes('CMS er ikke konfigurert')) {
      return NextResponse.json({ error: message }, { status: 503 });
    }
    console.error('[ops/blog/expire-drafts]', error);
    return NextResponse.json({ error: 'Uventet serverfeil ved utløp av bloggutkast' }, { status: 500 });
  }
}
