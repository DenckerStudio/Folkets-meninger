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

function sentenceMentionsParty(sentence: string, partyCode: string): boolean {
  const lower = sentence.toLowerCase();
  const code = normalizePartyCode(partyCode);
  const codeRe = new RegExp(`\\b${code.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\b`, 'i');
  if (codeRe.test(sentence)) return true;
  const name = PARTY_NAMES[code];
  if (name && lower.includes(name)) return true;
  return false;
}

function sentenceStance(sentence: string): PartyStance | null {
  const lower = sentence.toLowerCase();
  const hasFor =
    /\b(stemte|stemmer|voterte|voterer)(?:\s+\S+){0,4}\s+for\b/.test(lower) ||
    /\):\s*for\b/.test(lower) ||
    /\bfor\s+i\s+votering\b/.test(lower);
  const hasMot =
    /\b(stemte|stemmer|voterte|voterer)(?:\s+\S+){0,4}\s+mot\b/.test(lower) ||
    /\):\s*mot\b/.test(lower) ||
    /\bmot\s+i\s+votering\b/.test(lower);
  if (hasFor && !hasMot) return 'for';
  if (hasMot && !hasFor) return 'mot';
  if (hasFor && hasMot) return null;
  return null;
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

function splitSentences(text: string): string[] {
  return text
    .split(/(?<=[.!?])\s+/)
    .map((s) => s.trim())
    .filter(Boolean);
}

function dedupePartyStanceInSentence(
  sentence: string,
  partyCode: string,
  canonical: PartyStance,
): string {
  const parts = sentence.split(/\s*,\s*|\s+men\s+/i);
  if (parts.length <= 1) return sentence;

  const kept: string[] = [];
  for (const part of parts) {
    const clause = part.trim();
    if (!clause) continue;
    if (!sentenceMentionsParty(clause, partyCode)) {
      kept.push(clause);
      continue;
    }
    const stance = sentenceStance(clause);
    if (!stance) {
      kept.push(clause);
      continue;
    }
    if (stance === canonical) kept.push(clause);
  }
  if (kept.length === 0) return sentence;
  return kept.join(', ');
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

  const sentences = splitSentences(trimmed);
  if (sentences.length === 0) return trimmed;

  const answerVoteringIds = voteringIdsInText(trimmed);
  const voteringIds = new Set([...answerVoteringIds, ...sourceByVotering.keys()]);

  const dropSentence = new Set<number>();

  for (const voteringId of voteringIds) {
    const sourceParties = sourceByVotering.get(voteringId);
    if (!sourceParties) continue;

    for (const [partyCode, canonical] of sourceParties) {
      const forIdx: number[] = [];
      const motIdx: number[] = [];

      sentences.forEach((sentence, idx) => {
        if (dropSentence.has(idx)) return;
        const mentionsVotering =
          voteringIdsInText(sentence).includes(voteringId) ||
          answerVoteringIds.includes(voteringId) ||
          (answerVoteringIds.length === 0 && sourceByVotering.size === 1);
        if (!mentionsVotering) return;
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
  }

  let kept = sentences
    .map((sentence, idx) => {
      if (dropSentence.has(idx)) return null;
      let s = sentence;
      for (const [voteringId, sourceParties] of sourceByVotering) {
        if (answerVoteringIds.length > 0 && !answerVoteringIds.includes(voteringId)) {
          continue;
        }
        for (const [partyCode, canonical] of sourceParties) {
          if (!sentenceMentionsParty(s, partyCode)) continue;
          if (sentenceStance(s) === null) {
            s = dedupePartyStanceInSentence(s, partyCode, canonical);
          }
        }
      }
      return s;
    })
    .filter((s): s is string => Boolean(s));

  if (kept.length === 0) return trimmed;

  return kept.join(' ').replace(/\s+([,.])/g, '$1').trim();
}
