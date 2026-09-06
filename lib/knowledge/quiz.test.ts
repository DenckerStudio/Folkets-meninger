import assert from 'node:assert/strict';
import {
  buildKnowledgeQuiz,
  getQuizContextLevel,
  gradeKnowledgeQuiz,
  toPublicQuizQuestions,
} from './quiz';

const source = {
  issueId: '200211',
  title: 'Endringer i klimakvoteloven (økte avgifter)',
  summary: 'Forslaget øker klimaavgiftene for veitrafikk og industri fra neste budsjettår.',
  category: 'Klima og miljø',
  komite: 'Energi- og miljøkomiteen',
  aiSummary: {
    version: 1 as const,
    hva: 'Regjeringen foreslår å øke klimaavgiftene for veitrafikk og industri.',
    hvem: 'Bilister og industribedrifter blir berørt.',
    kostnad: 'Ingen konkret kronesum er oppgitt i kilden.',
  },
};

const quiz = buildKnowledgeQuiz(source);
assert.ok(quiz.questions.length >= 3);
assert.equal(quiz.passScore, 2);

const kinds = quiz.questions.map((q) => q.kind);
assert.ok(kinds.includes('hva'));
assert.ok(kinds.includes('hvem'));
assert.ok(kinds.includes('konsekvens'));

const again = buildKnowledgeQuiz(source);
assert.deepEqual(
  quiz.questions.map((q) => q.correctOptionId),
  again.questions.map((q) => q.correctOptionId),
);

const publicQuestions = toPublicQuizQuestions(quiz);
assert.equal(publicQuestions[0]?.options[0] && 'correctOptionId' in publicQuestions[0], false);
assert.ok(publicQuestions.every((q) => q.kind));

const answers: Record<string, string> = {};
for (const question of quiz.questions) {
  answers[question.id] = question.correctOptionId;
}
const perfect = gradeKnowledgeQuiz(quiz, answers);
assert.equal(perfect.passed, true);
assert.equal(perfect.score, quiz.questions.length);

const fail = gradeKnowledgeQuiz(quiz, { hva: 'hva-b' });
assert.equal(fail.passed, false);

assert.equal(getQuizContextLevel(source), 'rich');

const basicSource = {
  ...source,
  aiSummary: null,
  summary: 'Forslaget øker klimaavgiftene for veitrafikk og industri fra neste budsjettår.',
};
assert.equal(getQuizContextLevel(basicSource), 'basic');

const minimalSource = {
  issueId: '999',
  title: 'Kort tittel',
  category: null,
  komite: null,
  aiSummary: null,
  summary: null,
};
const minimalQuiz = buildKnowledgeQuiz(minimalSource);
assert.ok(minimalQuiz.questions.length >= 1);
assert.equal(getQuizContextLevel(minimalSource), 'minimal');

const v2Source = {
  ...source,
  aiSummary: {
    version: 2 as const,
    narrative: 'Regjeringen foreslår å øke klimaavgiftene for veitrafikk og industri.',
    who_affected: 'Bilister og industribedrifter blir berørt av endringene.',
    how_affected: 'Ingen konkret kronesum er oppgitt, men kostnadene forventes å øke.',
    topic_cards: [],
    labels: [],
  },
};
const v2Quiz = buildKnowledgeQuiz(v2Source);
assert.ok(v2Quiz.questions.some((q) => q.kind === 'hva'));
assert.ok(v2Quiz.questions.some((q) => q.kind === 'hvem'));
assert.ok(v2Quiz.questions.some((q) => q.kind === 'konsekvens'));

console.log('knowledge quiz tests passed');
