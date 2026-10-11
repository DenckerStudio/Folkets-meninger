import { NextResponse } from 'next/server';
import { listOllamaModels } from '@/lib/byok/ollama';
import { byokStorageReady, getByokMeta } from '@/lib/byok/service';
import { requireStemmePlus } from '@/lib/stemme-plus/entitlement';

export const dynamic = 'force-dynamic';

/**
 * Model list for the credential the user already stored, so the chat header and
 * the LLM settings can offer a dropdown without exposing `base_url` to the browser.
 */
export async function GET() {
  const gate = await requireStemmePlus();
  if (!gate.ok) {
    return NextResponse.json({ error: gate.error }, { status: gate.status });
  }

  if (!byokStorageReady()) {
    return NextResponse.json({ models: [], error: 'Nøkkel-lagring er ikke konfigurert.' });
  }

  const meta = await getByokMeta(gate.userId);
  if (!meta) {
    return NextResponse.json({ models: [] });
  }

  if (meta.provider === 'ollama' && meta.baseUrl) {
    const available = await listOllamaModels(meta.baseUrl);
    if (!available.ok) {
      return NextResponse.json({ models: [], error: available.error });
    }
    return NextResponse.json({ models: available.models });
  }

  return NextResponse.json({ models: [] });
}