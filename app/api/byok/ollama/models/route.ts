import { NextResponse } from 'next/server';
import { listOllamaModels } from '@/lib/byok/ollama';
import { normalizeBaseUrl } from '@/lib/byok/providers';
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

  const result = await listOllamaModels(baseUrl);
  if (!result.ok) {
    return NextResponse.json({ error: result.error }, { status: 400 });
  }

  return NextResponse.json({ models: result.models });
}
