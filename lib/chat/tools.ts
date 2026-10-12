import { tool } from 'ai';
import { z } from 'zod';
import {
  SPELLING_CONTEXTS,
  runRettsskriving,
  runUpdatedSourceSearch,
} from '@/lib/chat/actions';
import {
  retrieveSakContext,
  retrieveTopicContext,
  searchIssuesForChat,
  type ChatRagClient,
} from '@/lib/chat/rag';
import {
  collectHearingsForSak,
  collectOpenHearings,
  collectPoliticianMatches,
  collectSakDocumentGroups,
  collectSakTimeline,
} from '@/lib/chat/stortinget-tools';
import { fetchVoteAlignment } from '@/lib/chat/vote-alignment';
import { createPollChatTools } from '@/lib/chat/poll-tools';
import { createPersonalChatTools } from '@/lib/chat/personal-tools';
import type { QueryVectorizer } from '@/lib/chat/vector-search';
import { getIssueOpinionSummary } from '@/lib/opinions/service';

export type ChatToolOptions = {
  preferredIssueId?: string | null;
  ragClient?: ChatRagClient | null;
  vectorize?: QueryVectorizer | null;
  /** Request-session user id. Never taken from the client body or a tool argument. */
  userId?: string | null;
  /** Browser-local impact profile forwarded by the chat client. */
  impactProfile?: unknown;
};

export function createChatTools(options?: ChatToolOptions | string | null) {
  const resolved: ChatToolOptions =
    typeof options === 'string' || options == null
      ? { preferredIssueId: options ?? null }
      : options;
  const preferredIssueId = resolved.preferredIssueId ?? null;
  const ragClient = resolved.ragClient ?? null;
  const vectorize = resolved.vectorize ?? null;

  const resolveIssueId = async (args: {
    issueId?: string;
    query?: string;
  }): Promise<string | null> => {
    const direct = args.issueId?.trim() || preferredIssueId?.trim();
    if (direct) return direct;
    const needle = args.query?.trim();
    if (!needle) return null;
    const hits = await searchIssuesForChat(needle, 1, ragClient);
    return hits[0]?.id ?? null;
  };

  return {
    retrieveSakContext: tool({
      description:
        'Hent sak, AI-sammendrag og dokumentutdrag fra Folkets Stemme (uten embeddings-kolonner). Bruk når brukeren spør om en stortingssak.',
      inputSchema: z.object({
        issueId: z
          .string()
          .optional()
          .describe('Stortinget sak-id hvis kjent. La stå tom for å søke på tittel.'),
        query: z.string().min(2).describe('Hva du trenger å finne i saken eller dokumentene.'),
      }),
      execute: async ({ issueId, query }) => {
        const context = await retrieveSakContext({
          issueId: issueId || preferredIssueId,
          query,
          client: ragClient,
          vectorize,
        });
        return {
          issue: context.issue,
          summary: context.summary,
          chunks: context.chunks,
          note: context.note,
        };
      },
    }),
    searchUpdatedSources: tool({
      description:
        'Søk etter oppdaterte åpne kilder via SearXNG. Bruk for nyheter, Stortinget-sider eller bakgrunn utenfor vår cache.',
      inputSchema: z.object({
        query: z.string().min(3).describe('Søkestreng, gjerne med sakstittel eller henvisning.'),
      }),
      execute: async ({ query }) => {
        const result = await runUpdatedSourceSearch(query);
        if (!result.ok) {
          return { unavailable: result.unavailable, error: result.error, results: [] as const };
        }
        return { unavailable: false, results: result.results };
      },
    }),
    helpRettsskriving: tool({
      description:
        'Hjelp brukeren med rettskriving og grammatikk i en kladd til sak-diskusjon, motforslag eller høringsinnspill. Returner rettet tekst og korte merknader. Generer ikke nytt politisk innhold.',
      inputSchema: z.object({
        draft: z.string().min(8).max(8000).describe('Brukerens egen kladd.'),
        context: z.enum(SPELLING_CONTEXTS).describe('Hvor teksten skal brukes.'),
      }),
      execute: async ({ draft, context }) => {
        const result = runRettsskriving({ draft, context });
        if (!result.ok) {
          return {
            original: draft,
            context,
            instruction: result.error,
            published: false as const,
          };
        }
        return result.result;
      },
    }),
    listMatchingSaker: tool({
      description:
        'Finn saker i vår cache ut fra et emne, en sak-tittel, en henvisning eller et sak-id. Tar imot vanlige spørsmål (f.eks. «hva koster innvandringsloven») og deler spørsmålet i søkeord. Bruk når brukeren lete etter en sak, ikke bare én bestemt sak.',
      inputSchema: z.object({
        query: z
          .string()
          .min(2)
          .describe(
            'Sak-id, henvisning, tittel eller et spørsmål/emne brukeren leter etter, f.eks. «hva koster innvandringsloven».',
          ),
      }),
      execute: async ({ query }) => {
        const issues = await searchIssuesForChat(query, 8, ragClient);
        return {
          issues,
          note:
            issues.length === 0
              ? 'Ingen treff i sakcachen. Prøv et mer presist søk eller SearXNG.'
              : null,
        };
      },
    }),
    retrieveTopicContext: tool({
      description:
        'Hent kontekst fra flere relevante saker samtidig for et tema eller et bredt spørsmål (f.eks. «hva skjer med strømprisene» eller «hva er sagt om innvandring»). Returnerer de mest relevante sakene med sammendrag og dokumentutdrag, slik at du kan svare på tvers av saker. Bruk retrieveSakContext når én bestemt sak er kjent.',
      inputSchema: z.object({
        query: z
          .string()
          .min(2)
          .describe('Temaet eller spørsmålet brukeren vil forstå på tvers av saker.'),
        limit: z
          .number()
          .int()
          .min(1)
          .max(5)
          .optional()
          .describe('Hvor mange saker å hente (1–5, standard 3).'),
      }),
      execute: async ({ query, limit }) => {
        const context = await retrieveTopicContext({ query, limit, client: ragClient, vectorize });
        return { query: context.query, saker: context.saker, note: context.note };
      },
    }),
    getVoteResults: tool({
      description:
        'Hent hvordan Stortinget har votert i en sak (For/Mot/ikke til stede, vedtatt eller nedstemt) og hvordan det står mot folkets anonyme For/Mot/Avstår-stemmer i appen, med samsvars-score og avstand i prosentpoeng. Bruk når brukeren spør hvordan en sak ble vedtatt eller nedstemt, hvordan Stortinget stemte, eller hva «folkets vilje» var.',
      inputSchema: z.object({
        issueId: z
          .string()
          .optional()
          .describe('Stortinget sak-id hvis kjent. La stå tom for å søke på tittel.'),
        query: z
          .string()
          .min(2)
          .optional()
          .describe('Sak-tittel, henvisning eller spørsmål hvis sak-id ikke er kjent.'),
      }),
      execute: async ({ issueId, query }) => {
        let id = issueId?.trim() || preferredIssueId?.trim() || null;
        if (!id && query) {
          const issues = await searchIssuesForChat(query, 1, ragClient);
          id = issues[0]?.id ?? null;
        }
        if (!id) {
          return {
            found: false as const,
            note: 'Fant ingen sak å hente stemmeresultat for. Oppgi sak-id eller en tydeligere tittel.',
          };
        }
        const result = await fetchVoteAlignment({ issueId: id, client: ragClient });
        if (!result) {
          return { found: false as const, note: 'Kunne ikke hente stemmeresultat for saken.' };
        }
        return { found: true as const, issueId: id, ...result };
      },
    }),
    findHearingsForSak: tool({
      description:
        'Hent høringer på Stortinget som hører til en sak, med status (åpen/planlagt/avholdt/avlyst), innspillsfrist og lenke til skriftlig innspill. Bruk når brukeren spør om høring, frist eller hvordan de kan gi innspill til en sak.',
      inputSchema: z.object({
        issueId: z
          .string()
          .optional()
          .describe('Stortinget sak-id hvis kjent. La stå tom for å søke på tittel.'),
        query: z
          .string()
          .min(2)
          .optional()
          .describe('Sak-tittel, henvisning eller spørsmål hvis sak-id ikke er kjent.'),
      }),
      execute: async ({ issueId, query }) => {
        const id = await resolveIssueId({ issueId, query });
        if (!id) {
          return {
            found: false as const,
            issueId: null,
            hearings: [],
            note: 'Fant ingen sak å hente høringer for. Oppgi sak-id eller en tydeligere tittel.',
          };
        }
        const hearings = await collectHearingsForSak(id);
        return {
          found: true as const,
          issueId: id,
          hearings,
          note: hearings.length === 0 ? 'Ingen høring er registrert for denne saken.' : null,
        };
      },
    }),
    listOpenHearings: tool({
      description:
        'List åpne og planlagte høringer på Stortinget med neste innspillsfrist. Bruk når brukeren spør hvilke høringer som er åpne nå eller vil gi innspill.',
      inputSchema: z.object({
        limit: z
          .number()
          .int()
          .min(1)
          .max(20)
          .optional()
          .describe('Hvor mange høringer å vise (1–20, standard 8).'),
      }),
      execute: async ({ limit }) => {
        const result = await collectOpenHearings(limit ?? 8);
        return {
          hearings: result.hearings,
          summary: result.summary,
          note:
            result.hearings.length === 0
              ? 'Ingen åpne eller planlagte høringer akkurat nå.'
              : null,
        };
      },
    }),
    getSakTimeline: tool({
      description:
        'Hent saksgangen til en sak (hendelser steg for steg), behandlingsstatus og neste voteringsfrist. Bruk når brukeren spør hva som har skjedd i saken eller hva som skjer videre.',
      inputSchema: z.object({
        issueId: z
          .string()
          .optional()
          .describe('Stortinget sak-id hvis kjent. La stå tom for å søke på tittel.'),
        query: z
          .string()
          .min(2)
          .optional()
          .describe('Sak-tittel, henvisning eller spørsmål hvis sak-id ikke er kjent.'),
      }),
      execute: async ({ issueId, query }) => {
        const id = await resolveIssueId({ issueId, query });
        if (!id) {
          return {
            found: false as const,
            issueId: null,
            note: 'Fant ingen sak å hente saksgang for. Oppgi sak-id eller en tydeligere tittel.',
          };
        }
        const timeline = await collectSakTimeline(id);
        if (!timeline) {
          return {
            found: false as const,
            issueId: id,
            note: 'Kunne ikke hente saksdetaljer fra Stortinget for denne saken.',
          };
        }
        return { found: true as const, issueId: id, ...timeline };
      },
    }),
    listSakDocuments: tool({
      description:
        'List dokumentene i en sak gruppert etter type (lovforslag, representantforslag, innstilling, referat). Bruk når brukeren spør hvilke dokumenter saken består av eller vil åpne dem.',
      inputSchema: z.object({
        issueId: z
          .string()
          .optional()
          .describe('Stortinget sak-id hvis kjent. La stå tom for å søke på tittel.'),
        query: z
          .string()
          .min(2)
          .optional()
          .describe('Sak-tittel, henvisning eller spørsmål hvis sak-id ikke er kjent.'),
      }),
      execute: async ({ issueId, query }) => {
        const id = await resolveIssueId({ issueId, query });
        if (!id) {
          return {
            found: false as const,
            issueId: null,
            total: 0,
            groups: [] as const,
            note: 'Fant ingen sak å hente dokumenter for. Oppgi sak-id eller en tydeligere tittel.',
          };
        }
        const listing = await collectSakDocumentGroups(id);
        if (!listing) {
          return {
            found: false as const,
            issueId: id,
            total: 0,
            groups: [] as const,
            note: 'Kunne ikke hente saksdetaljer fra Stortinget for denne saken.',
          };
        }
        return {
          found: true as const,
          issueId: id,
          total: listing.total,
          groups: listing.groups,
          note: listing.total === 0 ? 'Ingen dokumenter er registrert på saken ennå.' : null,
        };
      },
    }),
    getFolketsMeninger: tool({
      description:
        'Hent folkets meninger (innsendte for/imot/blank-meninger) for en sak, med antall per standpunkt og de nyeste innleggene. Bruk når brukeren spør hva folk mener om en sak i appen.',
      inputSchema: z.object({
        issueId: z
          .string()
          .optional()
          .describe('Stortinget sak-id hvis kjent. La stå tom for å søke på tittel.'),
        query: z
          .string()
          .min(2)
          .optional()
          .describe('Sak-tittel, henvisning eller spørsmål hvis sak-id ikke er kjent.'),
        limit: z
          .number()
          .int()
          .min(1)
          .max(8)
          .optional()
          .describe('Hvor mange nyeste meninger å vise (1–8, standard 3).'),
      }),
      execute: async ({ issueId, query, limit }) => {
        const id = await resolveIssueId({ issueId, query });
        if (!id) {
          return {
            found: false as const,
            issueId: null,
            total: 0,
            counts: null,
            latest: [],
            note: 'Fant ingen sak å hente meninger for. Oppgi sak-id eller en tydeligere tittel.',
          };
        }
        const summary = await getIssueOpinionSummary(id, limit ?? 3);
        return {
          found: true as const,
          issueId: id,
          total: summary.total,
          counts: summary.counts,
          latest: summary.latest.map((opinion) => ({
            id: opinion.id,
            title: opinion.title,
            stance: opinion.stance,
            authorName: opinion.authorName,
            createdAt: opinion.createdAt,
          })),
          note: summary.total === 0 ? 'Ingen meninger er sendt inn om denne saken ennå.' : null,
        };
      },
    }),
    getPolitician: tool({
      description:
        'Slå opp stortingspolitikere og regjeringsmedlemmer i inneværende periode etter navn eller person-id. Returnerer parti, fylke, verv og eventuell regjeringsrolle. Bruk når brukeren spør hvem en politiker er eller hvilket parti/fylke de tilhører.',
      inputSchema: z.object({
        personId: z
          .string()
          .optional()
          .describe('Stortinget person-id hvis kjent.'),
        query: z
          .string()
          .min(2)
          .optional()
          .describe('Navn (fornavn og/eller etternavn) å søke etter.'),
      }),
      execute: async ({ personId, query }) => {
        if (!personId?.trim() && !query?.trim()) {
          return { matches: [], note: 'Oppgi et navn eller en person-id å slå opp.' };
        }
        return collectPoliticianMatches({ personId, query });
      },
    }),
    ...createPollChatTools({ client: ragClient, resolveIssueId }),
    ...createPersonalChatTools({
      client: ragClient,
      userId: resolved.userId ?? null,
      impactProfile: resolved.impactProfile,
      resolveIssueId,
    }),
  };
}
