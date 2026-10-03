/** System poll drafts (Reels) from Stortinget-sak RAG + AI-summary fallback. */

export const BUILD_RAG_QUERY_JS = `const sak = $('Expand sak for poll').first()?.json || $input.first()?.json || {};
const parts = [
  sak.issue_title,
  sak.henvisning,
  sak.issue_summary,
  sak.detail_excerpt,
  sak.ai_hva,
  sak.ai_narrative,
].map((v) => String(v || '').trim()).filter(Boolean);
const ragQuery = parts.join(' ').slice(0, 1400) || String(sak.issue_title || 'stortingssak');
return [{ json: { ...sak, ragQuery } }];`;

export const MAP_EMBEDDING_FOR_RAG_JS = `const sak = $('Build RAG query').first()?.json || {};
const embItem = $('Ollama embeddings').first()?.json || {};
const embedding = embItem.embedding;
const hasVector = Array.isArray(embedding) && embedding.length > 0;
const vectorLiteral = hasVector ? '[' + embedding.join(',') + ']' : '';
return [{
  json: {
    ...sak,
    issue_id: sak.issue_id,
    vectorLiteral,
    matchCount: hasVector ? 8 : 0,
    skipRag: !hasVector,
  },
}];`;

export const MERGE_RAG_CONTEXT_JS = `const sak = $('Build RAG query').first()?.json || $('Map embedding for RAG').first()?.json || {};
let ragRows = [];
try {
  ragRows = $('Retrieve RAG chunks').all().map((i) => i.json);
} catch (_) {
  ragRows = [];
}
const fallback = Array.isArray(sak.fallback_chunks) ? sak.fallback_chunks : [];
const ragChunks = ragRows.filter((r) => r && r.content);
const chunks = ragChunks.length ? ragChunks : fallback.filter((r) => r && r.content);

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
          (typeof c.similarity === 'number' ? c.similarity.toFixed(2) : 'utdrag') +
          ')\\n' +
          String(c.content || '').slice(0, 1400),
      )
      .join('\\n\\n')
  : '(ingen dokumentutdrag — bruk sammendrag og metadata)';

const docs = Array.isArray(sak.documents) ? sak.documents : [];
const docBlock = docs.length
  ? docs
      .map((d, idx) => {
        const excerpt = d.text_excerpt ? '\\n' + String(d.text_excerpt).slice(0, 500) : '';
        return '[' + idx + '] ' + (d.title || 'Dokument') + ' (' + (d.document_type || 'dok') + ')' + excerpt;
      })
      .join('\\n\\n')
  : '(ingen dokumenter)';

const summaryBlock = [
  sak.ai_narrative ? 'Fortelling: ' + sak.ai_narrative : '',
  sak.ai_hva ? 'Hva: ' + sak.ai_hva : '',
  sak.ai_hvem ? 'Hvem: ' + sak.ai_hvem : '',
  sak.ai_kostnad ? 'Kostnad: ' + sak.ai_kostnad : '',
]
  .filter(Boolean)
  .join('\\n');

const existing = (sak.existing_questions || []).slice(0, 35).map((q) => '- ' + q).join('\\n');
const sourceKind = String(sak.source_kind || (ragChunks.length ? 'rag' : 'fallback'));

const promptText = [
  'STORTINGSSAK: ' + (sak.issue_title || ''),
  sak.henvisning ? 'Henvisning: ' + sak.henvisning : '',
  sak.sak_kind ? 'Sakstype: ' + sak.sak_kind : '',
  sak.issue_category ? 'Kategori: ' + sak.issue_category : '',
  sak.komite ? 'Komité: ' + sak.komite : '',
  'Kildepakke: ' + sourceKind,
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
  'KILDEUTDRAG (grunnlag for spørsmål):',
  chunkBlock,
  '',
  'EXISTING_PROMPTS (unngå duplikat):',
  existing || '(ingen)',
  '',
  'Lag nøyaktig ETT konkret ja/nei-spørsmål. Tredje valg er alltid Blank.',
  'Spørsmålet skal handle om et politisk valg i saken, ikke gjenta tittelen.',
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
    source_kind: sourceKind,
    used_embedding_rag: ragChunks.length > 0,
    source_urls: sourceUrls,
  },
}];`;

export const SYSTEM_POLL_GENERATOR_SYSTEM = `Du er redaktør for Folkets Stemme-Reels.

INPUT: én stortingssak med metadata, AI-sammendrag og nummererte kildeutdrag [0], [1], …
Les kildene og lag nøyaktig ETT ja/nei-spørsmål. Ballot er alltid Ja / Nei / Blank.

Krav til spørsmålet:
- Konkret politisk valg («Mener du …», «Støtter du at …», «Bør Norge …»)
- Én presis handling, plikt, rettighet eller bevilgning — ikke hele saken
- ALDRI sitér sakstittel i anførselstegn som selve spørsmålet
- Unngå semantisk duplikat av EXISTING_PROMPTS
- 40–120 tegn, grammatisk korrekt bokmål
- Må dekkes av kildeutdrag eller sammendrag (source_indices)
- Nøytral: ingen «burde selvsagt» / partipreg
- Ikke lag egne svaralternativer

Returner KUN gyldig JSON:
{
  "research": {
    "story_title": "kort nøytral tittel",
    "summary": "2–3 nøytrale setninger om valget i saken",
    "political_choice": "hva ja betyr konkret",
    "confidence": "high|medium|low"
  },
  "prompt": {
    "question": "…",
    "novelty_explanation": "maks 160 tegn",
    "source_indices": [0],
    "repeat_reason": null
  }
}

Hvis kildene mangler substans: sett repeat_reason, tom question og confidence=low.`;

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

const issueId = String(sak.issue_id || '').trim();
const question = String(prompt.question || '').replace(/\\s+/g, ' ').trim();
const summary = String(research.summary || '').trim();
const confidence = String(research.confidence || 'medium').toLowerCase();
const pc = String(research.political_choice || '').trim();
const hasPolitics = pc && !/^ingen politisk valg$/i.test(pc);
const ragChunks = Array.isArray(sak.rag_chunks) ? sak.rag_chunks : [];
const hasContext =
  ragChunks.length > 0 ||
  String(sak.detail_excerpt || '').trim().length >= 80 ||
  String(sak.ai_hva || sak.ai_narrative || '').trim().length >= 40 ||
  String(sak.issue_summary || '').trim().length >= 80;
const tooShort = question.length < 40;
const tooLong = question.length > 140;
const looksLikeTitle = sak.issue_title && question.toLowerCase().includes(String(sak.issue_title).toLowerCase().slice(0, 24));
const valid =
  issueId &&
  !tooShort &&
  !tooLong &&
  hasPolitics &&
  hasContext &&
  confidence !== 'low' &&
  !looksLikeTitle;

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
        : tooShort
          ? 'question_too_short'
          : tooLong
            ? 'question_too_long'
            : looksLikeTitle
              ? 'repeats_title'
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
    source_kind: sak.source_kind || 'unknown',
    used_embedding_rag: Boolean(sak.used_embedding_rag),
    system_generated: true,
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
