import { ByokEncryptionNotConfiguredError } from '@/lib/byok/crypto';
import { loadDecryptedByok } from '@/lib/byok/service';
import { isSpellingContext } from '@/lib/chat/actions';
import { resolveRettsskrivingResult } from '@/lib/chat/rettskriving';
import { checkRateLimit } from '@/lib/rate-limit';
import { requireStemmePlus } from '@/lib/stemme-plus/entitlement';
import { getServerSupabase } from '@/lib/supabase-server';

export const dynamic = 'force-dynamic';
export const maxDuration = 60;

function clientIp(request: Request): string {
  return (
    request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ||
    request.headers.get('x-real-ip') ||
    'unknown'
  );
}

function logDecryptFailure(error: unknown): void {
  const message = error instanceof Error ? error.message : 'unknown decrypt error';
  if (/sk-|api[_-]?key|bearer\s+[a-z0-9-]+/i.test(message)) {
    console.error('[rettskriving] decrypt error (redacted)');
    return;
  }
  console.error('[rettskriving] decrypt error:', message);
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

  const session = await getServerSupabase();
  let credential = null;
  try {
    credential = await loadDecryptedByok(gate.userId, session);
  } catch (error) {
    if (error instanceof ByokEncryptionNotConfiguredError) {
      credential = null;
    } else {
      logDecryptFailure(error);
      return Response.json(
        { error: 'Kunne ikke lese den lagrede nøkkelen.' },
        { status: 502 },
      );
    }
  }

  const result = await resolveRettsskrivingResult({ draft, context, credential });
  if (!result.ok) {
    return Response.json(
      { error: result.error },
      { status: result.providerError ? 502 : 400 },
    );
  }

  return Response.json(result.result);
}
