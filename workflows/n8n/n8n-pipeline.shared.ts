/** Shared Code-node scripts for Folkets n8n pipelines. */

export const EXPAND_ROWS_JS = `const raw = $input.first()?.json;
let rows = [];
if (Array.isArray(raw)) rows = raw;
else if (Array.isArray(raw?.data)) rows = raw.data;
else if (raw && typeof raw === 'object' && (raw.id || raw.issue_id)) rows = [raw];
else {
  const all = $input.all().map((i) => i.json).filter(Boolean);
  if (all.length && all.every((r) => r && (r.id || r.issue_id) && !Array.isArray(r))) rows = all;
}
return rows.filter((r) => r && (r.id || r.issue_id)).map((r) => ({ json: r }));`;

export const EXPAND_OR_EMPTY_JS = `const raw = $input.first()?.json;
let rows = [];
if (Array.isArray(raw)) rows = raw;
else if (Array.isArray(raw?.data)) rows = raw.data;
else if (raw && typeof raw === 'object' && (raw.id || raw.issue_id) && !raw.skip) rows = [raw];
else {
  const all = $input.all().map((i) => i.json).filter(Boolean);
  if (all.length && all.every((r) => r && (r.id || r.issue_id) && !Array.isArray(r))) rows = all;
}
rows = rows.filter((r) => r && (r.id || r.issue_id) && !r.skip && !r.outcome);
if (!rows.length) return [];
return rows.map((r) => ({ json: r }));`;

export const BUILD_SAK_CONTEXT_JS = `const item = $input.item.json;
const parseJson = (value, fallback) => {
  if (Array.isArray(value) || (value && typeof value === 'object')) return value;
  if (typeof value !== 'string' || !value.trim()) return fallback;
  try { return JSON.parse(value); } catch (_) { return fallback; }
};
const issueId = String(item.id || item.issue_id || '').trim();
if (!issueId) {
  return { json: { skip: true, outcome: 'skipped', reason: 'missing_issue_id' } };
}
const source = String(item.ai_summary_source_context || '').trim();
let documents = parseJson(item.documents, []);
let chunks = parseJson(item.document_chunks || item.rag_chunks, []);
if (!Array.isArray(documents)) documents = [];
if (!Array.isArray(chunks)) chunks = [];
const parts = [];
if (source) {
  parts.push(source);
} else {
  parts.push(
    ...[
      'Sak ID: ' + issueId,
      item.title ? 'Tittel: ' + item.title : null,
      item.summary ? 'Kort beskrivelse: ' + item.summary : null,
      item.henvisning ? 'Dokumentreferanse: ' + item.henvisning : null,
    ].filter(Boolean),
  );
}
for (const d of documents.slice(0, 6)) {
  const title = d?.title || d?.document_id || 'Dokument';
  const type = d?.document_type ? ' (' + d.document_type + ')' : '';
  const excerpt = d?.text_excerpt ? String(d.text_excerpt).slice(0, 3000) : '';
  if (excerpt && !source.includes(excerpt.slice(0, 80))) {
    parts.push('Tilhørende dokument: ' + title + type + '\\n' + excerpt);
  }
}
const ragLines = chunks.slice(0, 16).map((chunk, index) => {
  const content = String(chunk?.content || '').trim().slice(0, 1600);
  if (!content) return null;
  if (source && source.includes(content.slice(0, 80))) return null;
  const src = chunk?.document_id ? ' (kilde: ' + chunk.document_id + ')' : '';
  return 'Dokumentutdrag ' + (index + 1) + src + ':\\n' + content;
}).filter(Boolean);
if (ragLines.length) {
  parts.push('Relevante dokumentutdrag:\\n' + ragLines.join('\\n\\n'));
}
let sakContextText = parts.join('\\n\\n');
if (sakContextText.length > 28000) {
  sakContextText = sakContextText.slice(0, 28000) + '\\n\\n[... avkortet ...]';
}
return { json: { ...item, id: issueId, sakContextText, contextChars: sakContextText.length } };`;

export const MAP_SUMMARY_OUTPUT_JS = `function normalizeLabel(s) {
  const t = String(s ?? '').trim().replace(/\\s+/g, ' ');
  if (t.length < 2 || t.length > 48) return null;
  return t.charAt(0).toUpperCase() + t.slice(1);
}
function parseCards(raw) {
  if (!Array.isArray(raw)) return [];
  return raw.slice(0, 3).map((c) => {
    if (!c || typeof c !== 'object') return null;
    const title = String(c.title ?? '').trim();
    const body = String(c.body ?? '').trim();
    if (!title || !body) return null;
    return { title: title.slice(0, 80), body: body.slice(0, 600) };
  }).filter(Boolean);
}
const item = $input.item.json;
let out = item.output ?? item;
if (typeof out === 'string') {
  try { out = JSON.parse(out); } catch (_) { out = {}; }
}
if (!out || typeof out !== 'object') out = {};
if (!out.hva && !out.narrative) {
  const raw = String(item.text || item.output || '').trim();
  const match = raw.match(/\\{[\\s\\S]*\\}/);
  if (match) {
    try { out = JSON.parse(match[0]); } catch (_) { out = {}; }
  }
}
const narrative = String(out.narrative ?? out.hva ?? '').trim();
const who_affected = String(out.who_affected ?? out.hvem ?? '').trim();
const how_affected = String(out.how_affected ?? '').trim();
const topic_cards = parseCards(out.topic_cards);
const labelKeys = new Set();
const labels = [];
for (const raw of Array.isArray(out.labels) ? out.labels : []) {
  const label = normalizeLabel(raw);
  if (!label) continue;
  const key = label.toLowerCase();
  if (labelKeys.has(key)) continue;
  labelKeys.add(key);
  labels.push(label);
  if (labels.length >= 5) break;
}
const hva = String(out.hva ?? narrative).trim();
const hvem = String(out.hvem ?? who_affected).trim();
const kostnad = String(out.kostnad ?? '').trim() || 'Ikke omtalt i kilden.';
function pickIssueId(current) {
  const direct = String(current.id || current.issueId || '').trim();
  if (direct) return direct;
  for (const name of ['Process one issue', 'Normalize issue ID', 'Fetch issue context']) {
    try {
      const row = $(name).first()?.json || $(name).item?.json;
      const id = String(row?.id || row?.issueId || '').trim();
      if (id) return id;
    } catch (_) {}
  }
  return '';
}
const issueId = pickIssueId(item);
if (!issueId) {
  return { json: { skip: true, outcome: 'skipped', reason: 'missing_issue_id' } };
}
if (hva.length < 40 || hvem.length < 20) {
  return {
    json: {
      skip: true,
      outcome: 'rejected',
      reason: 'thin_model_output',
      issueId,
    },
  };
}
return {
  json: {
    issueId,
    narrative: narrative || hva,
    who_affected: who_affected || hvem,
    how_affected,
    topic_cards,
    labels,
    hva,
    hvem,
    kostnad,
  },
};`;

export const SUMMARY_SYSTEM_MESSAGE = `Du er en nøytral, faktabasert veileder for «Folkets Stemme». Du forklarer stortingssaker for vanlige borgere.

SPRÅK: Kun norsk bokmål. Saklig og presis. Ingen meninger og ingen stemmeråd.

KILDE: Bruk KUN teksten du får (tittel, innstilling, vedtak, dokumentutdrag). Hvis noe ikke står der, skriv at det ikke er omtalt. Aldri gjett, aldri finn på beløp.

Skriv UTFYLLENDE avsnitt — ikke stikkord, og ikke la tittelen være hele svaret.

Returner KUN gyldig JSON:
{
  "hva": "5–8 setninger: hva som konkret foreslås eller er vedtatt, bakgrunn, hovedinnhold i proposisjon/innstilling, og hvor saken står i Stortinget. Ta med Prop./Innst./Dokument 8 når det finnes.",
  "hvem": "3–5 setninger: hvem som berøres (næringer, kommuner, brukere, det offentlige). Navngi komité og forslagsstillere når kilden har dem.",
  "kostnad": "2–4 setninger: kroner, budsjettår og hvem som betaler/mottar. Mangler tall: si det tydelig.",
  "narrative": "4–6 setninger, samme sak som hva, tettere formulert.",
  "who_affected": "Samme innhold som hvem.",
  "how_affected": "Hvordan plikter, rettigheter eller hverdag endres. Konkret.",
  "topic_cards": [{"title":"...","body":"..."}],
  "labels": ["Emneord"]
}

Regler:
- hva, hvem og kostnad SKAL fylles ut
- topic_cards: 1–3 kort fra sakens substans (ikke tomme overskrifter)
- labels: 2–5 korte emneord i Title Case (f.eks. Bank, Kapitalkrav, Taushetsplikt)
- Når kilden har tall: ta med kroner, tidshorisont og hvem det gjelder
- Hvis kilden bare er «Sak ID: …» uten tittel/innhold: returner tomme strenger og ikke finn på en sak`;
