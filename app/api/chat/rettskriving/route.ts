import { isSpellingContext, runRettsskriving } from '@/lib/chat/actions';
import { checkRateLimit } from '@/lib/rate-limit';
import { requireStemmePlus } from '@/lib/stemme-plus/entitlement';

export const dynamic = 'force-dynamic';

function clientIp(request: Request): string {
  return (
    request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ||
    request.headers.get('x-real-ip') ||
    'unknown'
  );
}

export async function POST(request: Request) {
  const gate = await requireStemmePlus();
  if (!gate.ok) {
    return Response.json({ error: gate.error }, { status: gate.status });
  }

  const ipRate = checkRateLimit(`chat-rettskriving:ip:${clientIp(request)}`, 20, 60_000);
  if (!ipRate.ok) {
    return Response.json(
      { error: 'For mange forespørsler. Prøv igjen om litt.' },
      { status: 429, headers: { 'Retry-After': String(ipRate.retryAfterSeconds) } },
    );
  }

  const userRate = checkRateLimit(`chat-rettskriving:user:${gate.userId}`, 20, 60_000);
  if (!userRate.ok) {
    return Response.json(
      { error: 'Du sender for mange forespørsler. Vent litt.' },
      { status: 429, headers: { 'Retry-After': String(userRate.retryAfterSeconds) } },
    );
  }

  let body: Record<string, unknown>;
  try {
    body = (await request.json()) as Record<string, unknown>;
  } catch {
    return Response.json({ error: 'Ugyldig forespørsel' }, { status: 400 });
  }

  const draft = typeof body.draft === 'string' ? body.draft : '';
  const context = typeof body.context === 'string' ? body.context : '';
  if (!isSpellingContext(context)) {
    return Response.json({ error: 'Velg hvor kladden skal brukes.' }, { status: 400 });
  }

  const result = runRettsskriving({ draft, context });
  if (!result.ok) {
    return Response.json({ error: result.error }, { status: 400 });
  }

  return Response.json(result.result);
}
