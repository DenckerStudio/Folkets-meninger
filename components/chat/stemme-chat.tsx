'use client';

import { useMemo, useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useChat } from '@ai-sdk/react';
import { DefaultChatTransport, isToolUIPart } from 'ai';
import { Loader2, Send } from 'lucide-react';
import { EmptyState } from '@/components/dashboard/empty-state';
import { SurfaceCard } from '@/components/dashboard/surface-card';
import { Button } from '@/components/ui/button';
import { StemmePlusBadge } from '@/components/profile/stemme-plus-badge';
import { cn } from '@/lib/utils';
import { routes } from '@/lib/routes';
import type { ChatGateReason } from '@/lib/chat/overlay';

type StemmeChatProps = {
  gate: ChatGateReason;
  issueId?: string | null;
  issueTitle?: string | null;
  priceNok: number;
  checkoutConfigured: boolean;
  variant?: 'page' | 'panel';
};

function toolLabel(type: string): string {
  switch (type) {
    case 'tool-retrieveSakContext':
      return 'Henter sak og dokumentutdrag';
    case 'tool-searchUpdatedSources':
      return 'Søker oppdaterte kilder';
    case 'tool-helpRettsskriving':
      return 'Retter språk i kladden';
    case 'tool-listMatchingSaker':
      return 'Finner saker';
    default:
      return 'Bruker verktøy';
  }
}

export function StemmeChat({
  gate,
  issueId,
  issueTitle,
  priceNok,
  checkoutConfigured,
  variant = 'page',
}: StemmeChatProps) {
  const pathname = usePathname();
  const [input, setInput] = useState('');
  const compact = variant === 'panel';
  const transport = useMemo(
    () =>
      new DefaultChatTransport({
        api: '/api/chat',
        headers: issueId ? { 'x-sak-id': issueId } : undefined,
        body: issueId ? { issueId } : undefined,
      }),
    [issueId],
  );
  const { messages, sendMessage, status, error, stop } = useChat({ transport });
  const busy = status === 'submitted' || status === 'streaming';
  const emptyClassName = compact ? 'border-none bg-transparent px-4 py-8' : undefined;

  if (gate === 'login') {
    return (
      <EmptyState
        className={emptyClassName}
        title="Logg inn for å bruke AI-chat"
        description="AI-chat er en Stemme+-funksjon. Logg inn med e-post eller Google for å fortsette."
        action={
          <Link
            href={`${routes.login}?next=${encodeURIComponent(pathname || routes.utforsk)}`}
            className="inline-flex rounded-lg bg-primary px-3 py-2 text-sm font-medium text-primary-foreground"
          >
            Logg inn
          </Link>
        }
      />
    );
  }

  if (gate === 'free') {
    return (
      <EmptyState
        className={emptyClassName}
        title="AI-chat er en Stemme+-funksjon"
        description="Chatboten bruker din egen LLM-nøkkel og våre sakdata. Gratis brukere beholder stemme, utforsk og høringer — uten en ødelagt chat."
        action={
          <div className="space-y-3">
            <StemmePlusBadge size="md" />
            <p className="text-sm text-foreground">{priceNok} kr/mnd</p>
            <Link
              href={`${routes.minSide}?tab=stemme-plus`}
              className="inline-flex rounded-lg bg-primary px-3 py-2 text-sm font-medium text-primary-foreground"
            >
              {checkoutConfigured ? 'Gå til Stemme+' : 'Se Stemme+-status'}
            </Link>
          </div>
        }
      />
    );
  }

  if (gate === 'no-key') {
    return (
      <EmptyState
        className={emptyClassName}
        title="Lagre en LLM-nøkkel først"
        description="Stemme+ AI-chat kjører på nøkkelen din (OpenAI, Anthropic, AI Gateway eller OpenAI-kompatibel). Vi lagrer den kryptert og sender den aldri tilbake til nettleseren."
        action={
          <Link
            href={`${routes.minSide}?tab=stemme-plus`}
            className="inline-flex rounded-lg bg-primary px-3 py-2 text-sm font-medium text-primary-foreground"
          >
            Åpne nøkkelinnstillinger
          </Link>
        }
      />
    );
  }

  return (
    <SurfaceCard
      padded={false}
      className={cn('flex flex-col', compact ? 'min-h-0 flex-1 border-0 shadow-none' : 'min-h-[32rem]')}
    >
      <div className="border-b border-border px-4 py-3">
        <p className="text-sm text-muted-foreground">
          {issueId
            ? `Kontekst: ${issueTitle || `sak ${issueId}`}`
            : 'Spør om saker, dokumenter, kilder eller rettskriving av dine egne utkast.'}
        </p>
      </div>

      <div className="flex-1 space-y-4 overflow-y-auto px-4 py-4">
        {messages.length === 0 ? (
          <EmptyState
            className="border-none bg-transparent px-0 py-6"
            title="Ingen samtale ennå"
            description="Ingen samtaler lagres på serveren. Still et spørsmål om en sak, be om kilder, eller lim inn en kladd for rettskriving."
          />
        ) : null}

        {messages.map((message) => (
          <article
            key={message.id}
            className={
              message.role === 'user'
                ? 'ml-8 rounded-xl bg-muted/50 px-3 py-2 text-sm text-foreground'
                : 'mr-4 space-y-2 text-sm text-foreground'
            }
          >
            <p className="text-xs font-medium text-muted-foreground">
              {message.role === 'user' ? 'Du' : 'AI'}
            </p>
            {message.parts.map((part, index) => {
              if (part.type === 'text') {
                return (
                  <p key={`${message.id}-${index}`} className="whitespace-pre-wrap">
                    {part.text}
                  </p>
                );
              }
              if (isToolUIPart(part)) {
                const done = part.state === 'output-available';
                return (
                  <p
                    key={`${message.id}-${index}`}
                    className="rounded-lg border border-border bg-muted/30 px-2 py-1 text-xs text-muted-foreground"
                  >
                    {done ? 'Ferdig: ' : 'Jobber: '}
                    {toolLabel(part.type)}
                  </p>
                );
              }
              return null;
            })}
          </article>
        ))}
      </div>

      {error ? (
        <p className="px-4 text-sm text-destructive">
          {error.message || 'Noe gikk galt i samtalen.'}
        </p>
      ) : null}

      <form
        className="flex gap-2 border-t border-border p-3"
        onSubmit={(event) => {
          event.preventDefault();
          const text = input.trim();
          if (!text || busy) return;
          void sendMessage({ text });
          setInput('');
        }}
      >
        <input
          value={input}
          onChange={(event) => setInput(event.target.value)}
          placeholder="Spør om en sak, eller lim inn en kladd for rettskriving…"
          className="min-w-0 flex-1 rounded-lg border border-border bg-background px-3 py-2 text-sm text-foreground"
        />
        {busy ? (
          <Button type="button" variant="outline" onClick={() => stop()}>
            Stopp
          </Button>
        ) : (
          <Button type="submit" disabled={!input.trim()}>
            {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
            Send
          </Button>
        )}
      </form>
    </SurfaceCard>
  );
}
