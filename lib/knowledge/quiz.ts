import type { AiSummary } from '@/lib/ai-summary/types';
import { isAiSummaryV2 } from '@/lib/ai-summary/types';
import type {
  KnowledgeQuiz,
  KnowledgeQuizQuestion,
  KnowledgeQuizQuestionKind,
  KnowledgeQuizSource,
  PublicKnowledgeQuizQuestion,
  QuizContextLevel,
} from './types';

const COMMITTEE_DISTRACTORS = [
  'Finanskomiteen',
  'Justiskomiteen',
  'Helse- og omsorgskomiteen',
  'Utenriks- og forsvarskomiteen',
  'Energi- og miljøkomiteen',
  'Utdannings- og forskningskomiteen',
  'Kommunal- og forvaltningskomiteen',
] as const;

const UNRELATED_TITLES = [
  'Endringer i vegtrafikkloven (førerkort for moped)',
  'Representantforslag om nasjonal hytteavgift',
  'Proposisjon om EØS-avgift for fritidsbåter',
] as const;

const UNRELATED_CLAIMS = [
  'Saken gjelder kun avgift på fritidsbåter i kystkommuner.',
  'Forslaget innfører stemmerett for 16-åringer ved stortingsvalg.',
  'Saken handler om å flytte hovedstaden til Bergen.',
  'Regjeringen foreslår å avvikle alle offentlige sykehus i Nord-Norge.',
  'Forslaget gir alle innbyggere gratis elbil uten vilkår.',
] as const;

const WHO_DISTRACTORS = [
  'Kun offentlige etater og departementer, ikke privatpersoner.',
  'Bare utenlandske selskaper med hovedkontor i EU.',
  'Ingen grupper er nevnt som berørt i saksgrunnlaget.',
] as const;

const CONSEQUENCE_DISTRACTORS = [
  'Forslaget har ingen økonomiske eller praktiske konsekvenser.',
  'Alle kostnader dekkes av oljefondet uten endringer for husholdninger.',
  'Konsekvensene er ikke omtalt i saksgrunnlaget.',
] as const;

export const QUIZ_KIND_LABELS: Record<KnowledgeQuizQuestionKind, string> = {
  hva: 'Hva',
  hvem: 'Hvem',
  konsekvens: 'Konsekvens',
  komite: 'Komité',
  tema: 'Tema',
  kategori: 'Område',
};

type SummaryFields = {
  hva: string | null;
  hvem: string | null;
  konsekvens: string | null;
};

function hashSeed(input: string): number {
  let hash = 2166136261;
  for (let i = 0; i < input.length; i += 1) {
    hash ^= input.charCodeAt(i);
    hash = Math.imul(hash, 16777619);
  }
  return hash >>> 0;
}

function nextSeed(seed: number): number {
  return (Math.imul(seed, 1664525) + 1013904223) >>> 0;
}

function seededShuffle<T>(items: readonly T[], seed: number): T[] {
  const arr = [...items];
  let current = seed || 1;
  for (let i = arr.length - 1; i > 0; i -= 1) {
    current = nextSeed(current);
    const j = current % (i + 1);
    const tmp = arr[i];
    arr[i] = arr[j];
    arr[j] = tmp;
  }
  return arr;
}

function firstSentence(text: string, maxLen = 200): string | null {
  const cleaned = text.replace(/\s+/g, ' ').trim();
  if (cleaned.length < 24) return null;
  const match = cleaned.match(/^.{24,200}?[.!?]/);
  const sentence = (match?.[0] ?? cleaned.slice(0, maxLen)).trim();
  return sentence.length >= 24 ? sentence : null;
}

function normalizeField(text: string | null | undefined): string | null {
  if (!text?.trim()) return null;
  return firstSentence(text.trim());
}

function extractSummaryFields(
  aiSummary: AiSummary | null | undefined,
  summary?: string | null,
): SummaryFields {
  if (aiSummary && isAiSummaryV2(aiSummary)) {
    return {
      hva: normalizeField(aiSummary.narrative) ?? normalizeField(aiSummary.hva),
      hvem: normalizeField(aiSummary.who_affected) ?? normalizeField(aiSummary.hvem),
      konsekvens:
        normalizeField(aiSummary.how_affected) ?? normalizeField(aiSummary.kostnad),
    };
  }

  if (aiSummary?.version === 1) {
    return {
      hva: normalizeField(aiSummary.hva),
      hvem: normalizeField(aiSummary.hvem),
      konsekvens: normalizeField(aiSummary.kostnad),
    };
  }

  const fallback = normalizeField(summary ?? '');
  return {
    hva: fallback,
    hvem: null,
    konsekvens: null,
  };
}

export function getQuizContextLevel(source: KnowledgeQuizSource): QuizContextLevel {
  const fields = extractSummaryFields(source.aiSummary, source.summary);
  const substantive = [fields.hva, fields.hvem, fields.konsekvens].filter(Boolean);

  if (source.aiSummary && substantive.length >= 2) {
    return 'rich';
  }
  if (substantive.length >= 1) {
    return 'basic';
  }
  return 'minimal';
}

function textsAreSimilar(a: string, b: string): boolean {
  const left = a.toLowerCase().slice(0, 40);
  const right = b.toLowerCase().slice(0, 40);
  return left === right || left.includes(right.slice(0, 20)) || right.includes(left.slice(0, 20));
}

function pickDistractors(
  correct: string,
  pool: readonly string[],
  seed: number,
  count = 2,
): string[] {
  const filtered = pool.filter(
    (item) => !textsAreSimilar(item, correct) && item.trim().length >= 12,
  );
  return seededShuffle(filtered, seed).slice(0, count);
}

function negateClaim(claim: string): string {
  const lower = claim.charAt(0).toLowerCase() + claim.slice(1);
  return `Det motsatte er tilfelle: saken handler ikke om ${lower.replace(/\.$/, '')}.`;
}

function withShuffledOptions(
  id: string,
  kind: KnowledgeQuizQuestionKind,
  prompt: string,
  correctText: string,
  distractors: string[],
  seed: number,
): KnowledgeQuizQuestion {
  const options = seededShuffle(
    [
      { id: `${id}-a`, text: correctText, correct: true },
      ...distractors.map((text, index) => ({
        id: `${id}-${String.fromCharCode(98 + index)}`,
        text,
        correct: false,
      })),
    ],
    seed,
  );

  const correct = options.find((option) => option.correct);
  if (!correct) {
    throw new Error('Quiz option shuffle lost the correct answer');
  }

  return {
    id,
    kind,
    prompt,
    options: options.map(({ id: optionId, text }) => ({ id: optionId, text })),
    correctOptionId: correct.id,
  };
}

function buildSubstanceQuestion(
  kind: 'hva' | 'hvem' | 'konsekvens',
  text: string,
  fields: SummaryFields,
  seed: number,
): KnowledgeQuizQuestion {
  const prompts: Record<'hva' | 'hvem' | 'konsekvens', string> = {
    hva: 'Hva handler denne saken primært om?',
    hvem: 'Hvem berøres mest av forslaget?',
    konsekvens: 'Hva sies om konsekvenser eller kostnader?',
  };

  const siblingPool = [fields.hva, fields.hvem, fields.konsekvens].filter(
    (item): item is string => typeof item === 'string' && !textsAreSimilar(item, text),
  );

  const genericPool =
    kind === 'hvem'
      ? WHO_DISTRACTORS
      : kind === 'konsekvens'
        ? CONSEQUENCE_DISTRACTORS
        : UNRELATED_CLAIMS;

  const distractors = [
    ...pickDistractors(text, siblingPool, seed),
    ...pickDistractors(text, genericPool, nextSeed(seed + 3)),
    negateClaim(text),
  ].slice(0, 2);

  return withShuffledOptions(kind, kind, prompts[kind], text, distractors, nextSeed(seed + 7));
}

export function buildKnowledgeQuiz(source: KnowledgeQuizSource): KnowledgeQuiz {
  const seed = hashSeed(source.issueId);
  const questions: KnowledgeQuizQuestion[] = [];
  const title = source.title.trim() || `Sak ${source.issueId}`;
  const fields = extractSummaryFields(source.aiSummary, source.summary);

  if (fields.hva) {
    questions.push(buildSubstanceQuestion('hva', fields.hva, fields, seed));
  }
  if (fields.hvem) {
    questions.push(buildSubstanceQuestion('hvem', fields.hvem, fields, nextSeed(seed + 11)));
  }
  if (fields.konsekvens) {
    questions.push(
      buildSubstanceQuestion('konsekvens', fields.konsekvens, fields, nextSeed(seed + 17)),
    );
  }

  if (source.komite?.trim() && questions.length < 4) {
    const komite = source.komite.trim();
    const others = COMMITTEE_DISTRACTORS.filter(
      (name) => name.toLowerCase() !== komite.toLowerCase(),
    );
    questions.push(
      withShuffledOptions(
        'komite',
        'komite',
        'Hvilken komité behandler saken?',
        komite,
        seededShuffle(others, nextSeed(seed + 23)).slice(0, 2),
        nextSeed(seed + 29),
      ),
    );
  }

  if (questions.length < 2) {
    const titleDistractors = UNRELATED_TITLES.filter(
      (item) => item.toLowerCase() !== title.toLowerCase(),
    );
    questions.push(
      withShuffledOptions(
        'tema',
        'tema',
        'Hvilken tittel hører til denne saken?',
        title,
        seededShuffle(titleDistractors, nextSeed(seed + 31)).slice(0, 2),
        nextSeed(seed + 37),
      ),
    );
  }

  if (questions.length < 2 && source.category?.trim()) {
    questions.push(
      withShuffledOptions(
        'kategori',
        'kategori',
        'Hvilket saksområde hører saken til?',
        source.category.trim(),
        ['Idrett og fritid', 'Kongelige seremonier'].filter(
          (item) => item.toLowerCase() !== source.category!.trim().toLowerCase(),
        ),
        nextSeed(seed + 41),
      ),
    );
  }

  const passScore = questions.length <= 2 ? questions.length : 2;
  return {
    issueId: source.issueId,
    questions,
    passScore,
  };
}

export function toPublicQuizQuestions(quiz: KnowledgeQuiz): PublicKnowledgeQuizQuestion[] {
  return quiz.questions.map((question) => ({
    id: question.id,
    kind: question.kind,
    prompt: question.prompt,
    options: question.options,
  }));
}

export function gradeKnowledgeQuiz(
  quiz: KnowledgeQuiz,
  answers: Record<string, string>,
): { score: number; total: number; passed: boolean; correctByQuestion: Record<string, boolean> } {
  const correctByQuestion: Record<string, boolean> = {};
  let score = 0;
  for (const question of quiz.questions) {
    const ok = answers[question.id] === question.correctOptionId;
    correctByQuestion[question.id] = ok;
    if (ok) score += 1;
  }
  return {
    score,
    total: quiz.questions.length,
    passed: score >= quiz.passScore,
    correctByQuestion,
  };
}
