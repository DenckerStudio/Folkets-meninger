import { NextResponse } from 'next/server';
import {
  ByokEncryptionNotConfiguredError,
} from '@/lib/byok/crypto';
import {
  isLlmProvider,
  looksLikeApiKey,
  normalizeBaseUrl,
  normalizeModel,
  providerNeedsBaseUrl,
} from '@/lib/byok/providers';
import {
  byokStorageReady,
  deleteByokCredential,
  getByokMeta,
  saveByokCredential,
} from '@/lib/byok/service';
import { requireStemmePlus } from '@/lib/stemme-plus/entitlement';

export const dynamic = 'force-dynamic';

export async function GET() {
  const gate = await requireStemmePlus();
  if (!gate.ok) {
    return NextResponse.json({ error: gate.error }, { status: gate.status });
  }

  const meta = await getByokMeta(gate.userId);
  return NextResponse.json({
    configured: Boolean(meta),
    encryptionReady: byokStorageReady(),
    credential: meta,
  });
}

export async function POST(request: Request) {
  const gate = await requireStemmePlus();
  if (!gate.ok) {
    return NextResponse.json({ error: gate.error }, { status: gate.status });
  }

  if (!byokStorageReady()) {
    return NextResponse.json(
      { error: 'Lagring av nøkler er ikke konfigurert (mangler BYOK_ENCRYPTION_KEY).' },
      { status: 503 },
    );
  }

  let body: Record<string, unknown>;
  try {
    body = (await request.json()) as Record<string, unknown>;
  } catch {
    return NextResponse.json({ error: 'Ugyldig forespørsel' }, { status: 400 });
  }

  if (!isLlmProvider(body.provider)) {
    return NextResponse.json({ error: 'Ugyldig leverandør' }, { status: 400 });
  }

  const apiKey = typeof body.apiKey === 'string' ? body.apiKey.trim() : '';
  if (!looksLikeApiKey(apiKey)) {
    return NextResponse.json(
      { error: 'Nøkkelen ser ugyldig ut. Lim inn en API-nøkkel uten mellomrom.' },
      { status: 400 },
    );
  }

  const model = normalizeModel(body.provider, body.model);
  const baseUrl = normalizeBaseUrl(body.provider, body.baseUrl);
  if (providerNeedsBaseUrl(body.provider) && !baseUrl) {
    return NextResponse.json(
      { error: 'OpenAI-kompatibel nøkkel krever en https-base-URL.' },
      { status: 400 },
    );
  }

  try {
    const credential = await saveByokCredential({
      userId: gate.userId,
      provider: body.provider,
      model,
      apiKey,
      baseUrl,
    });
    return NextResponse.json({ ok: true, credential });
  } catch (error) {
    if (error instanceof ByokEncryptionNotConfiguredError) {
      return NextResponse.json(
        { error: 'Lagring av nøkler er ikke konfigurert.' },
        { status: 503 },
      );
    }
    console.error('[byok] save failed');
    return NextResponse.json({ error: 'Kunne ikke lagre nøkkelen' }, { status: 500 });
  }
}

export async function DELETE() {
  const gate = await requireStemmePlus();
  if (!gate.ok) {
    return NextResponse.json({ error: gate.error }, { status: gate.status });
  }

  try {
    await deleteByokCredential(gate.userId);
    return NextResponse.json({ ok: true });
  } catch {
    return NextResponse.json({ error: 'Kunne ikke slette nøkkelen' }, { status: 500 });
  }
}
