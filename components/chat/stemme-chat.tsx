'use client';

import { useMemo, useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useChat } from '@ai-sdk/react';
import { DefaultChatTransport, isToolUIPart } from 'ai';
import {
  FileSearch,
  Loader2,
  ListFilter,
  MessageCircleQuestion,
  Send,
  Sparkles,
} from 'lucide-react';
import { ChatPanelActions } from '@/components/chat/chat-panel-actions';
import { EmptyState } from '@/components/dashboard/empty-state';
import {
  AiAssistantCard,
  type AssistantQuickAction,
} from '@/components/ui/ai-assistant-card';
import { Button } from '@/components/ui/button';
import { StemmePlusBadge } from '@/components/profile/stemme-plus-badge';
import { cn } from '@/lib/utils';
import { routes } from '@/lib/routes';
import { canUseOverlayActions, chatLoginHref, type ChatGateReason } from '@/lib/chat/overlay';

type StemmeChatProps = {
  gate: ChatGateReason;
  issueId?: string | null;
  issueTitle?: string | null;
  priceNok: number;
  checkoutConfigured: boolean;
  variant?: 'page' | 'panel';
  /** When embedded in ChatPanel shell, hide the inner card chrome. */
  embedded?: boolean;
  onClose?: () => void;
  titleId?: string;
  descriptionId?: string;
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

function buildQuickActions(issueId?: string | null): AssistantQuickAction[] {
  const actions: AssistantQuickAction[] = [];
  if (issueId) {
    actions.push({
      id: 'forklar-sak',
      label: 'Forklar saken',
      icon: <MessageCircleQuestion className="h-3.5 w-3.5" />,
    });
    actions.push({
      id: 'dokumenter',
      label: 'Hvilke dokumenter finnes?',
      icon: <FileSearch className="h-3.5 w-3.5" />,
    });
  }
  actions.push({
    id: 'finn-saker',
    label: 'Finn lignende saker',
    icon: <ListFilter className="h-3.5 w-3.5" />,
  });
  return actions;
}

function promptForAction(action: AssistantQuickAction, issueTitle?: string | null): string {
  switch (action.id) {
    case 'forklar-sak':
      return issueTitle
        ? `Forklar saken «${issueTitle}» kort og nøytralt ut fra sakskonteksten.`
        : 'Forklar den aktuelle saken kort og nøytralt ut fra sakskonteksten.';
    case 'dokumenter':
      return issueTitle
        ? `Hvilke dokumentutdrag finnes for «${issueTitle}»?`
        : 'Hvilke dokumentutdrag finnes for den aktuelle saken?';
    case 'finn-saker':
      return issueTitle
        ? `Finn lignende saker som «${issueTitle}».`
        : 'Finn relevante saker i cachen ut fra det jeg spør om.';
    default:
      return action.label;
  }
}

export function StemmeChat({
  gate,
  issueId,
  issueTitle,
  priceNok,
  checkoutConfigured,
  variant = 'page',
  embedded = false,
  onClose,
  titleId,
  descriptionId,
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
  const quickActions = useMemo(() => buildQuickActions(issueId), [issueId]);

  if (gate === 'login') {
    return (
      <EmptyState
        className={emptyClassName}
        title="Logg inn for å bruke chat"
        description="Chat er en Stemme+-funksjon. Logg inn med e-post eller Google for å fortsette."
        action={
          <Link
            href={chatLoginHref(pathname || routes.utforsk, issueId, routes.utforsk)}
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
        title="Chat er en Stemme+-funksjon"
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

  const showActions = canUseOverlayActions(gate);
  const noKeyEmpty = (
    <EmptyState
      compact
      className={emptyClassName}
      title="Lagre en LLM-nøkkel først"
      description="Stemme+-chat kjører på nøkkelen din (OpenAI, Anthropic, AI Gateway eller OpenAI-kompatibel). Uten nøkkel viser rettskriving bare instruksjonen — vi later ikke som en modell har rettet teksten. Sakskontekst og kildesøk fungerer uten nøkkel. Vi lagrer nøkkelen kryptert og sender den aldri tilbake til nettleseren."
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

  const actionsBar = showActions ? (
    <ChatPanelActions issueId={issueId} issueTitle={issueTitle} compact={compact} />
  ) : null;

  if (gate === 'no-key') {
    return (
      <div className="flex min-h-0 flex-1 flex-col">
        {actionsBar}
        {noKeyEmpty}
      </div>
    );
  }

  const messageList = (
    <>
      {messages.map((message) => (
        <article
          key={message.id}
          className={
            message.role === 'user'
              ? 'ml-4 rounded-xl bg-muted/50 px-3 py-2 text-sm text-foreground'
              : 'mr-2 space-y-2 text-sm text-foreground'
          }
        >
          <p className="text-xs font-medium text-muted-foreground">
            {message.role === 'user' ? 'Du' : 'Assistent'}
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
    </>
  );

  const inputFooter = (
    <form
      className="mt-auto space-y-2 border-t border-border pt-3"
      onSubmit={(event) => {
        event.preventDefault();
        const text = input.trim();
        if (!text || busy) return;
        void sendMessage({ text });
        setInput('');
      }}
    >
      {error ? (
        <p className="text-sm text-destructive">{error.message || 'Noe gikk galt i samtalen.'}</p>
      ) : null}
      <div className="rounded-2xl border border-border bg-background p-2 shadow-sm">
        <textarea
          value={input}
          onChange={(event) => setInput(event.target.value)}
          rows={3}
          placeholder={
            issueId
              ? 'Spør om saken, dokumenter eller bakgrunn…'
              : 'Spør om en sak eller dokumenter…'
          }
          className="w-full resize-none border-0 bg-transparent px-2 py-1.5 text-sm text-foreground outline-none placeholder:text-muted-foreground"
          onKeyDown={(event) => {
            if (event.key === 'Enter' && !event.shiftKey) {
              event.preventDefault();
              const text = input.trim();
              if (!text || busy) return;
              void sendMessage({ text });
              setInput('');
            }
          }}
        />
        <div className="flex items-center justify-between gap-2 px-1 pb-0.5">
          <p className="text-[11px] text-muted-foreground">
            {issueId ? `Kontekst: ${issueTitle || `sak ${issueId}`}` : 'Ingen sak valgt'}
          </p>
          {busy ? (
            <Button type="button" size="sm" variant="outline" onClick={() => stop()}>
              Stopp
            </Button>
          ) : (
            <Button type="submit" size="sm" disabled={!input.trim()}>
              <Send className="h-4 w-4" />
              Send
            </Button>
          )}
        </div>
      </div>
      <p className="text-center text-[11px] text-muted-foreground">
        Samtalen lagres ikke på serveren. Rettskriv og kilder finner du i meningskomponisten.
      </p>
    </form>
  );

  const welcomeBlock =
    messages.length === 0 ? (
      <div className="flex flex-col items-center gap-4 px-2 py-8 text-center">
        <div className="flex size-12 items-center justify-center rounded-2xl bg-muted text-foreground">
          <Sparkles className="h-5 w-5" aria-hidden />
        </div>
        <div className="space-y-1.5">
          <p className="text-lg font-semibold tracking-tight text-foreground">
            Hei — hvordan kan jeg hjelpe?
          </p>
          <p className="mx-auto max-w-sm text-sm text-muted-foreground">
            {issueId
              ? `Spør om ${issueTitle || `sak ${issueId}`}, dokumenter eller lignende saker.`
              : 'Spør om saker og dokumenter. Ingen samtaler lagres på serveren.'}
          </p>
        </div>
        {quickActions.length > 0 ? (
          <div className="flex flex-wrap justify-center gap-2 pt-1">
            {quickActions.map((action) => (
              <button
                key={action.id}
                type="button"
                data-chat-quick-action={action.id}
                onClick={() => {
                  if (busy) return;
                  void sendMessage({ text: promptForAction(action, issueTitle) });
                }}
                className="inline-flex"
              >
                <span className="inline-flex cursor-pointer items-center gap-1.5 rounded-full border border-transparent bg-secondary px-3 py-1.5 text-xs font-medium text-secondary-foreground hover:bg-secondary/80">
                  {action.icon}
                  {action.label}
                </span>
              </button>
            ))}
          </div>
        ) : null}
      </div>
    ) : null;

  const chatBody = (
    <div className="flex min-h-0 flex-1 flex-col">
      {actionsBar}
      <div className="min-h-0 flex-1 space-y-4 overflow-y-auto px-1 py-2">
        {welcomeBlock}
        {messages.length > 0 ? messageList : null}
      </div>
      {inputFooter}
    </div>
  );

  if (embedded) {
    return chatBody;
  }

  return (
    <AiAssistantCard
      titleId={titleId}
      descriptionId={descriptionId}
      title="Chat"
      description="Sakskontekst og samtale på nøkkelen din — rettskriv og kilder ligger i meningskomponisten."
      onClose={onClose}
      className={cn('min-h-[32rem]', compact && 'h-full')}
    >
      {chatBody}
    </AiAssistantCard>
  );
}
