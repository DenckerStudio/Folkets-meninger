import { NextResponse } from 'next/server';
import {
  ByokEncryptionNotConfiguredError,
} from '@/lib/byok/crypto';
import { listOllamaModels, modelExists } from '@/lib/byok/ollama';
import {
  isLlmProvider,
  invalidApiKeyMessage,
  looksLikeApiKey,
  normalizeBaseUrl,
  normalizeModel,
  OLLAMA_PLACEHOLDER_API_KEY,
  providerNeedsApiKey,
  providerNeedsBaseUrl,
} from '@/lib/byok/providers';
import {
  byokStorageReady,
  deleteByokCredential,
  getByokMeta,
  saveByokCredential,
  updateByokModel,
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

  const rawInput = typeof body.apiKey === 'string' ? body.apiKey : '';
  let apiKey = rawInput.trim();
  if (providerNeedsApiKey(body.provider)) {
    if (!looksLikeApiKey(apiKey)) {
      return NextResponse.json({ error: invalidApiKeyMessage(rawInput) }, { status: 400 });
    }
  } else if (!apiKey) {
    // Ollama often runs without auth; store a stable placeholder so encryption/last4 still work.
    apiKey = OLLAMA_PLACEHOLDER_API_KEY;
  } else if (/\s/.test(apiKey) || apiKey.length > 512) {
    return NextResponse.json({ error: invalidApiKeyMessage(rawInput) }, { status: 400 });
  }

  const model = normalizeModel(body.provider, body.model);
  const baseUrl = normalizeBaseUrl(body.provider, body.baseUrl);
  if (providerNeedsBaseUrl(body.provider) && !baseUrl) {
    const hint =
      body.provider === 'ollama'
        ? 'Ollama krever en base-URL (http:// eller https://), f.eks. http://localhost:11434/v1.'
        : 'OpenAI-kompatibel nøkkel krever en https-base-URL.';
    return NextResponse.json({ error: hint }, { status: 400 });
  }

  if (body.provider === 'ollama' && baseUrl) {
    const available = await listOllamaModels(baseUrl);
    if (!available.ok) {
      return NextResponse.json({ error: available.error }, { status: 400 });
    }
    if (!modelExists(available.models, model)) {
      const preview = available.models.slice(0, 5).join(', ');
      const suffix = available.models.length > 5 ? ' …' : '';
      return NextResponse.json(
        {
          error: `Modellen «${model}» finnes ikke på Ollama-serveren. Tilgjengelige: ${preview}${suffix}`,
        },
        { status: 400 },
      );
    }
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
    console.error('[byok] save failed:', error instanceof Error ? error.message : error);
    return NextResponse.json({ error: 'Kunne ikke lagre nøkkelen' }, { status: 500 });
  }
}

/** Switch the model on an already stored credential without re-entering the key. */
export async function PATCH(request: Request) {
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

  if (typeof body.model !== 'string' || !body.model.trim()) {
    return NextResponse.json({ error: 'Velg en modell.' }, { status: 400 });
  }

  const meta = await getByokMeta(gate.userId);
  if (!meta) {
    return NextResponse.json({ error: 'Ingen nøkkel er lagret ennå.' }, { status: 404 });
  }

  const model = normalizeModel(meta.provider, body.model);

  if (meta.provider === 'ollama') {
    if (!meta.baseUrl) {
      return NextResponse.json(
        { error: 'Ollama mangler base-URL. Lagre nøkkelen på nytt med en gyldig base-URL.' },
        { status: 400 },
      );
    }
    const available = await listOllamaModels(meta.baseUrl);
    if (!available.ok) {
      return NextResponse.json({ error: available.error }, { status: 400 });
    }
    if (!modelExists(available.models, model)) {
      const preview = available.models.slice(0, 5).join(', ');
      const suffix = available.models.length > 5 ? ' …' : '';
      return NextResponse.json(
        {
          error: `Modellen «${model}» finnes ikke på Ollama-serveren. Tilgjengelige: ${preview}${suffix}`,
        },
        { status: 400 },
      );
    }
  }

  try {
    const credential = await updateByokModel({ userId: gate.userId, model });
    if (!credential) {
      return NextResponse.json({ error: 'Ingen nøkkel er lagret ennå.' }, { status: 404 });
    }
    return NextResponse.json({ ok: true, credential });
  } catch (error) {
    console.error(
      '[byok] model switch failed:',
      error instanceof Error ? error.message : error,
    );
    return NextResponse.json({ error: 'Kunne ikke bytte modell' }, { status: 500 });
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
