/**
 * Folkets Stemme – Forum trending prompts v3
 * RSS + SearXNG + langvarige saker → Ollama agent (tools + memory) → forum_prompts
 *
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
  memory,
  tool,
  outputParser,
  ifElse,
  expr,
} from '@n8n/workflow-sdk';

const PROMPT_SYSTEM = `Du er politisk redaktør for «Folkets Stemme» (norsk borgerdebatt).

INPUT: Nummererte nyhetsoverskrifter [0], [1], … – kun disse titlene/lenkene finnes.
Du får også EXISTING_PROMPTS – spørsmål som allerede finnes og MÅ unngås (inkl. nær-duplikater).

Arbeidsflyt:
1. Les overskrifter og identifiser 6–10 politiske temaer/klynger
2. Gruppér relaterte overskrifter (samme clusterId der det finnes)
3. Formuler unike JA/NEI-spørsmål som ikke overlapper EXISTING_PROMPTS
4. Returner KUN gyldig JSON: {"prompts":[...]} – ingen markdown eller forklaring

Per spørsmål:
- question: kort, konkret (maks 120 tegn). Start med «Støtter du», «Bør Norge», «Skal» eller «Er du enig i at»
- source_indices: 3–6 indekser fra listen (PÅKREVD)
- topic_tags: 1–3 norske stikkord
- sensitivity: "low" eller "high" (high: krig, vold, kongehus, alvorlige personskandaler)
- stortinget_issue_id: valgfri tekst-ID for langvarig stortingssak

FORBUDT: vage spørsmål, sport/kjendis uten politikk, options-felt, duplikater av EXISTING_PROMPTS.`;

const EXISTING_PROMPTS_SQL = `SELECT
  COALESCE(json_agg(DISTINCT lower(trim(question))) FILTER (WHERE question IS NOT NULL AND trim(question) <> ''), '[]'::json) AS existing_questions,
  COALESCE(MAX(sort_order) FILTER (WHERE status = 'active' AND (expires_at IS NULL OR expires_at > now())), 0) AS max_sort_order
FROM public.forum_prompts
WHERE trim(question) <> ''
  AND (
    (status = 'active' AND (expires_at IS NULL OR expires_at > now()))
    OR created_at > now() - interval '30 days'
  )`;

const FETCH_RSS_JS = `const settings = $('Backfill settings').first()?.json || {};
const existingRow = $('Fetch existing prompts').first()?.json || {};
const longRunningIssues = ($input.all?.() || [$input.first()]).map((i) => i.json).filter((r) => r && r.id && r.title && r.id !== '_none_');
const feeds = [
  { outlet: 'VG', url: 'https://www.vg.no/rss/feed/' },
  { outlet: 'Dagbladet', url: 'https://www.dagbladet.no/?lab_viewport=rss' },
  { outlet: 'NRK', url: 'https://www.nrk.no/toppsaker.rss' },
  { outlet: 'Aftenposten', url: 'https://www.aftenposten.no/rss' },
];

function decodeXml(value) {
  return String(value ?? '').replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"').replace(/&#39;/g, "'").replace(/<!\\[CDATA\\[([\\s\\S]*?)\\]\\]>/g, '$1').trim();
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

function parseRssItems(xml, outlet) {
  const items = [];
  for (const block of (String(xml).match(/<item[\\s\\S]*?<\\/item>/gi) || []).slice(0, 15)) {
    const title = decodeXml(block.match(/<title(?:\\s[^>]*)?>([\\s\\S]*?)<\\/title>/i)?.[1]);
    const url = decodeXml(block.match(/<link(?:\\s[^>]*)?>([\\s\\S]*?)<\\/link>/i)?.[1]);
    const pubDate = decodeXml(block.match(/<pubDate>([\\s\\S]*?)<\\/pubDate>/i)?.[1]) || null;
    if (title && url) {
      const media = extractMedia(block);
      items.push({ title, url, link: url, outlet, publishedAt: pubDate, ...media });
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
  const noise = /(mesterliga|champions league|håndball|ishockey|everest|monty python|frimerke|kjendis|rampelys|skjønnhet|fotball|rbk|carlsen|soft glam)/i;
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
    for (const r of (res.results || []).slice(0, 6)) {
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
    if (picked.length >= 28) break;
  }
  if (picked.length >= 28) break;
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
    maxSortOrder,
    batchLimit: input.batchLimit,
  },
}];`;

const BUILD_AGENT_INPUT_JS = `const headlines = $json.headlines || [];
const existingQuestions = Array.isArray($json.existingQuestions) ? $json.existingQuestions : [];
const maxSortOrder = Number($json.maxSortOrder) || 0;

if (!headlines.length) {
  return [{ json: { headlines: [], headlinesText: '', skipAgent: true, headlineCount: 0, existingQuestions, maxSortOrder } }];
}

const existingBlock = existingQuestions.length
  ? '\\n\\nEXISTING_PROMPTS (unngå disse og nær-duplikater):\\n' + existingQuestions.slice(0, 40).map((q, i) => '- ' + q).join('\\n')
  : '\\n\\nEXISTING_PROMPTS: (ingen tidligere – du har frihet til nye temaer)';

const text = headlines.map((h, i) =>
  '[' + i + '] ' + h.title + ' (' + h.outlet + ')' + (h.longRunning ? ' [langvarig sak]' : '') + '\\n    ' + h.url
).join('\\n');

const footer = existingBlock + '\\n\\n---\\nReturner 6–10 unike avstemningsspørsmål som JSON. Ikke bruk «...» som spørsmålstekst – skriv fullstendige JA/NEI-spørsmål.';
return [{
  json: {
    headlines,
    headlinesText: (text + footer).slice(0, 6000),
    skipAgent: false,
    headlineCount: headlines.length,
    existingQuestions,
    maxSortOrder,
  },
}];`;

const CHECK_DUPLICATE_TOOL_JS = `const query = String($input?.query ?? '').trim();
const existing = $('Build agent input').first()?.json?.existingQuestions || [];

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

const key = norm(query);
if (!key) return 'ERROR: empty question';

for (const e of existing) {
  if (isNearDuplicate(key, e)) {
    return 'DUPLICATE: overlaps with existing prompt "' + String(e).slice(0, 80) + '"';
  }
}
return 'OK: unique question';`;

const SUMMARIZE_HEADLINES_TOOL_JS = `const raw = String($input?.query ?? '').trim();
const headlines = $('Build agent input').first()?.json?.headlines || [];
const indices = raw.split(/[,\\s]+/).map((n) => parseInt(n, 10)).filter((n) => !Number.isNaN(n) && n >= 0);

if (!indices.length) return 'ERROR: provide comma-separated headline indices, e.g. "0,2,5"';

const lines = [];
for (const i of indices.slice(0, 8)) {
  const h = headlines[i];
  if (!h) {
    lines.push('[' + i + '] (ukjent indeks)');
    continue;
  }
  lines.push('[' + i + '] ' + h.title + ' (' + h.outlet + ')' + (h.longRunning ? ' [langvarig stortingssak]' : ''));
}
return 'Oppsummering av valgte overskrifter:\\n' + lines.join('\\n');`;

const MODERATION_ROUTE_JS = `const item = $input.first()?.json || {};
let out = item.output ?? item;

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

function tryParseJson(raw) {
  if (!raw) return null;
  const s = stripCodeFence(raw);
  try { return JSON.parse(s); } catch (_) {}
  const start = s.indexOf('{"prompts"');
  const alt = start >= 0 ? start : s.indexOf('{');
  if (alt >= 0) {
    const slice = s.slice(alt);
    try { return JSON.parse(slice); } catch (_) {
      const end = slice.lastIndexOf('}');
      if (end > 0) {
        try { return JSON.parse(slice.slice(0, end + 1)); } catch (_) {}
      }
    }
  }
  return null;
}

if (typeof out === 'string') out = tryParseJson(out) || { prompts: [] };
if (out && typeof out.output === 'object' && out.output !== null) out = out.output;
if (out && typeof out.output === 'string') {
  out = tryParseJson(out.output) || tryParseJson(out) || { prompts: [] };
}

let prompts = Array.isArray(out.prompts) ? out.prompts : [];
prompts = prompts.filter((p) => {
  if (!p || typeof p !== 'object' || typeof p.question !== 'string') return false;
  const q = String(p.question || '').trim();
  if (q.length < 12 || q === '...' || /^\\.{2,}$/.test(q)) return false;
  if (/^(eksempel|test|placeholder)/i.test(q)) return false;
  return true;
});
const agentInput = $('Build agent input').first()?.json || {};
const headlines = (Array.isArray(agentInput.headlines) && agentInput.headlines.length)
  ? agentInput.headlines
  : (Array.isArray(item.headlines) ? item.headlines : []);
const existingQuestions = Array.isArray(agentInput.existingQuestions) && agentInput.existingQuestions.length
  ? agentInput.existingQuestions
  : (Array.isArray(item.existingQuestions) ? item.existingQuestions : []);
const maxSortOrder = Number(agentInput.maxSortOrder ?? item.maxSortOrder) || 0;

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

function isDuplicateQuestion(q) {
  const key = norm(q);
  for (const e of existingQuestions) {
    if (isNearDuplicate(key, e)) return true;
  }
  return false;
}

const FALLBACK_RULES = [
  { re: /laser|russe|russ|russetid/, q: 'Støtter du nasjonalt forbud mot lasere i russefeiringen?', tags: ['laser', 'russe'] },
  { re: /ki-video|ki-videoer|deepfake|ki-generert|syntetisk.*video/, q: 'Bør Norge forby KI-genererte krigsvideoer i valgkamp?', tags: ['ki', 'valg'] },
  { re: /mediepolitikk|publicistisk|mediestøtte|nrk.*kutt|kringkasting/, q: 'Bør staten styrke publicistiske medier i Norge?', tags: ['medier', 'kultur'] },
  { re: /støre|gahr støre|ap-regjering/, q: 'Er du fornøyd med Støre-regjeringens gjennomføringskraft?', tags: ['regjering', 'støre'] },
  { re: /regjering.*medie|medie.*regjering|null gjennomføring/, q: 'Er du enig i at regjeringen må styrke mediepolitikken?', tags: ['regjering', 'medier'] },
  { re: /politiet.*skutt|skjøt person|skarplad/, q: 'Støtter du at politiet skal kunne bruke skarplader våpen ved alvorlige trusler?', tags: ['politi', 'våpen'] },
  { re: /ukraina|ukrainsk|støtte.*ukraina/, q: 'Støtter du økt norsk militær og humanitær støtte til Ukraina?', tags: ['ukraina', 'forsvar'] },
  { re: /gaza|palestin|midtøsten/, q: 'Bør Norge øke humanitær støtte til Gaza?', tags: ['gaza', 'utenrikspolitikk'], sensitivity: 'high' },
  { re: /strøm|kraftpris|kraft.*pris|nettleie/, q: 'Bør staten innføre et tak på strømpriser for husholdninger?', tags: ['strøm', 'kraft'] },
  { re: /asyl|innvandring|utvisning|migrations/, q: 'Bør Norge stramme asyl- og utvisningsreglene?', tags: ['asyl', 'innvandring'] },
  { re: /skatt|formuesskatt|inntektsskatt/, q: 'Bør Norge øke skatt på høye inntekter og formuer?', tags: ['skatt', 'økonomi'] },
  { re: /budsjett|statsbudsjett/, q: 'Støtter du regjeringens prioriteringer i statsbudsjettet?', tags: ['budsjett', 'økonomi'] },
  { re: /klima|utslipp|karbon|co2/, q: 'Bør Norge innføre strengere klimakrav for næringslivet?', tags: ['klima', 'miljø'] },
  { re: /bolig|huspris|leiemarked/, q: 'Bør staten bygge flere rimelige boliger i store byer?', tags: ['bolig', 'økonomi'] },
  { re: /skole|lærer|utdanning|privatskole/, q: 'Bør staten øke bevilgningene til grunnskolen?', tags: ['skole', 'utdanning'] },
  { re: /helse|sykehus|fastlege|helseforetak/, q: 'Bør staten øke bevilgningene til sykehus og fastleger?', tags: ['helse', 'velferd'] },
  { re: /forsvar|nato|forsvarsbudsjett/, q: 'Støtter du at Norge når 3 prosent av BNP i forsvarsbudsjett?', tags: ['forsvar', 'nato'] },
  { re: /eu |europaparlament|eøs/, q: 'Bør Norge søke EU-medlemskap på nytt?', tags: ['eu', 'utenrikspolitikk'] },
  { re: /bompenger|veipakke|tollring/, q: 'Støtter du å avvikle bompenger på riksveier?', tags: ['transport', 'bompenger'] },
  { re: /barnevern|omsorgssvikt/, q: 'Bør barnevernet få flere ressurser og lavere saksbehandlingstid?', tags: ['barnevern', 'velferd'] },
  { re: /epstein|overgrep|seksual/, q: 'Bør Norge opprette uavhengig gransking av Epstein-koblinger?', tags: ['gransking', 'justis'], sensitivity: 'high' },
  { re: /domstol|høyesterett|rettssak/, q: 'Støtter du sterkere rettssikkerhet ved politiets bruk av makt?', tags: ['justis', 'politi'] },
  { re: /storting|representant|opposisjon/, q: 'Bør Stortinget få sterkere kontroll med regjeringens maktbruk?', tags: ['storting', 'demokrati'] },
  { re: /lovforslag|lovendring|ny lov/, q: 'Støtter du at nye lover alltid skal ha konsekvensutredning før vedtak?', tags: ['lov', 'demokrati'] },
  { re: /korrupsjon|underslag|svindel/, q: 'Bør straffen for korrupsjon i offentlig sektor skjerpes?', tags: ['korrupsjon', 'justis'] },
];

function titleFallback(headline, index) {
  const title = String(headline.title || '');
  const t = title.toLowerCase();
  if (/eksplosjon|brannskad|drap|overfall|ulykke/.test(t)) return null;
  const topic = title.split(/[:–-]/)[0].trim().slice(0, 70);
  if (topic.length < 12) return null;
  if ((headline.isPolitical || headline.longRunning) === false) return null;
  return {
    question: 'Er du enig i at Norge bør ta tydeligere grep om «' + topic + '»?',
    source_indices: [index],
    topic_tags: ['debatt'],
    sensitivity: 'low',
  };
}

function fallbackPrompts(headlines) {
  const out = [];
  const localSeen = new Set();
  for (let i = 0; i < headlines.length && out.length < 8; i++) {
    const title = String(headlines[i].title || '');
    const t = title.toLowerCase();
    let match = null;
    for (const rule of FALLBACK_RULES) {
      if (rule.re.test(t)) {
        match = {
          question: rule.q,
          source_indices: [i],
          topic_tags: rule.tags || [],
          sensitivity: rule.sensitivity || 'low',
        };
        break;
      }
    }
    if (!match) match = titleFallback(headlines[i], i);
    if (!match) continue;
    const key = norm(match.question);
    if (localSeen.has(key) || isDuplicateQuestion(match.question)) continue;
    localSeen.add(key);
    out.push(match);
  }
  return out;
}

const seenQuestions = new Set(existingQuestions.map((q) => norm(q)));
const agentPrompts = prompts;

const batchLimit = Math.max(1, Math.min(12, Number($('Backfill settings').first()?.json?.batchLimit ?? 10) || 10));
const sortOrderBase = maxSortOrder + 1;
const blocked = /(porn|nazi|hitler|jævla neger)/i;
const rejectQuestion = /bør det avstemmes|bør staten gjøre mer|bør det være nødvendig|forhindre brannskader i offentlige|antallet strømprisområder|olympiad|bronsemedalj|mesterliga|champions league|monty python|kultur og kreativ|forskning og utvikling i teknologiske|støtte førstehjelp i tilfelle|i norske byer bli forbudt for å forhindre skader|hva er den største|største utfordringen/i;
const results = [];

function inferSourceIndex(question, headlines) {
  const q = norm(question);
  let bestIdx = -1;
  let best = 0;
  for (let i = 0; i < headlines.length; i++) {
    const t = norm(headlines[i].title || '');
    let score = 0;
    for (const w of q.split(/\\s+/).filter((x) => x.length > 4)) {
      if (t.includes(w)) score += 2;
    }
    for (const pw of ['laser', 'russ', 'russe', 'strøm', 'skudd', 'politi', 'ukraina', 'krig', 'ki', 'regjering', 'storting', 'forbud', 'dsa', 'epstein', 'medie', 'asyl', 'skatt', 'klima', 'bolig', 'helse']) {
      if (q.includes(pw) && t.includes(pw)) score += 6;
    }
    if (score > best) { best = score; bestIdx = i; }
  }
  return best >= 4 ? bestIdx : -1;
}

function pickSources(p, headlines) {
  let indices = Array.isArray(p.source_indices) ? p.source_indices : [];
  if (!indices.length && typeof p.source_headline_index === 'number') indices = [p.source_headline_index];
  if (!indices.length) {
    const inferred = inferSourceIndex(p.question, headlines);
    if (inferred >= 0) indices = [inferred];
  }
  const clusterIds = new Set();
  for (const raw of indices) {
    const h = headlines[Number(raw)];
    if (h && h.clusterId != null) clusterIds.add(h.clusterId);
  }
  if (clusterIds.size) {
    for (let i = 0; i < headlines.length; i++) {
      const h = headlines[i];
      if (h && clusterIds.has(h.clusterId) && !indices.includes(i)) indices.push(i);
    }
  }
  const out = [];
  const seenUrl = new Set();
  for (const raw of indices) {
    const h = headlines[Number(raw)];
    if (!h || seenUrl.has(h.url)) continue;
    seenUrl.add(h.url);
    out.push({
      title: h.title,
      url: h.url,
      outlet: h.outlet,
      imageUrl: h.imageUrl || null,
      videoUrl: h.videoUrl || null,
      publishedAt: h.publishedAt || null,
    });
    if (out.length >= 8) break;
  }
  return out;
}

function indicesForIssue(pr, hl) {
  const idx = Array.isArray(pr.source_indices) ? pr.source_indices : [];
  return idx.length ? idx : [inferSourceIndex(pr.question, hl)].filter((i) => i >= 0);
}

function acceptPromptBatch(batch) {
  for (let i = 0; i < batch.length && results.length < batchLimit; i++) {
  const p = batch[i];
  const q = String(p.question || '').trim();
  const key = norm(q);
  if (!q || key.length < 12 || key.length > 200 || blocked.test(q) || rejectQuestion.test(q)) continue;
  if (seenQuestions.has(key) || isDuplicateQuestion(q)) continue;
  if (!/^(støtter du|bør |skal |er du enig)/i.test(q)) continue;
  const sources = pickSources(p, headlines);
  if (!sources.length) continue;
  seenQuestions.add(key);

  let stortingetIssueId = typeof p.stortinget_issue_id === 'string' ? p.stortinget_issue_id.trim() : '';
  if (!stortingetIssueId) {
    for (const raw of indicesForIssue(p, headlines)) {
      const h = headlines[Number(raw)];
      if (h && h.stortingetIssueId) { stortingetIssueId = String(h.stortingetIssueId); break; }
    }
  }
  const validIssueIds = new Set(
    headlines.filter((h) => h && h.stortingetIssueId).map((h) => String(h.stortingetIssueId))
  );
  if (stortingetIssueId && !validIssueIds.has(stortingetIssueId)) {
    stortingetIssueId = '';
  }

  const sensitivity = p.sensitivity === 'high' ? 'high' : 'low';
  const status = sensitivity === 'high' ? 'draft' : 'active';
  const options = [
    { id: 'ja', label: 'Ja' },
    { id: 'nei', label: 'Nei' },
    { id: 'vet_ikke', label: 'Vet ikke' },
    { id: 'avstemmes', label: 'Bør avstemmes' },
  ];
  const tags = Array.isArray(p.topic_tags) ? p.topic_tags : [];
  const esc = (s) => String(s ?? '').replace(/'/g, "''");
  const optionsJson = esc(JSON.stringify(options));
  const headlinesJson = esc(JSON.stringify(sources));
  const tagsSql = tags.length
    ? 'ARRAY[' + tags.map((t) => "'" + esc(t) + "'").join(',') + ']'
    : 'ARRAY[]::text[]';
  const stortingetSql = stortingetIssueId ? "'" + esc(stortingetIssueId) + "'" : 'NULL';
  const sortVal = results.length + sortOrderBase;
  const qEsc = esc(q);
  const activeInsert =
    "INSERT INTO public.forum_prompts (question, options, source_headlines, topic_tags, sensitivity, status, sort_order, expires_at, stortinget_issue_id) " +
    "SELECT '" + qEsc + "', '" + optionsJson + "'::jsonb, '" + headlinesJson + "'::jsonb, " + tagsSql + ", '" + sensitivity + "', '" + status + "', " + sortVal + ", NOW() + INTERVAL '7 days', " + stortingetSql + " " +
    "WHERE NOT EXISTS (SELECT 1 FROM public.forum_prompts fp WHERE lower(trim(fp.question)) = lower(trim('" + qEsc + "')) AND fp.status = 'active' AND (fp.expires_at IS NULL OR fp.expires_at > now()))";
  const draftInsert =
    "INSERT INTO public.forum_prompts (question, options, source_headlines, topic_tags, sensitivity, status, sort_order, stortinget_issue_id) " +
    "SELECT '" + qEsc + "', '" + optionsJson + "'::jsonb, '" + headlinesJson + "'::jsonb, " + tagsSql + ", '" + sensitivity + "', '" + status + "', " + sortVal + ", " + stortingetSql + " " +
    "WHERE NOT EXISTS (SELECT 1 FROM public.forum_prompts fp WHERE lower(trim(fp.question)) = lower(trim('" + qEsc + "')) AND fp.created_at > now() - interval '30 days')";
  const sql = status === 'active' ? activeInsert : draftInsert;
  results.push({ json: { sql, question: q, status } });
  }
}

acceptPromptBatch(agentPrompts);
if (!results.length && headlines.length) acceptPromptBatch(fallbackPrompts(headlines));

return results.length ? results : [{ json: { sql: null, skipped: true } }];`;

const ollamaChatModel = languageModel({
  type: '@n8n/n8n-nodes-langchain.lmChatOllama',
  version: 1,
  config: {
    name: 'Ollama Chat Model',
    credentials: { ollamaApi: newCredential('Ollama account') },
    parameters: {
      model: 'llama3.2:3b-text-q4_K_M',
      options: { think: false, temperature: 0.15, format: 'json', numPredict: 1200, numCtx: 8192 },
    },
  },
});

const agentMemory = memory({
  type: '@n8n/n8n-nodes-langchain.memoryBufferWindow',
  version: 1.4,
  config: {
    name: 'Prompt batch memory',
    parameters: {
      sessionIdType: 'customKey',
      sessionKey: expr('{{ "forum-prompts-" + $now.toFormat("yyyy-MM-dd") }}'),
      contextWindowLength: 8,
    },
  },
});

const checkDuplicateTool = tool({
  type: '@n8n/n8n-nodes-langchain.toolCode',
  version: 1.3,
  config: {
    name: 'check_duplicate',
    parameters: {
      description: 'Check if a proposed forum poll question is a duplicate or near-duplicate of existing prompts. Input: the full question text. Returns DUPLICATE or OK.',
      language: 'javaScript',
      jsCode: CHECK_DUPLICATE_TOOL_JS,
    },
  },
});

const summarizeHeadlinesTool = tool({
  type: '@n8n/n8n-nodes-langchain.toolCode',
  version: 1.3,
  config: {
    name: 'summarize_headlines',
    parameters: {
      description: 'Summarize a cluster of headlines by index. Input: comma-separated indices from the headline list, e.g. "0,2,5". Returns a short bullet summary.',
      language: 'javaScript',
      jsCode: SUMMARIZE_HEADLINES_TOOL_JS,
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

const fetchLongRunningIssues = node({
  type: 'n8n-nodes-base.postgres',
  version: 2.6,
  config: {
    name: 'Fetch long-running saker',
    credentials: { postgres: newCredential('Fokets Meninger') },
    parameters: {
      operation: 'executeQuery',
      query:
        "WITH issues AS (SELECT id, title, first_seen_at FROM public.stortinget_issues WHERE status = 'pending' AND first_seen_at IS NOT NULL AND first_seen_at < now() - interval '14 days' ORDER BY first_seen_at ASC LIMIT 10) SELECT id, title, first_seen_at FROM issues UNION ALL SELECT '_none_', 'Ingen langvarige saker', now() WHERE NOT EXISTS (SELECT 1 FROM issues)",
    },
  },
  output: [{ id: '200329', title: 'Eksempel sak', first_seen_at: '2025-01-01T00:00:00Z' }],
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

const fetchRssHeadlines = node({
  type: 'n8n-nodes-base.code',
  version: 2,
  config: {
    name: 'Fetch RSS headlines',
    parameters: {
      mode: 'runOnceForAllItems',
      language: 'javaScript',
      jsCode: FETCH_RSS_JS,
    },
  },
  output: [{ rssHeadlines: [{ title: 'Eksempel', url: 'https://www.vg.no/nyheter/i/test', outlet: 'VG' }], rssCount: 1 }],
});

const collectAllHeadlines = node({
  type: 'n8n-nodes-base.code',
  version: 2,
  config: {
    name: 'Collect all headlines',
    parameters: {
      mode: 'runOnceForAllItems',
      language: 'javaScript',
      jsCode: COLLECT_HEADLINES_JS,
    },
  },
  output: [{ headlines: [{ title: 'Eksempel', url: 'https://www.vg.no/nyheter/i/test/a', outlet: 'VG' }], headlineCount: 1 }],
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
        maxIterations: 3,
        enableStreaming: false,
      },
      subnodes: {
        model: ollamaChatModel,
        memory: agentMemory,
      },
    },
  },
  output: [{ output: { prompts: [{ question: 'Eksempel?', source_indices: [0], topic_tags: ['test'], sensitivity: 'low' }] } }],
});

const moderationRoute = node({
  type: 'n8n-nodes-base.code',
  version: 2,
  config: {
    name: 'Moderation + route',
    parameters: {
      mode: 'runOnceForAllItems',
      language: 'javaScript',
      jsCode: MODERATION_ROUTE_JS,
    },
  },
  output: [{ sql: 'INSERT INTO public.forum_prompts ...', question: 'Eksempel?', status: 'active' }],
});

const hasSql = ifElse({
  version: 2.2,
  config: {
    name: 'Has SQL?',
    parameters: {
      conditions: {
        options: { caseSensitive: true, leftValue: '', typeValidation: 'loose', version: 2 },
        conditions: [
          {
            leftValue: expr('{{ Boolean($json.sql) }}'),
            operator: { type: 'boolean', operation: 'true' },
          },
        ],
        combinator: 'and',
      },
    },
  },
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
  '## Forum trending prompts v3\\n\\nDB-dedupe + 25+ fallback-temaer + Ollama agent med memory og JSON-output (fallback ved agent-feil).',
  [scheduleTrigger, scheduleTriggerAfternoon, webhookTrigger],
  { color: 5 }
);

const ingestPipeline = backfillSettings
  .to(fetchExistingPrompts)
  .to(fetchLongRunningIssues)
  .to(fetchRssHeadlines)
  .to(collectAllHeadlines)
  .to(buildAgentInput)
  .to(hasHeadlines.onTrue(generatePromptsAgent.to(moderationRoute).to(hasSql.onTrue(savePrompt))));

export default workflow(
  'folkets-forum-trending-prompts',
  'Folkets Stemme – Forum trending prompts'
)
  .add(scheduleTrigger)
  .to(ingestPipeline)
  .add(scheduleTriggerAfternoon)
  .to(ingestPipeline)
  .add(webhookTrigger)
  .to(ingestPipeline);
