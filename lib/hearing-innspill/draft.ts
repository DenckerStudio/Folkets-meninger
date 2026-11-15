import { generateText, Output } from 'ai';
import { z } from 'zod';
import type { DecryptedByokCredential } from '@/lib/byok/service';
import type { ByokOutboundAccess } from '@/lib/byok/url-guard';
import { createUserLanguageModel } from '@/lib/chat/model';
import {
  hearingChunkDocumentLabel,
  searchHearingDocuments,
  type HearingChunkHit,
} from '@/lib/chat/hearing-rag';
import type { ChatRagClient } from '@/lib/chat/rag';

export const HEARING_INNSPILL_DRAFT_MAX = 6000;

const DRAFT_SCHEMA = z.object({
  draft: z.string().min(40).max(HEARING_INNSPILL_DRAFT_MAX),
});

export const HEARING_INNSPILL_DRAFT_SYSTEM = [
  'Du skriver et utkast til et skriftlig høringsinnspill på norsk bokmål.',
  'Bygg på dokumentutdragene — ikke finn på fakta, sitater eller lovhenvisninger som ikke står i kildene.',
  'Skriv i jeg-form eller nøytral borgerstil, kort og tydelig (omtrent 150–400 ord).',
  'Ikke signer med navn. Ikke si at innspillet er sendt. Dette er kun et utkast brukeren skal gjennomgå.',
].join(' ');

export function uniqueHearingSourceTitles(chunks: HearingChunkHit[]): string[] {
  const seen = new Set<string>();
  const titles: string[] = [];
  for (const chunk of chunks) {
    const label = hearingChunkDocumentLabel(chunk);
    const key = label.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    titles.push(label);
  }
  return titles;
}

function buildRagPrompt(chunks: HearingChunkHit[], hearingTitle: string): string {
  const excerpts = chunks
    .slice(0, 8)
    .map((chunk, index) => {
      const label = hearingChunkDocumentLabel(chunk);
      return `[${index + 1}] (${label})\n${chunk.content}`;
    })
    .join('\n\n');
  return `Høring: ${hearingTitle}\n\nRelevante dokumentutdrag:\n${excerpts}`;
}

export async function generateHearingInnspillDraft(args: {
  hearingId: string;
  hearingTitle: string;
  credential: DecryptedByokCredential;
  outbound: ByokOutboundAccess;
  ragClient: ChatRagClient;
}): Promise<{ draft: string; sources: string[]; note: string | null }> {
  const rag = await searchHearingDocuments({
    query: `${args.hearingTitle} høring innspill`,
    hearingId: args.hearingId,
    client: args.ragClient,
    limit: 8,
  });

  if (rag.chunks.length === 0) {
    return {
      draft: '',
      sources: [],
      note:
        rag.note ??
        'Fant ingen dokumentutdrag for denne høringen. Skriv innspillet selv, eller prøv igjen senere.',
    };
  }

  const model = await createUserLanguageModel(args.credential, args.outbound);
  const { output } = await generateText({
    model,
    output: Output.object({
      schema: DRAFT_SCHEMA,
      name: 'hearing_innspill_draft',
      description: 'Utkast til høringsinnspill basert på dokumentutdrag.',
    }),
    instructions: HEARING_INNSPILL_DRAFT_SYSTEM,
    prompt: buildRagPrompt(rag.chunks, args.hearingTitle),
  });

  if (!output?.draft?.trim()) {
    return {
      draft: '',
      sources: uniqueHearingSourceTitles(rag.chunks),
      note: 'Kunne ikke lage utkast. Prøv igjen.',
    };
  }

  return {
    draft: output.draft.trim(),
    sources: uniqueHearingSourceTitles(rag.chunks),
    note: null,
  };
}