/**
 * Forum Reels scout v11 – deterministic RSS ingest, cluster, enrich (n8n Code nodes).
 */

export const SCOUT_RSS_FEEDS = [
  { outlet: 'VG', url: 'https://www.vg.no/rss/feed/' },
  { outlet: 'Dagbladet', url: 'https://www.dagbladet.no/?lab_viewport=rss' },
  { outlet: 'NRK', url: 'https://www.nrk.no/toppsaker.rss' },
  { outlet: 'Aftenposten', url: 'https://www.aftenposten.no/rss' },
] as const;

export const SCOUT_RSS_ITEMS_PER_FEED = 12;

export const SCOUT_SEARXNG_BASE_URL = 'https://search.heyklever.app';

export const NRK_DEBATTEN_SEARXNG_HINT = `site:nrk.no/debatten — bruk SearXNG for politisk debatt/samfunnsdebatt uten RSS-feed`;

export const SCOUT_JUNK_PATTERNS =
  /(vm\s|verdensmesterskap|champions league|mesterliga|premier league|fotball|håndball|ishockey|olympiad|vm-final|døde|død|omkom|bilulykke|trafikkulykke|drapet|funnet død|kjendis|rampelys|underholdning|frimerke|soft glam|kronprinsesse|kronprins |prinsesse |prins |kongehus|celebrity|monty python|everest|carlsen|rbk)/i;

export const SCOUT_INFRA_JUNK_PATTERNS =
  /(jordras|ras over|vei.*stengt|stengt.*vei|stengt i lang tid|veiarbeid)/i;

export const SCOUT_POLITICS_PATTERNS =
  /(storting|regjering|minister|lov|lovforslag|budsjett|valg|skatt|forsvar|nato|politi|domstol|klima|immigrasjon|helse|utdanning|kommune|statsbudsjett|debatt|samfunn|velferd|justis|økonomi|bolig|strøm|kraft|bompenger|toll|asyl|barnevern|mediepolitikk|ukraina|gaza|terror|skole|høyesterett|stortinget|samferdsel|transport|innvandring|arbeidsliv|forsknings|forskningspolitikk)/i;

export const SCOUT_INGEST_AND_CLUSTER_JS = `const feeds = ${JSON.stringify(SCOUT_RSS_FEEDS)};
const itemsPerFeed = ${SCOUT_RSS_ITEMS_PER_FEED};

const junkRe = ${SCOUT_JUNK_PATTERNS.toString()};
const infraJunkRe = ${SCOUT_INFRA_JUNK_PATTERNS.toString()};
const politicsRe = ${SCOUT_POLITICS_PATTERNS.toString()};

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

function extractMedia(block) {
  const pick = (re) => decodeXml(String(block).match(re)?.[1] || '');
  const thumb = pick(/<media:thumbnail[^>]+url=["']([^"']+)["']/i);
  const mediaUrl = pick(/<media:content[^>]+url=["']([^"']+)["']/i);
  return { imageUrl: thumb || mediaUrl || null };
}

function parseRssItems(xml, outlet) {
  const items = [];
  for (const block of (String(xml).match(/<item[\\s\\S]*?<\\/item>/gi) || []).slice(0, itemsPerFeed)) {
    const title = decodeXml(block.match(/<title(?:\\s[^>]*)?>([\\s\\S]*?)<\\/title>/i)?.[1]);
    const url = decodeXml(block.match(/<link(?:\\s[^>]*)?>([\\s\\S]*?)<\\/link>/i)?.[1]);
    const pubDate = decodeXml(block.match(/<pubDate>([\\s\\S]*?)<\\/pubDate>/i)?.[1]) || null;
    if (title && url) {
      const media = extractMedia(block);
      items.push({
        title,
        url,
        outlet,
        description: extractDescription(block),
        published_at: pubDate,
        image_url: media.imageUrl,
      });
    }
  }
  return items;
}

function isLikelyArticle(url, title) {
  if (!url || !title || title.length < 8) return false;
  if (!/^https?:\\/\\//i.test(url)) return false;
  const u = String(url).toLowerCase();
  if (/\\/(tag)\\//i.test(u)) return false;
  if (/tv\\.nrk\\.no|radio\\.nrk\\.no/.test(u)) return false;
  if (/\\/sport\\//.test(u) && !politicsRe.test(title)) return false;
  return true;
}

function isJunk(title) {
  const t = String(title);
  if (junkRe.test(t)) return true;
  if (infraJunkRe.test(t) && !politicsRe.test(t)) return true;
  return false;
}

function politicsScore(title) {
  const t = String(title).toLowerCase();
  let s = 0;
  if (politicsRe.test(t)) s += 3;
  if (junkRe.test(t)) s -= 5;
  return s;
}

function normalizeTokens(title) {
  const stop = new Set(['og', 'i', 'på', 'til', 'for', 'en', 'et', 'den', 'det', 'som', 'er', 'av', 'med', 'har', 'fra', 'ikke']);
  return String(title)
    .toLowerCase()
    .replace(/[^a-zæøå0-9\\s]/g, ' ')
    .split(/\\s+/)
    .filter((w) => w.length > 3 && !stop.has(w));
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

function storyKey(title) {
  return String(title)
    .toLowerCase()
    .replace(/[^a-zæøå0-9]+/gi, ' ')
    .trim()
    .slice(0, 80);
}

const rssHeadlines = [];
const seenUrls = new Set();
let rssRaw = 0;
let filteredJunk = 0;
let filteredPolitics = 0;

const fetched = await Promise.all(
  feeds.map(async (feed) => {
    try {
      const xml = await this.helpers.httpRequest({ method: 'GET', url: feed.url, timeout: 8000 });
      return parseRssItems(xml, feed.outlet);
    } catch (_) {
      return [];
    }
  }),
);

for (const items of fetched) {
  for (const item of items) {
    rssRaw += 1;
    if (!isLikelyArticle(item.url, item.title)) continue;
    if (seenUrls.has(item.url)) continue;
    if (isJunk(item.title)) {
      filteredJunk += 1;
      continue;
    }
    const hasPoliticsKeyword = politicsRe.test(item.title);
    const ps = politicsScore(item.title) + recencyBoost(item.published_at);
    if (!hasPoliticsKeyword || ps < 1) {
      filteredPolitics += 1;
      continue;
    }
    seenUrls.add(item.url);
    rssHeadlines.push({
      ...item,
      politicsScore: ps,
      tokens: normalizeTokens(item.title),
    });
  }
}

rssHeadlines.sort((a, b) => (b.politicsScore || 0) - (a.politicsScore || 0));

const clusters = [];
for (const h of rssHeadlines) {
  let cluster = null;
  for (const c of clusters) {
    if (tokenOverlap(h.tokens, c.representative) >= 2) {
      cluster = c;
      break;
    }
  }
  if (!cluster) {
    cluster = { representative: h.tokens, items: [] };
    clusters.push(cluster);
  }
  cluster.items.push(h);
}

const candidates = [];
for (const c of clusters) {
  if (c.items.length < 2) continue;
  const outlets = new Set(c.items.map((i) => i.outlet));
  const outletCount = outlets.size;
  const politicsSum = c.items.reduce((s, i) => s + (i.politicsScore || 0), 0);
  const multiOutletBonus = outletCount >= 2 ? 8 : 0;
  const clusterScore = politicsSum + multiOutletBonus + (outletCount >= 3 ? 4 : 0);
  const storyTitle =
    c.items.slice().sort((a, b) => (b.politicsScore || 0) - (a.politicsScore || 0))[0]?.title || '';
  if (storyTitle.length < 15) continue;
  if (outletCount < 2 && clusterScore < 6) continue;

  candidates.push({
    story_title: storyTitle.slice(0, 160),
    story_key: storyKey(storyTitle),
    politics_score: Math.round(clusterScore),
    outlet_count: outletCount,
    outlets: [...outlets],
    cluster_score: clusterScore,
    articles: c.items.slice(0, 6).map((a) => ({
      title: a.title,
      url: a.url,
      outlet: a.outlet,
      description: a.description,
      published_at: a.published_at,
      image_url: a.image_url || null,
    })),
  });
}

candidates.sort((a, b) => b.cluster_score - a.cluster_score);
const topCandidates = candidates.slice(0, 5);

return [{
  json: {
    candidates: topCandidates,
    stats: {
      rss_raw: rssRaw,
      filtered_junk: filteredJunk,
      filtered_politics: filteredPolitics,
      headlines_kept: rssHeadlines.length,
      clusters_total: clusters.length,
      candidates_count: topCandidates.length,
    },
  },
}];`;

export const SCOUT_PREFETCH_DEBATTEN_JS = `const ingest = $('Ingest and cluster').first()?.json || {};
const candidates = (ingest.candidates || []).slice(0, 2);
const baseUrl = ${JSON.stringify(SCOUT_SEARXNG_BASE_URL)};

function titleKeywords(title) {
  const stop = new Set(['og', 'i', 'på', 'til', 'for', 'en', 'et', 'den', 'det', 'som', 'er', 'av', 'med', 'har', 'fra', 'ikke', 'norge', 'norsk']);
  return String(title)
    .toLowerCase()
    .replace(/[^a-zæøå0-9\\s]/g, ' ')
    .split(/\\s+/)
    .filter((w) => w.length > 3 && !stop.has(w))
    .slice(0, 4)
    .join(' ');
}

async function searxSearch(query) {
  try {
    const res = await this.helpers.httpRequest({
      method: 'GET',
      url: baseUrl + '/search?q=' + encodeURIComponent(query) + '&format=json&language=nb',
      timeout: 8000,
    });
    return Array.isArray(res.results) ? res.results : [];
  } catch (_) {
    return [];
  }
}

const debattenByCandidate = [];
for (const c of candidates) {
  const kw = titleKeywords(c.story_title);
  const q = kw ? 'site:nrk.no/debatten ' + kw : 'site:nrk.no/debatten';
  const results = await searxSearch.call(this, q);
  const hit = results.find(
    (r) => r?.url && /nrk\\.no\\/debatten/i.test(String(r.url)) && String(r.title || '').length > 8,
  );
  debattenByCandidate.push(
    hit
      ? {
          title: String(hit.title).slice(0, 200),
          url: hit.url,
          outlet: 'NRK Debatten',
          description: hit.content ? String(hit.content).slice(0, 400) : null,
          published_at: null,
          image_url: null,
        }
      : null,
  );
}

return [{
  json: {
    ...ingest,
    debatten_prefetch: debattenByCandidate,
  },
}];`;

export const SCOUT_LOG_EMPTY_INGEST_JS = `const ingest = $('Ingest and cluster').first()?.json || {};
const stats = ingest.stats || {};
return [{
  json: {
    skip_reason: 'no_candidates',
    message: 'Ingest returnerte ingen klynger med minst 2 artikler',
    ...stats,
  },
}];`;

export const SCOUT_BUILD_INSERT_QUERY_JS = `const d = $input.first()?.json || {};
const esc = (s) => String(s ?? '').replace(/'/g, "''");

const payload = {
  story_title: d.story_title,
  why_interesting: d.why_interesting,
  topic_tags: Array.isArray(d.topic_tags) ? d.topic_tags : ['politikk'],
  story_key: d.story_key,
  politics_score: Number(d.politics_score) || 0,
  scout_metadata: d.scout_metadata || {},
  articles: (d.articles || []).map((a, i) => ({
    title: a.title,
    url: a.url,
    outlet: a.outlet || '?',
    description: a.description || null,
    published_at: a.published_at || null,
    is_primary: i === 0,
    sort_order: i,
    source_payload: a.source_payload || {},
  })),
};

const payloadJson = esc(JSON.stringify(payload));

const query = [
  'WITH payload AS (',
  "  SELECT '" + payloadJson + "'::jsonb AS data",
  '),',
  'ins AS (',
  '  INSERT INTO public.forum_research_clusters (',
  '    title, discovery_rationale, topic_tags, source_count,',
  '    external_cluster_key, politics_score, scout_metadata, status',
  '  )',
  '  SELECT',
  "    left(data->>'story_title', 160),",
  "    data->>'why_interesting',",
  '    COALESCE(',
  "      ARRAY(SELECT jsonb_array_elements_text(data->'topic_tags')),",
  "      ARRAY['politikk']::text[]",
  '    ),',
  "    jsonb_array_length(data->'articles'),",
  "    data->>'story_key',",
  "    COALESCE((data->>'politics_score')::int, 0),",
  "    COALESCE(data->'scout_metadata', '{}'::jsonb),",
  "    'pending'",
  '  FROM payload',
  '  RETURNING id, title',
  '),',
  'article_rows AS (',
  '  INSERT INTO public.forum_research_articles (',
  '    cluster_id, title, url, outlet, description, published_at,',
  '    is_primary, sort_order, source_payload',
  '  )',
  '  SELECT',
  '    ins.id,',
  "    left(a->>'title', 500),",
  "    a->>'url',",
  "    COALESCE(a->>'outlet', '?'),",
  "    a->>'description',",
  "    NULLIF(a->>'published_at', '')::timestamptz,",
  "    COALESCE((a->>'is_primary')::boolean, false),",
  "    COALESCE((a->>'sort_order')::int, 0),",
  "    COALESCE(a->'source_payload', '{}'::jsonb)",
  '  FROM ins',
  "  CROSS JOIN LATERAL jsonb_array_elements((SELECT data->'articles' FROM payload)) AS a",
  '  RETURNING id',
  ')',
  'SELECT ins.id AS cluster_id, ins.title, (SELECT count(*)::int FROM article_rows) AS article_count',
  'FROM ins;',
].join('\\n');

return [{ json: { query, story_title: d.story_title } }];`;

export const SCOUT_ENRICH_ARTICLES_JS = `const input = $input.first()?.json || {};
const articles = Array.isArray(input.articles) ? input.articles : [];
const maxFetch = Math.min(8, Math.max(articles.length, 2));
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
let okCount = 0;
let partialCount = 0;

for (const a of articles) {
  const copy = { ...a };
  let excerpt = '';
  let fetchStatus = 'skipped';

  if (isFetchableArticleUrl(a.url) && fetchCount < maxFetch) {
    fetchCount += 1;
    try {
      const html = await this.helpers.httpRequest({
        method: 'GET',
        url: a.url,
        timeout,
        headers: {
          'User-Agent': 'FolketsStemmeBot/1.0 (+https://folkets-stemme.no; forum-scout-v11)',
          Accept: 'text/html,application/xhtml+xml',
          'Accept-Language': 'nb-NO,nb;q=0.9',
        },
      });
      let text = extractArticleText(typeof html === 'string' ? html : String(html?.body || html?.data || ''));
      const desc = String(a.description || '').trim();
      if (text.length < 280 && desc.length >= 80) {
        text = (desc + ' ' + text).trim();
        fetchStatus = 'partial';
        partialCount += 1;
      } else if (text.length >= 280) {
        fetchStatus = 'ok';
        okCount += 1;
      } else {
        fetchStatus = 'failed';
      }
      excerpt = text.length ? text.slice(0, 3000) : '';
    } catch (_) {
      const desc = String(a.description || '').trim();
      excerpt = desc.length >= 80 ? desc.slice(0, 3000) : '';
      fetchStatus = excerpt ? 'partial' : 'failed';
      if (fetchStatus === 'partial') partialCount += 1;
    }
  } else {
    const desc = String(a.description || '').trim();
    if (desc.length >= 80) {
      excerpt = desc.slice(0, 3000);
      fetchStatus = 'partial';
      partialCount += 1;
    }
  }

  copy.source_payload = {
    excerpt,
    fetch_status: fetchStatus,
    image_url: a.image_url || null,
    published_at_rss: a.published_at || null,
    word_count: excerpt ? excerpt.split(/\\s+/).filter(Boolean).length : 0,
  };
  enriched.push(copy);
}

const qualityOk = enriched.filter((x) => {
  const st = x.source_payload?.fetch_status;
  const ex = String(x.source_payload?.excerpt || '').trim();
  return (st === 'ok' || st === 'partial') && ex.length >= 80;
}).length;

return [{
  json: {
    ...input,
    articles: enriched,
    quality_source_count: qualityOk,
    enrich_stats: { ok: okCount, partial: partialCount, total: enriched.length },
  },
}];`;
