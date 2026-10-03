'use client';

import { useMemo, useState } from 'react';
import Link from 'next/link';
import { useChat } from '@ai-sdk/react';
import { DefaultChatTransport, isToolUIPart } from 'ai';
import { Loader2, Send } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { StemmePlusBadge } from '@/components/profile/stemme-plus-badge';
import { routes } from '@/lib/routes';

type ChatGateReason = 'free' | 'no-key' | 'ready';

type StemmeChatProps = {
  gate: ChatGateReason;
  issueId?: string | null;
  issueTitle?: string | null;
  priceNok: number;
  checkoutConfigured: boolean;
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
}: StemmeChatProps) {
  const [input, setInput] = useState('');
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

  if (gate === 'free') {
    return (
      <div className="rounded-xl border border-dashed border-border bg-card px-6 py-10 text-center">
        <StemmePlusBadge size="md" />
        <h2 className="mt-4 text-lg font-semibold text-foreground">AI-chat er en Stemme+-funksjon</h2>
        <p className="mx-auto mt-2 max-w-md text-sm text-muted-foreground">
          Chatboten bruker din egen LLM-nøkkel og våre sakdata. Gratis brukere beholder stemme,
          utforsk og høringer — uten en ødelagt chat.
        </p>
        <p className="mt-4 text-sm text-foreground">{priceNok} kr/mnd</p>
        <div className="mt-5 flex flex-wrap justify-center gap-3">
          <Link
            href={`${routes.minSide}?tab=stemme-plus`}
            className="rounded-lg bg-primary px-3 py-2 text-sm font-medium text-primary-foreground"
          >
            {checkoutConfigured ? 'Gå til Stemme+' : 'Se Stemme+-status'}
          </Link>
        </div>
      </div>
    );
  }

  if (gate === 'no-key') {
    return (
      <div className="rounded-xl border border-dashed border-border bg-card px-6 py-10 text-center">
        <h2 className="text-lg font-semibold text-foreground">Lagre en LLM-nøkkel først</h2>
        <p className="mx-auto mt-2 max-w-md text-sm text-muted-foreground">
          Stemme+ AI-chat kjører på nøkkelen din (OpenAI, Anthropic, AI Gateway eller
          OpenAI-kompatibel). Vi lagrer den kryptert og sender den aldri tilbake til nettleseren.
        </p>
        <Link
          href={`${routes.minSide}?tab=stemme-plus`}
          className="mt-5 inline-flex rounded-lg bg-primary px-3 py-2 text-sm font-medium text-primary-foreground"
        >
          Åpne nøkkelinnstillinger
        </Link>
      </div>
    );
  }

  return (
    <div className="flex min-h-[32rem] flex-col rounded-xl border border-border bg-card">
      <div className="border-b border-border px-4 py-3">
        <p className="text-sm text-muted-foreground">
          {issueId
            ? `Kontekst: ${issueTitle || `sak ${issueId}`}`
            : 'Spør om saker, dokumenter, kilder eller rettsskriving av dine egne utkast.'}
        </p>
      </div>

      <div className="flex-1 space-y-4 overflow-y-auto px-4 py-4">
        {messages.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            Ingen samtaler lagres på serveren. Still et spørsmål om en sak, be om kilder, eller lim
            inn en kladd for språkretting.
          </p>
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
          placeholder="Spør om en sak, eller lim inn en kladd for rettsskriving…"
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
    </div>
  );
}
