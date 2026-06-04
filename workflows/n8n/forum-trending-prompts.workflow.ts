/**
 * Folkets Stemme – Forum prompt synthesis (v7 flow 2)
 * Leser pending clusters fra forum_research_clusters → dyp research → JA/NEI-spørsmål → moderering → forum_prompts
 *
 * Flow 1 (discovery): forum-research-discovery.workflow.ts
 * v6: AI-moderering + forum_prompt_moderation_feedback
 * Live: https://n8n.heyklever.app/workflow/MloIdsnX7FozM4dv
 * Webhook: folkets-forum-prompts
 */
import {
  workflow,
  node,
  trigger,
  sticky,
  newCredential,
  languageModel,
  tool,
  outputParser,
  ifElse,
  splitInBatches,
  nextBatch,
  expr,
} from '@n8n/workflow-sdk';

const PENDING_CLUSTERS_SQL = `WITH picked AS (
  SELECT id
  FROM public.forum_research_clusters
  WHERE status = 'pending'
  ORDER BY politics_score DESC, created_at ASC
  LIMIT 3
)
UPDATE public.forum_research_clusters c
SET status = 'processing', updated_at = now()
FROM picked p
WHERE c.id = p.id
RETURNING
  c.id,
  c.title,
  c.discovery_rationale,
  c.topic_tags,
  c.stortinget_issue_id,
  c.politics_score,
  (
    SELECT COALESCE(
      json_agg(
        json_build_object(
          'title', a.title,
          'url', a.url,
          'outlet', a.outlet,
          'publishedAt', a.published_at,
          'description', a.description,
          'imageUrl', a.image_url,
          'videoUrl', a.video_url,
          'longRunning', c.stortinget_issue_id IS NOT NULL
        )
        ORDER BY a.sort_order
      ),
      '[]'::json
    )
    FROM public.forum_research_articles a
    WHERE a.cluster_id = c.id
  ) AS articles_json`;

const DEEP_RESEARCH_SYSTEM = `Du er analytiker for «Folkets Stemme». Du får flere artikler om SAMME sak.

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

const PROMPT_SYSTEM = `OBLIGATORISK VERKTØYBRUK (før du svarer med JSON):
- Du har check_duplicate og read_article_clusters. Kall dem – ikke hopp over.
- Kall read_article_clusters med JSON-argument {"indices":"0,2,5"} (komma-separerte indekser).
- For HVERT spørsmål du vurderer å inkludere: kall check_duplicate med {"question":"full spørsmålstekst"} (minst ett spørsmål MÅ gjennom check_duplicate før slutt-JSON).
- Hvis check_duplicate svarer DUPLICATE: dropp spørsmålet eller lag ny vinkling med repeat_reason.
- Først når verktøy er brukt: returner slutt-svar som ren JSON {"prompts":[...]} uten markdown.
- Du har KUN check_duplicate og read_article_clusters – ikke finn på andre verktøynavn (f.eks. formulate_prompts).
- Siste melding skal ALDRI være {"name":"...","parameters":{...}} – kun {"prompts":[{question,...}]}.
- JSON må være gyldig: bruk {"question":"..."} med anførselstegn rundt nøkkel og verdi.

Du er politisk redaktør for «Folkets Stemme» (norsk borgerdebatt).

INPUT:
- DEEP_RESEARCH: ferdig analyse (sammenligning mellom kilder, politisk valg, poll_angles)
- Nummererte kilder [0], [1], … med Artikkel:-utdrag
- EXISTING_PROMPTS – unngå duplikater

Arbeidsflyt:
1. Bruk DEEP_RESEARCH som primær forståelse – ikke ignorer disagreements/shared_facts
2. Formuler 1–3 sterke JA/NEI-spørsmål per sak (svart på hvitt, ikke «hva mener du om»)
3. Hvert spørsmål må følge av DEEP_RESEARCH.political_choice og Artikkel:-innhold
4. Sjekk duplikater med check_duplicate før du legger inn et spørsmål
5. Returner KUN gyldig JSON: {"prompts":[...]} – ingen markdown eller forklaring

Per spørsmål:
- question: kort, konkret (maks 120 tegn). Start med «Støtter du», «Bør Norge», «Skal» eller «Er du enig i at»
- novelty_explanation: én setning (maks 160 tegn) om hva artiklene faktisk sier (påstand, hendelse, forslag) – ikke generell mening
- repeat_reason: KUN hvis spørsmålet er en oppdatering/ny runde av et eldre tema eller nær-duplikat av EXISTING_PROMPTS. Må nevne konkret ny utvikling (vedtak, nye tall, ny dom, ny rapport, nytt forslag, ny hendelse, etc.). Hvis repeat_reason brukes, skal question være formulert som en oppdatering/vinkling, ikke identisk gjentakelse.
- source_indices: 3–6 indekser fra listen (PÅKREVD) – alle må støtte samme politiske vurdering
- topic_tags: 1–3 norske stikkord
- sensitivity: "low" eller "high" (high: krig, vold, kongehus, alvorlige personskandaler)
- stortinget_issue_id: valgfri tekst-ID for langvarig stortingssak

KILDEKRAV (strengt):
- Hvert spørsmål må kunne begrunnes ut fra Artikkel:-utdrag på valgte source_indices – ikke generelle standpunkter uten dekning i teksten.
- Minst én valgt kilde bør ha articleFetchStatus ok eller partial (ikke bare overskrift).
- Alle source_indices må handle om samme sak/tema (ikke bland f.eks. svindel mot eldre med korrupsjon i offentlig sektor).
- Minst 3 kilder per spørsmål.
- Minst 1 kilde skal være nyere enn 24 timer (se publishedAt i listen).
- UNNTAK: hvis ingen kilder er nyere enn 24 timer kan du KUN foreslå et spørsmål dersom repeat_reason eksplisitt beskriver en KONKRET ny utvikling som forklarer hvorfor temaet likevel må tas opp igjen NÅ (og kildene støtter det).

FORBUDT (automatisk forkastet i moderering):
- MALEN «Er du enig i at Norge bør ta tydeligere grep om «…»» – bruk ALDRI denne formuleringen
- å sette overskriftstekst inne i «…»-anførselstegn i spørsmålet
- å sitere eller parafrasere overskriften som spørsmålets kjerne
- spørsmål som ikke følger av kildenes faktiske innhold (tema-glidning)
- svindel mot privatpersoner/eldre → ikke spør om korrupsjonsstraff i offentlig sektor
- vage/åpne spørsmål («hva mener du om…», «bør vi diskutere…»)
- clickbait/retorikk uten politisk beslutning
- sport/kjendis uten politikk
- options-felt
- duplikater eller nær-duplikater uten repeat_reason

FORMAT:
Returner {"prompts":[{question, novelty_explanation, repeat_reason?, source_indices, topic_tags, sensitivity, stortinget_issue_id?}]} og ingenting annet.`;

const MODERATION_SYSTEM = `Du er kvalitetsredaktør for «Folkets Stemme» – modererer AI-genererte avstemningsspørsmål før publisering.

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

const EXISTING_PROMPTS_SQL = `SELECT
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

const TRUSTED_SOURCES_SQL = `SELECT COALESCE(
  json_agg(json_build_object('domain', domain, 'outlet_label', outlet_label)),
  '[]'::json
) AS trusted_sources
FROM public.forum_trusted_sources
WHERE status = 'approved'`;

const EXPAND_CLUSTER_JS = `const row = $input.item?.json || $input.first()?.json || {};
let articles = row.articles_json;
if (typeof articles === 'string') {
  try { articles = JSON.parse(articles); } catch (_) { articles = []; }
}
if (!Array.isArray(articles)) articles = [];
const headlines = articles.map((a, i) => ({
  title: String(a.title || ''),
  url: String(a.url || ''),
  outlet: a.outlet || 'Nyhet',
  publishedAt: a.publishedAt || null,
  description: a.description || null,
  imageUrl: a.imageUrl || null,
  videoUrl: a.videoUrl || null,
  longRunning: !!a.longRunning,
  stortingetIssueId: row.stortinget_issue_id || null,
  clusterId: 0,
  isPolitical: true,
  sortIndex: i,
}));
const existing = $('Fetch existing prompts').first()?.json || {};
return [{
  json: {
    clusterId: row.id,
    clusterTitle: row.title,
    discoveryRationale: row.discovery_rationale || '',
    topicTags: row.topic_tags || [],
    headlines,
    headlineCount: headlines.length,
    skipAgent: headlines.length < 3,
    existingQuestions: existing.existing_questions || [],
    approvedExamples: existing.approved_examples || [],
    rejectedExamples: existing.rejected_examples || [],
    maxSortOrder: Number(existing.max_sort_order) || 0,
  },
}];`;

const BUILD_DEEP_RESEARCH_INPUT_JS = `const input = $input.first()?.json || {};
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

const FETCH_RSS_JS_LEGACY = `const settings = $('Backfill settings').first()?.json || {};
const existingRow = $('Fetch existing prompts').first()?.json || {};
const longRunningIssues = ($input.all?.() || [$input.first()]).map((i) => i.json).filter((r) => r && r.id && r.title && r.id !== '_none_');
const feeds = [
  { outlet: 'VG', url: 'https://www.vg.no/rss/feed/' },
  { outlet: 'Dagbladet', url: 'https://www.dagbladet.no/?lab_viewport=rss' },
  { outlet: 'NRK', url: 'https://www.nrk.no/toppsaker.rss' },
  { outlet: 'Aftenposten', url: 'https://www.aftenposten.no/rss' },
];

function stripCdata(text) {
  const s = String(text);
  const start = s.indexOf('<![CDATA[');
  if (start < 0) return s;
  const end = s.indexOf(']]>', start + 9);
  if (end < 0) return s;
  return s.slice(start + 9, end);
}

function decodeXml(value) {
  return stripCdata(String(value ?? ''))
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .trim();
}

function extractMedia(block) {
  const pick = (re) => decodeXml(String(block).match(re)?.[1] || '');
  const encUrl = pick(/<enclosure[^>]+url=["']([^"']+)["']/i);
  const encType = pick(/<enclosure[^>]+type=["']([^"']+)["']/i).toLowerCase();
  const mediaUrl = pick(/<media:content[^>]+url=["']([^"']+)["']/i) || pick(/<media:content[^>]*url=["']([^"']+)["']/i);
  const thumb = pick(/<media:thumbnail[^>]+url=["']([^"']+)["']/i);
  let imageUrl = thumb || null;
  let videoUrl = null;
  const candidate = mediaUrl || encUrl;
  if (candidate) {
    if (encType.startsWith('video') || /\\/video\\//i.test(candidate)) videoUrl = candidate;
    else if (!imageUrl) imageUrl = candidate;
  }
  return { imageUrl, videoUrl };
}

function stripHtml(value) {
  return String(value ?? '').replace(/<[^>]+>/g, ' ').replace(/\\s+/g, ' ').trim();
}

function extractDescription(block) {
  const raw =
    decodeXml(block.match(/<description(?:\\s[^>]*)?>([\\s\\S]*?)<\\/description>/i)?.[1]) ||
    decodeXml(block.match(/<content:encoded[^>]*>([\\s\\S]*?)<\\/content:encoded>/i)?.[1]) ||
    '';
  const text = stripHtml(raw);
  if (!text) return null;
  return text.length > 500 ? text.slice(0, 497).trimEnd() + '…' : text;
}

function parseRssItems(xml, outlet) {
  const items = [];
  for (const block of (String(xml).match(/<item[\\s\\S]*?<\\/item>/gi) || []).slice(0, 15)) {
    const title = decodeXml(block.match(/<title(?:\\s[^>]*)?>([\\s\\S]*?)<\\/title>/i)?.[1]);
    const url = decodeXml(block.match(/<link(?:\\s[^>]*)?>([\\s\\S]*?)<\\/link>/i)?.[1]);
    const pubDate = decodeXml(block.match(/<pubDate>([\\s\\S]*?)<\\/pubDate>/i)?.[1]) || null;
    if (title && url) {
      const media = extractMedia(block);
      const description = extractDescription(block);
      items.push({ title, url, link: url, outlet, publishedAt: pubDate, description, ...media });
    }
  }
  return items;
}

const rssHeadlines = [];
const seen = new Set();
const fetched = await Promise.all(
  feeds.map(async (feed) => {
    try {
      const xml = await this.helpers.httpRequest({ method: 'GET', url: feed.url, timeout: 8000 });
      return parseRssItems(xml, feed.outlet);
    } catch (_) {
      return [];
    }
  })
);
for (const items of fetched) {
  for (const item of items) {
    if (seen.has(item.url)) continue;
    seen.add(item.url);
    rssHeadlines.push(item);
  }
}

return [{
  json: {
    rssHeadlines,
    rssCount: rssHeadlines.length,
    longRunningIssues,
    existingQuestions: existingRow.existing_questions || [],
    approvedExamples: existingRow.approved_examples || [],
    rejectedExamples: existingRow.rejected_examples || [],
    maxSortOrder: Number(existingRow.max_sort_order) || 0,
    searxngBaseUrl: settings.searxngBaseUrl,
    batchLimit: settings.batchLimit,
    longRunningMinDays: settings.longRunningMinDays,
  },
}];`;

const COLLECT_HEADLINES_JS = `const input = $input.first()?.json || {};
const rssHeadlines = Array.isArray(input.rssHeadlines) ? input.rssHeadlines : [];
const longRunningIssues = Array.isArray(input.longRunningIssues) ? input.longRunningIssues : [];
const existingQuestions = Array.isArray(input.existingQuestions) ? input.existingQuestions : [];
const approvedExamples = Array.isArray(input.approvedExamples) ? input.approvedExamples : [];
const rejectedExamples = Array.isArray(input.rejectedExamples) ? input.rejectedExamples : [];
const maxSortOrder = Number(input.maxSortOrder) || 0;
const baseUrl = input.searxngBaseUrl || 'https://searxng.heyklever.app';

function outletFromUrl(url) {
  if (!url) return 'Ukjent';
  if (url.includes('vg.no')) return 'VG';
  if (url.includes('dagbladet.no')) return 'Dagbladet';
  if (url.includes('nrk.no')) return 'NRK';
  if (url.includes('aftenposten.no')) return 'Aftenposten';
  if (url.includes('stortinget')) return 'Stortinget';
  return 'Nyhet';
}

function isGenericListing(url) {
  const u = String(url).toLowerCase();
  if (/tv\\.nrk\\.no|radio\\.nrk\\.no/.test(u)) return true;
  if (/\\/politikk\\/?$/.test(u) || /\\/valg\\/\\d+\\/resultat/.test(u)) return true;
  if (/\\/nyheter\\/norsk-politikk/.test(u)) return true;
  if (/\\/sport\\//.test(u) && !/politi|lov|forbud|regjering/.test(u)) return true;
  return false;
}

function isLikelyArticle(url, title) {
  if (!url || !title || title.length < 8) return false;
  if (!/^https?:\\/\\//i.test(url)) return false;
  if (/\\/(tag)\\//i.test(url)) return false;
  if (isGenericListing(url)) return false;
  return true;
}

function politicsScore(title) {
  const t = String(title).toLowerCase();
  const boost = /(storting|regjering|minister|lov|lovforslag|budsjett|valg|skatt|forsvar|nato|eu |politi|domstol|klima|russ|russe|immigrasjon|helse|utdanning|kommune|statsbudsjett|epstein|krig|ukraina|gaza|terror|skole|bolig|strøm|olje|korrupsjon|dsa|høyesterett|mediepolitikk|asyl|barnevern|kraft|bompenger|toll)/i;
  const noise = /(mesterliga|champions league|håndball|ishockey|everest|monty python|frimerke|kjendis|rampelys|skjønnhet|fotball|rbk|carlsen|soft glam|kronprins|kronprinsesse|prinsesse|prins |kongehus|royal|tokyo|olympiad|celebrity|pågrepet i australia)/i;
  let s = 0;
  if (boost.test(t)) s += 3;
  if (noise.test(t)) s -= 3;
  return s;
}

function normalizeTokens(title) {
  const stop = new Set(['og','i','på','til','for','en','et','den','det','som','er','av','med','har',' ikke',' fra']);
  return String(title).toLowerCase().replace(/[^a-zæøå0-9\\s]/g, ' ').split(/\\s+/).filter((w) => w.length > 3 && !stop.has(w));
}

function tokenOverlap(a, b) {
  const setB = new Set(b);
  let overlap = 0;
  for (const w of a) if (setB.has(w)) overlap++;
  return overlap;
}

function parseDate(value) {
  const t = Date.parse(String(value || ''));
  return Number.isNaN(t) ? null : t;
}

function recencyBoost(publishedAt) {
  const t = parseDate(publishedAt);
  if (!t) return 0;
  const ageHours = (Date.now() - t) / 3600000;
  if (ageHours < 24) return 2;
  if (ageHours < 72) return 1;
  return 0;
}

const items = [...rssHeadlines];
for (const issue of longRunningIssues.slice(0, 8)) {
  items.push({
    title: issue.title,
    url: 'https://folketsstemme.no/dashboard/sak/' + issue.id,
    outlet: 'Stortinget',
    publishedAt: issue.first_seen_at || null,
    imageUrl: null,
    videoUrl: null,
    stortingetIssueId: String(issue.id),
    longRunning: true,
  });
}

const searxQueries = [
  'site:nrk.no OR site:vg.no politikk regjering stortinget',
  'site:aftenposten.no OR site:dagbladet.no lovforslag budsjett',
  'norge politikk samfunn debatt',
  'norge velferd helse utdanning',
  'norge justis politi domstol',
  'norge økonomi skatt budsjett',
  'norge klima energi bolig',
  'norge stortinget debatt mediepolitikk',
  'norge ukraina forsvar støtte',
  'norge klima kraft strøm',
];
for (const lr of longRunningIssues.slice(0, 3)) {
  const shortTitle = String(lr.title || '').split(/[:–-]/)[0].trim().slice(0, 60);
  if (shortTitle.length > 10) searxQueries.push(shortTitle + ' site:nrk.no OR site:vg.no');
}

for (const q of searxQueries) {
  try {
    const res = await this.helpers.httpRequest({
      method: 'GET',
      url: baseUrl + '/search?q=' + encodeURIComponent(q) + '&format=json&language=nb-NO',
      timeout: 8000,
    });
    for (const r of (res.results || []).slice(0, 10)) {
      if (r.title && r.url) {
        items.push({
          title: r.title,
          url: r.url,
          outlet: outletFromUrl(r.url),
          imageUrl: r.img_src || r.thumbnail || null,
          videoUrl: null,
          publishedAt: r.publishedDate || null,
        });
      }
    }
  } catch (_) {}
}

const seen = new Set();
const headlines = [];
for (const item of items) {
  const title = String(item.title || '').trim();
  const url = String(item.url || item.link || '').trim();
  const outlet = item.outlet || outletFromUrl(url);
  if (!isLikelyArticle(url, title) && !item.longRunning) continue;
  if (seen.has(url)) continue;
  seen.add(url);
  headlines.push({
    title,
    url,
    outlet,
    description: item.description ? String(item.description).trim().slice(0, 500) : null,
    publishedAt: item.publishedAt || item.pubDate || null,
    imageUrl: item.imageUrl || null,
    videoUrl: item.videoUrl || null,
    stortingetIssueId: item.stortingetIssueId || null,
    longRunning: !!item.longRunning,
    politicsScore: politicsScore(title) + recencyBoost(item.publishedAt),
    tokens: normalizeTokens(title),
  });
}

headlines.sort((a, b) => (b.politicsScore || 0) - (a.politicsScore || 0));

const clusters = [];
for (const h of headlines) {
  let cluster = null;
  for (const c of clusters) {
    if (tokenOverlap(h.tokens, c.representative) >= 2) {
      cluster = c;
      break;
    }
  }
  if (!cluster) {
    cluster = { id: clusters.length, representative: h.tokens, items: [] };
    clusters.push(cluster);
  }
  cluster.items.push(h);
}

for (const c of clusters) {
  const dates = c.items.map((i) => parseDate(i.publishedAt)).filter(Boolean);
  c.spanDays = dates.length >= 2 ? (Math.max(...dates) - Math.min(...dates)) / 86400000 : 0;
  c.score = c.items.reduce((s, i) => s + (i.politicsScore || 0), 0) + (c.spanDays >= 3 ? 5 : 0) + (c.items.some((i) => i.longRunning) ? 6 : 0);
}

clusters.sort((a, b) => b.score - a.score);
const picked = [];
for (const c of clusters) {
  for (const h of c.items) {
    picked.push({ ...h, clusterId: c.id, clusterSpanDays: c.spanDays });
    if (picked.length >= 36) break;
  }
  if (picked.length >= 36) break;
}

const trimmed = picked.map(({ politicsScore: ps, tokens: _t, ...rest }) => ({
  ...rest,
  isPolitical: (ps || 0) >= 1 || !!rest.longRunning,
}));

return [{
  json: {
    headlines: trimmed,
    headlineCount: trimmed.length,
    longRunningIssues,
    existingQuestions,
    approvedExamples,
    rejectedExamples,
    maxSortOrder,
    batchLimit: input.batchLimit,
  },
}];`;

const FETCH_ARTICLE_BODIES_JS = `const input = $input.first()?.json || {};
const headlines = Array.isArray(input.headlines) ? input.headlines : [];
const maxFetch = Math.min(16, Math.max(headlines.length, 3));
const timeout = 10000;

function stripHtml(html) {
  return String(html)
    .replace(/<script[\\s\\S]*?<\\/script>/gi, ' ')
    .replace(/<style[\\s\\S]*?<\\/style>/gi, ' ')
    .replace(/<noscript[\\s\\S]*?<\\/noscript>/gi, ' ')
    .replace(/<[^>]+>/g, ' ')
    .replace(/\\s+/g, ' ')
    .trim();
}

function extractArticleText(html) {
  const s = String(html);
  const ldBlocks = s.match(/<script[^>]*type=["']application\\/ld\\+json["'][^>]*>([\\s\\S]*?)<\\/script>/gi) || [];
  for (const block of ldBlocks) {
    try {
      const jsonText = block.replace(/<\\/?script[^>]*>/gi, '');
      const data = JSON.parse(jsonText);
      const items = Array.isArray(data) ? data : [data];
      for (const item of items) {
        const body = item && (item.articleBody || item.description);
        if (typeof body === 'string' && body.length > 200) return stripHtml(body);
      }
    } catch (_) {}
  }
  const articleMatch = s.match(/<article[^>]*>([\\s\\S]*?)<\\/article>/i);
  if (articleMatch) {
    const t = stripHtml(articleMatch[1]);
    if (t.length > 300) return t;
  }
  const mainMatch = s.match(/<main[^>]*>([\\s\\S]*?)<\\/main>/i);
  if (mainMatch) {
    const t = stripHtml(mainMatch[1]);
    if (t.length > 300) return t;
  }
  const all = stripHtml(s);
  return all.length > 500 ? all.slice(0, 8000) : '';
}

function isFetchableArticleUrl(url) {
  const u = String(url).toLowerCase();
  if (!/^https?:\\/\\//.test(u)) return false;
  if (/folketsstemme\\.no|folkets-stemme\\.no/.test(u)) return false;
  if (/tv\\.nrk\\.no|radio\\.nrk\\.no/.test(u)) return false;
  return /(vg\\.no|nrk\\.no|aftenposten\\.no|dagbladet\\.no|e24\\.no|dn\\.no|nettavisen\\.no)/.test(u);
}

const enriched = [];
let fetchCount = 0;
for (const h of headlines) {
  const copy = { ...h };
  if (!isFetchableArticleUrl(h.url) || fetchCount >= maxFetch) {
    copy.articleText = copy.articleText || null;
    copy.articleFetchStatus = copy.articleFetchStatus || 'skipped';
    enriched.push(copy);
    continue;
  }
  fetchCount += 1;
  try {
    const html = await this.helpers.httpRequest({
      method: 'GET',
      url: h.url,
      timeout,
      headers: {
        'User-Agent': 'FolketsStemmeBot/1.0 (+https://folkets-stemme.no; forum-prompts)',
        Accept: 'text/html,application/xhtml+xml',
        'Accept-Language': 'nb-NO,nb;q=0.9',
      },
    });
    let text = extractArticleText(typeof html === 'string' ? html : String(html?.body || html?.data || ''));
    const desc = String(h.description || '').trim();
    if (text.length < 280 && desc.length >= 80) {
      text = (desc + ' ' + text).trim();
      copy.articleFetchStatus = 'partial';
    } else if (text.length >= 280) {
      copy.articleFetchStatus = 'ok';
    } else {
      copy.articleFetchStatus = 'failed';
    }
    copy.articleText = text.length ? text.slice(0, 4000) : null;
  } catch (_) {
    const desc = String(h.description || '').trim();
    copy.articleText = desc.length >= 80 ? desc.slice(0, 4000) : null;
    copy.articleFetchStatus = copy.articleText ? 'partial' : 'failed';
  }
  enriched.push(copy);
}

return [{
  json: {
    ...input,
    headlines: enriched,
    articlesFetched: enriched.filter((x) => x.articleFetchStatus === 'ok').length,
    articlesPartial: enriched.filter((x) => x.articleFetchStatus === 'partial').length,
    articlesFailed: enriched.filter((x) => x.articleFetchStatus === 'failed').length,
  },
}];`;

const BUILD_AGENT_INPUT_JS = `const base = $('Expand cluster').first()?.json || {};
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

const footer = existingBlock + deepBlock + '\\n\\n---\\nReturner 1–3 sterke JA/NEI-spørsmål som JSON for DENNE saken. Les Artikkel:-utdrag. Ikke sitér overskrifter.';
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

const CHECK_DUPLICATE_TOOL_JS = `${TOOL_INPUT_PARSE_JS}
const inp = parseToolInput();
const question = String(inp.question ?? inp.query ?? inp.input ?? inp.text ?? '').trim();
const existing = ($('Build agent input').first()?.json?.existingQuestions) || ($('Expand cluster').first()?.json?.existingQuestions) || [];

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

for (const e of existing) {
  if (isNearDuplicate(key, e)) {
    return 'DUPLICATE: overlaps with existing prompt "' + String(e).slice(0, 80) + '"';
  }
}
return 'OK: unique question';`;

const READ_ARTICLE_CLUSTERS_TOOL_JS = `${TOOL_INPUT_PARSE_JS}
const inp = parseToolInput();
const raw = String(inp.indices ?? inp.query ?? inp.input ?? '').trim();
const headlines = ($('Build agent input').first()?.json?.headlines) || ($('Expand cluster').first()?.json?.headlines) || [];
const indices = raw.split(/[,\\s]+/).map((n) => parseInt(n, 10)).filter((n) => !Number.isNaN(n) && n >= 0);

if (!indices.length) return 'ERROR: send {"indices":"0,2,5"} with comma-separated headline indices';

const lines = [];
for (const i of indices.slice(0, 6)) {
  const h = headlines[i];
  if (!h) {
    lines.push('[' + i + '] (ukjent indeks)');
    continue;
  }
  const excerpt = h.articleText || h.description || '(ingen artikkeltekst)';
  lines.push(
    '[' + i + '] ' + h.title + ' (' + h.outlet + ', fetch=' + (h.articleFetchStatus || 'none') + ')' +
    (h.longRunning ? ' [langvarig stortingssak]' : '') +
    '\\nURL: ' + h.url +
    '\\nUtdrag:\\n' + String(excerpt).slice(0, 2200)
  );
}
return lines.join('\\n\\n---\\n\\n');`;

const BUILD_MODERATION_INPUT_JS = `const genItem = $input.first()?.json || {};
const agentInput = $('Build agent input').first()?.json || {};
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
  if (!/^(Støtter du|Bør Norge|Skal |Er du enig i at)/i.test(q)) return false;
  if (/funksjonskall|verktøy|JSON\\.parse|overskrift-mal/i.test(q)) return false;
  if (/tydeligere grep om/i.test(q)) return false;
  return true;
}

function questionFromCluster(headlines, indices) {
  const titles = indices.map((i) => String(headlines[i]?.title || '')).filter(Boolean);
  const joined = titles.join(' ').toLowerCase();
  const anchor = titles[0].replace(/\\s*[-–|].*$/, '').trim().slice(0, 70);
  if (/shada/i.test(joined)) return 'Skal norske politikere ta grep etter Shada-saken?';
  if (/ukrain/i.test(joined)) return 'Støtter du økt norsk støtte til Ukraina?';
  if (/boligpris|boligmarked/i.test(joined)) return 'Bør Norge gjøre mer for å dempe boligprisveksten?';
  if (/statsbudsjett/i.test(joined)) return 'Støtter du regjeringens prioriteringer i statsbudsjettet?';
  return 'Støtter du at Stortinget følger opp saken: «' + anchor + '»?';
}

function fallbackCandidatesFromHeadlines(headlines, existingQuestions) {
  const seen = new Set((existingQuestions || []).map((q) => normQuestion(q)));
  const byCluster = new Map();
  for (let i = 0; i < headlines.length; i++) {
    const h = headlines[i];
    if (!h || (!h.isPolitical && !h.longRunning)) continue;
    const cid = h.clusterId != null ? h.clusterId : 'solo-' + i;
    if (!byCluster.has(cid)) byCluster.set(cid, []);
    byCluster.get(cid).push(i);
  }
  const ranked = [...byCluster.entries()].sort((a, b) => b[1].length - a[1].length);
  const out = [];
  for (const [, indices] of ranked) {
    if (indices.length < 3) continue;
    const question = questionFromCluster(headlines, indices);
    const key = normQuestion(question);
    if (seen.has(key)) continue;
    seen.add(key);
    out.push({
      question,
      novelty_explanation: 'Fallback fra ' + indices.length + ' kilder i samme nyhetsklynge.',
      source_indices: indices.slice(0, 6),
      topic_tags: ['politikk', 'samfunn'],
      sensitivity: 'low',
      status: 'draft',
    });
    if (out.length >= 6) break;
  }
  return out;
}

let candidates = parseGeneratorOutput(genItem).filter((p) => p && isValidPollCandidate(p));
if (!candidates.length) {
  candidates = fallbackCandidatesFromHeadlines(headlines, existingQuestions);
}

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

const PREPARE_SAVES_JS = `const modItem = $input.first()?.json || {};
const agentInput = $('Build agent input').first()?.json || {};
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

let { approved, rejected } = parseModerationOutput(modItem);
const buildInput = $('Build moderation input').first()?.json || {};
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

const clusterId = $('Expand cluster').first()?.json?.clusterId;
const deepResearch = $('Build agent input').first()?.json?.deepResearch || {};
if (clusterId) {
  const drEsc = esc(JSON.stringify(deepResearch));
  results.push({
    json: {
      sql:
        "UPDATE public.forum_research_clusters SET status = 'completed', deep_research_json = '" + drEsc + "'::jsonb, processed_at = now(), updated_at = now() WHERE id = '" + esc(clusterId) + "'",
      kind: 'cluster_complete',
    },
  });
}

return results;`;
const ollamaChatModel = languageModel({
  type: '@n8n/n8n-nodes-langchain.lmChatOllama',
  version: 1,
  config: {
    name: 'Ollama Chat Model',
    credentials: { ollamaApi: newCredential('Ollama account') },
    parameters: {
      model: 'llama3.1:8b',
      options: { think: false, temperature: 0.15, format: 'default', numPredict: 2400, numCtx: 8192 },
    },
  },
});

const moderationOllamaChatModel = languageModel({
  type: '@n8n/n8n-nodes-langchain.lmChatOllama',
  version: 1,
  config: {
    name: 'Moderation Ollama Chat Model',
    credentials: { ollamaApi: newCredential('Ollama account') },
    parameters: {
      model: 'llama3.1:8b',
      options: { think: false, temperature: 0.1, format: 'json', numPredict: 1400, numCtx: 8192 },
    },
  },
});

const deepResearchOllamaModel = languageModel({
  type: '@n8n/n8n-nodes-langchain.lmChatOllama',
  version: 1,
  config: {
    name: 'Deep research Ollama Chat Model',
    credentials: { ollamaApi: newCredential('Ollama account') },
    parameters: {
      model: 'llama3.1:8b',
      options: { think: false, temperature: 0.15, format: 'json', numPredict: 2000, numCtx: 8192 },
    },
  },
});

const deepResearchOutputParser = outputParser({
  type: '@n8n/n8n-nodes-langchain.outputParserStructured',
  version: 1.3,
  config: {
    name: 'Deep research JSON parser',
    parameters: {
      schemaType: 'fromJson',
      jsonSchemaExample:
        '{"story_title":"Sak","summary":"Kort oppsummering","shared_facts":["fakta"],"disagreements":["uenighet"],"political_choice":"Valg","poll_angles":["vinkel"],"source_quality":"god","confidence":"high"}',
      autoFix: true,
    },
    subnodes: { model: deepResearchOllamaModel },
  },
});

const moderationOutputParser = outputParser({
  type: '@n8n/n8n-nodes-langchain.outputParserStructured',
  version: 1.3,
  config: {
    name: 'Moderation JSON parser',
    parameters: {
      schemaType: 'fromJson',
      jsonSchemaExample:
        '{"approved_prompts":[{"question":"Støtter du nasjonalt forbud mot lasere?","novelty_explanation":"Artiklene omtaler politisk debatt om lasere.","source_indices":[0,1,2],"topic_tags":["laser"],"sensitivity":"low","status":"active"}],"rejected":[{"question":"Hva mener du om politikken?","reason":"For vagt spørsmål"}]}',
      autoFix: true,
    },
    subnodes: {
      model: moderationOllamaChatModel,
    },
  },
});

const checkDuplicateTool = tool({
  type: '@n8n/n8n-nodes-langchain.toolCode',
  version: 1.3,
  config: {
    name: 'check_duplicate',
    parameters: {
      description:
        'Check duplicate forum poll questions. Call with JSON: {"question":"Støtter du ...?"}. Returns DUPLICATE or OK.',
      language: 'javaScript',
      specifyInputSchema: true,
      schemaType: 'fromJson',
      jsonSchemaExample: '{"question":"Støtter du nasjonalt forbud mot lasere?"}',
      jsCode: CHECK_DUPLICATE_TOOL_JS,
    },
  },
});

const readArticleClustersTool = tool({
  type: '@n8n/n8n-nodes-langchain.toolCode',
  version: 1.3,
  config: {
    name: 'read_article_clusters',
    parameters: {
      description:
        'Read article excerpts for headline indices. Call with JSON: {"indices":"0,2,5"}. Returns title, URL, fetch status, and excerpt per index.',
      language: 'javaScript',
      specifyInputSchema: true,
      schemaType: 'fromJson',
      jsonSchemaExample: '{"indices":"0,2,5"}',
      jsCode: READ_ARTICLE_CLUSTERS_TOOL_JS,
    },
  },
});

const promptsOutputParser = outputParser({
  type: '@n8n/n8n-nodes-langchain.outputParserStructured',
  version: 1.3,
  config: {
    name: 'Prompts JSON parser',
    parameters: {
      schemaType: 'fromJson',
      jsonSchemaExample:
        '{"prompts":[{"question":"Støtter du nasjonalt forbud mot lasere?","source_indices":[0,1,2],"topic_tags":["laser","russe"],"sensitivity":"low"}]}',
      autoFix: true,
    },
    subnodes: {
      model: ollamaChatModel,
    },
  },
});

const scheduleTriggerAfternoon = trigger({
  type: 'n8n-nodes-base.scheduleTrigger',
  version: 1.3,
  config: {
    name: 'Hourly 30',
    parameters: {
      rule: {
        interval: [{ field: 'cronExpression', expression: '30 * * * *' }],
      },
    },
  },
  output: [{}],
});

const fetchExistingPrompts = node({
  type: 'n8n-nodes-base.postgres',
  version: 2.6,
  config: {
    name: 'Fetch existing prompts',
    executeOnce: true,
    credentials: { postgres: newCredential('Fokets Meninger') },
    parameters: {
      operation: 'executeQuery',
      query: EXISTING_PROMPTS_SQL,
    },
  },
  output: [{ existing_questions: ['støtter du nasjonalt forbud mot lasere i russefeiringen?'], max_sort_order: 3 }],
});

const fetchTrustedSources = node({
  type: 'n8n-nodes-base.postgres',
  version: 2.6,
  config: {
    name: 'Fetch trusted sources',
    executeOnce: true,
    credentials: { postgres: newCredential('Fokets Meninger') },
    parameters: {
      operation: 'executeQuery',
      query: TRUSTED_SOURCES_SQL,
    },
  },
  output: [{ trusted_sources: [{ domain: 'vg.no', outlet_label: 'VG' }] }],
});

const fetchPendingClusters = node({
  type: 'n8n-nodes-base.postgres',
  version: 2.6,
  config: {
    name: 'Fetch pending clusters',
    executeOnce: true,
    credentials: { postgres: newCredential('Fokets Meninger') },
    parameters: {
      operation: 'executeQuery',
      query: PENDING_CLUSTERS_SQL,
    },
  },
  output: [
    {
      id: '00000000-0000-0000-0000-000000000001',
      title: 'Eksempel sak',
      articles_json: [{ title: 'A', url: 'https://www.vg.no/a', outlet: 'VG' }],
    },
  ],
});

const processOneCluster = splitInBatches({
  version: 3,
  config: {
    name: 'Process one cluster',
    parameters: { batchSize: 1 },
  },
});

const scheduleTrigger = trigger({
  type: 'n8n-nodes-base.scheduleTrigger',
  version: 1.3,
  config: {
    name: 'Hourly 00',
    parameters: {
      rule: {
        interval: [{ field: 'cronExpression', expression: '0 * * * *' }],
      },
    },
  },
  output: [{}],
});

const webhookTrigger = trigger({
  type: 'n8n-nodes-base.webhook',
  version: 2.1,
  config: {
    name: 'Webhook manual',
    parameters: {
      path: 'folkets-forum-prompts',
      httpMethod: 'POST',
      responseMode: 'onReceived',
    },
  },
  output: [{ body: {} }],
});

const backfillSettings = node({
  type: 'n8n-nodes-base.set',
  version: 3.4,
  config: {
    name: 'Backfill settings',
    parameters: {
      mode: 'manual',
      includeOtherFields: true,
      assignments: {
        assignments: [
          { id: 'searxng-base', name: 'searxngBaseUrl', value: 'https://searxng.heyklever.app', type: 'string' },
          { id: 'batch-limit', name: 'batchLimit', value: '25', type: 'string' },
          { id: 'long-running-days', name: 'longRunningMinDays', value: '14', type: 'string' },
        ],
      },
    },
  },
  output: [{ searxngBaseUrl: 'https://searxng.heyklever.app', batchLimit: '25', longRunningMinDays: '14' }],
});

const expandCluster = node({
  type: 'n8n-nodes-base.code',
  version: 2,
  config: {
    name: 'Expand cluster',
    parameters: {
      mode: 'runOnceForEachItem',
      language: 'javaScript',
      jsCode: EXPAND_CLUSTER_JS,
    },
  },
  output: [{ clusterId: '00000000-0000-0000-0000-000000000001', headlines: [], skipAgent: false }],
});

const buildDeepResearchInput = node({
  type: 'n8n-nodes-base.code',
  version: 2,
  config: {
    name: 'Build deep research input',
    parameters: {
      mode: 'runOnceForAllItems',
      language: 'javaScript',
      jsCode: BUILD_DEEP_RESEARCH_INPUT_JS,
    },
  },
  output: [{ deepResearchText: 'SAK: ...', skipDeepResearch: false }],
});

const deepResearchAgent = node({
  type: '@n8n/n8n-nodes-langchain.agent',
  version: 3.1,
  config: {
    name: 'Deep research (Ollama)',
    onError: 'continueErrorOutput',
    parameters: {
      promptType: 'define',
      text: expr('{{ $json.deepResearchText }}'),
      hasOutputParser: true,
      options: {
        systemMessage: DEEP_RESEARCH_SYSTEM,
        maxIterations: 2,
        returnIntermediateSteps: false,
        enableStreaming: false,
      },
      subnodes: {
        model: deepResearchOllamaModel,
        outputParser: deepResearchOutputParser,
      },
    },
  },
  output: [
    {
      output: {
        summary: 'Oppsummering',
        political_choice: 'Valg',
        poll_angles: ['Støtter du X?'],
        confidence: 'medium',
      },
    },
  ],
});

const fetchArticleBodies = node({
  type: 'n8n-nodes-base.code',
  version: 2,
  config: {
    name: 'Fetch article bodies',
    parameters: {
      mode: 'runOnceForAllItems',
      language: 'javaScript',
      jsCode: FETCH_ARTICLE_BODIES_JS,
    },
  },
  output: [
    {
      headlines: [
        {
          title: 'Eksempel',
          url: 'https://www.vg.no/nyheter/i/test/a',
          outlet: 'VG',
          articleText: 'Brødtekst fra artikkelen …',
          articleFetchStatus: 'ok',
        },
      ],
      articlesFetched: 1,
    },
  ],
});

const buildAgentInput = node({
  type: 'n8n-nodes-base.code',
  version: 2,
  config: {
    name: 'Build agent input',
    parameters: {
      mode: 'runOnceForAllItems',
      language: 'javaScript',
      jsCode: BUILD_AGENT_INPUT_JS,
    },
  },
  output: [{ headlinesText: '- Eksempel (VG)', skipAgent: false, headlineCount: 1 }],
});

const hasHeadlines = ifElse({
  version: 2.2,
  config: {
    name: 'Has headlines?',
    parameters: {
      conditions: {
        options: { caseSensitive: true, leftValue: '', typeValidation: 'loose' },
        conditions: [
          {
            leftValue: expr('{{ $json.skipAgent }}'),
            operator: { type: 'boolean', operation: 'false' },
          },
        ],
        combinator: 'and',
      },
    },
  },
});

const generatePromptsAgent = node({
  type: '@n8n/n8n-nodes-langchain.agent',
  version: 3.1,
  config: {
    name: 'Generate prompts (Ollama)',
    onError: 'continueErrorOutput',
    parameters: {
      promptType: 'define',
      text: expr('{{ $json.headlinesText }}'),
      hasOutputParser: false,
      options: {
        systemMessage: PROMPT_SYSTEM,
        maxIterations: 8,
        returnIntermediateSteps: true,
        enableStreaming: false,
      },
      subnodes: {
        model: ollamaChatModel,
        tools: [checkDuplicateTool, readArticleClustersTool],
      },
    },
  },
  output: [{ output: { prompts: [{ question: 'Eksempel?', source_indices: [0], topic_tags: ['test'], sensitivity: 'low' }] } }],
});

const buildModerationInput = node({
  type: 'n8n-nodes-base.code',
  version: 2,
  config: {
    name: 'Build moderation input',
    parameters: {
      mode: 'runOnceForAllItems',
      language: 'javaScript',
      jsCode: BUILD_MODERATION_INPUT_JS,
    },
  },
  output: [{ moderationText: 'KANDIDAT-SPØRSMÅL...', candidateCount: 3 }],
});

const moderatePromptsAgent = node({
  type: '@n8n/n8n-nodes-langchain.agent',
  version: 3.1,
  config: {
    name: 'Moderate prompts (Ollama)',
    onError: 'continueErrorOutput',
    parameters: {
      promptType: 'define',
      text: expr('{{ $json.moderationText }}'),
      hasOutputParser: true,
      options: {
        systemMessage: MODERATION_SYSTEM,
        maxIterations: 3,
        returnIntermediateSteps: false,
        enableStreaming: false,
      },
      subnodes: {
        model: moderationOllamaChatModel,
        outputParser: moderationOutputParser,
      },
    },
  },
  output: [
    {
      output: {
        approved_prompts: [{ question: 'Eksempel?', source_indices: [0, 1, 2], topic_tags: ['test'], sensitivity: 'low', status: 'draft' }],
        rejected: [],
      },
    },
  ],
});

const prepareSaves = node({
  type: 'n8n-nodes-base.code',
  version: 2,
  config: {
    name: 'Prepare saves',
    parameters: {
      mode: 'runOnceForAllItems',
      language: 'javaScript',
      jsCode: PREPARE_SAVES_JS,
    },
  },
  output: [{ sql: 'INSERT INTO public.forum_prompts ...', question: 'Eksempel?', status: 'active' }],
});

const savePrompt = node({
  type: 'n8n-nodes-base.postgres',
  version: 2.6,
  config: {
    name: 'Save prompt',
    credentials: { postgres: newCredential('Fokets Meninger') },
    parameters: {
      operation: 'executeQuery',
      query: expr('{{ $json.sql }}'),
    },
  },
  output: [{ success: true }],
});

sticky(
  '## Forum prompt synthesis v7 (flow 2)\\n\\nLeser forum_research_clusters → dyp research → JA/NEI-spørsmål. Discovery: forum-research-discovery.',
  [scheduleTrigger, scheduleTriggerAfternoon, webhookTrigger],
  { color: 5 }
);

const clusterSynthesisPipeline = expandCluster
  .to(fetchArticleBodies)
  .to(buildDeepResearchInput)
  .to(
    hasHeadlines.onTrue(
      deepResearchAgent
        .to(buildAgentInput)
        .to(
          generatePromptsAgent
            .to(buildModerationInput)
            .to(moderatePromptsAgent)
            .to(prepareSaves)
            .to(savePrompt)
        )
    )
  );

const synthesisPipeline = backfillSettings
  .to(fetchExistingPrompts)
  .to(fetchTrustedSources)
  .to(fetchPendingClusters)
  .to(
    processOneCluster.onEachBatch(
      clusterSynthesisPipeline.to(nextBatch(processOneCluster))
    )
  );

export default workflow(
  'folkets-forum-trending-prompts',
  'Folkets Stemme – Forum prompt synthesis'
)
  .add(scheduleTrigger)
  .to(synthesisPipeline)
  .add(scheduleTriggerAfternoon)
  .to(synthesisPipeline)
  .add(webhookTrigger)
  .to(synthesisPipeline);
