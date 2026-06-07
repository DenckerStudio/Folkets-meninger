/**
 * Forum Reels v8 – article body fetch before cluster save.
 */
export const FETCH_ARTICLE_BODIES_JS = `const input = $input.first()?.json || {};
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

export const ENRICH_STORY_ARTICLES_JS = `const gen = $input.first()?.json || {};
const ingest = $('Build discovery input').first()?.json || $('Cluster headlines').first()?.json || {};
const headlines = Array.isArray(ingest.headlines) ? ingest.headlines : [];
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
    ...ingest,
    ...gen,
    headlines: enriched,
    articlesFetched: enriched.filter((x) => x.articleFetchStatus === 'ok').length,
    articlesPartial: enriched.filter((x) => x.articleFetchStatus === 'partial').length,
    articlesFailed: enriched.filter((x) => x.articleFetchStatus === 'failed').length,
  },
}];`;
