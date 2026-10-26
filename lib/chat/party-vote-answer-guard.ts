/**
 * Post-validation: party vote claims in grounded answers must match excerpt votering summaries.
 */

export type PartyStance = 'for' | 'mot';

const PARTY_LINE_RE = /^-\s*.+?\(([A-Za-z]+)\):\s*(for|mot)\s*$/gim;

const PARTY_NAMES: Record<string, string> = {
  A: 'arbeiderpartiet',
  H: 'høyre',
  FrP: 'fremskrittspartiet',
  SV: 'sosialistisk venstreparti',
  Sp: 'senterpartiet',
  R: 'rødt',
  MDG: 'miljøpartiet',
  KrF: 'kristelig folkeparti',
  V: 'venstre',
};

/** Ground truth from RAG votering excerpt blocks (`formatVoteringRagSummary`). */
export function parsePartyStancesByVoteringFromExcerpts(
  excerpts: string[],
): Map<string, Map<string, PartyStance>> {
  const combined = excerpts.join('\n');
  const blocks = combined.split(/(?=Votering\s+\d+\.)/i);
  const out = new Map<string, Map<string, PartyStance>>();

  for (const block of blocks) {
    const header = /^Votering\s+(\d+)\./im.exec(block);
    if (!header) continue;
    const voteringId = header[1];
    const parties = new Map<string, PartyStance>();
    const lineRe = new RegExp(PARTY_LINE_RE.source, PARTY_LINE_RE.flags);
    let m: RegExpExecArray | null;
    while ((m = lineRe.exec(block)) !== null) {
      const code = m[1];
      const stance = m[2].toLowerCase() as PartyStance;
      if (stance === 'for' || stance === 'mot') {
        parties.set(code, stance);
      }
    }
    if (parties.size > 0) {
      out.set(voteringId, parties);
    }
  }
  return out;
}

function normalizePartyCode(raw: string): string {
  if (raw === 'AP') return 'A';
  return raw;
}

/** Party codes in answer text: exact case, word boundaries (no /i on A/H/R/V). */
export function sentenceMentionsParty(sentence: string, partyCode: string): boolean {
  const lower = sentence.toLowerCase();
  const code = normalizePartyCode(partyCode);
  const escaped = code.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const codeRe = new RegExp(`\\b${escaped}\\b`);
  if (codeRe.test(sentence)) return true;
  const name = PARTY_NAMES[code];
  if (name && lower.includes(name)) return true;
  return false;
}

const STEM_FOR_RE =
  /\b(stemte|stemmer|voterte|voterer)\b[\s\S]*?\bfor\b|\):\s*for\b|\bfor\s+i\s+votering\b/;
const STEM_MOT_RE =
  /\b(stemte|stemmer|voterte|voterer)\b[\s\S]*?\bmot\b|\):\s*mot\b|\bmot\s+i\s+votering\b/;

function clauseStance(clause: string): PartyStance | null {
  const lower = clause.toLowerCase();
  const hasFor = STEM_FOR_RE.test(lower);
  const hasMot = STEM_MOT_RE.test(lower);
  if (hasFor && !hasMot) return 'for';
  if (hasMot && !hasFor) return 'mot';
  return null;
}

/** Stance of a sentence or clause; null when both for and mot appear (ambiguous). */
export function sentenceStance(sentence: string): PartyStance | null {
  return clauseStance(sentence);
}

function voteringIdsInText(text: string): string[] {
  const ids = new Set<string>();
  const re = /\bvotering(?:en)?\s+(\d{4,6})\b/gi;
  let m: RegExpExecArray | null;
  while ((m = re.exec(text)) !== null) {
    ids.add(m[1]);
  }
  return [...ids];
}

const VOTERING_HEADER_RE = /^Votering\s+(\d+)\./im;

/** Votering ids from [n] citations that point at votering excerpt blocks. */
export function voteringIdsFromBracketCitations(answer: string, excerpts: string[]): string[] {
  const ids = new Set<string>();
  const citeRe = /\[(\d{1,2})\]/g;
  let m: RegExpExecArray | null;
  while ((m = citeRe.exec(answer)) !== null) {
    const idx = Number.parseInt(m[1], 10) - 1;
    if (idx < 0 || idx >= excerpts.length) continue;
    const header = VOTERING_HEADER_RE.exec(excerpts[idx]);
    if (header) ids.add(header[1]);
  }
  return [...ids];
}

/**
 * Votering ids the guard may use. Null = leave answer unchanged.
 * Runs when the answer names votering id(s), or cites exactly one votering excerpt via [n].
 */
export function resolvePartyVoteGuardScope(
  answer: string,
  excerpts: string[],
): string[] | null {
  const textIds = voteringIdsInText(answer);
  if (textIds.length > 0) return textIds;
  const citedIds = voteringIdsFromBracketCitations(answer, excerpts);
  if (citedIds.length === 1) return citedIds;
  return null;
}

function splitSentencesInLine(line: string): string[] {
  return line
    .split(/(?<=[.!?])[ \t]+/)
    .map((s) => s.trim())
    .filter(Boolean);
}

/** Clause boundaries only — never split party lists on commas. */
function splitClauses(sentence: string): string[] {
  const parts = sentence.split(/\s+(?:men|mens)\s+/i);
  if (parts.length <= 1) return [sentence];
  return parts.map((p, i) => (i === 0 ? p.trim() : p.trim())).filter(Boolean);
}

function joinClauses(clauses: string[]): string {
  if (clauses.length <= 1) return clauses[0] ?? '';
  const head = clauses[0].replace(/,\s*$/, '').trimEnd();
  const tail = clauses
    .slice(1)
    .map((c) => c.replace(/^mens\s+/i, '').trim())
    .join(', mens ');
  return `${head}, mens ${tail}`;
}

function partyLabelsForCode(partyCode: string): string[] {
  const code = normalizePartyCode(partyCode);
  const labels = [code];
  const name = PARTY_NAMES[code];
  if (name) {
    labels.push(
      name,
      name.replace(/\b\w/g, (c) => c.toUpperCase()),
      name.split(' ').map((w) => w.charAt(0).toUpperCase() + w.slice(1)).join(' '),
    );
  }
  if (code === 'FrP') labels.push('Frp', 'FRP');
  if (code === 'KrF') labels.push('Krf', 'KRF');
  return [...new Set(labels)];
}

/** Remove one party from a comma/og-list inside a clause; returns null if edit is unsafe. */
function removePartyFromClause(clause: string, partyCode: string): string | null {
  const labels = partyLabelsForCode(partyCode).sort((a, b) => b.length - a.length);
  for (const label of labels) {
    const escaped = label.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const patterns = [
      new RegExp(`,\\s*og\\s+${escaped}(?=\\s|,|\\.|\\[|$)`, 'i'),
      new RegExp(`\\bog\\s+${escaped}(?=\\s|,|\\.|\\[|$)`, 'i'),
      new RegExp(`${escaped}\\s*,\\s*og\\s+`, 'i'),
      new RegExp(`${escaped}\\s*,\\s*`, 'i'),
      new RegExp(`\\b${escaped}\\b`, 'i'),
    ];
    for (const re of patterns) {
      if (!re.test(clause)) continue;
      const next = clause.replace(re, (match) => {
        if (/^\s*,\s*og\s+/i.test(match)) return '';
        if (/,\s*og\s+/i.test(match)) return '';
        if (/og\s+/i.test(match)) return '';
        if (/,\s*$/.test(match)) return '';
        return '';
      });
      const cleaned = next.replace(/\s{2,}/g, ' ').replace(/,\s*,/g, ',').replace(/\s+([,.])/g, '$1').trim();
      if (cleaned && sentenceMentionsParty(cleaned, partyCode)) {
        continue;
      }
      if (cleaned) return cleaned;
    }
  }
  return null;
}

function reconcileSentenceForVotering(
  sentence: string,
  voteringId: string,
  sourceParties: Map<string, PartyStance>,
): string {
  const sentenceVoteringIds = voteringIdsInText(sentence);
  if (sentenceVoteringIds.length > 0 && !sentenceVoteringIds.includes(voteringId)) {
    return sentence;
  }

  const clauses = splitClauses(sentence);
  if (clauses.length === 1 && clauseStance(sentence) === null) {
    const hasFor = STEM_FOR_RE.test(sentence.toLowerCase());
    const hasMot = STEM_MOT_RE.test(sentence.toLowerCase());
    if (hasFor && hasMot) return sentence;
  }

  let changed = false;
  const editedClauses = [...clauses];

  for (const [partyCode, canonical] of sourceParties) {
    const forClauseIdx: number[] = [];
    const motClauseIdx: number[] = [];

    editedClauses.forEach((clause, idx) => {
      if (!sentenceMentionsParty(clause, partyCode)) return;
      const stance = clauseStance(clause);
      if (stance === 'for') forClauseIdx.push(idx);
      if (stance === 'mot') motClauseIdx.push(idx);
    });

    if (forClauseIdx.length === 0 && motClauseIdx.length === 0) continue;
    if (forClauseIdx.length === 0 || motClauseIdx.length === 0) continue;

    const wrongIdx = canonical === 'for' ? motClauseIdx : forClauseIdx;
    for (const idx of wrongIdx) {
      const removed = removePartyFromClause(editedClauses[idx], partyCode);
      if (!removed || !clauseKeepsPartyVoteClaim(removed)) {
        editedClauses[idx] = '';
        changed = true;
        continue;
      }
      editedClauses[idx] = removed;
      changed = true;
    }
  }

  if (!changed) return sentence;
  const nonEmpty = editedClauses.map((c) => c.trim()).filter(Boolean);
  if (nonEmpty.length === 0) return sentence;
  const joined = joinClauses(nonEmpty);
  return joined || sentence;
}

function clauseMentionsAnyParty(clause: string): boolean {
  for (const code of Object.keys(PARTY_NAMES)) {
    if (sentenceMentionsParty(clause, code)) return true;
  }
  return false;
}

function clauseKeepsPartyVoteClaim(clause: string): boolean {
  const trimmed = clause.trim();
  if (!trimmed) return false;
  if (!clauseStance(trimmed)) return false;
  return clauseMentionsAnyParty(trimmed);
}

function reconcilePartyVoteLine(
  line: string,
  sourceByVotering: Map<string, Map<string, PartyStance>>,
  scopeVoteringIds: string[],
): string {
  const trimmedLine = line.trim();
  if (!trimmedLine) return line;

  const sentences = splitSentencesInLine(trimmedLine);
  if (sentences.length === 0) return line;

  const dropSentence = new Set<number>();

  for (const voteringId of scopeVoteringIds) {
    const sourceParties = sourceByVotering.get(voteringId);
    if (!sourceParties) continue;

    for (const [partyCode, canonical] of sourceParties) {
      const forIdx: number[] = [];
      const motIdx: number[] = [];

      sentences.forEach((sentence, idx) => {
        if (dropSentence.has(idx)) return;
        const sentenceVoteringIds = voteringIdsInText(sentence);
        if (sentenceVoteringIds.length > 0 && !sentenceVoteringIds.includes(voteringId)) {
          return;
        }
        if (!sentenceMentionsParty(sentence, partyCode)) return;
        const stance = sentenceStance(sentence);
        if (stance === 'for') forIdx.push(idx);
        if (stance === 'mot') motIdx.push(idx);
      });

      if (forIdx.length === 0 || motIdx.length === 0) continue;

      const wrongStance: PartyStance = canonical === 'for' ? 'mot' : 'for';
      const toDrop = wrongStance === 'mot' ? motIdx : forIdx;
      for (const idx of toDrop) {
        dropSentence.add(idx);
      }
    }

    const isBulletLine = /^-\s/.test(trimmedLine);
    sentences.forEach((sentence, idx) => {
      if (dropSentence.has(idx)) return;
      const sentenceVoteringIds = voteringIdsInText(sentence);
      if (
        sentenceVoteringIds.length > 0 &&
        !sentenceVoteringIds.includes(voteringId)
      ) {
        return;
      }
      for (const [partyCode, canonical] of sourceParties) {
        if (!sentenceMentionsParty(sentence, partyCode)) continue;
        const stance = sentenceStance(sentence);
        if (!stance || stance === canonical) continue;
        if (sentenceVoteringIds.includes(voteringId) || isBulletLine) {
          dropSentence.add(idx);
        }
      }
    });
  }

  const kept = sentences
    .map((sentence, idx) => {
      if (dropSentence.has(idx)) return null;
      let s = sentence;
      for (const voteringId of scopeVoteringIds) {
        const sourceParties = sourceByVotering.get(voteringId);
        if (!sourceParties) continue;
        s = reconcileSentenceForVotering(s, voteringId, sourceParties);
      }
      return s;
    })
    .filter((s): s is string => Boolean(s));

  if (kept.length === 0) return '';

  const rebuilt = kept.join(' ').replace(/[ \t]+([,.])/g, '$1');
  if (line.startsWith(' ') || line.startsWith('\t')) {
    const indent = line.match(/^(\s*)/)?.[1] ?? '';
    return indent + rebuilt;
  }
  return rebuilt;
}

/**
 * Removes or corrects sentences that claim the same party voted both for and against
 * in the same votering when excerpts only support one stance.
 */
export function reconcilePartyVoteClaimsWithSources(answer: string, excerpts: string[]): string {
  const trimmed = answer.trim();
  if (!trimmed) return trimmed;

  const sourceByVotering = parsePartyStancesByVoteringFromExcerpts(excerpts);
  if (sourceByVotering.size === 0) return trimmed;

  const scopeVoteringIds = resolvePartyVoteGuardScope(trimmed, excerpts);
  if (!scopeVoteringIds || scopeVoteringIds.length === 0) return trimmed;

  const lines = answer.split('\n');
  const processed = lines
    .map((line) => reconcilePartyVoteLine(line, sourceByVotering, scopeVoteringIds))
    .filter((line) => line.trim().length > 0);
  return processed.join('\n').trimEnd();
}
