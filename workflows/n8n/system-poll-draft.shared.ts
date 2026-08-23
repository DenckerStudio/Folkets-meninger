/** System poll drafts (Reels) from Stortinget-sak RAG. */

export const FETCH_SAK_FOR_POLL_SQL = `WITH target AS (
  SELECT i.id
  FROM public.stortinget_issues i
  WHERE i.status = 'pending'
    AND EXISTS (
      SELECT 1
      FROM public.document_chunks dc
      WHERE dc.issue_id = i.id
        AND dc.embedding_status = 'ready'
        AND dc.embedding IS NOT NULL
    )
    AND NOT EXISTS (
      SELECT 1
      FROM public.polls p
      WHERE p.stortinget_issue_id = i.id
        AND p.status IN ('draft', 'open', 'closed')
    )
    AND (
      NULLIF(trim($1::text), '') IS NULL
      OR i.id = NULLIF(trim($1::text), '')
    )
  ORDER BY i.last_updated_at DESC NULLS LAST, i.first_seen_at ASC
  LIMIT 1
)
SELECT
  i.id AS issue_id,
  i.title AS issue_title,
  COALESCE(i.summary, '') AS issue_summary,
  COALESCE(i.category, '') AS issue_category,
  i.first_seen_at,
  i.last_updated_at,
  left(
    COALESCE(
      nullif(trim(i.detail_json->>'innstillingstekst'), ''),
      nullif(trim(i.detail_json->>'vedtakstekst'), ''),
      i.summary,
      ''
    ),
    2400
  ) AS detail_excerpt,
  s.hva AS ai_hva,
  s.hvem AS ai_hvem,
  s.kostnad AS ai_kostnad,
  (
    SELECT COALESCE(
      json_agg(
        json_build_object(
          'document_id', d.document_id,
          'title', d.title,
          'document_type', d.document_type,
          'source_url', d.source_url
        )
        ORDER BY d.fetched_at DESC
      ),
      '[]'::json
    )
    FROM public.stortinget_issue_documents d
    WHERE d.issue_id = i.id
    LIMIT 6
  ) AS documents,
  (
    SELECT COALESCE(
      json_agg(DISTINCT lower(trim(title))) FILTER (
        WHERE title IS NOT NULL AND trim(title) <> ''
      ),
      '[]'::json
    )
    FROM public.polls
    WHERE trim(title) <> '' AND status IN ('open', 'draft', 'closed')
  ) AS existing_questions
FROM target t
JOIN public.stortinget_issues i ON i.id = t.id
LEFT JOIN public.issue_ai_summaries s ON s.stortinget_issue_id = i.id`;

export const RAG_RETRIEVE_SQL = `SELECT
  id,
  document_id,
  chunk_index,
  content,
  similarity
FROM public.match_issue_document_chunks(
  $1::text,
  $2::vector,
  $3::int
)`;

export const BUILD_RAG_QUERY_JS = `const sak = $('Expand sak for poll').first()?.json || $input.first()?.json || {};
const parts = [
  sak.issue_title,
  sak.issue_summary,
  sak.detail_excerpt,
  sak.ai_hva,
].map((v) => String(v || '').trim()).filter(Boolean);
const ragQuery = parts.join(' ').slice(0, 1200) || String(sak.issue_title || 'stortingssak');
return [{ json: { ...sak, ragQuery } }];`;

export const MAP_EMBEDDING_FOR_RAG_JS = `const sak = $('Build RAG query').first()?.json || {};
const embItem = $('Ollama embeddings').first()?.json || {};
const embedding = embItem.embedding;
if (!Array.isArray(embedding) || embedding.length === 0) {
  throw new Error('Missing embedding vector for RAG retrieval');
}
const vectorLiteral = '[' + embedding.join(',') + ']';
return [{
  json: {
    issue_id: sak.issue_id,
    vectorLiteral,
    matchCount: 8,
  },
}];`;

export const MERGE_RAG_CONTEXT_JS = `const sak = $('Build RAG query').first()?.json || {};
const ragRows = $('Retrieve RAG chunks').all().map((i) => i.json);
const chunks = ragRows.filter((r) => r && r.content);

const chunkBlock = chunks.length
  ? chunks
      .map(
        (c, idx) =>
          '[' +
          idx +
          '] ' +
          (c.document_id || 'dok') +
          ' #' +
          (c.chunk_index ?? 0) +
          ' (likhet ' +
          (typeof c.similarity === 'number' ? c.similarity.toFixed(2) : '?') +
          ')\\n' +
          String(c.content || '').slice(0, 1400),
      )
      .join('\\n\\n')
  : '(ingen RAG-chunks — bruk sammendrag og utdrag)';

const docs = Array.isArray(sak.documents) ? sak.documents : [];
const docBlock = docs.length
  ? docs
      .map((d, idx) => '[' + idx + '] ' + (d.title || 'Dokument') + ' (' + (d.document_type || 'dok') + ')')
      .join('\\n')
  : '(ingen dokumenter)';

const summaryBlock = [
  sak.ai_hva ? 'Hva: ' + sak.ai_hva : '',
  sak.ai_hvem ? 'Hvem: ' + sak.ai_hvem : '',
  sak.ai_kostnad ? 'Kostnad: ' + sak.ai_kostnad : '',
]
  .filter(Boolean)
  .join('\\n');

const existing = (sak.existing_questions || []).slice(0, 35).map((q) => '- ' + q).join('\\n');

const promptText = [
  'STORTINGSSAK: ' + (sak.issue_title || ''),
  sak.issue_category ? 'Kategori: ' + sak.issue_category : '',
  '',
  'SAMMENDRAG:',
  summaryBlock || sak.issue_summary || '(mangler)',
  '',
  'UTDRAG FRA SAK:',
  sak.detail_excerpt || '(mangler)',
  '',
  'DOKUMENTER:',
  docBlock,
  '',
  'RAG-CHUNKS (grunnlag for spørsmål):',
  chunkBlock,
  '',
  'EXISTING_PROMPTS (unngå duplikat):',
  existing || '(ingen)',
  '',
  'Returner research + ett JA/NEI/BLANK-spørsmål som JSON.',
].join('\\n');

const sourceUrls = [];
if (sak.issue_id) {
  sourceUrls.push({
    label: 'Stortingssak ' + sak.issue_id,
    url: '/dashboard/sak/' + sak.issue_id,
  });
}
for (const d of docs.slice(0, 4)) {
  if (d && d.source_url) {
    sourceUrls.push({
      label: d.title || d.document_id || 'Dokument',
      url: d.source_url,
    });
  }
}

return [{
  json: {
    ...sak,
    promptText,
    rag_chunks: chunks,
    source_urls: sourceUrls,
  },
}];`;

export const SYSTEM_POLL_GENERATOR_SYSTEM = `Du er AI-journalist for Folkets Stemme.

INPUT: én stortingssak med sammendrag, utdrag og nummererte RAG-chunks [0], [1], …
Les kildene og lag nøyaktig ETT ja/nei-spørsmål (tredje valg er alltid Blank) om et konkret politisk valg i saken.

Spørsmål-regler:
- Konkret politisk valg («Mener du …», «Støtter du at …», «Bør Norge …»)
- ALDRI sitér sakstittel i anførselstegn som spørsmålet
- Unngå duplikat av EXISTING_PROMPTS (semantisk samme tema)
- Maks 120 tegn, grammatisk korrekt norsk
- Spørsmålet SKAL dekkes av RAG-chunks eller sammendrag (source_indices)
- Nøytral formulering
- Ikke lag egne svaralternativer — ballot er alltid Ja / Nei / Blank

Returner KUN gyldig JSON:
{
  "research": {
    "story_title": "…",
    "summary": "2–3 nøytrale setninger",
    "political_choice": "…",
    "confidence": "high|medium|low"
  },
  "prompt": {
    "question": "…",
    "novelty_explanation": "maks 160 tegn",
    "source_indices": [0],
    "repeat_reason": null
  }
}

Hvis kildene mangler substans: sett repeat_reason og tom question.`;

export const SYSTEM_POLL_GENERATOR_SAVE_JS = `const sak = $('Merge RAG context').first()?.json || {};
const agent = $('System poll generator (Ollama)').first()?.json || {};
let out = agent.output;
if (typeof out === 'string') {
  try { out = JSON.parse(out); } catch { out = {}; }
}
if (!out || typeof out !== 'object') out = {};
if (!out.prompt) {
  const raw = String(agent.text || agent.output || '').trim();
  const match = raw.match(/\\{[\\s\\S]*\\}/);
  if (match) {
    try { out = JSON.parse(match[0]); } catch { out = {}; }
  }
}
const prompt = out.prompt || {};
const research = out.research || {};

const esc = (s) => String(s ?? '').replace(/'/g, "''");
const issueId = String(sak.issue_id || '').trim();
const question = String(prompt.question || '').trim();
const summary = String(research.summary || '').trim();
const confidence = String(research.confidence || 'medium').toLowerCase();
const pc = String(research.political_choice || '').trim();
const hasPolitics = pc && !/^ingen politisk valg$/i.test(pc);
const ragChunks = Array.isArray(sak.rag_chunks) ? sak.rag_chunks : [];
const hasContext =
  ragChunks.length > 0 ||
  String(sak.detail_excerpt || '').trim().length >= 80 ||
  String(sak.ai_hva || '').trim().length >= 40;
const valid =
  issueId &&
  question.length >= 15 &&
  hasPolitics &&
  hasContext &&
  confidence !== 'low';

if (!issueId) {
  return [{ json: { skip: true, reason: 'missing_issue_id' } }];
}

if (!valid) {
  return [{
    json: {
      skip: true,
      outcome: 'rejected',
      issue_id: issueId,
      reason: !question
        ? 'empty_question'
        : confidence === 'low'
          ? 'low_confidence'
          : !hasPolitics
            ? 'no_political_choice'
            : 'insufficient_context',
    },
  }];
}

const rpcBody = {
  p_issue_id: issueId,
  p_title: question,
  p_neutral_summary: summary,
  p_source_urls: sak.source_urls || [],
  p_generation_metadata: {
    source_type: 'stortinget_sak',
    confidence,
    rag_chunk_count: ragChunks.length,
    rag_chunks: ragChunks.slice(0, 8).map((c) => ({
      document_id: c.document_id,
      chunk_index: c.chunk_index,
      similarity: c.similarity,
    })),
    political_choice: pc,
    model: 'gemma4:e2b-it-qat',
  },
};

return [{
  json: {
    rpcBody,
    outcome: 'saved',
    issue_id: issueId,
    question,
    research,
  },
}];`;
