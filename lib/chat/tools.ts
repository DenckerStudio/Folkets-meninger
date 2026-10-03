import { tool } from 'ai';
import { z } from 'zod';
import { retrieveSakContext, searchIssuesForChat } from '@/lib/chat/rag';
import { searchSearxng } from '@/lib/chat/searxng';

const spellingContexts = ['diskusjon', 'motforslag', 'horing', 'annet'] as const;

export function createChatTools(preferredIssueId?: string | null) {
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
        const result = await searchSearxng(query);
        if (!result.ok) {
          return { unavailable: true, error: result.error, results: [] as const };
        }
        return { unavailable: false, results: result.results };
      },
    }),
    helpRettsskriving: tool({
      description:
        'Hjelp brukeren med rettskriving og grammatikk i en kladd til sak-diskusjon, motforslag eller høringsinnspill. Returner rettet tekst og korte merknader. Generer ikke nytt politisk innhold.',
      inputSchema: z.object({
        draft: z.string().min(8).max(8000).describe('Brukerens egen kladd.'),
        context: z.enum(spellingContexts).describe('Hvor teksten skal brukes.'),
      }),
      execute: async ({ draft, context }) => {
        return {
          original: draft,
          context,
          instruction:
            'Rett stavemåte, grammatikk og tydelighet. Behold brukerens mening. Ikke finn på argumenter, sitater eller fakta. Ikke formuler et ferdig innlegg som om det var publisert.',
        };
      },
    }),
    listMatchingSaker: tool({
      description: 'List saker i vår cache som matcher en tittel, henvisning eller sak-id.',
      inputSchema: z.object({
        query: z.string().min(2).describe('Tittel, henvisning eller sak-id.'),
      }),
      execute: async ({ query }) => {
        const issues = await searchIssuesForChat(query, 8);
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
