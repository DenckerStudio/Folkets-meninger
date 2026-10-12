/**
 * Slash commands for the Stemme+ chat. Typing `/` opens a keyboard-navigable
 * menu; picking a command either sends a grounded prompt or composes one that
 * expects an argument. Rettskriv and kildesøk are intentionally absent — they
 * belong to the opinion composer.
 */

export type ChatCommandBehavior = 'send' | 'compose' | 'new-chat';

export type ChatCommand = {
  id: string;
  /** Command name without the leading slash, e.g. `forklar`. */
  name: string;
  label: string;
  hint: string;
  behavior: ChatCommandBehavior;
  /** Whether the command is most useful when a sak/mening is in context. */
  needsIssue?: boolean;
  buildPrompt?: (args: { issueTitle?: string | null; argument?: string }) => string;
};

export const CHAT_COMMANDS: ChatCommand[] = [
  {
    id: 'cmd-forklar',
    name: 'forklar',
    label: 'Forklar saken',
    hint: 'Kort og nøytral forklaring',
    behavior: 'send',
    needsIssue: true,
    buildPrompt: ({ issueTitle }) =>
      issueTitle
        ? `Forklar «${issueTitle}» kort og nøytralt ut fra sakskonteksten.`
        : 'Forklar saken jeg ser på kort og nøytralt ut fra sakskonteksten.',
  },
  {
    id: 'cmd-status',
    name: 'status',
    label: 'Status og neste steg',
    hint: 'Hvor står saken nå?',
    behavior: 'send',
    needsIssue: true,
    buildPrompt: ({ issueTitle }) =>
      issueTitle
        ? `Hva er status i «${issueTitle}» nå, og hva er neste steg?`
        : 'Hva er status i saken jeg ser på nå, og hva er neste steg?',
  },
  {
    id: 'cmd-stemmer',
    name: 'stemmer',
    label: 'Hvordan stemte Stortinget?',
    hint: 'Votering og folkets stemmer',
    behavior: 'send',
    needsIssue: true,
    buildPrompt: ({ issueTitle }) =>
      issueTitle
        ? `Hvordan har Stortinget votert i «${issueTitle}», og hvordan står det mot folkets stemmer?`
        : 'Hvordan har Stortinget votert i saken jeg ser på, og hvordan står det mot folkets stemmer?',
  },
  {
    id: 'cmd-konsekvens',
    name: 'konsekvens',
    label: 'Konsekvenser for folk',
    hint: 'Hva betyr dette i praksis?',
    behavior: 'send',
    needsIssue: true,
    buildPrompt: ({ issueTitle }) =>
      issueTitle
        ? `Hvilke praktiske konsekvenser har «${issueTitle}» for folk i Norge?`
        : 'Hvilke praktiske konsekvenser har saken jeg ser på for folk i Norge?',
  },
  {
    id: 'cmd-mot',
    name: 'mot',
    label: 'Motargumenter',
    hint: 'Argumenter mot og alternative syn',
    behavior: 'send',
    needsIssue: true,
    buildPrompt: ({ issueTitle }) =>
      issueTitle
        ? `Hva er de viktigste motargumentene mot «${issueTitle}»?`
        : 'Hva er de viktigste motargumentene mot saken jeg ser på?',
  },
  {
    id: 'cmd-finn',
    name: 'finn',
    label: 'Finn saker',
    hint: 'Søk i sakcachen — skriv et emne',
    behavior: 'compose',
    buildPrompt: ({ argument }) =>
      argument?.trim()
        ? `Finn saker på Stortinget om ${argument.trim()}.`
        : 'Finn saker på Stortinget om ',
  },
  {
    id: 'cmd-tema',
    name: 'tema',
    label: 'Utforsk et tema',
    hint: 'Svar på tvers av flere saker — skriv et tema',
    behavior: 'compose',
    buildPrompt: ({ argument }) =>
      argument?.trim()
        ? `Hva er sagt om ${argument.trim()} på tvers av sakene på Stortinget?`
        : 'Hva er sagt om ',
  },
  {
    id: 'cmd-ny',
    name: 'ny',
    label: 'Ny samtale',
    hint: 'Tøm samtalen og start på nytt',
    behavior: 'new-chat',
  },
];

export function isSlashCommandInput(input: string): boolean {
  const trimmed = input.trimStart();
  return trimmed.startsWith('/') && !trimmed.includes('\n');
}

/** Text typed after the slash, or null when the input is not a slash command. */
export function slashQuery(input: string): string | null {
  if (!isSlashCommandInput(input)) return null;
  return input.trimStart().slice(1);
}

/** Split `/finn strømpriser` into `{ name: 'finn', argument: 'strømpriser' }`. */
export function parseSlashCommand(input: string): { name: string; argument: string } | null {
  const query = slashQuery(input);
  if (query === null) return null;
  const [name = '', ...rest] = query.split(/\s+/);
  return { name: name.toLowerCase(), argument: rest.join(' ').trim() };
}

export function findChatCommand(name: string): ChatCommand | null {
  const normalized = name.trim().toLowerCase();
  return CHAT_COMMANDS.find((command) => command.name === normalized) ?? null;
}

/** Rank commands for the `/` menu. Empty query returns all, in authored order. */
export function filterChatCommands(query: string): ChatCommand[] {
  const normalized = query.trim().toLowerCase();
  if (!normalized) return CHAT_COMMANDS;
  return CHAT_COMMANDS.filter((command) => {
    return (
      command.name.includes(normalized) ||
      command.label.toLowerCase().includes(normalized) ||
      command.hint.toLowerCase().includes(normalized)
    );
  });
}
