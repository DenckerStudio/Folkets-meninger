import { generateText, Output } from 'ai';
import { z } from 'zod';
import type { DecryptedByokCredential } from '@/lib/byok/service';
import {
  RETTSSKRIVING_DRAFT_MAX,
  RETTSSKRIVING_INSTRUCTION,
  runRettsskriving,
  spellingContextLabel,
  type RettsskrivingResult,
  type SpellingContext,
} from '@/lib/chat/actions';
import { createUserLanguageModel } from '@/lib/chat/model';

const NOTES_MAX = 400;

const RETTSSKRIVING_CORRECTION_SCHEMA = z.object({
  corrected: z.string().min(1).max(RETTSSKRIVING_DRAFT_MAX),
  notes: z.string().max(NOTES_MAX),
});

export const RETTSSKRIVING_PROVIDER_ERROR =
  'Kunne ikke rette kladden. Sjekk at nøkkelen og modellen er gyldige.';

export const RETTSSKRIVING_SYSTEM = [
  'Du retter stavemåte, grammatikk og tydelighet i brukerens egen kladd.',
  RETTSSKRIVING_INSTRUCTION,
  'Svar på norsk bokmål.',
  'Returner corrected (rettet kladd) og notes (korte merknader, maks tre setninger).',
  'Hvis kladden allerede er god, returner den uendret og si det i notes.',
  'Ikke publiser teksten. Ikke stem. Ikke later som du er brukeren.',
].join(' ');

export type RettsskrivingResolveOk = { ok: true; result: RettsskrivingResult };
export type RettsskrivingResolveErr =
  | { ok: false; providerError: false; error: string }
  | { ok: false; providerError: true; error: string };

export type RettsskrivingCorrectFn = (input: {
  draft: string;
  context: SpellingContext;
  credential: DecryptedByokCredential;
}) => Promise<RettsskrivingResult>;

function logProviderFailure(error: unknown): void {
  const message = error instanceof Error ? error.message : 'unknown rettskriving error';
  if (/sk-|api[_-]?key|bearer\s+[a-z0-9-]+/i.test(message)) {
    console.error('[rettskriving] provider error (redacted)');
    return;
  }
  console.error('[rettskriving] provider error:', message);
}

export async function correctRettsskrivingWithCredential(input: {
  draft: string;
  context: SpellingContext;
  credential: DecryptedByokCredential;
}): Promise<RettsskrivingResult> {
  const model = createUserLanguageModel(input.credential);
  const { output } = await generateText({
    model,
    output: Output.object({
      schema: RETTSSKRIVING_CORRECTION_SCHEMA,
      name: 'rettskriving',
      description: 'Rettet kladd og korte merknader. Ikke nytt politisk innhold.',
    }),
    instructions: RETTSSKRIVING_SYSTEM,
    prompt: `Brukes som: ${spellingContextLabel(input.context)}\n\nKladd:\n${input.draft}`,
  });

  if (!output) {
    throw new Error('Ingen retting fra leverandøren');
  }

  const corrected = output.corrected.trim();
  if (!corrected) {
    throw new Error('Tom retting fra leverandøren');
  }

  return {
    original: input.draft,
    context: input.context,
    instruction: RETTSSKRIVING_INSTRUCTION,
    published: false,
    mode: 'corrected',
    corrected,
    notes: output.notes.trim().slice(0, NOTES_MAX) || null,
  };
}

/** Validate the draft, then correct with BYOK when a credential exists. Never invents a correction. */
export async function resolveRettsskrivingResult(input: {
  draft: string;
  context: SpellingContext;
  credential: DecryptedByokCredential | null;
  correctDraft?: RettsskrivingCorrectFn;
}): Promise<RettsskrivingResolveOk | RettsskrivingResolveErr> {
  const validated = runRettsskriving({ draft: input.draft, context: input.context });
  if (!validated.ok) {
    return { ok: false, providerError: false, error: validated.error };
  }

  if (!input.credential) {
    return { ok: true, result: validated.result };
  }

  try {
    const correct = input.correctDraft ?? correctRettsskrivingWithCredential;
    const result = await correct({
      draft: validated.result.original,
      context: input.context,
      credential: input.credential,
    });
    return { ok: true, result };
  } catch (error) {
    logProviderFailure(error);
    return { ok: false, providerError: true, error: RETTSSKRIVING_PROVIDER_ERROR };
  }
}
