'use client';

import {
  forwardRef,
  useEffect,
  useImperativeHandle,
  useMemo,
  useRef,
  useState,
  type MouseEvent as ReactMouseEvent,
} from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useChat } from '@ai-sdk/react';
import { DefaultChatTransport, isToolUIPart } from 'ai';
import { ArrowUp, Loader2, Sparkles } from 'lucide-react';
import { ChatCommandMenu } from '@/components/chat/chat-command-menu';
import { ChatConversationMenu } from '@/components/chat/chat-conversation-menu';
import { ChatMarkdown } from '@/components/chat/chat-markdown';
import { collectChatSourceLinks, isInAppNavigationClick } from '@/lib/chat/source-links';
import { ChatMessageActions, textFromMessageParts } from '@/components/chat/chat-message-actions';
import { ChatToolResult } from '@/components/chat/chat-tool-result';
import { readImpactProfileForChat } from '@/components/chat/impact-profile-for-chat';
import { EmptyState } from '@/components/dashboard/empty-state';
import { AiAssistantCard } from '@/components/ui/ai-assistant-card';
import { Button } from '@/components/ui/button';
import { StemmePlusBadge } from '@/components/profile/stemme-plus-badge';
import { cn } from '@/lib/utils';
import { routes } from '@/lib/routes';
import { chatLoginHref, type ChatGateReason } from '@/lib/chat/overlay';
import { chatErrorMessage } from '@/lib/chat/errors';
import { buildFollowUps } from '@/lib/chat/follow-ups';
import {
  filterChatCommands,
  isSlashCommandInput,
  parseSlashCommand,
  slashQuery,
  type ChatCommand,
} from '@/lib/chat/commands';
import {
  buildChatSuggestions,
  type ChatSuggestion,
  type ChatUserSignals,
} from '@/lib/chat/suggestions';
import { resolveChatView } from '@/lib/chat/view-context';
import { pageContextFromView } from '@/lib/chat/page-context';
import {
  deleteConversation,
  loadConversations,
  newConversationId,
  saveConversation,
  titleFromMessages,
  toStoredMessages,
  type StoredConversation,
} from '@/lib/chat/conversations';

export type StemmeChatConversationsState = {
  conversations: StoredConversation[];
  activeId: string | null;
  busy: boolean;
};

export type StemmeChatHandle = {
  startNewChat: () => void;
  selectConversation: (id: string) => void;
  removeConversation: (id: string) => void;
};

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
  /** Server-ranked prompts for the empty state; falls back to view-based ones. */
  suggestions?: ChatSuggestion[];
  suggestionsLoading?: boolean;
  /** Emits saved-conversation state so the shell can render the header menu. */
  onConversationsChange?: (state: StemmeChatConversationsState) => void;
  /** Called when a link in a message navigates within the app (the panel closes). */
  onInAppNavigate?: () => void;
};

const EMPTY_SIGNALS: ChatUserSignals = {
  categories: [],
  labels: [],
  recentStances: [],
  interests: [],
  ownOpinionTitles: [],
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
    case 'tool-getPollResults':
      return 'Henter avstemningsresultat';
    case 'tool-getMyActivity':
      return 'Henter din aktivitet';
    case 'tool-getImpact':
      return 'Beregner hva saken betyr for deg';
    case 'tool-getPublicProfile':
      return 'Henter din offentlige profil';
    default:
      return 'Bruker verktøy';
  }
}

export const StemmeChat = forwardRef<StemmeChatHandle, StemmeChatProps>(function StemmeChat(
  {
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
    suggestions,
    suggestionsLoading = false,
    onConversationsChange,
    onInAppNavigate,
  },
  ref,
) {
  const pathname = usePathname();
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  // Synchronous guard: `busy` comes from React state and is stale within the
  // same tick, so two Enter/click events could fire two identical sends and
  // duplicate the user turn. The ref blocks the second call immediately.
  const sendLockRef = useRef(false);
  const [input, setInput] = useState('');
  const [activeCommandIndex, setActiveCommandIndex] = useState(0);
  const compact = variant === 'panel';
  // Restore the most recent saved conversation once, on mount (localStorage only).
  const [initialConversation] = useState<StoredConversation | null>(() => {
    if (variant !== 'panel') return null;
    return loadConversations()[0] ?? null;
  });
  const [conversations, setConversations] = useState<StoredConversation[]>(() =>
    variant === 'panel' ? loadConversations() : [],
  );
  const [conversationId, setConversationId] = useState<string | null>(
    () => initialConversation?.id ?? null,
  );
  // Structured page context for the request body; ids never go into the text.
  const pageView = useMemo(() => resolveChatView(pathname), [pathname]);
  const pageContext = useMemo(
    () => pageContextFromView(pageView, issueId ?? null),
    [pageView, issueId],
  );
  const transport = useMemo(
    () =>
      new DefaultChatTransport({
        api: '/api/chat',
        headers: issueId ? { 'x-sak-id': issueId } : undefined,
        body: { ...(issueId ? { issueId } : {}), pageContext },
        prepareSendMessagesRequest: ({ id, messages, body: baseBody, trigger, messageId }) => ({
          body: {
            ...baseBody,
            id,
            messages,
            trigger,
            messageId,
            impactProfile: readImpactProfileForChat(),
          },
        }),
      }),
    [issueId, pageContext],
  );

  const {
    messages,
    setMessages,
    sendMessage,
    regenerate,
    status,
    error,
    stop,
  } = useChat({
    transport,
    messages: (initialConversation?.messages ?? []) as never,
  });
  const busy = status === 'submitted' || status === 'streaming';
  const emptyClassName = compact ? 'border-none bg-transparent px-4 py-8' : undefined;

  const view = pageView;
  const effectiveIssueId = issueId ?? (view.kind === 'sak' ? view.id : null);
  const fallbackSuggestions = useMemo(
    () =>
      buildChatSuggestions({
        context: { kind: view.kind, title: issueTitle ?? null, issueId: effectiveIssueId },
        signals: EMPTY_SIGNALS,
      }),
    [view.kind, issueTitle, effectiveIssueId],
  );
  const shownSuggestions = useMemo(() => {
    const list = suggestions && suggestions.length > 0 ? suggestions : fallbackSuggestions;
    return compact ? list.slice(0, 4) : list;
  }, [suggestions, fallbackSuggestions, compact]);

  const commandQuery = slashQuery(input);
  const matchingCommands = useMemo(
    () => (commandQuery === null ? [] : filterChatCommands(commandQuery)),
    [commandQuery],
  );
  const menuOpen = isSlashCommandInput(input) && matchingCommands.length > 0;

  useEffect(() => {
    setActiveCommandIndex(0);
  }, [commandQuery]);

  const lastAssistantId = useMemo(() => {
    for (let index = messages.length - 1; index >= 0; index -= 1) {
      const message = messages[index];
      if (message.role === 'assistant' && textFromMessageParts(message.parts)) {
        return message.id;
      }
    }
    return null;
  }, [messages]);
  const followUps = useMemo(() => {
    if (busy || lastAssistantId === null) return [];
    const toolsUsed = messages
      .flatMap((message) => message.parts)
      .map((part) => ('type' in part ? String(part.type) : ''));
    return buildFollowUps({
      hasIssue: Boolean(effectiveIssueId),
      issueTitle,
      toolsUsed,
      contextKind: view.kind,
    });
  }, [busy, lastAssistantId, messages, effectiveIssueId, issueTitle, view.kind]);

  // Persist the active conversation to localStorage (panel only; page stays ephemeral).
  useEffect(() => {
    if (variant !== 'panel') return;
    if (messages.length === 0) return;
    const id = conversationId ?? newConversationId();
    if (!conversationId) setConversationId(id);
    const stored = toStoredMessages(
      messages as unknown as Array<{ id: string; role: string; parts: unknown[] }>,
    );
    const title = titleFromMessages(stored);
    const next = saveConversation({ id, title, updatedAt: Date.now(), issueId: issueId ?? null, messages: stored });
    setConversations(next);
    // Persist on message changes only.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [messages, variant]);

  function startNewChat() {
    setConversationId(newConversationId());
    setMessages([]);
    setInput('');
  }

  function selectConversation(id: string) {
    const found = conversations.find((c) => c.id === id);
    if (!found) return;
    setConversationId(found.id);
    setMessages(found.messages as never);
  }

  function removeConversation(id: string) {
    setConversations(deleteConversation(id));
    if (conversationId === id) {
      setConversationId(newConversationId());
      setMessages([]);
    }
  }

  // A [n] source or tool-card link that navigates in this tab closes the panel,
  // so the user lands on the page instead of a modal over a changed page.
  const handleMessageLinkClick = (event: ReactMouseEvent<HTMLDivElement>) => {
    const anchor = (event.target as HTMLElement | null)?.closest?.('a');
    if (!anchor || !event.currentTarget.contains(anchor)) return;
    const navigates = isInAppNavigationClick(
      event,
      {
        href: anchor.getAttribute('href'),
        target: anchor.getAttribute('target'),
        download: anchor.hasAttribute('download'),
      },
      window.location.origin,
    );
    if (navigates) onInAppNavigate?.();
  };

  // Keep the shell's header menu in sync with saved conversations.
  useEffect(() => {
    onConversationsChange?.({ conversations, activeId: conversationId, busy });
  }, [onConversationsChange, conversations, conversationId, busy]);

  useImperativeHandle(
    ref,
    () => ({ startNewChat, selectConversation, removeConversation }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [conversations, conversationId],
  );

  function sendText(text: string, contextSakId?: string | null) {
    const trimmed = text.trim();
    if (!trimmed || busy || sendLockRef.current) return;
    sendLockRef.current = true;
    // A suggestion about another sak (e.g. a recent stance) carries its id as
    // structured context for this request only.
    const options = contextSakId
      ? { body: { pageContext: { ...pageContext, sakId: contextSakId } } }
      : undefined;
    void sendMessage({ text: trimmed }, options).finally(() => {
      sendLockRef.current = false;
    });
  }

  function applyCommand(command: ChatCommand) {
    const parsed = parseSlashCommand(input);
    const argument = parsed?.name === command.name ? parsed.argument : '';
    if (command.behavior === 'new-chat') {
      startNewChat();
      return;
    }
    const prompt = command.buildPrompt?.({ issueTitle, argument }) ?? command.label;
    if (command.behavior === 'compose') {
      setInput(prompt);
      requestAnimationFrame(() => {
        const el = textareaRef.current;
        if (el) {
          el.focus();
          el.setSelectionRange(prompt.length, prompt.length);
        }
      });
      return;
    }
    setInput('');
    sendText(prompt);
  }

  /** Enter in the slash menu fills the input for editing instead of sending immediately. */
  function insertCommandForEdit(command: ChatCommand) {
    if (command.behavior === 'new-chat') {
      startNewChat();
      return;
    }
    const parsed = parseSlashCommand(input);
    const argument = parsed?.name === command.name ? parsed.argument : '';
    const prompt = command.buildPrompt?.({ issueTitle, argument }) ?? command.label;
    setInput(prompt);
    requestAnimationFrame(() => {
      const el = textareaRef.current;
      if (el) {
        el.focus();
        el.setSelectionRange(prompt.length, prompt.length);
      }
    });
  }

  function submitInput() {
    const text = input.trim();
    if (!text) return;
    setInput('');
    sendText(text);
  }

  function onInputKeyDown(event: React.KeyboardEvent<HTMLTextAreaElement>) {
    if (menuOpen) {
      const count = matchingCommands.length;
      if (event.key === 'ArrowDown') {
        event.preventDefault();
        setActiveCommandIndex((index) => (index + 1) % count);
        return;
      }
      if (event.key === 'ArrowUp') {
        event.preventDefault();
        setActiveCommandIndex((index) => (index - 1 + count) % count);
        return;
      }
      if (event.key === 'Enter' || event.key === 'Tab') {
        event.preventDefault();
        const command = matchingCommands[activeCommandIndex];
        if (command) insertCommandForEdit(command);
        return;
      }
      if (event.key === 'Escape') {
        event.preventDefault();
        setInput('');
        return;
      }
    }
    if (event.key === 'Enter' && !event.shiftKey) {
      event.preventDefault();
      submitInput();
    }
  }

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
        description="Chatboten bruker din egen språkmodellnøkkel og våre sakdata. Gratis brukere beholder stemme, utforsk og høringer — uten en ødelagt chat."
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

  const noKeyEmpty = (
    <EmptyState
      compact
      className={emptyClassName}
      title="Lagre en språkmodellnøkkel først"
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

  if (gate === 'no-key') {
    return (
      <div className="flex min-h-0 flex-1 flex-col">
        {noKeyEmpty}
      </div>
    );
  }

  const messageList = (
    <>
      {messages.map((message) => (
        <article
          key={message.id}
          className={cn(
            'space-y-2',
            message.role === 'user' ? 'ml-8 pl-3' : 'mr-6 pr-3',
          )}
        >
          {message.role === 'user' ? (
            <div className="ml-auto w-fit max-w-[90%] rounded-2xl rounded-br-md bg-primary px-3.5 py-2 text-sm text-primary-foreground">
              {message.parts.map((part, index) =>
                part.type === 'text' ? (
                  <span key={`${message.id}-${index}`} className="whitespace-pre-wrap">
                    {part.text}
                  </span>
                ) : null,
              )}
            </div>
          ) : (
            <div className="space-y-2">
              <p className="flex items-center gap-1.5 text-xs font-semibold text-brand">
                <Sparkles className="size-3.5 shrink-0" aria-hidden />
                Stemme+
              </p>
              {message.parts.map((part, index) => {
                if (part.type === 'text') {
                  return part.text ? (
                    <ChatMarkdown
                      key={`${message.id}-${index}`}
                      text={part.text}
                      sources={collectChatSourceLinks(message.parts)}
                      className="text-sm leading-relaxed text-foreground"
                    />
                  ) : null;
                }
                if (isToolUIPart(part)) {
                  const done = part.state === 'output-available';
                  if (done && part.output !== undefined) {
                    return (
                      <ChatToolResult key={`${message.id}-${index}`} toolType={part.type} output={part.output} />
                    );
                  }
                  return (
                    <p
                      key={`${message.id}-${index}`}
                      className="inline-flex items-center gap-1.5 rounded-lg border border-border bg-muted/30 px-2 py-1 text-xs text-muted-foreground"
                    >
                      <Loader2 className="size-3 animate-spin" aria-hidden />
                      {toolLabel(part.type)}
                    </p>
                  );
                }
                return null;
              })}
              {!busy && textFromMessageParts(message.parts) ? (
                <ChatMessageActions
                  text={textFromMessageParts(message.parts)}
                  busy={busy}
                  onRegenerate={() => void regenerate({ messageId: message.id })}
                />
              ) : null}
              {message.id === lastAssistantId && followUps.length > 0 ? (
                <div className="flex flex-wrap gap-1.5 pt-1" data-chat-follow-ups="">
                  {followUps.map((followUp) => (
                    <button
                      key={followUp.id}
                      type="button"
                      data-chat-follow-up={followUp.id}
                      onClick={() => sendText(followUp.prompt)}
                      className="inline-flex rounded-full border border-border bg-background px-2.5 py-1 text-[11px] font-medium text-muted-foreground transition-colors hover:border-brand/40 hover:text-foreground"
                    >
                      {followUp.label}
                    </button>
                  ))}
                </div>
              ) : null}
            </div>
          )}
        </article>
      ))}
    </>
  );

  const inputFooter = (
    <form
      className="mt-auto space-y-1.5 border-t border-border pt-2 sm:pt-3"
      onSubmit={(event) => {
        event.preventDefault();
        submitInput();
      }}
    >
      {error ? (
        <p className="text-sm text-destructive">{chatErrorMessage(error)}</p>
      ) : null}
      <div className="relative">
        <ChatCommandMenu
          id="chat-command-menu"
          commands={menuOpen ? matchingCommands : []}
          activeIndex={activeCommandIndex}
          onSelect={applyCommand}
          onActiveIndexChange={setActiveCommandIndex}
        />
        <div className="rounded-2xl border border-border bg-card shadow-sm transition-shadow focus-within:border-brand/40 focus-within:shadow-md">
          <textarea
            ref={textareaRef}
            value={input}
            onChange={(event) => setInput(event.target.value)}
            onKeyDown={onInputKeyDown}
            rows={1}
            placeholder={
              issueId
                ? 'Spør om saken, dokumenter eller bakgrunn…'
                : 'Spør om en sak eller dokumenter…'
            }
            aria-controls={menuOpen ? 'chat-command-menu' : undefined}
            aria-autocomplete="list"
            className="max-h-40 w-full resize-none border-0 bg-transparent px-3.5 pt-3 pb-1 text-sm text-foreground outline-none placeholder:text-muted-foreground"
          />
          <div className="flex items-center justify-between gap-2 px-2.5 pb-2">
            <p className="line-clamp-1 text-[11px] text-muted-foreground">
              {issueId ? (
                <>Kontekst: {issueTitle || `sak ${issueId}`}</>
              ) : (
                <>
                  Skriv <kbd className="rounded border border-border px-1 font-sans">/</kbd> for kommandoer
                </>
              )}
            </p>
            {busy ? (
              <Button type="button" size="sm" variant="outline" onClick={() => stop()}>
                Stopp
              </Button>
            ) : (
              <Button
                type="submit"
                size="icon-sm"
                aria-label="Send"
                disabled={!input.trim()}
              >
                <ArrowUp className="size-4" />
              </Button>
            )}
          </div>
        </div>
      </div>
      <p className="hidden text-center text-[11px] text-muted-foreground sm:block">
        Samtalen lagres kun lokalt i denne nettleseren.
      </p>
    </form>
  );

  const welcomeBlock =
    messages.length === 0 ? (
      <div className="flex flex-col items-center gap-4 px-1 py-6 text-center">
        <div className="flex size-11 items-center justify-center rounded-2xl bg-brand/10 text-brand">
          <Sparkles className="h-5 w-5" aria-hidden />
        </div>
        <div className="space-y-1">
          <p className="text-base font-semibold tracking-tight text-foreground">
            Hei — hvordan kan jeg hjelpe?
          </p>
          <p className="mx-auto max-w-sm text-sm text-muted-foreground">
            {issueId
              ? `Spør om ${issueTitle || `sak ${issueId}`}, dokumenter eller lignende saker.`
              : 'Spør om saker og dokumenter. Samtalen lagres bare i denne nettleseren.'}
          </p>
        </div>
        {suggestionsLoading && shownSuggestions.length === 0 ? (
          <div className="w-full space-y-1.5 pt-1" aria-hidden>
            {[0, 1, 2].map((row) => (
              <div key={row} className="h-11 animate-pulse rounded-xl bg-muted/60" />
            ))}
          </div>
        ) : shownSuggestions.length > 0 ? (
          <div className="w-full space-y-1.5 pt-1 text-left" data-chat-suggestions="">
            {shownSuggestions.map((suggestion) => (
              <button
                key={suggestion.id}
                type="button"
                data-chat-suggestion={suggestion.id}
                onClick={() => sendText(suggestion.prompt, suggestion.contextSakId)}
                className="group flex w-full items-center justify-between gap-3 rounded-xl border border-border bg-card/60 px-3 py-2 text-left transition-colors hover:border-brand/40 hover:bg-card"
              >
                <span className="min-w-0">
                  <span className="block line-clamp-2 text-sm font-medium text-foreground">
                    {suggestion.label}
                  </span>
                  <span className="block line-clamp-2 text-xs text-muted-foreground">
                    {suggestion.prompt}
                  </span>
                </span>
                <ArrowUp
                  className="size-3.5 shrink-0 rotate-45 text-muted-foreground opacity-0 transition-opacity group-hover:opacity-60"
                  aria-hidden
                />
              </button>
            ))}
          </div>
        ) : null}
        <p className="text-[11px] text-muted-foreground">
          Tips: skriv <kbd className="rounded border border-border px-1 font-sans">/</kbd> for kommandoer som
          <span className="font-medium text-foreground"> /status</span> og
          <span className="font-medium text-foreground"> /finn</span>.
        </p>
      </div>
    ) : null;

  const chatBody = (
    <div className="flex min-h-0 flex-1 flex-col">
      <div
        className="min-h-0 flex-1 space-y-4 overflow-y-auto overscroll-contain px-1 py-2"
        onClick={onInAppNavigate ? handleMessageLinkClick : undefined}
      >
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
      description="Sakskontekst og samtale på nøkkelen din."
      onClose={onClose}
      headerActions={
        <ChatConversationMenu
          conversations={conversations}
          activeId={conversationId}
          disabled={busy}
          onNewChat={startNewChat}
          onSelect={selectConversation}
          onDelete={removeConversation}
        />
      }
      className={cn('min-h-[32rem]', compact && 'h-full')}
    >
      {chatBody}
    </AiAssistantCard>
  );
});
