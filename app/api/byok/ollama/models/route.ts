import { NextResponse } from 'next/server';
import { listOllamaModels } from '@/lib/byok/ollama-list.server';
import { normalizeBaseUrl } from '@/lib/byok/providers';
import {
  BYOK_BASE_URL_REJECTED_NB,
  BYOK_OLLAMA_UNREACHABLE_NB,
  ByokUrlRejectedError,
  assertSafeByokBaseUrl,
} from '@/lib/byok/url-guard';
import { byokOutboundForUser } from '@/lib/byok/outbound';
import { requireStemmePlus } from '@/lib/stemme-plus/entitlement';

export const dynamic = 'force-dynamic';

export async function GET(request: Request) {
  const gate = await requireStemmePlus();
  if (!gate.ok) {
    return NextResponse.json({ error: gate.error }, { status: gate.status });
  }

  const raw = new URL(request.url).searchParams.get('baseUrl') ?? '';
  const baseUrl = normalizeBaseUrl('ollama', raw);
  if (!baseUrl) {
    return NextResponse.json(
      { error: 'Ugyldig Ollama-URL. Bruk http:// eller https://.' },
      { status: 400 },
    );
  }

  const outbound = await byokOutboundForUser(gate.userId);
  try {
    await assertSafeByokBaseUrl(baseUrl, outbound);
  } catch (error) {
    if (error instanceof ByokUrlRejectedError) {
      return NextResponse.json({ error: BYOK_BASE_URL_REJECTED_NB }, { status: 400 });
    }
    throw error;
  }

  const result = await listOllamaModels(baseUrl, { outbound });
  if (!result.ok) {
    return NextResponse.json({ error: BYOK_OLLAMA_UNREACHABLE_NB }, { status: 400 });
  }

  return NextResponse.json({ models: result.models });
}
