/**
 * Forum Reels v12 – Regjeringen RSS ingest (RSS Read node + Code parse/dedupe).
 */

export const REGJERINGEN_RSS_URL =
  'https://www.regjeringen.no/no/rss/Rss/2581966/?from=01.01.2026&to=31.12.2026';

export const REGJERINGEN_RSS_ITEMS_LIMIT = 40;

export const REGJERINGEN_JUNK_PATTERNS =
  /(vm\s|verdensmesterskap|champions league|fotball|håndball|ishockey|olympiad|døde|død|omkom|bilulykke|trafikkulykke|kjendis|rampelys|underholdning|kronprinsesse|prinsesse |prins |kongehus|celebrity)/i;

export const REGJERINGEN_INGEST_JS = `const itemsLimit = ${REGJERINGEN_RSS_ITEMS_LIMIT};
const junkRe = ${REGJERINGEN_JUNK_PATTERNS.toString()};

const ctx = $('Fetch dedup context').first()?.json || {};
const existingUrls = new Set((ctx.existing_urls || []).map((u) => String(u).toLowerCase()));
const recentTitles = new Set((ctx.recent_titles || []).map((t) => String(t).toLowerCase()));

function stripHtml(value) {
  return String(value ?? '').replace(/<[^>]+>/g, ' ').replace(/\\s+/g, ' ').trim();
}

function normalizeItem(raw) {
  const title = String(raw.title || '').trim();
  const url = String(raw.link || raw.url || raw.guid || '').trim();
  if (!title || !url || !/^https?:\\/\\//i.test(url)) return null;
  const description = stripHtml(
    raw.contentSnippet || raw.content || raw.description || raw.summary || '',
  );
  const pubDate = raw.pubDate || raw.isoDate || raw.published_at || null;
  return {
    title,
    url,
    outlet: 'Regjeringen',
    description: description || null,
    published_at: pubDate,
  };
}

function storyKey(title) {
  return String(title)
    .toLowerCase()
    .replace(/[^a-zæøå0-9]+/gi, ' ')
    .trim()
    .slice(0, 80);
}

function recencyBoost(publishedAt) {
  const t = Date.parse(String(publishedAt || ''));
  if (Number.isNaN(t)) return 1;
  const ageHours = (Date.now() - t) / 3600000;
  if (ageHours < 24) return 3;
  if (ageHours < 72) return 2;
  if (ageHours < 168) return 1;
  return 0;
}

const rssRows = $('RSS Read')
  .all()
  .map((i) => i.json)
  .filter(Boolean);

let rssRaw = 0;
let filteredJunk = 0;
let filteredDuplicate = 0;
const seenUrls = new Set();
const newItems = [];

for (const raw of rssRows.slice(0, itemsLimit)) {
  const item = normalizeItem(raw);
  if (!item) continue;

  rssRaw += 1;
  const urlKey = String(item.url).toLowerCase();
  const titleKey = String(item.title).toLowerCase().trim();

  if (item.title.length < 12) continue;
  if (junkRe.test(item.title)) {
    filteredJunk += 1;
    continue;
  }
  if (seenUrls.has(urlKey) || existingUrls.has(urlKey)) {
    filteredDuplicate += 1;
    continue;
  }
  if (recentTitles.has(titleKey)) {
    filteredDuplicate += 1;
    continue;
  }

  seenUrls.add(urlKey);
  const politicsScore = 5 + recencyBoost(item.published_at);
  newItems.push({
    story_title: item.title.slice(0, 160),
    story_key: storyKey(item.title),
    why_interesting: 'Regjeringssak fra Regjeringen.no RSS.',
    topic_tags: ['politikk'],
    politics_score: politicsScore,
    scout_metadata: {
      source: 'regjeringen_rss',
      ingest_at: new Date().toISOString(),
    },
    articles: [{
      title: item.title,
      url: item.url,
      outlet: item.outlet,
      description: item.description,
      published_at: item.published_at,
      is_primary: true,
      sort_order: 0,
      source_payload: {
        excerpt: item.description || '',
        fetch_status: item.description ? 'partial' : 'pending',
        published_at_rss: item.published_at || null,
      },
    }],
  });
}

const stats = {
  rss_raw: rssRaw,
  filtered_junk: filteredJunk,
  filtered_duplicate: filteredDuplicate,
  new_count: newItems.length,
};

if (!newItems.length) {
  return [{ json: { skip_reason: 'no_new_items', stats } }];
}

return newItems.map((item) => ({ json: { ...item, stats } }));`;

export const REGJERINGEN_BUILD_INSERT_JS = `const d = $input.item.json || {};
const esc = (s) => String(s ?? '').replace(/'/g, "''");

const payload = {
  story_title: d.story_title,
  why_interesting: d.why_interesting,
  topic_tags: Array.isArray(d.topic_tags) ? d.topic_tags : ['politikk'],
  story_key: d.story_key,
  politics_score: Number(d.politics_score) || 0,
  scout_metadata: d.scout_metadata || { source: 'regjeringen_rss' },
  articles: (d.articles || []).map((a, i) => ({
    title: a.title,
    url: a.url,
    outlet: a.outlet || 'Regjeringen',
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
  '    external_cluster_key, politics_score, scout_metadata, status, source_type',
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
  "    'pending',",
  "    'rss'",
  '  FROM payload',
  "  WHERE NOT EXISTS (",
  '    SELECT 1 FROM public.forum_research_clusters c',
  "    WHERE lower(trim(c.external_cluster_key)) = lower(trim(data->>'story_key'))",
  "      AND c.created_at > now() - interval '30 days'",
  "      AND c.status NOT IN ('rejected', 'failed')",
  '  )',
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
  "    COALESCE(a->>'outlet', 'Regjeringen'),",
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

return { json: { query, story_title: d.story_title, stats: d.stats } };`;

export const REGJERINGEN_LOG_EMPTY_JS = `const first = $('Parse Regjeringen RSS').first()?.json || {};
const stats = first.stats || {};
return [{
  json: {
    skip_reason: first.skip_reason || 'no_new_items',
    message: first.message || 'Ingen nye Regjeringen-artikler å lagre',
    ...stats,
  },
}];`;
