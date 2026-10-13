/**
 * Suggested prompts for the Stemme+ chat. Pure functions so the ranking is easy
 * to test: the API gathers signals and this module turns them into a short,
 * deduplicated list grounded in what the user sees and what they engage with.
 *
 * Deliberately excludes Rettskriv and kildesøk — those live in the opinion
 * composer, not the chat.
 */
import type { ChatViewKind } from '@/lib/chat/view-context';

export type ChatSuggestionSource = 'view' | 'signal' | 'stance' | 'interest' | 'general';

export type ChatSuggestion = {
  id: string;
  label: string;
  prompt: string;
  source: ChatSuggestionSource;
};

export type ChatSuggestionContext = {
  kind: ChatViewKind;
  /** Human title for the current entity (sak title, mening title, politician name, poll question). */
  title: string | null;
  /** Stortinget issue id to scope the conversation, when known. */
  issueId: string | null;
};

export type ChatSignal = {
  value: string;
  count: number;
};

export type ChatRecentStance = {
  issueId: string;
  title: string | null;
  stance: string;
};

export type ChatUserSignals = {
  categories: ChatSignal[];
  labels: ChatSignal[];
  recentStances: ChatRecentStance[];
  interests: string[];
  ownOpinionTitles: string[];
};

export const MAX_CHAT_SUGGESTIONS = 6;

function quote(value: string | null | undefined): string | null {
  const trimmed = value?.trim();
  return trimmed ? `«${trimmed}»` : null;
}

function viewSuggestions(context: ChatSuggestionContext): ChatSuggestion[] {
  const title = context.title?.trim() || null;
  const quoted = quote(title);

  switch (context.kind) {
    case 'sak': {
      const subject = quoted ?? (context.issueId ? `sak ${context.issueId}` : 'saken');
      return [
        {
          id: 'sak-forklar',
          label: 'Forklar saken',
          prompt: `Forklar ${subject} kort og nøytralt ut fra sakskonteksten.`,
          source: 'view',
        },
        {
          id: 'sak-konsekvenser',
          label: 'Hva betyr det for folk?',
          prompt: `Hvilke praktiske konsekvenser har ${subject} for folk i Norge?`,
          source: 'view',
        },
        {
          id: 'sak-stemmer',
          label: 'Hvordan stemte Stortinget?',
          prompt: `Hvordan har Stortinget votert i ${subject}, og hvordan står det mot folkets vilje?`,
          source: 'view',
        },
        {
          id: 'sak-mot',
          label: 'Motargumenter',
          prompt: `Hva er de viktigste motargumentene mot ${subject}?`,
          source: 'view',
        },
      ];
    }
    case 'mening': {
      const subject = quoted ?? 'denne meningen';
      const suggestions: ChatSuggestion[] = [
        {
          id: 'mening-sider',
          label: 'Se saken fra flere sider',
          prompt: `Hvilke argumenter finnes for og mot synet i ${subject}?`,
          source: 'view',
        },
        {
          id: 'mening-fakta',
          label: 'Fakta å kjenne til',
          prompt: `Hvilke fakta bør jeg kjenne til for å vurdere synet i ${subject}?`,
          source: 'view',
        },
      ];
      if (context.issueId) {
        suggestions.push({
          id: 'mening-status',
          label: 'Status i stortingssaken',
          prompt: 'Hva er status i stortingssaken denne meningen er knyttet til, og hva er neste steg?',
          source: 'view',
        });
      }
      return suggestions;
    }
    case 'politiker': {
      const name = title ?? 'representanten';
      return [
        {
          id: 'politiker-saker',
          label: 'Hvilke saker er viktige for hen?',
          prompt: `Hvilke saker på Stortinget er ${name} opptatt av akkurat nå?`,
          source: 'view',
        },
        {
          id: 'politiker-finn',
          label: 'Finn relevante saker',
          prompt: `Finn saker på Stortinget som er relevante for ${name}.`,
          source: 'view',
        },
        {
          id: 'politiker-parti',
          label: 'Partiet og linjene',
          prompt: `Hva kjennetegner den politiske linjen til partiet til ${name}?`,
          source: 'view',
        },
      ];
    }
    case 'reel': {
      const subject = quoted ?? 'denne avstemningen';
      const suggestions: ChatSuggestion[] = [
        {
          id: 'reel-bakgrunn',
          label: 'Hva handler det om?',
          prompt: `Hva handler avstemningen ${subject} om? Finn bakgrunnen i sakene på Stortinget.`,
          source: 'view',
        },
        {
          id: 'reel-mot',
          label: 'Argumenter for og mot',
          prompt: `Hvilke argumenter taler for og mot i ${subject}?`,
          source: 'view',
        },
      ];
      if (context.issueId) {
        suggestions.push({
          id: 'reel-konsekvenser',
          label: 'Konsekvenser',
          prompt: `Hvilke praktiske konsekvenser får ${subject} for folk i Norge?`,
          source: 'view',
        });
      }
      return suggestions;
    }
    case 'horing': {
      const subject = quoted ?? 'denne høringen';
      return [
        {
          id: 'horing-forklar',
          label: 'Hva skal høringen belyse?',
          prompt: `Hva skal høringen ${subject} belyse, og hva er hovedspørsmålene?`,
          source: 'view',
        },
        {
          id: 'horing-finn',
          label: 'Relevante saker',
          prompt: `Finn stortingssaker som er relevante for høringen ${subject}.`,
          source: 'view',
        },
      ];
    }
    case 'utforsk':
    case 'folkets-meninger':
    case 'horinger':
    case 'general':
    default:
      return [];
  }
}

function signalSuggestions(signals: ChatUserSignals, context: ChatSuggestionContext): ChatSuggestion[] {
  const out: ChatSuggestion[] = [];
  const currentTitle = context.title?.trim().toLowerCase() ?? '';

  const topCategory = signals.categories.find(
    (signal) => signal.value.trim() && signal.value.trim().toLowerCase() !== currentTitle,
  );
  if (topCategory) {
    out.push({
      id: `signal-category-${topCategory.value}`,
      label: `Siste innen ${topCategory.value}`,
      prompt: `Hva er de viktigste sakene på Stortinget innen ${topCategory.value} akkurat nå?`,
      source: 'signal',
    });
  }

  const topLabel = signals.labels.find(
    (signal) => signal.value.trim() && signal.value.trim().toLowerCase() !== currentTitle,
  );
  if (topLabel) {
    out.push({
      id: `signal-label-${topLabel.value}`,
      label: `Finn saker om ${topLabel.value}`,
      prompt: `Finn saker på Stortinget om ${topLabel.value}.`,
      source: 'signal',
    });
  }

  return out;
}

function stanceSuggestions(signals: ChatUserSignals, context: ChatSuggestionContext): ChatSuggestion[] {
  const out: ChatSuggestion[] = [];
  for (const stance of signals.recentStances) {
    if (!stance.title?.trim()) continue;
    if (context.issueId && stance.issueId === context.issueId) continue;
    out.push({
      id: `stance-${stance.issueId}`,
      label: `Status: ${stance.title.length > 40 ? `${stance.title.slice(0, 40)}…` : stance.title}`,
      prompt: `Hva er status i «${stance.title}», og hva er neste steg?`,
      source: 'stance',
    });
    if (out.length >= 2) break;
  }
  return out;
}

function interestSuggestions(signals: ChatUserSignals, context: ChatSuggestionContext): ChatSuggestion[] {
  const out: ChatSuggestion[] = [];
  const currentTitle = context.title?.trim().toLowerCase() ?? '';
  for (const interest of signals.interests) {
    const value = interest.trim();
    if (!value || value.toLowerCase() === currentTitle) continue;
    out.push({
      id: `interest-${value}`,
      label: `Hjertesak: ${value}`,
      prompt: `Hva er de ferskeste sakene på Stortinget innen ${value}?`,
      source: 'interest',
    });
    if (out.length >= 2) break;
  }
  return out;
}

function generalSuggestions(): ChatSuggestion[] {
  return [
    {
      id: 'general-nå',
      label: 'Hva skjer på Stortinget nå?',
      prompt: 'Hva er de viktigste sakene på Stortinget akkurat nå?',
      source: 'general',
    },
    {
      id: 'general-finn',
      label: 'Finn en sak om et tema',
      prompt: 'Finn saker på Stortinget om et tema jeg beskriver.',
      source: 'general',
    },
  ];
}

/**
 * Build the ranked, deduplicated suggestion list shown in the empty chat state.
 * Buckets are interleaved round-robin so the list mixes view-specific prompts
 * with the user's own engagement instead of exhausting one source first.
 */
export function buildChatSuggestions(input: {
  context: ChatSuggestionContext;
  signals: ChatUserSignals;
}): ChatSuggestion[] {
  const { context, signals } = input;
  const buckets: ChatSuggestion[][] = [
    viewSuggestions(context),
    signalSuggestions(signals, context),
    stanceSuggestions(signals, context),
    interestSuggestions(signals, context),
  ];

  const seen = new Set<string>();
  const result: ChatSuggestion[] = [];
  const add = (suggestion: ChatSuggestion | undefined): void => {
    if (!suggestion || result.length >= MAX_CHAT_SUGGESTIONS) return;
    const key = suggestion.prompt.trim().toLowerCase();
    if (!key || seen.has(key)) return;
    seen.add(key);
    result.push(suggestion);
  };

  const longest = Math.max(0, ...buckets.map((bucket) => bucket.length));
  for (let index = 0; index < longest; index += 1) {
    for (const bucket of buckets) {
      add(bucket[index]);
    }
  }

  if (result.length === 0) {
    for (const suggestion of generalSuggestions()) add(suggestion);
  }

  return result;
}
