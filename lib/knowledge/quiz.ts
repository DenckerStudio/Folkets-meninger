import type { AiSummary } from '@/lib/ai-summary/types';
import type { KnowledgeQuiz, KnowledgeQuizQuestion, KnowledgeQuizSource, PublicKnowledgeQuizQuestion } from './types';

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
] as const;

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

function firstSentence(text: string, maxLen = 180): string | null {
  const cleaned = text.replace(/\s+/g, ' ').trim();
  if (cleaned.length < 24) return null;
  const match = cleaned.match(/^.{24,180}?[.!?]/);
  const sentence = (match?.[0] ?? cleaned.slice(0, maxLen)).trim();
  return sentence.length >= 24 ? sentence : null;
}

function aiSummaryText(summary: AiSummary | null | undefined): string {
  if (!summary) return '';
  if (summary.version === 2) {
    return [summary.narrative, summary.who_affected, summary.how_affected].filter(Boolean).join(' ');
  }
  return [summary.hva, summary.hvem, summary.kostnad].filter(Boolean).join(' ');
}

function negateClaim(claim: string): string {
  const lower = claim.charAt(0).toLowerCase() + claim.slice(1);
  return `Saken slår fast at det motsatte er tilfelle: det er ikke slik at ${lower}`;
}

function withShuffledOptions(
  id: string,
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
    prompt,
    options: options.map(({ id: optionId, text }) => ({ id: optionId, text })),
    correctOptionId: correct.id,
  };
}

export function buildKnowledgeQuiz(source: KnowledgeQuizSource): KnowledgeQuiz {
  const seed = hashSeed(source.issueId);
  const questions: KnowledgeQuizQuestion[] = [];
  const title = source.title.trim() || `Sak ${source.issueId}`;

  if (source.komite?.trim()) {
    const komite = source.komite.trim();
    const others = COMMITTEE_DISTRACTORS.filter(
      (name) => name.toLowerCase() !== komite.toLowerCase(),
    );
    questions.push(
      withShuffledOptions(
        'komite',
        'Hvilken komité behandler saken?',
        komite,
        seededShuffle(others, seed).slice(0, 2),
        nextSeed(seed),
      ),
    );
  }

  const titleDistractors = UNRELATED_TITLES.filter(
    (item) => item.toLowerCase() !== title.toLowerCase(),
  );
  questions.push(
    withShuffledOptions(
      'tema',
      'Hvilken tittel hører til denne saken?',
      title,
      seededShuffle(titleDistractors, nextSeed(seed + 7)).slice(0, 2),
      nextSeed(seed + 11),
    ),
  );

  const sourceText = aiSummaryText(source.aiSummary) || source.summary?.trim() || '';
  const claim = firstSentence(sourceText);
  if (claim) {
    const unrelated = UNRELATED_CLAIMS.filter(
      (item) => !claim.toLowerCase().includes(item.slice(0, 18).toLowerCase()),
    );
    questions.push(
      withShuffledOptions(
        'grunnlag',
        'Hvilket utsagn stemmer med saksgrunnlaget?',
        claim,
        [negateClaim(claim), seededShuffle(unrelated, seed + 19)[0] ?? UNRELATED_CLAIMS[0]],
        nextSeed(seed + 23),
      ),
    );
  } else if (source.category?.trim()) {
    questions.push(
      withShuffledOptions(
        'kategori',
        'Hvilket saksområde hører saken til?',
        source.category.trim(),
        ['Idrett og fritid', 'Kongelige seremonier'].filter(
          (item) => item.toLowerCase() !== source.category!.trim().toLowerCase(),
        ),
        nextSeed(seed + 29),
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
