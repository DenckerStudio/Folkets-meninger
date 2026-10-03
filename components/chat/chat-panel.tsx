'use client';

import { useEffect, useId, useState } from 'react';
import { createPortal } from 'react-dom';
import { Loader2, X } from 'lucide-react';
import { StemmeChat } from '@/components/chat/stemme-chat';
import { useChatOverlay } from '@/components/chat/chat-overlay-context';
import { STEMME_PLUS_MONTHLY_PRICE_NOK } from '@/lib/stemme-plus/constants';
import { resolveChatGate, type ChatGateReason } from '@/lib/chat/overlay';

type PanelMeta = {
  priceNok: number;
  checkoutConfigured: boolean;
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
    const load = async () => {
      setGate('loading');
      setError(null);
      try {
        const res = await fetch('/api/stemme-plus/status', { cache: 'no-store' });
        if (cancelled) return;
        if (res.status === 401) {
          setGate(
            resolveChatGate({
              authenticated: false,
              hasStemmePlus: false,
              hasByok: false,
            }),
          );
          setMeta({
            priceNok: STEMME_PLUS_MONTHLY_PRICE_NOK,
            checkoutConfigured: false,
          });
          return;
        }

        const json = (await res.json()) as {
          error?: string;
          tier?: string;
          has_byok?: boolean;
          monthly_price_nok?: number;
          checkout_configured?: boolean;
        };
        if (!res.ok) {
          throw new Error(json.error || 'Kunne ikke hente tilgang til AI-chat.');
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
        });
      } catch (loadError) {
        if (!cancelled) {
          setError(loadError instanceof Error ? loadError.message : 'Kunne ikke hente tilgang til AI-chat.');
        }
      }
    };

    void load();
    return () => {
      cancelled = true;
    };
  }, [open]);

  if (!open || !mounted) return null;

  return createPortal(
    <div className="fixed inset-0 z-[60] flex items-end justify-end p-0 sm:p-4 xl:items-stretch xl:justify-end xl:p-6">
      <button
        type="button"
        className="absolute inset-0 bg-foreground/40 backdrop-blur-[2px]"
        aria-label="Lukk AI-chat"
        onClick={closeChat}
      />
      <section
        id="stemme-chat-panel"
        data-chat-panel=""
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        aria-describedby={descriptionId}
        className="relative z-10 flex h-[min(92vh,44rem)] w-full max-w-full flex-col overflow-hidden rounded-t-2xl border border-border bg-card shadow-xl sm:h-[min(88vh,42rem)] sm:max-w-md sm:rounded-2xl xl:my-2 xl:h-auto xl:max-h-[calc(100vh-4rem)]"
      >
        <header className="flex shrink-0 items-start justify-between gap-3 border-b border-border px-4 py-3">
          <div className="min-w-0">
            <h2 id={titleId} className="text-base font-semibold text-foreground">
              AI-chat
            </h2>
            <p id={descriptionId} className="mt-1 text-sm text-muted-foreground">
              Snakk om saker, kilder og rettskriving — på nøkkelen din.
            </p>
          </div>
          <button
            type="button"
            onClick={closeChat}
            className="rounded-lg p-2 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
            aria-label="Lukk AI-chat"
          >
            <X className="h-5 w-5" />
          </button>
        </header>

        <div className="flex min-h-0 flex-1 flex-col">
          {error ? <p className="px-4 pt-3 text-sm text-destructive">{error}</p> : null}
          {gate === 'loading' && !error ? (
            <p className="flex flex-1 items-center justify-center gap-2 text-sm text-muted-foreground">
              <Loader2 className="h-4 w-4 animate-spin" />
              Laster AI-chat…
            </p>
          ) : gate === 'loading' ? null : (
            <StemmeChat
              key={issue?.issueId ?? 'general'}
              gate={gate}
              issueId={issue?.issueId ?? null}
              issueTitle={issue?.issueTitle ?? null}
              priceNok={meta.priceNok}
              checkoutConfigured={meta.checkoutConfigured}
              variant="panel"
            />
          )}
        </div>
      </section>
    </div>,
    document.body,
  );
}
