import assert from 'node:assert/strict';
import { buildKnowledgeQuiz, gradeKnowledgeQuiz, toPublicQuizQuestions } from './quiz';

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

const again = buildKnowledgeQuiz(source);
assert.deepEqual(
  quiz.questions.map((q) => q.correctOptionId),
  again.questions.map((q) => q.correctOptionId),
);

const publicQuestions = toPublicQuizQuestions(quiz);
assert.equal(publicQuestions[0]?.options[0] && 'correctOptionId' in publicQuestions[0], false);

const answers: Record<string, string> = {};
for (const question of quiz.questions) {
  answers[question.id] = question.correctOptionId;
}
const perfect = gradeKnowledgeQuiz(quiz, answers);
assert.equal(perfect.passed, true);
assert.equal(perfect.score, quiz.questions.length);

const fail = gradeKnowledgeQuiz(quiz, { tema: 'tema-b' });
assert.equal(fail.passed, false);

const komiteQuestion = quiz.questions.find((q) => q.id === 'komite');
assert.ok(komiteQuestion);
assert.ok(komiteQuestion.options.some((opt) => opt.text === 'Energi- og miljøkomiteen'));

console.log('knowledge quiz tests passed');
