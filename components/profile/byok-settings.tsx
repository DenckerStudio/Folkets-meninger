'use client';

import { useState } from 'react';
import { Loader2, Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  DEFAULT_MODELS,
  LLM_PROVIDERS,
  PROVIDER_LABELS,
  type LlmProvider,
} from '@/lib/byok/providers';

export type ByokMetaView = {
  provider: LlmProvider;
  model: string;
  keyLast4: string;
} | null;

type ByokSettingsProps = {
  encryptionReady: boolean;
  initial: ByokMetaView;
};

export function ByokSettings({ encryptionReady, initial }: ByokSettingsProps) {
  const [provider, setProvider] = useState<LlmProvider>(initial?.provider ?? 'openai');
  const [model, setModel] = useState(initial?.model ?? DEFAULT_MODELS.openai);
  const [baseUrl, setBaseUrl] = useState('');
  const [apiKey, setApiKey] = useState('');
  const [saved, setSaved] = useState<ByokMetaView>(initial);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const onProviderChange = (next: LlmProvider) => {
    setProvider(next);
    setModel(DEFAULT_MODELS[next]);
  };

  const save = async () => {
    setBusy(true);
    setError(null);
    setMessage(null);
    try {
      const res = await fetch('/api/byok', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          provider,
          model,
          apiKey,
          baseUrl: provider === 'openai_compatible' ? baseUrl : undefined,
        }),
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error(typeof json.error === 'string' ? json.error : 'Kunne ikke lagre nøkkelen');
      }
      setApiKey('');
      setSaved({
        provider: json.credential.provider,
        model: json.credential.model,
        keyLast4: json.credential.keyLast4,
      });
      setMessage('Nøkkelen er lagret. Den sendes aldri tilbake til nettleseren.');
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Kunne ikke lagre nøkkelen');
    } finally {
      setBusy(false);
    }
  };

  const remove = async () => {
    setBusy(true);
    setError(null);
    setMessage(null);
    try {
      const res = await fetch('/api/byok', { method: 'DELETE' });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error(typeof json.error === 'string' ? json.error : 'Kunne ikke slette nøkkelen');
      }
      setSaved(null);
      setMessage('Nøkkelen er slettet.');
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Kunne ikke slette nøkkelen');
    } finally {
      setBusy(false);
    }
  };

  if (!encryptionReady) {
    return (
      <p className="rounded-xl border border-dashed border-border bg-muted/30 px-4 py-3 text-sm text-muted-foreground">
        Kryptert nøkkel-lagring er ikke konfigurert i dette miljøet (`BYOK_ENCRYPTION_KEY` mangler).
      </p>
    );
  }

  return (
    <div className="space-y-4">
      <div>
        <h4 className="text-sm font-semibold text-foreground">Din LLM-nøkkel (BYOK)</h4>
        <p className="mt-1 text-sm text-muted-foreground">
          Nøkkelen krypteres på serveren og brukes bare til Stemme+ AI-chat. Vi viser aldri den
          fulle nøkkelen etter lagring.
        </p>
      </div>

      {saved ? (
        <p className="text-sm text-foreground">
          Lagret {PROVIDER_LABELS[saved.provider]} · {saved.model} · slutter på {saved.keyLast4}
        </p>
      ) : (
        <p className="text-sm text-muted-foreground">Ingen nøkkel er lagret ennå.</p>
      )}

      <div className="grid gap-3 sm:grid-cols-2">
        <label className="space-y-1 text-sm">
          <span className="text-muted-foreground">Leverandør</span>
          <select
            value={provider}
            onChange={(event) => onProviderChange(event.target.value as LlmProvider)}
            className="w-full rounded-lg border border-border bg-background px-3 py-2 text-foreground"
          >
            {LLM_PROVIDERS.map((item) => (
              <option key={item} value={item}>
                {PROVIDER_LABELS[item]}
              </option>
            ))}
          </select>
        </label>
        <label className="space-y-1 text-sm">
          <span className="text-muted-foreground">Modell</span>
          <input
            value={model}
            onChange={(event) => setModel(event.target.value)}
            className="w-full rounded-lg border border-border bg-background px-3 py-2 text-foreground"
            placeholder={DEFAULT_MODELS[provider]}
          />
        </label>
      </div>

      {provider === 'openai_compatible' ? (
        <label className="block space-y-1 text-sm">
          <span className="text-muted-foreground">Base-URL (https)</span>
          <input
            value={baseUrl}
            onChange={(event) => setBaseUrl(event.target.value)}
            className="w-full rounded-lg border border-border bg-background px-3 py-2 text-foreground"
            placeholder="https://api.example.com/v1"
          />
        </label>
      ) : null}

      <label className="block space-y-1 text-sm">
        <span className="text-muted-foreground">API-nøkkel</span>
        <input
          type="password"
          value={apiKey}
          onChange={(event) => setApiKey(event.target.value)}
          autoComplete="off"
          className="w-full rounded-lg border border-border bg-background px-3 py-2 text-foreground"
          placeholder={saved ? `Ny nøkkel (erstatter …${saved.keyLast4})` : 'Lim inn nøkkelen'}
        />
      </label>

      <div className="flex flex-wrap gap-2">
        <Button type="button" onClick={() => void save()} disabled={busy || !apiKey.trim()}>
          {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
          {saved ? 'Bytt nøkkel' : 'Lagre nøkkel'}
        </Button>
        {saved ? (
          <Button type="button" variant="outline" onClick={() => void remove()} disabled={busy}>
            <Trash2 className="h-4 w-4" data-icon="inline-start" />
            Slett nøkkel
          </Button>
        ) : null}
      </div>

      {message ? <p className="text-sm text-brand">{message}</p> : null}
      {error ? <p className="text-sm text-destructive">{error}</p> : null}
    </div>
  );
}
