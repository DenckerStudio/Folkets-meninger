import { NextResponse } from 'next/server';
import { listOllamaModels } from '@/lib/byok/ollama-list.server';
import { normalizeBaseUrl } from '@/lib/byok/providers';
import {
  BYOK_OLLAMA_PROBE_ERROR_NB,
  BYOK_OLLAMA_PROBE_HTTP_STATUS,
} from '@/lib/byok/url-guard';
import { byokOutboundForUser } from '@/lib/byok/outbound';
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

function probeFailure(): NextResponse {
  return NextResponse.json(
    { error: BYOK_OLLAMA_PROBE_ERROR_NB },
    { status: BYOK_OLLAMA_PROBE_HTTP_STATUS },
  );
}

export async function GET(request: Request) {
  try {
    const gate = await requireStemmePlus();
    if (!gate.ok) {
      return NextResponse.json({ error: gate.error }, { status: gate.status });
    }

    const ipRate = await checkRateLimit(
      `byok-ollama-models:ip:${clientIp(request)}`,
      30,
      60_000,
    );
    if (!ipRate.ok) {
      return NextResponse.json(
        { error: 'For mange forespørsler. Prøv igjen om litt.' },
        { status: 429, headers: { 'Retry-After': String(ipRate.retryAfterSeconds) } },
      );
    }

    const userRate = await checkRateLimit(`byok-ollama-models:user:${gate.userId}`, 30, 60_000);
    if (!userRate.ok) {
      return NextResponse.json(
        { error: 'For mange forespørsler. Prøv igjen om litt.' },
        { status: 429, headers: { 'Retry-After': String(userRate.retryAfterSeconds) } },
      );
    }

    const raw = new URL(request.url).searchParams.get('baseUrl') ?? '';
    const baseUrl = normalizeBaseUrl('ollama', raw);
    if (!baseUrl) {
      return probeFailure();
    }

    const outbound = await byokOutboundForUser(gate.userId);
    const result = await listOllamaModels(baseUrl, { outbound });
    if (!result.ok) {
      return probeFailure();
    }

    return NextResponse.json({ models: result.models });
  } catch (error) {
    console.warn(
      '[byok/ollama/models] probe failed:',
      error instanceof Error ? error.message : error,
    );
    return probeFailure();
  }
}
