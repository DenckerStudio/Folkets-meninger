/**
 * Shared RSS + headline collection for forum research discovery (v7).
 */

export const DISCOVERY_CONTEXT_SQL = `SELECT
  COALESCE(
    json_agg(DISTINCT lower(trim(question))) FILTER (WHERE question IS NOT NULL AND trim(question) <> ''),
    '[]'::json
  ) AS existing_questions,
  (
    SELECT COALESCE(json_agg(lower(trim(title))), '[]'::json)
    FROM (
      SELECT title
      FROM public.forum_research_clusters
      WHERE created_at > now() - interval '72 hours'
        AND status IN ('pending', 'accepted', 'processing', 'draft', 'finished')
      ORDER BY created_at DESC
      LIMIT 40
    ) recent
  ) AS recent_cluster_titles
FROM public.forum_prompts
WHERE trim(question) <> ''
  AND status = 'active'
  AND (expires_at IS NULL OR expires_at > now())`;

export const FETCH_RSS_DISCOVERY_JS = `const settings = $('Backfill settings').first()?.json || {};
const ctx = $('Fetch discovery context').first()?.json || {};
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
    existingQuestions: ctx.existing_questions || [],
    recentClusterTitles: ctx.recent_cluster_titles || [],
    searxngBaseUrl: settings.searxngBaseUrl,
    batchLimit: settings.batchLimit,
    discoveryLimit: settings.discoveryLimit,
  },
}];`;

export const COLLECT_HEADLINES_DISCOVERY_JS = `const input = $input.first()?.json || {};
const rssHeadlines = Array.isArray(input.rssHeadlines) ? input.rssHeadlines : [];
const longRunningIssues = Array.isArray(input.longRunningIssues) ? input.longRunningIssues : [];
const existingQuestions = Array.isArray(input.existingQuestions) ? input.existingQuestions : [];
const recentClusterTitles = Array.isArray(input.recentClusterTitles) ? input.recentClusterTitles : [];
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

const flatHeadlines = [];
for (const c of clusters) {
  for (const h of c.items) {
    flatHeadlines.push({
      ...h,
      clusterId: c.id,
      clusterSpanDays: c.spanDays,
      isPolitical: (h.politicsScore || 0) >= 1 || !!h.longRunning,
    });
  }
}

return [{
  json: {
    clusters,
    headlines: flatHeadlines,
    headlineCount: flatHeadlines.length,
    longRunningIssues,
    existingQuestions,
    recentClusterTitles,
    discoveryLimit: Number(input.discoveryLimit) || 6,
  },
}];`;
