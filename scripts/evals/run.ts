/**
 * Eval runner for Stemme+-chat, sak-sammendrag and høringer (plan P1).
 *
 *   npm run eval -- --suite chat|summary|hearing|all [--variant main] [--generate]
 *
 * Writes evals/results/<dato>-<variant>-<suite>.json and a markdown table.
 * Needs NEXT_PUBLIC_SUPABASE_URL + NEXT_PUBLIC_SUPABASE_ANON_KEY for the
 * chat-retrieval and summary suites (read-only, public tables). `--generate`
 * additionally needs EVAL_LLM_PROVIDER, EVAL_LLM_MODEL, EVAL_LLM_API_KEY
 * (and EVAL_LLM_BASE_URL for ollama/openai_compatible). The hearing suite only
 * needs network access to data.stortinget.no.
 */
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { loadEnvConfig } from '@next/env';
import { createClient } from '@supabase/supabase-js';
import {
  citationCoverage,
  danishFormHits,
  factCoverage,
  hallucinatedNumbers,
  mean,
  recallAtK,
  reciprocalRank,
  refusalCorrect,
  round,
  type RefusalKind,
} from './scoring';

const ROOT = process.cwd();
loadEnvConfig(ROOT);

type Suite = 'chat' | 'summary' | 'hearing';

type ChatCase = {
  id: string;
  kategori: 'sak' | 'tema' | 'høring' | 'votering' | 'felle';
  spørsmål: string;
  åpen_sak: string | null;
  sak_ids: string[];
  forventede_chunk_ids: string[];
  nøkkelfakta: string[];
  skal_avslå: boolean;
  avslagstype: RefusalKind | null;
};

type SakCase = {
  id: string;
  sak_id: string;
  type: string;
  ferdigbehandlet: boolean;
  henvisning: string;
  nøkkelfakta: string[];
  referansetekst: string;
};

type HearingCase = {
  id: string;
  horing_id: string;
  sak_id: string;
  tema: string;
  komite: string;
  frist: string;
};

function parseArgs(argv: string[]) {
  const args = { suites: ['chat', 'summary', 'hearing'] as Suite[], variant: 'main', generate: false };
  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    if (arg === '--suite') {
      const value = argv[++i];
      args.suites = value === 'all' ? ['chat', 'summary', 'hearing'] : [value as Suite];
    } else if (arg === '--variant') {
      args.variant = argv[++i] || 'main';
    } else if (arg === '--generate') {
      args.generate = true;
    }
  }
  return args;
}

function readJsonl<T>(file: string): T[] {
  return readFileSync(path.join(ROOT, 'evals/golden', file), 'utf8')
    .split('\n')
    .filter((line) => line.trim())
    .map((line) => JSON.parse(line) as T);
}

class InertWebSocket {
  readonly readyState = 3;
  close() {}
  send() {}
}

function supabaseFromEnv() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL?.trim();
  const key =
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY?.trim() ||
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY?.trim();
  if (!url || !key) return null;
  // Node < 22 has no global WebSocket; the eval never uses realtime, so give
  // supabase-js an inert transport instead of failing at construction.
  const realtime =
    typeof globalThis.WebSocket === 'undefined'
      ? { transport: InertWebSocket as unknown as typeof WebSocket }
      : undefined;
  return {
    client: createClient(url, key, { auth: { persistSession: false }, ...(realtime ? { realtime } : {}) }),
    host: new URL(url).host,
  };
}

function osloDate(value: string | Date): string {
  const date = typeof value === 'string' ? new Date(value) : value;
  return new Intl.DateTimeFormat('sv-SE', { timeZone: 'Europe/Oslo' }).format(date);
}

type Blocked = { blocked: string };

async function runChat(generate: boolean): Promise<Record<string, unknown> | Blocked> {
  const db = supabaseFromEnv();
  if (!db) return { blocked: 'NEXT_PUBLIC_SUPABASE_URL / NEXT_PUBLIC_SUPABASE_ANON_KEY mangler' };
  const { searchIssuesForChat, retrieveSakContext, retrieveTopicContext } = await import('@/lib/chat/rag');
  const cases = readJsonl<ChatCase>('chat.jsonl');

  let gen: null | {
    run: (c: ChatCase) => Promise<{ text: string; toolOutputs: string[]; ms: number }>;
  } = null;
  let generateBlocked: string | null = null;
  if (generate) {
    const provider = process.env.EVAL_LLM_PROVIDER?.trim();
    const model = process.env.EVAL_LLM_MODEL?.trim();
    const apiKey = process.env.EVAL_LLM_API_KEY?.trim() ?? '';
    if (!provider || !model || (!apiKey && provider !== 'ollama')) {
      generateBlocked = 'EVAL_LLM_PROVIDER / EVAL_LLM_MODEL / EVAL_LLM_API_KEY mangler';
    } else {
      const [{ generateText, isStepCount }, { buildChatInstructions }, { createUserLanguageModel }, { createChatTools }, { createOllamaVectorizer }] =
        await Promise.all([
          import('ai'),
          import('@/lib/chat/instructions'),
          import('@/lib/chat/model'),
          import('@/lib/chat/tools'),
          import('@/lib/chat/vector-search'),
        ]);
      const credential = {
        provider: provider as Parameters<typeof createUserLanguageModel>[0]['provider'],
        model,
        apiKey,
        baseUrl: process.env.EVAL_LLM_BASE_URL?.trim() || null,
        keyLast4: 'eval',
        updatedAt: new Date().toISOString(),
      };
      const languageModel = createUserLanguageModel(credential);
      const vectorize = createOllamaVectorizer(credential);
      gen = {
        run: async (c) => {
          const started = Date.now();
          const result = await generateText({
            model: languageModel,
            instructions: buildChatInstructions(c.åpen_sak),
            messages: [{ role: 'user', content: c.spørsmål }],
            tools: createChatTools({
              preferredIssueId: c.åpen_sak,
              ragClient: db.client,
              vectorize,
              userId: null,
            }),
            stopWhen: isStepCount(8),
          });
          const toolOutputs = result.steps.flatMap((step) =>
            step.toolResults.map((toolResult) => JSON.stringify(toolResult.output ?? null)),
          );
          return { text: result.text, toolOutputs, ms: Date.now() - started };
        },
      };
    }
  }

  const rows: Array<Record<string, unknown>> = [];
  for (const c of cases) {
    const hits = await searchIssuesForChat(c.spørsmål, 8, db.client);
    const retrievedIds = hits.map((hit) => hit.id);

    let contextText = '';
    let chunkKeys: string[] = [];
    if (c.kategori === 'tema') {
      const topic = await retrieveTopicContext({ query: c.spørsmål, limit: 3, client: db.client });
      contextText = JSON.stringify(topic.saker);
      chunkKeys = topic.saker.flatMap((sak) => sak.chunks.map((ch) => `${ch.documentId}:${ch.chunkIndex}`));
    } else if (c.kategori !== 'felle' || c.åpen_sak) {
      const sak = await retrieveSakContext({ issueId: c.åpen_sak, query: c.spørsmål, client: db.client });
      contextText = JSON.stringify(sak);
      chunkKeys = sak.chunks.map((ch) => `${ch.documentId}:${ch.chunkIndex}`);
    }

    const row: Record<string, unknown> = {
      id: c.id,
      kategori: c.kategori,
      sak_recall_at_8: c.åpen_sak ? null : recallAtK(c.sak_ids, retrievedIds, 8),
      sak_mrr: c.åpen_sak ? null : reciprocalRank(c.sak_ids, retrievedIds),
      chunk_recall_at_8: c.forventede_chunk_ids.length ? recallAtK(c.forventede_chunk_ids, chunkKeys, 8) : null,
      context_fact_coverage: factCoverage(c.nøkkelfakta, contextText),
      retrieved_sak_ids: retrievedIds,
    };

    if (gen) {
      try {
        const answer = await gen.run(c);
        const sources = [...answer.toolOutputs, c.spørsmål];
        row.answer_fact_coverage = factCoverage(c.nøkkelfakta, answer.text);
        row.hallucinated_numbers = hallucinatedNumbers(answer.text, sources);
        row.citation_coverage = citationCoverage(answer.text);
        row.danish_hits = danishFormHits(answer.text);
        row.refusal_correct =
          c.skal_avslå && c.avslagstype ? refusalCorrect(c.avslagstype, answer.text, sources) : null;
        row.latency_ms = answer.ms;
        row.answer = answer.text;
      } catch (error) {
        row.generate_error = error instanceof Error ? error.message.slice(0, 200) : 'ukjent feil';
      }
    }
    rows.push(row);
  }

  const num = (key: string) => rows.map((row) => row[key] as number | null | undefined);
  const generated = rows.filter((row) => typeof row.answer === 'string');
  return {
    database_host: db.host,
    generate: gen ? true : generateBlocked ? { blocked: generateBlocked } : false,
    metrics: {
      cases: rows.length,
      sak_recall_at_8: round(mean(num('sak_recall_at_8'))),
      sak_mrr: round(mean(num('sak_mrr'))),
      chunk_recall_at_8: round(mean(num('chunk_recall_at_8'))),
      context_fact_coverage: round(mean(num('context_fact_coverage'))),
      ...(gen
        ? {
            answered: generated.length,
            answer_fact_coverage: round(mean(num('answer_fact_coverage'))),
            citation_coverage: round(mean(num('citation_coverage'))),
            answers_with_hallucinated_numbers: generated.filter(
              (row) => (row.hallucinated_numbers as string[]).length > 0,
            ).length,
            answers_with_danish_forms: generated.filter((row) => (row.danish_hits as string[]).length > 0).length,
            refusal_accuracy: round(mean(rows.map((row) => (row.refusal_correct == null ? null : row.refusal_correct ? 1 : 0)))),
            latency_p50_ms: percentile(num('latency_ms'), 0.5),
            latency_p95_ms: percentile(num('latency_ms'), 0.95),
            faithfulness: null,
            faithfulness_note: 'Krever LLM-dommer (åpent spørsmål 7 i planen); ikke målt.',
          }
        : {}),
    },
    rows,
  };
}

function percentile(values: ReadonlyArray<number | null | undefined>, p: number): number | null {
  const nums = values.filter((value): value is number => typeof value === 'number').sort((a, b) => a - b);
  if (nums.length === 0) return null;
  return nums[Math.min(nums.length - 1, Math.floor(p * nums.length))];
}

async function runSummary(): Promise<Record<string, unknown> | Blocked> {
  const db = supabaseFromEnv();
  if (!db) return { blocked: 'NEXT_PUBLIC_SUPABASE_URL / NEXT_PUBLIC_SUPABASE_ANON_KEY mangler' };
  const cases = readJsonl<SakCase>('saker.jsonl');
  const rows: Array<Record<string, unknown>> = [];
  for (const c of cases) {
    const [{ data: summary }, { data: issue }, { data: chunks }] = await Promise.all([
      db.client.from('issue_ai_summaries').select('*').eq('stortinget_issue_id', c.sak_id).maybeSingle(),
      db.client.from('stortinget_issues').select('id, title, summary, henvisning').eq('id', c.sak_id).maybeSingle(),
      db.client.from('document_chunks').select('content').eq('issue_id', c.sak_id).limit(500),
    ]);
    if (!summary) {
      rows.push({ id: c.id, sak_id: c.sak_id, has_summary: false, issue_in_db: Boolean(issue), chunks: chunks?.length ?? 0 });
      continue;
    }
    const s = summary as Record<string, unknown>;
    const text = ['hva', 'hvem', 'kostnad', 'narrative', 'who_affected', 'how_affected']
      .map((key) => (typeof s[key] === 'string' ? (s[key] as string) : ''))
      .join('\n');
    const sources = [
      JSON.stringify(issue ?? {}),
      ...((chunks ?? []) as Array<{ content: string | null }>).map((chunk) => chunk.content ?? ''),
    ];
    rows.push({
      id: c.id,
      sak_id: c.sak_id,
      has_summary: true,
      valid_length:
        String(s.hva ?? '').trim().length >= 40 && String(s.hvem ?? '').trim().length >= 20,
      fact_coverage: factCoverage(c.nøkkelfakta, text),
      hallucinated_numbers: hallucinatedNumbers(text, sources),
      danish_hits: danishFormHits(text),
      chunks: chunks?.length ?? 0,
    });
  }
  const withSummary = rows.filter((row) => row.has_summary);
  return {
    database_host: db.host,
    metrics: {
      cases: rows.length,
      with_summary: withSummary.length,
      fact_coverage: round(mean(withSummary.map((row) => row.fact_coverage as number | null))),
      summaries_with_hallucinated_numbers: withSummary.filter(
        (row) => (row.hallucinated_numbers as string[]).length > 0,
      ).length,
      summaries_with_danish_forms: withSummary.filter((row) => (row.danish_hits as string[]).length > 0).length,
      valid_length: withSummary.filter((row) => row.valid_length).length,
      faithfulness: null,
      faithfulness_note: 'Krever LLM-dommer (åpent spørsmål 7 i planen); ikke målt.',
    },
    rows,
  };
}

async function runHearing(): Promise<Record<string, unknown> | Blocked> {
  const { collectHearingsForSak } = await import('@/lib/chat/stortinget-tools');
  const cases = readJsonl<HearingCase>('horinger.jsonl');
  const rows: Array<Record<string, unknown>> = [];
  for (const c of cases) {
    let hearings: Awaited<ReturnType<typeof collectHearingsForSak>> = [];
    let error: string | null = null;
    try {
      hearings = await collectHearingsForSak(c.sak_id);
    } catch (err) {
      error = err instanceof Error ? err.message.slice(0, 200) : 'ukjent feil';
    }
    const match = hearings.find((hearing) => hearing.id === c.horing_id) ?? null;
    const text = match ? JSON.stringify(match) : '';
    const fristOk = Boolean(match?.deadline && osloDate(match.deadline) === osloDate(c.frist));
    const komiteOk = Boolean(match?.committee && match.committee === c.komite);
    const temaOk = Boolean(match && factCoverage([c.tema], text) === 1);
    rows.push({
      id: c.id,
      horing_id: c.horing_id,
      found: Boolean(match),
      frist_ok: fristOk,
      komite_ok: komiteOk,
      tema_ok: temaOk,
      innspill_url: match?.skriftligInnspillUrl ?? null,
      error,
    });
  }
  const share = (key: string) => round(rows.filter((row) => Boolean(row[key])).length / rows.length);
  return {
    source: 'data.stortinget.no (live, via lib/chat/stortinget-tools collectHearingsForSak)',
    metrics: {
      cases: rows.length,
      found: share('found'),
      frist_ok: share('frist_ok'),
      komite_ok: share('komite_ok'),
      tema_ok: share('tema_ok'),
      key_fact_coverage: round(
        mean(rows.map((row) => [row.frist_ok, row.komite_ok, row.tema_ok].filter(Boolean).length / 3)),
      ),
      ai_hearing_summaries: 0,
      ai_hearing_summaries_note: 'Høringssammendrag finnes ikke i dag (plan P9/4.3).',
    },
    rows,
  };
}

function markdown(suite: Suite, variant: string, result: Record<string, unknown>): string {
  const lines = [`# Eval ${suite} – ${variant} – ${new Date().toISOString()}`, ''];
  if ('blocked' in result) {
    lines.push(`Ikke kjørt: ${String(result.blocked)}`);
    return lines.join('\n') + '\n';
  }
  lines.push('| Metrikk | Verdi |', '|---|---|');
  for (const [key, value] of Object.entries((result.metrics as Record<string, unknown>) ?? {})) {
    lines.push(`| ${key} | ${value == null ? '–' : String(value)} |`);
  }
  return lines.join('\n') + '\n';
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  const outDir = path.join(ROOT, 'evals/results');
  mkdirSync(outDir, { recursive: true });
  const stamp = osloDate(new Date());

  for (const suite of args.suites) {
    const started = Date.now();
    const result =
      suite === 'chat' ? await runChat(args.generate) : suite === 'summary' ? await runSummary() : await runHearing();
    const payload = { suite, variant: args.variant, ran_at: new Date().toISOString(), elapsed_ms: Date.now() - started, ...result };
    const base = path.join(outDir, `${stamp}-${args.variant}-${suite}`);
    writeFileSync(`${base}.json`, JSON.stringify(payload, null, 2) + '\n');
    writeFileSync(`${base}.md`, markdown(suite, args.variant, result));
    console.log(markdown(suite, args.variant, result));
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
