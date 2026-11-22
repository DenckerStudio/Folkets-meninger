/**
 * Shared JS snippets + prompts for reddit-reply-worth.workflow.ts.
 * Gate regex must stay aligned with lib/reddit-signals/reply-worth-gate.ts.
 */

export const REPLY_WORTH_SYSTEM_MESSAGE = `Du vurderer om Folkets Meninger bør svare i en norsk Reddit-tråd.
Produkt: plattform for meninger, saker og avstemninger om norsk politikk og samfunn (folkets-meninger.no).
Reddit er interessesignal, ikke faktakilde.

Score reply_worth 1–5:
5 = sterkt: åpent spørsmål/samfunnsdiskusjon der vi kan hjelpe faktabasert, godt tidsvindu
4 = godt: relevant tema + engasjement; myk henvisning naturlig
3 = mulig: borderline
1–2 = nei: meme, shopping, spam, ren nyhetslink, toksisk, overfylt, dårlig fit

Svar KUN gyldig JSON: {"worth":n,"reason":"…"}
reason på bokmål, maks 140 tegn. Ikke foreslå auto-post.`;

/** Expand PostgREST RPC array / object into one item per candidate. */
export const EXPAND_REPLY_WORTH_CANDIDATES_JS = `const raw = $input.first()?.json;
let rows = [];
if (Array.isArray(raw)) rows = raw;
else if (Array.isArray(raw?.data)) rows = raw.data;
else if (raw && typeof raw === 'object' && raw.reddit_id) rows = [raw];
else {
  const all = $input.all().map((i) => i.json).filter(Boolean);
  if (all.length && all.every((r) => r && r.reddit_id && !Array.isArray(r))) rows = all;
}
rows = rows.filter((r) => r && r.reddit_id);
if (!rows.length) return [];
return rows.map((r) => ({ json: r }));`;

/**
 * Deterministic gate (mirrors lib/reddit-signals/reply-worth-gate.ts).
 * Sets gatePass, gateReasons, skipReason on the item.
 */
export const APPLY_REPLY_WORTH_GATE_JS = `const MAX_AGE_HOURS = 72;
const MIN_COMMENTS = 3;
const MAX_COMMENTS = 150;
const MIN_SCORE = 5;
const TITLE_BLOCKLIST = /\\b(meme|memes|shitpost|shopping|gavekort|giveaway|tipp?\\s*meg|hvilken\\s+bank|beste\\s+bank|lønnsslipp)\\b/i;

const row = $json;
const reasons = [];
const status = String(row.status || '');
if (status !== 'ny') reasons.push('status er ikke ny');
if (row.removal_type) reasons.push('tråd er merket fjernet');

const postedMs = Date.parse(row.posted_at);
const nowMs = Date.now();
if (!Number.isFinite(postedMs)) reasons.push('ugyldig posted_at');
else {
  const ageHours = (nowMs - postedMs) / (60 * 60 * 1000);
  if (ageHours > MAX_AGE_HOURS) reasons.push('eldre enn ' + MAX_AGE_HOURS + ' t');
  if (ageHours < 0) reasons.push('posted_at i fremtiden');
}

const score = Number(row.score);
const comments = Number(row.num_comments);
if (!Number.isFinite(score) || score < MIN_SCORE) reasons.push('score under ' + MIN_SCORE);
if (!Number.isFinite(comments) || comments < MIN_COMMENTS) reasons.push('færre enn ' + MIN_COMMENTS + ' kommentarer');
if (Number.isFinite(comments) && comments > MAX_COMMENTS) reasons.push('flere enn ' + MAX_COMMENTS + ' kommentarer');
if (TITLE_BLOCKLIST.test(String(row.title || ''))) reasons.push('tittel treffer blocklist');

const gatePass = reasons.length === 0;
return {
  json: {
    ...row,
    gatePass,
    gateReasons: reasons,
    skipReason: gatePass ? null : reasons.join('; '),
  },
};`;

export const BUILD_REPLY_WORTH_PROMPT_JS = `const j = $json;
const lines = [
  'Subreddit: r/' + (j.subreddit || ''),
  'Tittel: ' + (j.title || ''),
  'Poeng: ' + (j.score ?? ''),
  'Kommentarer: ' + (j.num_comments ?? ''),
  'Kommentarer per poeng: ' + (j.contention ?? ''),
  'Flair: ' + (j.flair || '(ingen)'),
  'Koblet sak: ' + (j.related_issue_title || '(ingen)'),
];
return {
  json: {
    ...j,
    promptText: lines.join('\\n'),
  },
};`;

export const MAP_REPLY_WORTH_OUTPUT_JS = `const j = $json;
let worth = null;
let reason = '';
const raw =
  j.output ||
  j.text ||
  j.response ||
  (typeof j === 'object' && j.worth != null ? j : null);

let parsed = raw;
if (typeof raw === 'string') {
  try { parsed = JSON.parse(raw); } catch (_) {
    const m = raw.match(/\\{[\\s\\S]*\\}/);
    if (m) {
      try { parsed = JSON.parse(m[0]); } catch (__) { parsed = null; }
    } else parsed = null;
  }
}

if (parsed && typeof parsed === 'object') {
  const w = Number(parsed.worth);
  if (Number.isFinite(w)) worth = Math.max(1, Math.min(5, Math.round(w)));
  reason = String(parsed.reason || '').trim().slice(0, 140);
}

const ok = worth !== null;
return {
  json: {
    reddit_id: j.reddit_id || $('Apply reply-worth gate').item.json.reddit_id,
    gatePass: true,
    worth: ok ? worth : null,
    reason: reason || (ok ? 'Uten begrunnelse' : 'ugyldig modell-svar'),
    model: 'gemma4:26b',
    setStatus: ok ? 'scored' : 'failed',
  },
};`;
