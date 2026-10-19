import { tool } from 'ai';
import { z } from 'zod';
import {
  SPELLING_CONTEXTS,
  runRettsskriving,
  runUpdatedSourceSearch,
} from '@/lib/chat/actions';
import {
  createCitationRegistry,
  uniqueSources,
  type ChatSource,
  type CitationRegistry,
} from '@/lib/chat/citations';
import {
  loadIssueMeta,
  retrieveSakContext,
  retrieveTopicContext,
  searchIssuesForChat,
  type ChatDocumentChunk,
  type ChatIssueHit,
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
import { searchHearingDocuments } from '@/lib/chat/hearing-rag';
import { getIssueOpinionSummary } from '@/lib/opinions/service';

export type ChatToolOptions = {
  preferredIssueId?: string | null;
  preferredHearingId?: string | null;
  ragClient?: ChatRagClient | null;
  vectorize?: QueryVectorizer | null;
  /** Request-session user id. Never taken from the client body or a tool argument. */
  userId?: string | null;
  /** Browser-local impact profile forwarded by the chat client. */
  impactProfile?: unknown;
  /** Per-request source numbering; a fresh registry is created when omitted. */
  citations?: CitationRegistry | null;
};

/**
 * Focused Stemme+ tool set sent to the model (plan P2, «kort verktøyprofil»).
 * Core sak/topic/hearing/vote retrieval plus the user's own data. Tools left
 * out stay available via `createChatTools` for tests and older conversations:
 * - helpRettsskriving: rettskriving lives in the opinion composer
 *   (`/api/chat/rettskriving`), next to the text the user is writing.
 * - listSakDocuments: overlaps retrieveSakContext, whose excerpts now carry
 *   numbered document sources.
 * - getFolketsMeninger: individual opinions are user content and must not be
 *   mixed into factual context (plan 3.1); aggregated votes come from getVoteResults.
 * - getPublicProfile: only echoes the user's own public display name; no page
 *   context or suggestion asks for it.
 * getPolitician and getPollResults stay in: the chat opens with suggestions on
 * politician and poll pages (lib/chat/suggestions.ts) that only they can answer.
 * Every view suggestion must map to a tool in this list (suggestions.test.ts).
 */
export const FOCUSED_CHAT_TOOL_NAMES = [
  'retrieveSakContext',
  'retrieveTopicContext',
  'listMatchingSaker',
  'getVoteResults',
  'getPollResults',
  'getSakTimeline',
  'findHearingsForSak',
  'listOpenHearings',
  'searchHearingDocuments',
  'searchUpdatedSources',
  'getPolitician',
  'getMyActivity',
  'getImpact',
  'listMyNotifications',
  'getInnspillStatus',
] as const;

export type FocusedChatToolName = (typeof FOCUSED_CHAT_TOOL_NAMES)[number];

export function selectFocusedChatTools<T extends Record<FocusedChatToolName, unknown>>(
  tools: T,
): Pick<T, FocusedChatToolName> {
  const picked = {} as Pick<T, FocusedChatToolName>;
  for (const name of FOCUSED_CHAT_TOOL_NAMES) {
    picked[name] = tools[name];
  }
  return picked;
}

export function createChatTools(options?: ChatToolOptions | string | null) {
  const resolved: ChatToolOptions =
    typeof options === 'string' || options == null
      ? { preferredIssueId: options ?? null }
      : options;
  const preferredIssueId = resolved.preferredIssueId ?? null;
  const preferredHearingId = resolved.preferredHearingId ?? null;
  const ragClient = resolved.ragClient ?? null;
  const vectorize = resolved.vectorize ?? null;
  const citations = resolved.citations ?? createCitationRegistry();

  const citeIssue = (issue: Pick<ChatIssueHit, 'id' | 'title'> | null): ChatSource | null =>
    issue
      ? citations.cite({ kind: 'sak', title: issue.title || `Sak ${issue.id}`, issueId: issue.id })
      : null;

  const citeChunks = (issueId: string, chunks: readonly ChatDocumentChunk[]) =>
    chunks.map((chunk) => {
      const source = citations.cite({
        kind: 'dokument',
        title: chunk.documentTitle || 'Dokument i saken',
        issueId,
        documentId: chunk.documentId,
      });
      return { chunk: { ...chunk, kilde: source.n }, source };
    });

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
        'Hent sak, sammendrag og dokumentutdrag fra Folkets Meninger. Hvert utdrag har et kildenummer (kilde) som du siterer som [n]. Bruk når brukeren spør om en bestemt stortingssak.',
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
        const issueSource = citeIssue(context.issue);
        const cited = context.issue ? citeChunks(context.issue.id, context.chunks) : [];
        return {
          issue: context.issue ? { ...context.issue, kilde: issueSource?.n ?? null } : null,
          summary: context.summary,
          chunks: context.issue ? cited.map((entry) => entry.chunk) : context.chunks,
          kilder: uniqueSources([
            ...(issueSource ? [issueSource] : []),
            ...cited.map((entry) => entry.source),
          ]),
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
        const sources = result.results.map((hit) =>
          citations.cite({ kind: 'nett', title: hit.title || hit.url, url: hit.url }),
        );
        return {
          unavailable: false,
          results: result.results.map((hit, index) => ({ ...hit, kilde: sources[index].n })),
          kilder: uniqueSources(sources),
        };
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
        const found = await searchIssuesForChat(query, 8, ragClient);
        const sources = found.map((issue) => citeIssue(issue)!);
        const issues = found.map((issue, index) => ({ ...issue, kilde: sources[index].n }));
        return {
          issues,
          kilder: uniqueSources(sources),
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
        const sources: ChatSource[] = [];
        const saker = context.saker.map((sak) => {
          const issueSource = citeIssue(sak.issue)!;
          const cited = citeChunks(sak.issue.id, sak.chunks);
          sources.push(issueSource, ...cited.map((entry) => entry.source));
          return {
            ...sak,
            issue: { ...sak.issue, kilde: issueSource.n },
            chunks: cited.map((entry) => entry.chunk),
          };
        });
        return { query: context.query, saker, kilder: uniqueSources(sources), note: context.note };
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
        const [result, meta] = await Promise.all([
          fetchVoteAlignment({ issueId: id, client: ragClient }),
          loadIssueMeta(id, ragClient),
        ]);
        if (!result) {
          return { found: false as const, note: 'Kunne ikke hente stemmeresultat for saken.' };
        }
        const source = citeIssue({ id, title: meta?.title ?? null })!;
        return { found: true as const, issueId: id, kilde: source.n, kilder: [source], ...result };
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
        const collected = await collectHearingsForSak(id);
        const sources = collected.map((hearing) =>
          citations.cite({
            kind: 'høring',
            title: hearing.title,
            issueId: id,
            // Saksgang-derived hearings have no public hearing page.
            hearingId: hearing.id.startsWith('saksgang-') ? null : hearing.id,
            url: hearing.skriftligInnspillUrl,
          }),
        );
        const hearings = collected.map((hearing, index) => ({ ...hearing, kilde: sources[index].n }));
        return {
          found: true as const,
          issueId: id,
          hearings,
          kilder: uniqueSources(sources),
          note: hearings.length === 0 ? 'Ingen høring er registrert for denne saken.' : null,
        };
      },
    }),
    searchHearingDocuments: tool({
      description:
        'Søk i høringsdokumenter (program, sakspublikasjoner) som er lagret for Stortingets høringer. Returner utdrag med kildenummer, frist, komité og lenker. Bruk når brukeren spør hva en høring handler om, hva som etterspørres i innspill, eller vil ha sitater fra høringskilder. Presenter fakta nøytralt uten å anbefale standpunkt.',
      inputSchema: z.object({
        query: z
          .string()
          .min(2)
          .describe('Søkeord eller spørsmål om innholdet i høringsdokumentene.'),
        hearingId: z
          .string()
          .optional()
          .describe('Stortinget hørings-id hvis kjent. La stå tom på en høringsside.'),
      }),
      execute: async ({ query, hearingId }) => {
        const resolvedHearingId = hearingId?.trim() || preferredHearingId?.trim() || null;
        const result = await searchHearingDocuments({
          query,
          hearingId: resolvedHearingId,
          client: ragClient,
        });

        const sources: ChatSource[] = [];
        const excerpts = result.chunks.map((chunk) => {
          const source = citations.cite({
            kind: 'dokument',
            title: chunk.documentTitle || 'Høringsdokument',
            hearingId: chunk.hearingId,
            documentId: chunk.documentId,
            url: chunk.sourceUrl,
          });
          sources.push(source);
          return {
            kilde: source.n,
            content: chunk.content,
            documentTitle: chunk.documentTitle,
            documentKind: chunk.documentKind,
            sourceUrl: chunk.sourceUrl,
          };
        });

        if (result.hearing) {
          sources.push(
            citations.cite({
              kind: 'høring',
              title: result.hearing.title,
              hearingId: result.hearing.id,
              url: result.hearing.skriftligInnspillUrl,
            }),
          );
        }

        return {
          hearing: result.hearing,
          excerpts,
          kilder: uniqueSources(sources),
          note: result.note,
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
        const sources = result.hearings.map((hearing) =>
          citations.cite({
            kind: 'høring',
            title: hearing.title,
            hearingId: hearing.id,
            url: hearing.skriftligInnspillUrl,
          }),
        );
        return {
          hearings: result.hearings.map((hearing, index) => ({ ...hearing, kilde: sources[index].n })),
          kilder: uniqueSources(sources),
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
        const source = citeIssue({ id, title: timeline.title })!;
        return { found: true as const, issueId: id, kilde: source.n, kilder: [source], ...timeline };
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
        'Slå opp stortingspolitikere og regjeringsmedlemmer i inneværende periode etter navn eller person-id. Returnerer parti, fylke, verv og eventuell regjeringsrolle, med kilde [n] per treff. Bruk når brukeren spør hvem en politiker er eller hvilket parti/fylke de tilhører.',
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
        const result = await collectPoliticianMatches({ personId, query });
        const sources = result.matches.map((politician) =>
          citations.cite({ kind: 'politiker', title: politician.name, personId: politician.id }),
        );
        return {
          ...result,
          matches: result.matches.map((politician, index) => ({ ...politician, kilde: sources[index].n })),
          kilder: uniqueSources(sources),
        };
      },
    }),
    ...createPollChatTools({ client: ragClient, citations, resolveIssueId }),
    ...createPersonalChatTools({
      client: ragClient,
      userId: resolved.userId ?? null,
      impactProfile: resolved.impactProfile,
      resolveIssueId,
    }),
  };
}
