import { runUpdatedSourceSearch } from '@/lib/chat/actions';
import { checkRateLimit } from '@/lib/rate-limit';
import { requireStemmePlus } from '@/lib/stemme-plus/entitlement';
import { trustedClientIp } from '@/lib/trusted-client-ip';

export const dynamic = 'force-dynamic';

export async function POST(request: Request) {
  const gate = await requireStemmePlus();
  if (!gate.ok) {
    return Response.json({ error: gate.error }, { status: gate.status });
  }

  const ipRate = await checkRateLimit(
    `chat-sources:ip:${trustedClientIp(request)}`,
    20,
    60_000,
  );
  if (!ipRate.ok) {
    return Response.json(
      { error: 'For mange forespørsler. Prøv igjen om litt.' },
      { status: 429, headers: { 'Retry-After': String(ipRate.retryAfterSeconds) } },
    );
  }

  const userRate = await checkRateLimit(`chat-sources:user:${gate.userId}`, 20, 60_000);
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

  const query = typeof body.query === 'string' ? body.query : '';
  const result = await runUpdatedSourceSearch(query);
  if (!result.ok && !result.unavailable) {
    return Response.json({ error: result.error, unavailable: false, results: [] }, { status: 400 });
  }

  return Response.json({
    unavailable: result.unavailable,
    error: result.ok ? undefined : result.error,
    results: result.results,
  });
}
