/**
 * Forum Reels v8 – synthesis agents, SQL, and Code (shared).
 */
export const DEEP_RESEARCH_SYSTEM = `Du er analytiker for «Folkets Stemme». Du får flere artikler om SAMME sak.

Oppgave:
1. Les alle Artikkel:-utdrag grundig
2. Sammenlign kildene: hva er felles fakta, hva er uenighet, hva er den politiske konflikten?
3. Identifiser det konkrete valget folk kan ta stilling til (lov, policy, handling)
4. Ikke sitér bare overskrifter – bygg forståelse fra brødtekst

Returner KUN gyldig JSON:
{
  "story_title": "Kort sakstittel",
  "summary": "2–4 setninger om hva saken handler om",
  "shared_facts": ["fakta 1", "fakta 2"],
  "disagreements": ["uenighet mellom kilder/partier om X"],
  "political_choice": "Hva er det konkrete politiske valget?",
  "poll_angles": ["mulig JA/NEI-vinkel 1", "mulig vinkel 2"],
  "source_quality": "kort vurdering av kilde-dekning",
  "confidence": "high|medium|low"
}`;

export const JOURNALIST_SYSTEM = `OBLIGATORISK VERKTØYBRUK (før du svarer med JSON):
- Du har KUN check_duplicate. Kall den med {"question":"full spørsmålstekst"} før slutt-JSON.
- Hvis check_duplicate svarer DUPLICATE: dropp spørsmålet eller lag ny vinkling med repeat_reason.
- Returner nøyaktig ETT sterkt JA/NEI-spørsmål som JSON {"prompts":[{...}]} – ingen markdown.

Du er politisk redaktør for «Folkets Stemme» (norsk borgerdebatt).

INPUT:
- DEEP_RESEARCH: ferdig analyse (sammenligning mellom kilder, politisk valg, poll_angles)
- Nummererte kilder [0], [1], … med Artikkel:-utdrag (med article_text fra DB)
- EXISTING_PROMPTS – unngå duplikater

Arbeidsflyt:
1. Bruk DEEP_RESEARCH som primær forståelse
2. Formuler nøyaktig 1 sterkt JA/NEI-spørsmål (svart på hvitt)
3. Sjekk duplikat med check_duplicate før du returnerer
4. Returner KUN gyldig JSON: {"prompts":[{...}]}

Per spørsmål:
- question: kort, konkret (maks 120 tegn). Start med «Støtter du», «Bør Norge», «Skal» eller «Er du enig i at»
- novelty_explanation: én setning (maks 160 tegn) om hva artiklene faktisk sier
- repeat_reason: KUN ved oppdatering av eldre tema med konkret ny utvikling
- source_indices: 3–6 indekser – samme sak, støttet av Artikkel:-utdrag
- topic_tags: 1–3 norske stikkord
- sensitivity: "low" eller "high"
- stortinget_issue_id: valgfri tekst-ID

KILDEKRAV:
- Minst 3 kilder, minst én med fetch ok/partial
- Minst 1 kilde nyere enn 24 timer ELLER tydelig repeat_reason med konkret ny utvikling
- Ikke sitér overskrifter som spørsmålets kjerne
- ALDRI malen «Er du enig i at Norge bør ta tydeligere grep om «…»»

FORBUDT: vage spørsmål, sport/kjendis uten politikk, tema-glidning, duplikater uten repeat_reason.`;

export const EDITOR_SYSTEM = `Du er kvalitetsredaktør for «Folkets Stemme» – modererer AI-genererte avstemningsspørsmål før publisering.

INPUT:
- KANDIDAT-SPØRSMÅL: JSON-liste fra genereringsagenten
- KILDER: nummererte overskrifter/artikler (indeks 0, 1, …)
- GODKJENTE EKSEMPLER: spørsmål admin/AI har godkjent tidligere – LÆR av stil og kvalitet
- AVSLÅTTE EKSEMPLER: spørsmål som ble forkastet – UNNGÅ lignende feil

Oppgave: Vurder hvert kandidat-spørsmål. Godkjenn kun spørsmål som:
1. Er konkrete JA/NEI-spørsmål (starter med «Støtter du», «Bør Norge», «Skal» eller «Er du enig i at»)
2. Følger av Artikkel:-innhold på valgte source_indices – ikke bare overskrift
3. Har minst 3 source_indices som handler om samme sak
4. Primærkilde har faktisk artikkelinnhold (ikke bare overskrift-mal)
5. Ikke er duplikat eller nær-duplikat av EXISTING eller avslåtte eksempler
6. Har politisk relevans (ikke ren sport/kjendis uten politikk)

ALLTID AVSLÅ:
- «Er du enig i at Norge bør ta tydeligere grep om «…»» eller overskrift sitert inne i «…»
- Vage spørsmål («hva mener du om», «bør vi diskutere»)
- Tema-glidning (f.eks. svindel mot eldre → korrupsjon i offentlig sektor)
- Spørsmål uten dekning i valgte kilder
- source_indices som blander ulike nyhetssaker (f.eks. Shada-saken + boligmarked)

KILDEKRAV (strengt):
- Alle source_indices må handle om SAMME sak – ikke fyll med andre politiske artikler for å nå 3 kilder
- Velg kun artikler fra samme cluster/indeks-gruppe eller med tydelig ordoverlap med primærkilden

Status per godkjent spørsmål:
- "active": lav sensitivitet, trusted kilder, god kilde-alignment, nyhetsaktuelt
- "draft": høy sensitivitet, svak kilde-dekning, ukjent kilde-host, eller usikker kvalitet

Returner KUN gyldig JSON:
{
  "approved_prompts": [{
    "question": "...",
    "novelty_explanation": "...",
    "source_indices": [0,1,2],
    "topic_tags": ["..."],
    "sensitivity": "low",
    "status": "active",
    "repeat_reason": null
  }],
  "rejected": [{ "question": "...", "reason": "kort begrunnelse" }]
}

Inkluder rejected for alle kandidater du ikke godkjenner. Tom approved_prompts er OK hvis ingenting holder mål.`;

export const EXISTING_PROMPTS_SQL = `SELECT
  COALESCE(json_agg(DISTINCT lower(trim(question))) FILTER (WHERE question IS NOT NULL AND trim(question) <> ''), '[]'::json) AS existing_questions,
  COALESCE(MAX(sort_order) FILTER (WHERE status = 'active' AND (expires_at IS NULL OR expires_at > now())), 0) AS max_sort_order,
  (
    SELECT COALESCE(json_agg(json_build_object('question', question, 'reason', reason) ORDER BY created_at DESC), '[]'::json)
    FROM (
      SELECT question, ''::text AS reason, created_at
      FROM public.forum_prompts
      WHERE status = 'active' AND trim(question) <> ''
      ORDER BY created_at DESC
      LIMIT 25
    ) approved
  ) AS approved_examples,
  (
    SELECT COALESCE(json_agg(json_build_object('question', question, 'reason', reason) ORDER BY created_at DESC), '[]'::json)
    FROM (
      SELECT question, 'Arkivert'::text AS reason, created_at
      FROM public.forum_prompts
      WHERE status = 'archived' AND trim(question) <> ''
      ORDER BY created_at DESC
      LIMIT 25
    ) rejected
  ) AS rejected_examples
FROM public.forum_prompts
WHERE trim(question) <> ''
  AND (
    (status = 'active' AND (expires_at IS NULL OR expires_at > now()))
    OR created_at > now() - interval '30 days'
  )`;

export const TRUSTED_SOURCES_SQL = `SELECT COALESCE(
  json_agg(json_build_object('domain', domain, 'outlet_label', outlet_label)),
  '[]'::json
) AS trusted_sources
FROM public.forum_trusted_sources
WHERE status = 'approved'`;

export const BUILD_DEEP_RESEARCH_INPUT_JS = `const input = $input.first()?.json || {};
const headlines = Array.isArray(input.headlines) ? input.headlines : [];
if (!headlines.length) {
  return [{ json: { ...input, deepResearchText: '', skipDeepResearch: true } }];
}

function shortDate(value) {
  const t = Date.parse(String(value || ''));
  if (Number.isNaN(t)) return '';
  return new Date(t).toISOString().slice(0, 16).replace('T', ' ');
}

const sourceBlock = headlines.map((h, i) => {
  const pub = h.publishedAt ? shortDate(h.publishedAt) : '';
  const art = h.articleText
    ? String(h.articleText).slice(0, 3200)
    : (h.description || '(ingen artikkeltekst)');
  return '[' + i + '] ' + h.title + ' (' + h.outlet + (pub ? ', ' + pub : '') + ', fetch=' + (h.articleFetchStatus || 'none') + ')\\n    ' + h.url + '\\n    Artikkel: ' + art;
}).join('\\n\\n');

const deepResearchText = [
  'SAK: ' + (input.clusterTitle || 'Ukjent'),
  input.discoveryRationale ? 'Discovery: ' + input.discoveryRationale : '',
  '',
  'KILDER (sammenlign disse grundig):',
  sourceBlock,
  '',
  'Analyser saken og returner JSON som beskrevet.',
].filter(Boolean).join('\\n');

return [{
  json: {
    ...input,
    deepResearchText: deepResearchText.slice(0, 16000),
    skipDeepResearch: false,
  },
}];`;

export const BUILD_JOURNALIST_INPUT_JS = `const base = $('Expand from saved').first()?.json || {};
const deepItem = $input.first()?.json || {};
const headlines = Array.isArray(base.headlines) ? base.headlines : [];
const existingQuestions = Array.isArray(base.existingQuestions) ? base.existingQuestions : [];
const approvedExamples = Array.isArray(base.approvedExamples) ? base.approvedExamples : [];
const rejectedExamples = Array.isArray(base.rejectedExamples) ? base.rejectedExamples : [];
const maxSortOrder = Number(base.maxSortOrder) || 0;

function stripCodeFence(text) {
  let t = String(text).trim();
  const fence = '\u0060\u0060\u0060';
  const jsonTag = fence + 'json';
  let i = t.toLowerCase().indexOf(jsonTag);
  if (i >= 0) t = t.slice(i + jsonTag.length);
  i = t.indexOf(fence);
  if (i >= 0) t = t.slice(0, i);
  return t.trim();
}

function parseDeepResearch(raw) {
  const candidates = [raw.output, raw.text, raw];
  for (const c of candidates) {
    if (c == null) continue;
    if (typeof c === 'object' && c.summary) return c;
    if (typeof c === 'string') {
      try {
        const p = JSON.parse(stripCodeFence(c));
        if (p && p.summary) return p;
      } catch (_) {}
    }
  }
  return null;
}

const deepResearch = parseDeepResearch(deepItem) || parseDeepResearch(deepItem.output) || {};

if (!headlines.length) {
  return [{ json: { ...base, headlines: [], headlinesText: '', skipAgent: true, headlineCount: 0, deepResearch, existingQuestions, approvedExamples, rejectedExamples, maxSortOrder } }];
}

const existingBlock = existingQuestions.length
  ? '\\n\\nEXISTING_PROMPTS (unngå disse og nær-duplikater):\\n' + existingQuestions.slice(0, 40).map((q, i) => '- ' + q).join('\\n')
  : '\\n\\nEXISTING_PROMPTS: (ingen tidligere – du har frihet til nye temaer)';

function shortDate(value) {
  const t = Date.parse(String(value || ''));
  if (Number.isNaN(t)) return '';
  return new Date(t).toISOString().slice(0, 16).replace('T', ' ');
}

const text = headlines.map((h, i) => {
  const pub = h.publishedAt ? shortDate(h.publishedAt) : '';
  const pubChunk = pub ? ', publishedAt: ' + pub : '';
  const fetchChunk = h.articleFetchStatus ? ', fetch: ' + h.articleFetchStatus : '';
  const descChunk = h.description ? '\\n    Kort: ' + h.description : '';
  const articleChunk = h.articleText
    ? '\\n    Artikkel: ' + String(h.articleText).slice(0, 2400)
    : '\\n    Artikkel: (ikke hentet – ikke bruk som primærkilde)';
  return '[' + i + '] ' + h.title + ' (' + h.outlet + pubChunk + fetchChunk + ')' + (h.longRunning ? ' [langvarig sak]' : '') + descChunk + articleChunk + '\\n    ' + h.url;
}).join('\\n');

const deepBlock = deepResearch && deepResearch.summary
  ? '\\n\\nDEEP_RESEARCH (bruk som primær forståelse):\\n' + JSON.stringify(deepResearch, null, 2)
  : '\\n\\nDEEP_RESEARCH: (mangler – les Artikkel:-utdrag nøye)';

const footer = existingBlock + deepBlock + '\\n\\n---\\nReturner 1 sterkt JA/NEI-spørsmål som JSON for DENNE saken. Les Artikkel:-utdrag. Ikke sitér overskrifter.';
return [{
  json: {
    ...base,
    headlines,
    headlinesText: (text + footer).slice(0, 14000),
    skipAgent: false,
    headlineCount: headlines.length,
    deepResearch,
    existingQuestions,
    approvedExamples,
    rejectedExamples,
    maxSortOrder,
  },
}];`;

export const BUILD_EDITOR_INPUT_JS = `const genItem = $input.first()?.json || {};
const agentInput = $('Build journalist input').first()?.json || {};
const headlines = Array.isArray(agentInput.headlines) ? agentInput.headlines : [];
const approvedExamples = Array.isArray(agentInput.approvedExamples) ? agentInput.approvedExamples : [];
const rejectedExamples = Array.isArray(agentInput.rejectedExamples) ? agentInput.rejectedExamples : [];
const existingQuestions = Array.isArray(agentInput.existingQuestions) ? agentInput.existingQuestions : [];

function stripCodeFence(text) {
  let t = String(text).trim();
  const fence = '\u0060\u0060\u0060';
  const jsonTag = fence + 'json';
  let i = t.toLowerCase().indexOf(jsonTag);
  if (i >= 0) t = t.slice(i + jsonTag.length);
  i = t.indexOf(fence);
  if (i >= 0) t = t.slice(0, i);
  return t.trim();
}

function parseGeneratorOutput(rawItem) {
  const raw = rawItem || {};
  const candidates = [raw.output, raw.text, raw.data, raw];
  for (const c of candidates) {
    if (c == null) continue;
    if (typeof c === 'object') {
      if (Array.isArray(c.prompts)) return c.prompts;
      if (Array.isArray(c.approved_prompts)) return c.approved_prompts;
      if (c.output != null) {
        try {
          const inner = typeof c.output === 'string' ? JSON.parse(stripCodeFence(c.output)) : c.output;
          if (inner && Array.isArray(inner.prompts)) return inner.prompts;
        } catch (_) {}
      }
    }
    if (typeof c === 'string') {
      try {
        const parsed = JSON.parse(stripCodeFence(c));
        if (parsed && Array.isArray(parsed.prompts)) return parsed.prompts;
      } catch (_) {}
    }
  }
  return [];
}

function formatExamples(list, label) {
  if (!list.length) return label + ': (ingen ennå)';
  return label + ':\\n' + list.slice(0, 20).map((e) => {
    const q = typeof e === 'string' ? e : String(e.question || '');
    const r = typeof e === 'object' && e.reason ? ' – ' + e.reason : '';
    return '- ' + q + r;
  }).join('\\n');
}

function normQuestion(q) {
  return String(q || '').toLowerCase().replace(/[^a-zæøå0-9\\s]/g, ' ').replace(/\\s+/g, ' ').trim();
}

function isValidPollCandidate(p) {
  const q = String(p?.question || '').trim();
  if (q.length < 15 || q.length > 220) return false;
  if (!/^(Støtter du|Bør Norge|Skal |Er du enig i at|Mener du)/i.test(q)) return false;
  if (/funksjonskall|verktøy|JSON\\.parse|overskrift-mal/i.test(q)) return false;
  if (/tydeligere grep om|Stortinget følger opp/i.test(q)) return false;
  if (/«[^»]{8,}»/.test(q)) return false;
  return true;
}

let candidates = parseGeneratorOutput(genItem).filter((p) => p && isValidPollCandidate(p));

const sourceLines = headlines.slice(0, 18).map((h, i) => {
  const art = h.articleText ? String(h.articleText).slice(0, 400) : (h.description || '(ingen tekst)');
  return '[' + i + '] ' + h.title + ' (' + h.outlet + ', fetch=' + (h.articleFetchStatus || 'none') + ')\\n    ' + art;
}).join('\\n\\n');

const existingBlock = existingQuestions.length
  ? '\\n\\nEXISTING_PROMPTS (unngå duplikater):\\n' + existingQuestions.slice(0, 30).map((q) => '- ' + q).join('\\n')
  : '';

const moderationText = [
  'KANDIDAT-SPØRSMÅL (JSON):',
  JSON.stringify({ prompts: candidates }, null, 2),
  '',
  'KILDER:',
  sourceLines,
  existingBlock,
  '',
  formatExamples(approvedExamples, 'GODKJENTE EKSEMPLER (lær av disse)'),
  '',
  formatExamples(rejectedExamples, 'AVSLÅTTE EKSEMPLER (unngå lignende)'),
  '',
  'Moderer alle kandidater. Returner approved_prompts og rejected som JSON.',
].join('\\n');

return [{
  json: {
    ...agentInput,
    moderationText: moderationText.slice(0, 12000),
    candidateCount: candidates.length,
    candidates,
  },
}];`;

export const FINALIZE_PROMPTS_JS = `const editorItem = $input.first()?.json || {};
const journalist = $('Build journalist input').first()?.json || {};
const headlines = Array.isArray(journalist.headlines) ? journalist.headlines : [];
const deepResearch = journalist.deepResearch || {};
const existingQuestions = Array.isArray(journalist.existingQuestions) ? journalist.existingQuestions : [];
const staticData = $getWorkflowStaticData('global');
const sameRun = Array.isArray(staticData.savedQuestionsThisRun) ? staticData.savedQuestionsThisRun : [];
const currentYear = new Date().getFullYear();

function stripCodeFence(text) {
  let t = String(text).trim();
  const fence = '\u0060\u0060\u0060';
  const jsonTag = fence + 'json';
  let i = t.toLowerCase().indexOf(jsonTag);
  if (i >= 0) t = t.slice(i + jsonTag.length);
  i = t.indexOf(fence);
  if (i >= 0) t = t.slice(0, i);
  return t.trim();
}

function parseEditorOutput(rawItem) {
  const raw = rawItem || {};
  const candidates = [raw.output, raw.text, raw.data, raw];
  for (const c of candidates) {
    if (c == null) continue;
    if (typeof c === 'object') {
      if (Array.isArray(c.approved_prompts)) return { approved: c.approved_prompts, rejected: c.rejected || [] };
      if (c.output && typeof c.output === 'object' && Array.isArray(c.output.approved_prompts)) {
        return { approved: c.output.approved_prompts, rejected: c.output.rejected || [] };
      }
    }
    if (typeof c === 'string') {
      try {
        const parsed = JSON.parse(stripCodeFence(c));
        if (parsed && Array.isArray(parsed.approved_prompts)) {
          return { approved: parsed.approved_prompts, rejected: parsed.rejected || [] };
        }
      } catch (_) {}
    }
  }
  return { approved: [], rejected: [] };
}

function norm(q) {
  return String(q || '').toLowerCase().replace(/[^a-zæøå0-9\\s]/g, ' ').replace(/\\s+/g, ' ').trim();
}

function tokens(q) {
  return norm(q).split(' ').filter((w) => w.length > 3);
}

function isNearDuplicate(candidate, baseline) {
  const c = norm(candidate);
  const b = norm(baseline);
  if (!c || !b) return false;
  if (c === b) return true;
  const ct = tokens(c);
  const bt = new Set(tokens(b));
  if (!ct.length) return false;
  let overlap = 0;
  for (const w of ct) if (bt.has(w)) overlap++;
  return overlap >= 4 && overlap / ct.length >= 0.55;
}

function rejectsQuestion(q) {
  const question = String(q || '').trim();
  if (question.length < 15 || question.length > 220) return 'for kort/langt';
  if (!/^(Støtter du|Bør Norge|Skal |Er du enig i at|Mener du)/i.test(question)) return 'ugyldig starter';
  if (/Stortinget følger opp|overskrift-mal|tydeligere grep om/i.test(question)) return 'forbudt mal';
  if (/«[^»]{8,}»/.test(question)) return 'overskrift i anførselstegn';
  if (/\\b20\\d{2}\\b/.test(question)) {
    const years = question.match(/\\b20\\d{2}\\b/g) || [];
    if (years.some((y) => Number(y) < currentYear)) return 'utdatert år';
  }
  if (/\\bstøtte\\b/i.test(question) && !/\\bat\\b/i.test(question) && /^Støtter du\\b/i.test(question)) {
    return 'grammatikk (manglende at)';
  }
  return null;
}

let { approved, rejected } = parseEditorOutput(editorItem);
const extraRejected = [];

approved = approved.filter((p) => {
  const q = String(p?.question || '').trim();
  const reason = rejectsQuestion(q);
  if (reason) {
    extraRejected.push({ question: q, reason });
    return false;
  }
  for (const e of [...existingQuestions, ...sameRun]) {
    if (isNearDuplicate(q, e)) {
      extraRejected.push({ question: q, reason: 'nær-duplikat' });
      return false;
    }
  }
  return true;
});

approved = approved.slice(0, 1);

if (approved.length) {
  const q = String(approved[0].question || '').trim();
  staticData.savedQuestionsThisRun = [...sameRun, q];
}

const clusterId = $('Expand from saved').first()?.json?.clusterId;

return [{
  json: {
    ...journalist,
    approvedPrompts: approved,
    rejectedPrompts: [...(rejected || []), ...extraRejected],
    deepResearch,
    clusterId,
    skipFinalize: !approved.length,
  },
}];`;

export const PREPARE_SAVES_JS = `const finalize = $('Finalize prompts').first()?.json || {};
if (finalize.skipFinalize) return [];
const modItem = { output: { approved_prompts: finalize.approvedPrompts || [], rejected: finalize.rejectedPrompts || [] } };
const agentInput = $('Build journalist input').first()?.json || {};
const headlines = Array.isArray(agentInput.headlines) ? agentInput.headlines : [];
const existingQuestions = Array.isArray(agentInput.existingQuestions) ? agentInput.existingQuestions : [];
const maxSortOrder = Number(agentInput.maxSortOrder) || 0;
const batchLimit = Math.max(1, Math.min(12, Number($('Backfill settings').first()?.json?.batchLimit ?? 10) || 10));
const trustedRow = $('Fetch trusted sources').first()?.json || {};
let trustedSources = trustedRow.trusted_sources;
if (typeof trustedSources === 'string') {
  try { trustedSources = JSON.parse(trustedSources); } catch (_) { trustedSources = []; }
}
if (!Array.isArray(trustedSources)) trustedSources = [];

const FALLBACK_TRUSTED_DOMAINS = [
  { domain: 'vg.no', outlet_label: 'VG' },
  { domain: 'nrk.no', outlet_label: 'NRK' },
  { domain: 'aftenposten.no', outlet_label: 'Aftenposten' },
  { domain: 'dagbladet.no', outlet_label: 'Dagbladet' },
  { domain: 'stortinget.no', outlet_label: 'Stortinget' },
  { domain: 'folketsstemme.no', outlet_label: 'Folkets Stemme' },
  { domain: 'folkets-stemme.no', outlet_label: 'Folkets Stemme' },
];

function effectiveTrustedList(list) {
  return Array.isArray(list) && list.length ? list : FALLBACK_TRUSTED_DOMAINS;
}

function hostFromUrl(url) {
  try { return new URL(String(url)).hostname.replace(/^www\\./, '').toLowerCase(); } catch (_) { return ''; }
}

function isTrustedSource(url, outlet, trustedList) {
  if (outlet === 'Stortinget') return true;
  const u = String(url || '').toLowerCase();
  if (u.includes('folketsstemme.no') || u.includes('folkets-stemme.no')) return true;
  const host = hostFromUrl(url);
  for (const t of effectiveTrustedList(trustedList)) {
    const d = String(t.domain || '').toLowerCase().replace(/^www\\./, '');
    if (d && (host === d || host.endsWith('.' + d))) return true;
  }
  return false;
}

function hasUntrustedSource(sources, trustedList) {
  return sources.some((s) => !isTrustedSource(s.url, s.outlet, trustedList));
}

function tokens(q) {
  return String(q || '').toLowerCase().replace(/[^a-zæøå0-9\\s]/g, ' ').replace(/\\s+/g, ' ').trim().split(' ').filter((w) => w.length > 3);
}

function norm(q) {
  return String(q || '').toLowerCase().replace(/[^a-zæøå0-9\\s]/g, ' ').replace(/\\s+/g, ' ').trim();
}

function jaccard(a, b) {
  const A = new Set(tokens(a));
  const B = new Set(tokens(b));
  if (!A.size || !B.size) return 0;
  let inter = 0;
  for (const w of A) if (B.has(w)) inter++;
  return inter / (A.size + B.size - inter);
}

function tokenOverlapCount(aTokens, bTokens) {
  const bSet = new Set(bTokens);
  let overlap = 0;
  for (const w of aTokens) if (bSet.has(w)) overlap++;
  return overlap;
}

function headlineTokens(h) {
  return tokens(String(h?.title || '') + ' ' + String(h?.description || '') + ' ' + String(h?.articleText || ''));
}

function sourceStoryTokens(s) {
  return tokens(String(s?.title || '') + ' ' + String(s?.description || '') + ' ' + String(s?.articleText || ''));
}

function sourceText(s) {
  return norm(String(s?.title || '') + ' ' + String(s?.description || '') + ' ' + String(s?.articleText || ''));
}

function properNounsFromQuestion(question) {
  const out = [];
  for (const raw of String(question || '').split(/[^a-zA-ZæøåÆØÅ0-9]+/)) {
    const w = raw.trim();
    if (w.length >= 5) out.push(w.toLowerCase());
  }
  return out;
}

function sourceMatchesQuestion(h, question) {
  if (!h) return false;
  const joined = headlineTokens(h).join(' ');
  for (const pn of properNounsFromQuestion(question)) {
    if (joined.includes(pn)) return true;
  }
  return tokenOverlapCount(tokens(question), headlineTokens(h)) >= 2;
}

function inferSourceIndex(question, headlines) {
  const qTokens = tokens(question);
  let bestIdx = -1;
  let best = 0;
  for (let i = 0; i < headlines.length; i++) {
    const h = headlines[i];
    const t = norm((h?.title || '') + ' ' + (h?.description || '') + ' ' + (h?.articleText || ''));
    let score = 0;
    for (const pn of properNounsFromQuestion(question)) {
      if (t.includes(pn)) score += 10;
    }
    for (const w of norm(question).split(/\\s+/).filter((x) => x.length > 4)) {
      if (t.includes(w)) score += 2;
    }
    score += tokenOverlapCount(qTokens, headlineTokens(h)) * 2;
    if (score > best) { best = score; bestIdx = i; }
  }
  return best >= 6 ? bestIdx : -1;
}

function sourcesCoherent(sources, headlines) {
  if (!sources.length) return false;
  const primary = sources[0];
  const primaryTokens = sourceStoryTokens(primary);
  const primaryHeadline = headlines.find((x) => x && x.url === primary.url);
  const clusterId = primaryHeadline?.clusterId;
  for (let i = 1; i < sources.length; i++) {
    const s = sources[i];
    const h = headlines.find((x) => x && x.url === s.url);
    if (clusterId != null && h?.clusterId === clusterId) continue;
    if (tokenOverlapCount(primaryTokens, sourceStoryTokens(s)) >= 2) continue;
    return false;
  }
  return true;
}

function questionSourceAlignment(question, sources) {
  if (!Array.isArray(sources) || !sources.length) return false;
  const qTokens = tokens(question).filter((w) => w.length > 4);
  let anyOk = false;
  for (const s of sources) {
    const st = sourceText(s);
    if (jaccard(question, st) >= 0.2 || tokenOverlapCount(qTokens, sourceStoryTokens(s)) >= 1) {
      anyOk = true;
      break;
    }
  }
  return anyOk && sourcesCoherent(sources, headlines);
}

function headlineToSource(h) {
  if (!h || !h.url) return null;
  return {
    title: h.title,
    url: h.url,
    outlet: h.outlet,
    description: h.description || null,
    articleText: h.articleText ? String(h.articleText).slice(0, 800) : null,
    articleFetchStatus: h.articleFetchStatus || null,
    imageUrl: h.imageUrl || null,
    videoUrl: h.videoUrl || null,
    publishedAt: h.publishedAt || null,
  };
}

function enrichSourceIndices(p, headlines) {
  const question = String(p.question || '');
  let indices = Array.isArray(p.source_indices) ? p.source_indices.map(Number).filter((n) => !Number.isNaN(n) && n >= 0) : [];
  const primaryIdx = indices.find((i) => sourceMatchesQuestion(headlines[i], question));
  const resolvedPrimary = primaryIdx != null ? primaryIdx : (indices[0] != null ? indices[0] : inferSourceIndex(question, headlines));
  if (resolvedPrimary == null || resolvedPrimary < 0 || !headlines[resolvedPrimary]) return p;
  const expanded = new Set(indices);
  expanded.add(resolvedPrimary);
  const primaryH = headlines[resolvedPrimary];
  if (primaryH?.clusterId != null) {
    for (let i = 0; i < headlines.length; i++) {
      if (headlines[i]?.clusterId === primaryH.clusterId) expanded.add(i);
    }
  }
  for (let i = 0; i < headlines.length; i++) {
    if (sourceMatchesQuestion(headlines[i], question)) expanded.add(i);
  }
  return { ...p, source_indices: [...expanded] };
}

function pickSources(p, headlines) {
  const question = String(p.question || '');
  let indices = Array.isArray(p.source_indices) ? p.source_indices.map(Number).filter((n) => !Number.isNaN(n) && n >= 0) : [];
  if (!indices.length) {
    const inferred = inferSourceIndex(question, headlines);
    if (inferred >= 0) indices = [inferred];
  }
  const primaryIdx = indices.find((i) => sourceMatchesQuestion(headlines[i], question));
  const resolvedPrimary = primaryIdx != null ? primaryIdx : (indices[0] != null ? indices[0] : inferSourceIndex(question, headlines));
  if (resolvedPrimary == null || resolvedPrimary < 0 || !headlines[resolvedPrimary]) return [];

  const primaryH = headlines[resolvedPrimary];
  const primaryCluster = primaryH.clusterId;
  const primaryTokens = headlineTokens(primaryH);

  indices = [resolvedPrimary];
  for (const i of Array.isArray(p.source_indices) ? p.source_indices.map(Number) : []) {
    if (Number.isNaN(i) || i < 0 || i === resolvedPrimary) continue;
    const h = headlines[i];
    if (!h) continue;
    if (primaryCluster != null && h.clusterId === primaryCluster) { indices.push(i); continue; }
    if (sourceMatchesQuestion(h, question)) { indices.push(i); continue; }
    if (tokenOverlapCount(primaryTokens, headlineTokens(h)) >= 2) indices.push(i);
  }
  if (primaryCluster != null) {
    for (let i = 0; i < headlines.length; i++) {
      if (i === resolvedPrimary || indices.includes(i)) continue;
      const h = headlines[i];
      if (h?.clusterId === primaryCluster) indices.push(i);
    }
  }

  const out = [];
  const seenUrl = new Set();
  for (const raw of indices) {
    const h = headlines[Number(raw)];
    if (!h || !h.url || seenUrl.has(h.url)) continue;
    const src = headlineToSource(h);
    if (src) { out.push(src); seenUrl.add(h.url); }
    if (out.length >= 8) break;
  }
  return out;
}

function supplementSources(sources, headlines, question, minCount) {
  const out = [...sources];
  const seen = new Set(out.map((s) => s.url));
  const qTokens = tokens(question);
  const primaryTokens = out.length ? sourceStoryTokens(out[0]) : [];
  const clusterIds = new Set();
  for (const s of out) {
    const h = headlines.find((x) => x && x.url === s.url);
    if (h?.clusterId != null) clusterIds.add(h.clusterId);
  }
  for (let i = 0; i < headlines.length && out.length < minCount; i++) {
    const h = headlines[i];
    if (!h?.url || seen.has(h.url)) continue;
    if (clusterIds.size && h.clusterId != null && clusterIds.has(h.clusterId)) {
      const src = headlineToSource(h);
      if (src) { out.push(src); seen.add(h.url); }
      continue;
    }
    const ht = headlineTokens(h);
    if (tokenOverlapCount(qTokens, ht) >= 2 || tokenOverlapCount(primaryTokens, ht) >= 2) {
      const src = headlineToSource(h);
      if (src) { out.push(src); seen.add(h.url); }
    }
  }
  return out;
}

function parseModerationOutput(rawItem) {
  const raw = rawItem || {};
  const candidates = [raw.output, raw.text, raw.data, raw];
  for (const c of candidates) {
    if (c == null) continue;
    if (typeof c === 'object') {
      if (Array.isArray(c.approved_prompts)) return { approved: c.approved_prompts, rejected: c.rejected || [] };
      if (c.output && typeof c.output === 'object' && Array.isArray(c.output.approved_prompts)) {
        return { approved: c.output.approved_prompts, rejected: c.output.rejected || [] };
      }
    }
    if (typeof c === 'string') {
      try {
        const parsed = JSON.parse(c.replace(/^[\`\\s]*json?/i, '').replace(/\`+/g, '').trim());
        if (parsed && Array.isArray(parsed.approved_prompts)) {
          return { approved: parsed.approved_prompts, rejected: parsed.rejected || [] };
        }
      } catch (_) {}
    }
  }
  return { approved: [], rejected: [] };
}

let { approved, rejected } = ({ approved: ($("Finalize prompts").first()?.json?.approvedPrompts) || [], rejected: ($("Finalize prompts").first()?.json?.rejectedPrompts) || [] });
const buildInput = $('Finalize prompts').first()?.json || {};
if (!approved.length && Array.isArray(buildInput.candidates) && buildInput.candidates.length) {
  approved = buildInput.candidates.map((p) => ({
    ...p,
    status: p.status || 'draft',
  }));
  rejected = rejected || [];
}
const esc = (s) => String(s ?? '').replace(/'/g, "''");
const seenQuestions = new Set(existingQuestions.map((q) => String(q || '').toLowerCase().trim()));
const results = [];
const sortOrderBase = maxSortOrder + 1;
let savedCount = 0;

for (let i = 0; i < approved.length && savedCount < batchLimit; i++) {
  const p = approved[i];
  const q = String(p.question || '').trim();
  if (!q || q.length < 12 || q.length > 220) continue;
  const key = q.toLowerCase();
  if (seenQuestions.has(key)) continue;

  const enriched = enrichSourceIndices(p, headlines);
  let sources = pickSources(enriched, headlines);
  sources = supplementSources(sources, headlines, q, 3);
  if (sources.length < 2) continue;
  const isFallback = /Fallback fra/i.test(String(enriched.novelty_explanation || ''));
  if (!isFallback && !questionSourceAlignment(q, sources)) continue;
  if (!isFallback && !sourcesCoherent(sources, headlines)) continue;

  const sensitivity = enriched.sensitivity === 'high' ? 'high' : 'low';
  let status = enriched.status === 'active' ? 'active' : 'draft';
  if (sources.length < 3) status = 'draft';
  if (sensitivity === 'high') status = 'draft';
  if (hasUntrustedSource(sources, trustedSources)) status = 'draft';
  const trustedOk = sensitivity === 'low' && !hasUntrustedSource(sources, trustedSources);
  if (trustedOk && sources.length >= 3) status = 'active';
  if (trustedOk && isFallback && sources.length >= 2) status = 'active';

  const options = [
    { id: 'ja', label: 'Ja' },
    { id: 'nei', label: 'Nei' },
    { id: 'ikke_interessert', label: 'Ikke interessert' },
  ];
  const tags = Array.isArray(enriched.topic_tags) ? enriched.topic_tags : [];
  const optionsJson = esc(JSON.stringify(options));
  const headlinesJson = esc(JSON.stringify(sources));
  const tagsSql = tags.length
    ? 'ARRAY[' + tags.map((t) => "'" + esc(t) + "'").join(',') + ']'
    : 'ARRAY[]::text[]';
  const stortingetIssueId = typeof enriched.stortinget_issue_id === 'string' ? enriched.stortinget_issue_id.trim() : '';
  const stortingetSql = stortingetIssueId ? "'" + esc(stortingetIssueId) + "'" : 'NULL';
  const sortVal = savedCount + sortOrderBase;
  const qEsc = esc(q);

  const activeInsert =
    "INSERT INTO public.forum_prompts (question, options, source_headlines, topic_tags, sensitivity, status, sort_order, expires_at, stortinget_issue_id) " +
    "SELECT '" + qEsc + "', '" + optionsJson + "'::jsonb, '" + headlinesJson + "'::jsonb, " + tagsSql + ", '" + sensitivity + "', '" + status + "', " + sortVal + ", NOW() + INTERVAL '7 days', " + stortingetSql + " " +
    "WHERE NOT EXISTS (SELECT 1 FROM public.forum_prompts fp WHERE lower(trim(fp.question)) = lower(trim('" + qEsc + "')) AND fp.status = 'active' AND (fp.expires_at IS NULL OR fp.expires_at > now()))";
  const draftInsert =
    "INSERT INTO public.forum_prompts (question, options, source_headlines, topic_tags, sensitivity, status, sort_order, stortinget_issue_id) " +
    "SELECT '" + qEsc + "', '" + optionsJson + "'::jsonb, '" + headlinesJson + "'::jsonb, " + tagsSql + ", '" + sensitivity + "', '" + status + "', " + sortVal + ", " + stortingetSql + " " +
    "WHERE NOT EXISTS (SELECT 1 FROM public.forum_prompts fp WHERE lower(trim(fp.question)) = lower(trim('" + qEsc + "')) AND fp.created_at > now() - interval '30 days')";

  results.push({ json: { sql: status === 'active' ? activeInsert : draftInsert, question: q, status } });
  seenQuestions.add(key);
  savedCount += 1;
}

for (const r of rejected || []) {
  const q = String(r.question || '').trim();
  const reason = String(r.reason || 'Avslått av AI-moderering').slice(0, 200);
  if (!q || q.length < 8) continue;
  const qEsc = esc(q);
  const reasonEsc = esc(reason);
  results.push({
    json: {
      sql:
        "INSERT INTO public.forum_prompt_moderation_feedback (question, verdict, reason, source) " +
        "SELECT '" + qEsc + "', 'rejected', '" + reasonEsc + "', 'ai' " +
        "WHERE NOT EXISTS (SELECT 1 FROM public.forum_prompt_moderation_feedback f WHERE lower(trim(f.question)) = lower(trim('" + qEsc + "')) AND f.verdict = 'rejected' AND f.created_at > now() - interval '7 days')",
      kind: 'feedback',
    },
  });
}

return results;`;

const TOOL_INPUT_PARSE_JS = `function parseToolInput() {
  let raw = $input;
  if (raw && typeof raw === 'object' && typeof raw.first === 'function') {
    try { raw = raw.first().json; } catch (_) {}
  }
  if (typeof raw === 'string') {
    const t = raw.trim();
    if (!t) return {};
    try { return JSON.parse(t); } catch (_) { return { query: t }; }
  }
  if (raw && typeof raw === 'object') return raw;
  return {};
}`;

export const CHECK_DUPLICATE_TOOL_JS = `${TOOL_INPUT_PARSE_JS}
const inp = parseToolInput();
const question = String(inp.question ?? inp.query ?? inp.input ?? inp.text ?? '').trim();
const existing = ($('Build journalist input').first()?.json?.existingQuestions) || ($('Expand from saved').first()?.json?.existingQuestions) || [];
const staticData = $getWorkflowStaticData('global');
const sameRun = Array.isArray(staticData.savedQuestionsThisRun) ? staticData.savedQuestionsThisRun : [];

function norm(q) {
  return String(q || '').toLowerCase().replace(/[^a-zæøå0-9\\s]/g, ' ').replace(/\\s+/g, ' ').trim();
}

function tokens(q) {
  return norm(q).split(' ').filter((w) => w.length > 3);
}

function isNearDuplicate(candidate, baseline) {
  const c = norm(candidate);
  const b = norm(baseline);
  if (!c || !b) return false;
  if (c === b) return true;
  const ct = tokens(c);
  const bt = new Set(tokens(b));
  if (!ct.length) return false;
  let overlap = 0;
  for (const w of ct) if (bt.has(w)) overlap++;
  const ratio = overlap / ct.length;
  return overlap >= 4 && ratio >= 0.55;
}

const key = norm(question);
if (!key) return 'ERROR: empty question – send {"question":"..."}';

for (const e of [...existing, ...sameRun]) {
  if (isNearDuplicate(key, e)) {
    return 'DUPLICATE: overlaps with existing prompt "' + String(e).slice(0, 80) + '"';
  }
}
return 'OK: unique question';`;

export const RESET_RUN_STATIC_JS = `const staticData = $getWorkflowStaticData('global');
staticData.savedQuestionsThisRun = [];
return [{ json: { reset: true } }];`;

export const EXPAND_SAVED_CLUSTER_JS = `const row = $input.item?.json || $input.first()?.json || {};
const articles = Array.isArray(row.articleRows) ? row.articleRows : [];
const headlines = articles.map((a, i) => ({
  title: String(a.title || ''),
  url: String(a.url || ''),
  outlet: a.outlet || 'Nyhet',
  publishedAt: a.publishedAt || null,
  description: a.description || null,
  imageUrl: a.imageUrl || null,
  videoUrl: a.videoUrl || null,
  articleText: a.articleText || a.article_text || null,
  articleFetchStatus: a.articleFetchStatus || a.article_fetch_status || null,
  longRunning: !!a.longRunning || !!row.stortingetIssueId,
  stortingetIssueId: row.stortingetIssueId || a.stortingetIssueId || null,
  clusterId: 0,
  isPolitical: true,
  sortIndex: i,
}));
const existing = $('Fetch existing prompts').first()?.json || {};
const trusted = $('Fetch trusted sources').first()?.json || {};
return [{
  json: {
    clusterId: row.clusterId,
    clusterTitle: row.title || row.clusterTitle,
    discoveryRationale: row.discoveryRationale || '',
    topicTags: row.topicTags || [],
    headlines,
    headlineCount: headlines.length,
    skipAgent: headlines.length < 3,
    existingQuestions: existing.existing_questions || [],
    approvedExamples: existing.approved_examples || [],
    rejectedExamples: existing.rejected_examples || [],
    maxSortOrder: Number(existing.max_sort_order) || 0,
    trustedSources: trusted.trusted_sources || [],
  },
}];`;
