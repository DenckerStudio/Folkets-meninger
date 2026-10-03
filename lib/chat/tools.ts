import { tool } from 'ai';
import { z } from 'zod';
import {
  SPELLING_CONTEXTS,
  runRettsskriving,
  runUpdatedSourceSearch,
} from '@/lib/chat/actions';
import {
  retrieveSakContext,
  searchIssuesForChat,
  type ChatRagClient,
} from '@/lib/chat/rag';

export function createChatTools(
  preferredIssueId?: string | null,
  ragClient?: ChatRagClient | null,
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
      description: 'List saker i vår cache som matcher en tittel, henvisning eller sak-id.',
      inputSchema: z.object({
        query: z.string().min(2).describe('Tittel, henvisning eller sak-id.'),
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
  };
}
