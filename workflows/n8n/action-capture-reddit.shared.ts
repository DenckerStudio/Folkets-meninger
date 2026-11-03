/**
 * Reddit-hints for aksjonsfangst (cluster_key når lenke peker på ekstern artikkel).
 * Innhenting av Reddit-data skjer kun via Arctic Shift i n8n — ingen reddit.com-RSS her.
 */

/**
 * Foreslå cluster_key for Reddit-lenkeposter: peker URL til en nyhetsdomene,
 * bruk stabil nøkkel fra artikkel-URL slik at klynging kan matche RSS-kilder.
 */
export function redditLinkClusterKeyHint(input: {
  sourceType?: string | null;
  urlCanonical?: string | null;
  actionSlug?: string | null;
}): string | null {
  const slug = input.actionSlug?.trim();
  if (slug) return slug;
  if (input.sourceType !== 'reddit') return null;
  const url = input.urlCanonical?.trim();
  if (!url) return null;
  try {
    const parsed = new URL(url);
    const host = parsed.hostname.replace(/^www\./, '').toLowerCase();
    if (host === 'reddit.com' || host === 'redd.it') return null;
    const path = parsed.pathname.replace(/\/+$/, '') || '/';
    return `link-${host}${path}`.toLowerCase().slice(0, 120);
  } catch {
    return null;
  }
}

/** n8n Code node: patch cluster_key etter LLM når Reddit peker på ekstern artikkel. */
export const REDDIT_CLUSTER_KEY_PATCH_JS = `const item = $json.item || $json;
const cls = $json.classification || {};
let clusterKey = cls.action_slug || ($json.cluster_key || '');
if (!cls.action_slug && item && item.source_type === 'reddit') {
  const url = String(item.url_canonical || '').trim();
  try {
    const u = new URL(url);
    const host = u.hostname.replace(/^www\\./, '').toLowerCase();
    if (host !== 'reddit.com' && host !== 'redd.it') {
      const path = u.pathname.replace(/\\/+$/,'') || '/';
      clusterKey = ('link-' + host + path).toLowerCase().slice(0, 120);
    }
  } catch {}
}
if (!clusterKey && item) clusterKey = 'item-' + String(item.item_key || '').slice(0, 12);
return [{ json: { ...$json, cluster_key: clusterKey } }];`;
