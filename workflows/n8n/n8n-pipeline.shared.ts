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

export const BUILD_SAK_CONTEXT_JS = `// «Build sak context» v3 (hurtigfiks 2026-10-20). Code node, mode runOnceForEachItem.
// Utfall først (kortvedtak/vedtakstekst), så fakta (dokumenttype, komité), så deterministisk uttrukne
// forslag, komiteens tilråding og til slutt dokumenttekst (hoveddokument før innstilling; referater utelates).
// Erstatter den gamle 800-tegns-kappen. Tak: MAX_CONTEXT_CHARS (~4–5k tokens, passer num_ctx 16384).
const PROMPT_VERSION = 'sak-summary-v3-quickfix';
const MAX_CONTEXT_CHARS = 14000;
const MAX_FORSLAG_CHARS = 450;
const MAX_TILRAADING_CHARS = 1500;
const item = $input.item.json;
const src = String(item.ai_summary_source_context || '');

const KNOWN = ['Kort beskrivelse', 'Dokumentreferanse', 'Komité', 'Emner', 'Stikkord', 'Forslagstillere', 'Saksordførere', 'Saksgang og hendelser', 'Innstillingstekst', 'Kortvedtak', 'Vedtakstekst', 'Parentestekst'];
const sec = {};
const persistedChunks = [];
const persistedDocs = [];
let inChunks = false;
for (const rawBlock of src.split('\\n\\n')) {
  const block = rawBlock.trim();
  if (!block) continue;
  let m;
  if ((m = block.match(/^Sak ID:\\s*(.+)$/))) { sec['Sak ID'] = m[1].trim(); continue; }
  if ((m = block.match(/^Tittel:\\s*([\\s\\S]+)$/))) { sec['Tittel'] = m[1].trim(); continue; }
  if (block.startsWith('Relevante dokumentutdrag:')) { inChunks = true; const rest = block.slice('Relevante dokumentutdrag:'.length).trim(); if (rest) persistedChunks.push(rest); continue; }
  if (block.startsWith('Tilhørende dokument:')) { inChunks = false; persistedDocs.push(block); continue; }
  m = block.match(/^([^\\n:]{1,40}):\\n([\\s\\S]*)$/);
  if (m && KNOWN.includes(m[1].trim())) { inChunks = false; sec[m[1].trim()] = m[2].trim(); continue; }
  if (inChunks) {
    if (/^Dokumentutdrag \\d+/.test(block) || !persistedChunks.length) persistedChunks.push(block);
    else persistedChunks[persistedChunks.length - 1] += '\\n\\n' + block;
  }
}
// Persisterte chunks → {document_id, chunk_index, content}
const parsedPersisted = persistedChunks.map((b) => {
  const m = b.match(/^Dokumentutdrag \\d+(?: \\(kilde: ([^)#]+?)(?: #(\\d+))?\\))?:\\n([\\s\\S]*)$/);
  if (!m) return null;
  return { document_id: (m[1] || '').trim(), chunk_index: m[2] ? Number(m[2]) : 0, content: m[3].trim() };
}).filter((c) => c && c.content);

let fresh = item.document_chunks;
if (typeof fresh === 'string') { try { fresh = JSON.parse(fresh); } catch (_) { fresh = []; } }
if (!Array.isArray(fresh)) fresh = [];
fresh = fresh.filter((c) => c && c.content);
const chunks = fresh.length ? fresh : parsedPersisted;

const title = sec['Tittel'] || item.title || '';
const summary = sec['Kort beskrivelse'] || item.summary || '';
const henvisning = sec['Dokumentreferanse'] || item.henvisning || '';
const komite = sec['Komité'] || '';
const kortvedtak = sec['Kortvedtak'] || '';
const vedtakstekst = sec['Vedtakstekst'] || '';
const parentes = sec['Parentestekst'] || '';

function docTypeOf(h) {
  if (/Dokument\\s*8\\s*:/i.test(h)) return 'Representantforslag (Dokument 8) – fremmet av stortingsrepresentanter, ikke av regjeringen';
  if (/Prop\\.\\s*\\d+\\s*L/i.test(h)) return 'Lovproposisjon fra regjeringen (Prop. L)';
  if (/Prop\\.\\s*\\d+\\s*LS/i.test(h)) return 'Proposisjon fra regjeringen (Prop. LS)';
  if (/Prop\\./i.test(h)) return 'Proposisjon fra regjeringen';
  if (/Meld\\.\\s*St\\./i.test(h)) return 'Stortingsmelding fra regjeringen';
  if (/Dokument\\s*3\\s*:/i.test(h)) return 'Dokument fra Riksrevisjonen (Dokument 3)';
  if (/Dokument\\s*\\d+/i.test(h)) return 'Stortingsdokument (' + (h.match(/Dokument\\s*\\d+[^,]*/i) || [''])[0].trim() + ')';
  if (/Innst\\./i.test(h)) return 'Innstilling fra komité';
  return '';
}
const docType = docTypeOf(henvisning);
const docTypeKey = /Representantforslag/.test(docType) ? 'representantforslag' : /proposisjon/i.test(docType) ? 'proposisjon' : /melding/i.test(docType) ? 'melding' : docType ? 'annet' : 'ukjent';

function outcomeOf(kv, vt) {
  const t = (kv + ' ' + vt).toLowerCase().replace(/\\s+/g, ' ');
  if (!kv.trim()) return { stage: 'ikke_ferdigbehandlet', label: 'Ingen kortvedtak i kilden – saken er ikke ferdigbehandlet (ikke påstå at noe er vedtatt eller avvist).' };
  if (/ble ikke vedtatt|vedtok ikke|ikke vedtatt|ble ikke bifalt|ikke bifalt|vedlegges protokollen|ble avvist|ble forkastet|\\bfalt\\b/.test(t)) {
    if (/stortinget vedtok å|ble vedtatt med|vedtatt i endret form/.test(t)) return { stage: 'delvis_vedtatt', label: 'Delvis/endret vedtak – se kortvedtak ordrett.' };
    return { stage: 'ikke_vedtatt', label: 'Forslaget ble IKKE vedtatt.' };
  }
  if (/med avvik|med tillegg|avvik\\/tillegg|i endret form/.test(t)) return { stage: 'delvis_vedtatt', label: 'Stortinget vedtok noe annet eller mindre enn det opprinnelige forslaget – beskriv nøyaktig det kortvedtaket sier, ikke at forslagene ble vedtatt.' };
  if (/stortinget vedtok|ble vedtatt|bifalt|samtykke|vedtatt/.test(t)) return { stage: 'vedtatt', label: 'Stortinget fattet vedtak – se kortvedtak ordrett for hva som ble vedtatt.' };
  return { stage: 'se_kortvedtak', label: 'Se kortvedtak ordrett.' };
}
const outcome = outcomeOf(kortvedtak, vedtakstekst);

// Dokumenttekst per dokument (chunk-overlapp fjernes)
const byDoc = new Map();
for (const c of chunks) {
  const id = String(c.document_id || 'ukjent');
  if (!byDoc.has(id)) byDoc.set(id, []);
  byDoc.get(id).push(c);
}
function joinChunks(list) {
  list.sort((a, b) => Number(a.chunk_index || 0) - Number(b.chunk_index || 0));
  let out = '';
  for (const c of list) {
    const t = String(c.content || '').trim();
    if (!out) { out = t; continue; }
    let k = Math.min(160, t.length, out.length);
    let cut = 0;
    for (; k >= 20; k--) { if (out.endsWith(t.slice(0, k))) { cut = k; break; } }
    out += (cut ? '' : ' ') + t.slice(cut);
  }
  return out;
}
function docKind(id) {
  if (/^refs-|referat|votering/i.test(id)) return 'referat';
  if (/^inns|innst/i.test(id)) return 'innstilling';
  return 'hoved';
}
const docs = [...byDoc.entries()].map(([id, list]) => ({ id, kind: docKind(id), text: joinChunks(list) }));
const mainDocs = docs.filter((d) => d.kind === 'hoved');
const innstDocs = docs.filter((d) => d.kind === 'innstilling');

// Deterministisk uttrekk av forslag («Stortinget ber regjeringen …» / «Stortinget samtykker i …»)
function extractForslag(text) {
  let t = text;
  const marker = [...t.matchAll(/(fremmes|fremmer|følgende) (?:følgende )?forslag:?/gi)].pop();
  if (marker) t = t.slice(marker.index);
  const parts = t.split(/(?=Stortinget (?:ber regjeringen|samtykker i|gir samtykke|vedtar|anmoder regjeringen))/);
  const out = [];
  for (const p of parts) {
    if (!/^Stortinget (ber regjeringen|samtykker i|gir samtykke|vedtar|anmoder regjeringen)/.test(p)) continue;
    let s = p.replace(/\\s+/g, ' ').trim();
    s = s.split(/\\s\\d{1,2}\\.\\s(?:januar|februar|mars|april|mai|juni|juli|august|september|oktober|november|desember)\\s\\d{4}\\b/i)[0];
    s = s.split(/\\s(?:II|III|IV|V)\\s(?=Stortinget|Loven|Lova)/)[0];
    if (s.length > MAX_FORSLAG_CHARS) s = s.slice(0, MAX_FORSLAG_CHARS).replace(/\\s\\S*$/, '') + ' …';
    if (s.length > 25 && !out.includes(s)) out.push(s);
  }
  return out;
}
let forslag = [];
for (const d of mainDocs) forslag = forslag.concat(extractForslag(d.text));
const WORDNUM = { to: 2, tre: 3, fire: 4, fem: 5, seks: 6, sju: 7, syv: 7, åtte: 8, ni: 9, ti: 10, elleve: 11, tolv: 12 };
let expectedCount = null;
const tm = String(title).toLowerCase().match(/\\b(to|tre|fire|fem|seks|sju|syv|åtte|ni|ti|elleve|tolv|\\d{1,2})\\s+(tiltak|forslag|punkter|grep)/);
if (tm) expectedCount = WORDNUM[tm[1]] || Number(tm[1]) || null;

function extractTilraading(text) {
  const idx = text.search(/Komiteens tilråding|Komiteen rår Stortinget til|rår Stortinget til å gjøre slikt vedtak/i);
  if (idx < 0) return '';
  let s = text.slice(idx).replace(/\\s+/g, ' ').trim();
  if (s.length > MAX_TILRAADING_CHARS) s = s.slice(0, MAX_TILRAADING_CHARS).replace(/\\s\\S*$/, '') + ' …';
  return s;
}
let tilraading = '';
for (const d of innstDocs) { tilraading = extractTilraading(d.text); if (tilraading) break; }

const head = [];
head.push('=== UTFALL OG STATUS (fasit – bruk dette, ikke gjett) ===');
head.push('Utfall: ' + outcome.label);
if (kortvedtak) head.push('Kortvedtak (ordrett): ' + kortvedtak);
if (vedtakstekst) head.push('Vedtakstekst: ' + vedtakstekst);
if (parentes) head.push('Parentestekst: ' + parentes);
if (sec['Saksgang og hendelser']) head.push('Saksgang: ' + sec['Saksgang og hendelser'].replace(/\\n\\s*/g, ' '));
head.push('');
head.push('=== FAKTA OM SAKEN ===');
head.push('Sak ID: ' + (sec['Sak ID'] || item.id || ''));
if (title) head.push('Tittel: ' + title);
if (summary && summary !== title) head.push('Kort beskrivelse: ' + summary);
if (docType) head.push('Dokumenttype: ' + docType);
if (henvisning) head.push('Dokumentreferanse: ' + henvisning);
if (komite) head.push('Komité (Stortingets fagkomité som behandlet saken): ' + komite);
if (sec['Forslagstillere']) head.push('Forslagstillere: ' + sec['Forslagstillere']);
if (sec['Saksordførere']) head.push('Saksordførere: ' + sec['Saksordførere']);
if (sec['Emner']) head.push('Emner: ' + sec['Emner']);
if (sec['Innstillingstekst'] && sec['Innstillingstekst'] !== title) head.push('Innstillingstekst: ' + sec['Innstillingstekst']);
if (forslag.length) {
  head.push('');
  head.push('=== FORSLAGENE I DOKUMENTET (' + forslag.length + ' stk, uttrukket ordrett – gjengi ALLE) ===');
  forslag.forEach((f, i) => head.push((i + 1) + '. ' + f));
}
if (tilraading) {
  head.push('');
  head.push('=== KOMITEENS TILRÅDING (utdrag) ===');
  head.push(tilraading);
}
let text = head.join('\\n');
const body = [];
let budget = MAX_CONTEXT_CHARS - text.length - 200;
const ordered = [...mainDocs, ...innstDocs];
for (const d of ordered) {
  if (budget < 400) break;
  let t = d.text.replace(/\\s+/g, ' ').trim();
  const label = '[' + d.id + (d.kind === 'innstilling' ? ' – innstilling' : '') + ']';
  if (t.length > budget - label.length - 1) t = t.slice(0, Math.max(0, budget - label.length - 20)).replace(/\\s\\S*$/, '') + ' [… avkortet …]';
  body.push(label + '\\n' + t);
  budget -= t.length + label.length + 2;
}
// Fallback: dokumentutdrag fra persistert kontekst (text_excerpt) hvis ingen chunks
if (!ordered.length) {
  for (const d of persistedDocs) {
    if (budget < 400) break;
    let t = d.replace(/\\s+/g, ' ').trim();
    if (t.length > budget) t = t.slice(0, budget - 20) + ' [… avkortet …]';
    body.push(t);
    budget -= t.length + 2;
  }
}
if (body.length) text += '\\n\\n=== DOKUMENTTEKST (bakgrunn) ===\\n' + body.join('\\n\\n');
if (text.length > MAX_CONTEXT_CHARS) text = text.slice(0, MAX_CONTEXT_CHARS) + '\\n[… avkortet …]';

// cyrb53 – deterministisk hash av kontekst + promptversjon (brukes til «regenerer kun ved endring»)
function cyrb53(str, seed = 0) {
  let h1 = 0xdeadbeef ^ seed, h2 = 0x41c6ce57 ^ seed;
  for (let i = 0, ch; i < str.length; i++) { ch = str.charCodeAt(i); h1 = Math.imul(h1 ^ ch, 2654435761); h2 = Math.imul(h2 ^ ch, 1597334677); }
  h1 = Math.imul(h1 ^ (h1 >>> 16), 2246822507); h1 ^= Math.imul(h2 ^ (h2 >>> 13), 3266489909);
  h2 = Math.imul(h2 ^ (h2 >>> 16), 2246822507); h2 ^= Math.imul(h1 ^ (h1 >>> 13), 3266489909);
  return (4294967296 * (2097151 & h2) + (h1 >>> 0)).toString(16).padStart(14, '0');
}
const contextHash = cyrb53(PROMPT_VERSION + '\\n' + text);
const hasContent = Boolean(title) && (Boolean(kortvedtak) || Boolean(summary) || ordered.length > 0);
return {
  json: {
    ...item,
    document_chunks: undefined,
    sakContextText: text,
    contextChars: text.length,
    contextHash,
    sourceHash: String(item.ai_summary_source_hash || ''),
    promptVersion: PROMPT_VERSION,
    facts: {
      outcome_stage: outcome.stage,
      doc_type: docTypeKey,
      komite,
      forslag_count: forslag.length,
      forslag_expected: expectedCount,
      forslag_source: forslag,
      kortvedtak,
      has_content: hasContent,
      chunk_docs: docs.map((d) => d.id + ':' + d.kind),
      chunks_used: chunks.length,
      chunk_source: fresh.length ? 'document_chunks' : 'persisted_context',
    },
  },
};
`;

export const MAP_SUMMARY_OUTPUT_JS = `// «Parse & validate summary» – Code node, runOnceForEachItem. Erstatter «Map agent output».
// Ugyldig/tynn/motstridende output → skip (eksisterende sammendrag overskrives ikke).
// Felles parser/validering for AI-sammendrag v3 (hurtigfiks 2026-10-20).
// validateSummary(raw, facts) -> { ok, reason, out, quality }
function validateSummary(raw, facts) {
  facts = facts || {};
  const quality = { json_valid: false, json_repaired: false, repairs: [], flags: [] };
  let txt = typeof raw === 'string' ? raw : (raw && typeof raw === 'object' ? JSON.stringify(raw) : '');
  txt = txt.replace(/<think>[\\s\\S]*?<\\/think>/gi, '').replace(/\`\`\`(?:json)?/gi, '').trim();
  let obj = null;
  try { obj = JSON.parse(txt); quality.json_valid = true; } catch (_) {}
  if (!obj) {
    const a = txt.indexOf('{'); const b = txt.lastIndexOf('}');
    if (a >= 0 && b > a) {
      let s = txt.slice(a, b + 1);
      try { obj = JSON.parse(s); } catch (_) {
        s = s.replace(/,\\s*([}\\]])/g, '$1').replace(/[\\u201C\\u201D]/g, '"').replace(/\\r?\\n/g, ' ');
        try { obj = JSON.parse(s); } catch (_) { obj = null; }
      }
      if (obj) { quality.json_repaired = true; quality.repairs.push('json_extract_or_repair'); }
    }
  }
  if (!obj || typeof obj !== 'object' || Array.isArray(obj)) return { ok: false, reason: 'invalid_json', out: null, quality };
  const str = (v) => (typeof v === 'string' ? v : v == null ? '' : Array.isArray(v) ? v.join(' ') : String(v)).replace(/\\s+/g, ' ').trim();
  const fixSpelling = (s) => {
    const before = s;
    s = s.replace(/\\bSakken\\b/g, 'Saken').replace(/\\bsakken\\b/g, 'saken')
      .replace(/\\bKomitéen\\b/g, 'Komiteen').replace(/\\bkomitéen\\b/g, 'komiteen')
      .replace(/\\bRollestol/g, 'Rullestol').replace(/\\brollestol/g, 'rullestol')
      .replace(/mæssig/g, 'messig').replace(/forstærk/g, 'forsterk');
    if (s !== before) quality.repairs.push('spelling');
    return s;
  };
  let hva = fixSpelling(str(obj.hva || obj.narrative));
  const hvem = fixSpelling(str(obj.hvem || obj.who_affected));
  const how = fixSpelling(str(obj.how_affected));
  let kostnad = fixSpelling(str(obj.kostnad));
  const utfall = str(obj.utfall).toLowerCase();
  if (hva.length < 60) return { ok: false, reason: 'missing_or_thin_hva', out: null, quality };
  if (hvem.length < 30) return { ok: false, reason: 'missing_or_thin_hvem', out: null, quality };
  if (how.length < 30) return { ok: false, reason: 'missing_or_thin_how_affected', out: null, quality };

  // Dokumenttype
  if (facts.doc_type === 'representantforslag' && /proposisjon/i.test(hva + ' ' + hvem + ' ' + how)) {
    hva = hva.replace(/\\bProposisjonen\\b/g, 'Representantforslaget').replace(/\\bproposisjonen\\b/g, 'representantforslaget');
    quality.repairs.push('doc_type_proposisjon_to_representantforslag');
    quality.flags.push('doc_type_was_wrong');
  }
  // Utfall
  const all = (hva + ' ' + how).toLowerCase();
  const saysNot = /ikke vedtatt|vedtok ikke|ikke flertall|ble avvist|ble ikke|ikke ble vedtatt|\\bfalt\\b/.test(all);
  const saysAdopted = /\\b(ble|er|har blitt|blitt) vedtatt\\b/.test(all.replace(/ikke (ble|er|har blitt) vedtatt/g, '').replace(/(ble|er) ikke vedtatt/g, ''));
  const stage = facts.outcome_stage || '';
  if (stage === 'ikke_vedtatt') {
    if (saysAdopted && !saysNot) return { ok: false, reason: 'outcome_conflict_says_adopted', out: null, quality };
    if (!saysNot) { hva = hva.replace(/\\s*$/, '') + ' Forslaget ble ikke vedtatt i Stortinget.'; quality.repairs.push('outcome_sentence_added'); }
  }
  if (stage === 'ikke_ferdigbehandlet' && saysAdopted) return { ok: false, reason: 'outcome_conflict_not_decided', out: null, quality };
  if (utfall && stage && !['se_kortvedtak'].includes(stage) && utfall !== stage && !(stage === 'vedtatt' && utfall === 'delvis_vedtatt') && !(stage === 'delvis_vedtatt' && utfall === 'vedtatt')) quality.flags.push('utfall_field_mismatch:' + utfall + '≠' + stage);
  // Komité
  if (facts.komite && !(hva + ' ' + hvem).toLowerCase().includes(String(facts.komite).toLowerCase().slice(0, 12))) quality.flags.push('komite_not_named');
  // Kostnad: tom når kilden ikke sier noe
  if (/ikke (oppgitt|omtalt|nevnt|spesifisert)|ingen (informasjon|opplysninger)|mangler (tall|informasjon)|ikke kjent/i.test(kostnad)) { kostnad = ''; quality.repairs.push('kostnad_filler_removed'); }
  if (kostnad && !/\\d|kr\\b|kroner|milliard|million|budsjett|bevilg|økonomisk|kostn|utgift/i.test(kostnad)) { quality.flags.push('kostnad_without_numbers'); }
  // Forslagsliste: fullstendig mot deterministisk uttrekk
  let forslag = Array.isArray(obj.forslag) ? obj.forslag.map(str).filter((s) => s.length > 3) : [];
  const src = Array.isArray(facts.forslag_source) ? facts.forslag_source : [];
  quality.forslag_model = forslag.length;
  quality.forslag_source = src.length;
  quality.forslag_expected = facts.forslag_expected || null;
  if (src.length && forslag.length !== src.length) {
    quality.flags.push('forslag_incomplete_model_' + forslag.length + '_of_' + src.length);
    forslag = src.map((s) => s.replace(/^Stortinget ber regjeringen\\s*/i, '').replace(/\\s+/g, ' ').trim()).map((s) => (s.length > 220 ? s.slice(0, 220).replace(/\\s\\S*$/, '') + ' …' : s)).map((s) => s.charAt(0).toUpperCase() + s.slice(1));
    quality.repairs.push('forslag_from_source');
  }
  if (facts.forslag_expected && forslag.length && forslag.length !== facts.forslag_expected) quality.flags.push('forslag_count_vs_title_' + forslag.length + '_vs_' + facts.forslag_expected);
  if (/blant annet/i.test(hva) && forslag.length) quality.flags.push('blant_annet_in_hva');
  // Labels og kort
  const labels = [];
  const seen = new Set();
  for (const l of Array.isArray(obj.labels) ? obj.labels : []) {
    const t = str(l);
    if (t.length < 2 || t.length > 48) continue;
    const L = t.charAt(0).toUpperCase() + t.slice(1);
    if (seen.has(L.toLowerCase())) continue;
    seen.add(L.toLowerCase()); labels.push(fixSpelling(L));
    if (labels.length >= 5) break;
  }
  let cards = (Array.isArray(obj.topic_cards) ? obj.topic_cards : []).map((c) => (c && typeof c === 'object') ? { title: fixSpelling(str(c.title)).slice(0, 80), body: fixSpelling(str(c.body)).slice(0, 700) } : null).filter((c) => c && c.title && c.body).slice(0, 3);
  if (forslag.length) {
    const body = forslag.map((f, i) => (i + 1) + ') ' + f.replace(/[.;]\\s*$/, '')).join('; ') + '.';
    cards = [{ title: 'Forslagene (' + forslag.length + ')', body }].concat(cards).slice(0, 4);
  }
  return {
    ok: true,
    reason: '',
    out: { hva, hvem, kostnad, narrative: hva, who_affected: hvem, how_affected: how, utfall, forslag, labels, topic_cards: cards },
    quality,
  };
}

const item = $input.item.json;
let ctx = {};
for (const n of ['Hash gate (webhook)', 'Build sak context (webhook)', 'Build sak context']) { try { const j = $(n).item.json; if (j && j.sakContextText) { ctx = j; break; } } catch (_) {} }
let issueId = '';
for (const n of ['Process one issue', 'Normalize issue ID']) { try { const id = String($(n).item?.json?.id || '').trim(); if (id) { issueId = id; break; } } catch (_) {} }
if (!issueId) issueId = String(ctx.id || item.id || '').trim();
if (!issueId) return { json: { skip: true, outcome: 'skipped', reason: 'missing_issue_id' } };
if (ctx.facts && ctx.facts.has_content === false) return { json: { skip: true, outcome: 'skipped', reason: 'no_source_content', issueId: '' } };
const res = validateSummary(item.output ?? item.text ?? '', ctx.facts || {});
if (!res.ok) {
  return { json: { skip: true, outcome: 'rejected', reason: res.reason, rejectedIssueId: issueId, issueId: '', quality: res.quality, contextChars: ctx.contextChars } };
}
return { json: { issueId, ...res.out, quality: res.quality, contextHash: ctx.contextHash || '', sourceHash: ctx.sourceHash || '', promptVersion: ctx.promptVersion || '', outcomeStage: (ctx.facts || {}).outcome_stage || '', contextChars: ctx.contextChars } };
`;

export const SUMMARY_SYSTEM_MESSAGE = `Du er en nøytral, faktabasert veileder for «Folkets Meninger». Du forklarer stortingssaker for vanlige borgere på norsk bokmål.

KILDE OG FAKTA
- Bruk KUN teksten i brukermeldingen. Ikke gjett. Ikke finn på tall, beløp, årstall, komiteer, partier eller tiltak.
- UTFALL: Hent utfallet KUN fra blokken «UTFALL OG STATUS» (kortvedtak og vedtakstekst). Skriv utfallet tydelig i "hva" (f.eks. «Forslaget ble ikke vedtatt.»). Er det ingen kortvedtak, skriv at saken ikke er ferdigbehandlet – aldri at den er vedtatt. Avviker kortvedtaket fra forslagene, beskriv nøyaktig det som faktisk ble vedtatt, og at de opprinnelige forslagene ikke ble vedtatt slik de var formulert.
- DOKUMENTTYPE: Bruk «Dokumenttype» fra kilden. Et representantforslag (Dokument 8) kommer fra stortingsrepresentanter, ikke fra regjeringen. Kall det aldri en proposisjon.
- KOMITÉ: Bruk komitenavnet i feltet «Komité» ordrett. En komité er Stortingets, ikke et partis.
- Sesjonen (f.eks. 2025-2026) er stortingsåret. Ikke skriv at noe «skal gjelde for» sesjonen.

FULLSTENDIGE LISTER
- Har kilden blokken «FORSLAGENE I DOKUMENTET», skal "forslag" inneholde ALLE punktene – ett kort punkt (maks 25 ord) per forslag, i samme rekkefølge, uten å slå sammen eller hoppe over noen.
- Ikke skriv «blant annet» om en liste som står i kilden. Har kilden ingen slik liste: "forslag": [].

FELTENE
- "hva": 4–7 setninger: hva saken gjelder, hvem som fremmet den, dokumenttype, hovedinnholdet og utfallet.
- "hvem": 2–4 setninger: hvilke grupper som berøres direkte. Nevn komiteen og forslagsstillerne (med parti) når kilden har dem.
- "how_affected": 2–4 setninger om de faktiske konsekvensene for de berørte slik kilden beskriver dem (rettigheter, plikter, tjenester, trygghet, hverdag). Nevn penger bare hvis saken handler om penger. Ble forslaget ikke vedtatt: si at vedtaket ikke endrer noe for dem, og hva forslaget ville ha endret.
- "kostnad": Bare hvis kilden oppgir beløp, budsjett eller økonomiske konsekvenser: 1–3 setninger med kroner og hvem som betaler. Ellers tom streng "". Ikke skriv «ikke oppgitt» eller «ikke omtalt».
- "utfall": én av "vedtatt", "ikke_vedtatt", "delvis_vedtatt", "ikke_ferdigbehandlet" – i samsvar med kortvedtaket.
- "labels": 2–5 korte emneord i Title Case.
- "topic_cards": 1–3 kort {"title","body"} med konkret innhold fra kilden (ikke gjenta forslagslisten).

SPRÅK: Bokmål, hele setninger, saklig, ingen meninger og ingen stemmeråd. Ikke danske former (-mæssig, forstærkning) og ikke æ der bokmål har e. Skriv «saken», «komiteen».

Svar KUN med ett gyldig JSON-objekt, uten tekst før eller etter:
{"hva":"","hvem":"","how_affected":"","kostnad":"","utfall":"","forslag":[""],"labels":[""],"topic_cards":[{"title":"","body":""}]}
Er kilden bare «Sak ID» uten tittel eller innhold: returner tomme strenger og tomme lister.`;

/** Webhook hash-gate: skip Ollama when kontekst + promptversjon er uendret (workflow static data). */
export const HASH_GATE_WEBHOOK_JS = `// Hash-gate: regenerer bare når konteksten (inkl. promptversjon) er endret, eller ved force=true.
// Forrige hash ligger i workflowens statiske data ($getWorkflowStaticData('global').aiSummaryHashes) – ingen DB-endring.
const ctx = $input.first().json;
let force = false;
try { force = String($('Normalize issue ID').first().json.force) === 'true'; } catch (_) {}
const store = $getWorkflowStaticData('global');
const map = store.aiSummaryHashes || {};
const last = map[String(ctx.id || '')] || null;
let regenerate = true;
let gate_reason = 'no_previous_hash';
if (ctx.facts && ctx.facts.has_content === false) { regenerate = false; gate_reason = 'no_source_content'; }
else if (force) { regenerate = true; gate_reason = 'force'; }
else if (last && last.h === ctx.contextHash) { regenerate = false; gate_reason = 'unchanged_context_hash'; }
else if (last) { gate_reason = 'context_changed'; }
return [{ json: { ...ctx, regenerate, gate_reason, last_context_hash: last ? last.h : '', last_generated_at: last ? last.at : '' }, pairedItem: { item: 0 } }];
`;

export const ATTACH_EXTRA_CONTEXT_SCHEDULE_JS = `const listed = $('Process one issue').first()?.json || {};
const extraRaw = $('Load issue source').first()?.json;
const extra = Array.isArray(extraRaw) ? (extraRaw[0] || {}) : (extraRaw || {});
const chunkRaw = $input.first()?.json;
let chunks = [];
if (Array.isArray(chunkRaw)) chunks = chunkRaw;
else if (chunkRaw && Array.isArray(chunkRaw.data)) chunks = chunkRaw.data;
else chunks = $input.all().map((i) => i.json).filter((r) => r && r.content);
return [{ json: { ...listed, ...extra, document_chunks: chunks.filter((c) => c && c.content) } }];
`;

export const ATTACH_EXTRA_CONTEXT_WEBHOOK_JS = `const sak = $('Fetch issue by ID').first()?.json || {};
const raw = $input.first()?.json;
let chunks = [];
if (Array.isArray(raw)) chunks = raw;
else if (raw && Array.isArray(raw.data)) chunks = raw.data;
else chunks = $input.all().map((i) => i.json).filter((r) => r && r.content);
return [{ json: { ...sak, document_chunks: chunks.filter((c) => c && c.content) } }];
`;

export const PREPARE_UPSERT_SQL_JS = `// genmeta v1 – prompt_version sak-summary-v3-quickfix (2026-10-20). prompt_sha256 dekker systemprompt + «Build sak context» + validator.
// Lagres i kjøringsdata (customData) til PR #171 stage B er migrert.
const GEN_META = {
  schema: 'fm.genmeta/v1', prompt_id: 'sak_summary', node_key: 'system', prompt_version: 'sak-summary-v3-quickfix',
  prompt_sha256: '601b452c294a', prompt_source: 'inline', prompt_version_id: null,
  model: 'gemma4:26b', model_params: {"num_ctx": 16384, "num_predict": 2200, "temperature": 0.2, "think": false, "format": "json"},
  workflow_id: (typeof $workflow !== 'undefined' && $workflow.id) ? String($workflow.id) : 'GP666Zq84qc19tcE', workflow_version_id: null,
  n8n_execution_id: (typeof $execution !== 'undefined' && $execution.id) ? String($execution.id) : null,
  generated_at: new Date().toISOString(),
};
const item = $input.item.json;
try { if (typeof $execution !== 'undefined' && $execution.customData) { $execution.customData.set('prompt_version', GEN_META.prompt_version); $execution.customData.set('prompt_sha256', GEN_META.prompt_sha256); $execution.customData.set('model', GEN_META.model); $execution.customData.set('issue_id', String(item.issueId || item.rejectedIssueId || '')); $execution.customData.set('outcome', item.skip ? String(item.reason || 'skipped') : 'saved'); } } catch (_) {}
if (item.skip || !item.issueId) {
  return { json: { ...item, skip: true, issueId: '', gen_meta: GEN_META } };
}
const { issueId, hva, hvem, kostnad, narrative, who_affected, how_affected, topic_cards, labels, quality, contextHash, sourceHash, promptVersion, outcomeStage, forslag } = item;
return { json: { issueId, hva, hvem, kostnad, narrative, who_affected, how_affected, topic_cards, labels, forslag, quality, contextHash, sourceHash, promptVersion, outcomeStage, gen_meta: GEN_META } };
`;

/** Lagrer kontekst-hash etter vellykket lagring (hash-gate). Workflow static data, maks 6000 saker. */
export const STORE_GENERATION_HASH_SCHEDULE_JS = `// Lagrer kontekst-hash etter vellykket lagring (hash-gate). Workflow static data, maks 6000 saker.
const store = $getWorkflowStaticData('global');
if (!store.aiSummaryHashes || typeof store.aiSummaryHashes !== 'object') store.aiSummaryHashes = {};
const map = store.aiSummaryHashes;
const out = [];
for (let i = 0; i < $input.all().length; i++) {
  let p = {};
  try { p = $('Prepare upsert SQL').itemMatching(i).json || {}; } catch (_) { try { p = $('Prepare upsert SQL').all()[i].json || {}; } catch (_) {} }
  const id = String(p.issueId || '');
  if (id && p.contextHash) {
    map[id] = { h: p.contextHash, at: new Date().toISOString(), pv: (p.gen_meta && p.gen_meta.prompt_version) || '', m: (p.gen_meta && p.gen_meta.model) || '', o: p.outcomeStage || '' };
  }
  out.push({ json: { issueId: id, hashStored: Boolean(id && p.contextHash), contextHash: p.contextHash || '', quality: p.quality || {} }, pairedItem: { item: i } });
}
const keys = Object.keys(map);
if (keys.length > 6000) { keys.sort((a, b) => String(map[a].at).localeCompare(String(map[b].at))); for (const k of keys.slice(0, keys.length - 6000)) delete map[k]; }
return out;
`;

export const STORE_GENERATION_HASH_WEBHOOK_JS = `// Lagrer kontekst-hash etter vellykket lagring (hash-gate). Workflow static data, maks 6000 saker.
const store = $getWorkflowStaticData('global');
if (!store.aiSummaryHashes || typeof store.aiSummaryHashes !== 'object') store.aiSummaryHashes = {};
const map = store.aiSummaryHashes;
const out = [];
for (let i = 0; i < $input.all().length; i++) {
  let p = {};
  try { p = $('Prepare upsert SQL (webhook)').itemMatching(i).json || {}; } catch (_) { try { p = $('Prepare upsert SQL (webhook)').all()[i].json || {}; } catch (_) {} }
  const id = String(p.issueId || '');
  if (id && p.contextHash) {
    map[id] = { h: p.contextHash, at: new Date().toISOString(), pv: (p.gen_meta && p.gen_meta.prompt_version) || '', m: (p.gen_meta && p.gen_meta.model) || '', o: p.outcomeStage || '' };
  }
  out.push({ json: { issueId: id, hashStored: Boolean(id && p.contextHash), contextHash: p.contextHash || '', quality: p.quality || {} }, pairedItem: { item: i } });
}
const keys = Object.keys(map);
if (keys.length > 6000) { keys.sort((a, b) => String(map[a].at).localeCompare(String(map[b].at))); for (const k of keys.slice(0, keys.length - 6000)) delete map[k]; }
return out;
`;
