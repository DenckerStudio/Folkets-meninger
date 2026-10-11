'use client';

import { useEffect, useId, useState } from 'react';
import { createPortal } from 'react-dom';
import { Loader2 } from 'lucide-react';
import { ModelPicker } from '@/components/byok/model-picker';
import { StemmeChat } from '@/components/chat/stemme-chat';
import { useChatOverlay } from '@/components/chat/chat-overlay-context';
import { AiAssistantCard } from '@/components/ui/ai-assistant-card';
import { STEMME_PLUS_MONTHLY_PRICE_NOK } from '@/lib/stemme-plus/constants';
import { resolveChatGate, type ChatGateReason } from '@/lib/chat/overlay';
import type { LlmProvider } from '@/lib/byok/providers';

const STATUS_LOAD_TIMEOUT_MS = 8000;

function guestGate(): ChatGateReason {
  return resolveChatGate({
    authenticated: false,
    hasStemmePlus: false,
    hasByok: false,
  });
}

type PanelMeta = {
  priceNok: number;
  checkoutConfigured: boolean;
  provider: LlmProvider | null;
  model: string | null;
};

export function ChatPanel() {
  const { open, closeChat, issue } = useChatOverlay();
  const titleId = useId();
  const descriptionId = useId();
  const [mounted, setMounted] = useState(false);
  const [gate, setGate] = useState<ChatGateReason | 'loading'>('loading');
  const [meta, setMeta] = useState<PanelMeta>({
    priceNok: STEMME_PLUS_MONTHLY_PRICE_NOK,
    checkoutConfigured: false,
    provider: null,
    model: null,
  });
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    if (!open) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = prev;
    };
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') closeChat();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, closeChat]);

  useEffect(() => {
    if (!open) return;

    let cancelled = false;
    const controller = new AbortController();
    const timeout = window.setTimeout(() => controller.abort(), STATUS_LOAD_TIMEOUT_MS);
    const load = async () => {
      setGate('loading');
      setError(null);
      try {
        const res = await fetch('/api/stemme-plus/status', {
          cache: 'no-store',
          signal: controller.signal,
        });
        if (cancelled) return;
        if (res.status === 401) {
          setGate(guestGate());
          setMeta({
            priceNok: STEMME_PLUS_MONTHLY_PRICE_NOK,
            checkoutConfigured: false,
            provider: null,
            model: null,
          });
          return;
        }

        const json = (await res.json()) as {
          error?: string;
          tier?: string;
          has_byok?: boolean;
          monthly_price_nok?: number;
          checkout_configured?: boolean;
          byok?: { provider?: LlmProvider; model?: string } | null;
        };
        if (!res.ok) {
          throw new Error(json.error || 'Kunne ikke hente tilgang til chat.');
        }

        setGate(
          resolveChatGate({
            authenticated: true,
            hasStemmePlus: json.tier === 'stemme_plus',
            hasByok: Boolean(json.has_byok),
          }),
        );
        setMeta({
          priceNok: json.monthly_price_nok ?? STEMME_PLUS_MONTHLY_PRICE_NOK,
          checkoutConfigured: Boolean(json.checkout_configured),
          provider: json.byok?.provider ?? null,
          model: json.byok?.model ?? null,
        });
      } catch (loadError) {
        if (cancelled) return;
        setGate(guestGate());
        setMeta({
          priceNok: STEMME_PLUS_MONTHLY_PRICE_NOK,
          checkoutConfigured: false,
          provider: null,
          model: null,
        });
        if (!(loadError instanceof DOMException && loadError.name === 'AbortError')) {
          setError(loadError instanceof Error ? loadError.message : 'Kunne ikke hente tilgang til chat.');
        }
      }
    };

    void load();
    return () => {
      cancelled = true;
      controller.abort();
      window.clearTimeout(timeout);
    };
  }, [open]);

  if (!open || !mounted) return null;

  const readyGate = gate !== 'loading' ? gate : null;

  return createPortal(
    <div className="fixed inset-0 z-[90] flex items-end justify-end p-0 sm:p-4 xl:items-stretch xl:justify-end xl:p-6">
      <button
        type="button"
        className="absolute inset-0 bg-foreground/40 backdrop-blur-[2px]"
        aria-label="Lukk chat"
        onClick={closeChat}
      />
      <section
        id="stemme-chat-panel"
        data-chat-panel=""
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        aria-describedby={descriptionId}
        className="relative z-10 flex h-[min(92vh,44rem)] w-full max-w-full flex-col sm:h-[min(88vh,42rem)] sm:max-w-md xl:my-2 xl:h-auto xl:max-h-[calc(100vh-4rem)]"
      >
        <AiAssistantCard
          titleId={titleId}
          descriptionId={descriptionId}
          title="Chat"
          description="Sakskontekst og samtale på nøkkelen din. Rettskriv og kilder ligger i meningskomponisten."
          onClose={closeChat}
          headerExtra={
            readyGate === 'ready' && meta.provider && meta.model ? (
              <div className="mt-2 max-w-[16rem]">
                <ModelPicker
                  provider={meta.provider}
                  model={meta.model}
                  size="sm"
                  label="Aktiv modell"
                  onSwitched={(next) => setMeta((current) => ({ ...current, model: next }))}
                />
              </div>
            ) : null
          }
          className="h-full max-h-full"
        >
          {error ? <p className="px-0 pt-1 text-sm text-destructive">{error}</p> : null}
          {gate === 'loading' && !error ? (
            <p className="flex flex-1 items-center justify-center gap-2 text-sm text-muted-foreground">
              <Loader2 className="h-4 w-4 animate-spin" />
              Laster chat…
            </p>
          ) : null}
          {readyGate ? (
            <StemmeChat
              key={issue?.issueId ?? 'general'}
              gate={readyGate}
              issueId={issue?.issueId ?? null}
              issueTitle={issue?.issueTitle ?? null}
              priceNok={meta.priceNok}
              checkoutConfigured={meta.checkoutConfigured}
              variant="panel"
              embedded
              provider={meta.provider}
              model={meta.model}
              onModelSwitched={(next) => setMeta((current) => ({ ...current, model: next }))}
            />
          ) : null}
        </AiAssistantCard>
      </section>
    </div>,
    document.body,
  );
}
