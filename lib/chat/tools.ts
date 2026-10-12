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
import { fetchVoteAlignment } from '@/lib/chat/vote-alignment';
import type { QueryVectorizer } from '@/lib/chat/vector-search';

export function createChatTools(
  preferredIssueId?: string | null,
  ragClient?: ChatRagClient | null,
  vectorize?: QueryVectorizer | null,
) {
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
  };
}
