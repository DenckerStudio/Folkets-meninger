'use client';

import { useCallback, useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import {
  BookOpen,
  BrainCircuit,
  CheckCircle2,
  ChevronRight,
  Loader2,
  Lock,
  RotateCcw,
  Sparkles,
} from 'lucide-react';
import { useAuth } from '@/hooks/use-auth';
import { routes } from '@/lib/routes';
import { QUIZ_KIND_LABELS } from '@/lib/knowledge/quiz';
import { cn } from '@/lib/utils';
import type { KnowledgeQuizQuestionKind, QuizContextLevel } from '@/lib/knowledge/types';
import type { PublicKnowledgeQuizQuestion } from '@/lib/knowledge/types';

type QuizPayload = {
  questions: PublicKnowledgeQuizQuestion[];
  passScore: number;
  passed: boolean;
  loggedIn: boolean;
  contextLevel: QuizContextLevel;
  hasAiSummary: boolean;
};

type QuizResult = {
  score: number;
  total: number;
  passed: boolean;
  alreadyPassed?: boolean;
  correctByQuestion?: Record<string, boolean>;
};

function contextMessage(level: QuizContextLevel, hasAiSummary: boolean): string | null {
  if (level === 'rich') {
    return 'Spørsmålene er hentet fra AI-sammendraget og saksgrunnlaget.';
  }
  if (level === 'basic') {
    return hasAiSummary
      ? 'Begrenset saksgrunnlag — noen spørsmål kan være enklere.'
      : 'AI-sammendrag mangler — spørsmålene bygger på tilgjengelig saksinfo.';
  }
  return 'Lite saksgrunnlag tilgjengelig. Les dokumentene under fanen Dokumenter for å forstå saken bedre.';
}

function goToDocumentsTab() {
  const nextHash = '#dokumenter';
  if (window.location.hash !== nextHash) {
    window.history.replaceState(null, '', nextHash);
  }
  window.dispatchEvent(new Event('sak-tab-change'));
  document.getElementById('dokumenter')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
}

export function KnowledgeQuiz({ sakId, variant = 'default' }: { sakId: string; variant?: 'default' | 'pre-vote' }) {
  const { user } = useAuth();
  const router = useRouter();
  const [quiz, setQuiz] = useState<QuizPayload | null>(null);
  const [loading, setLoading] = useState(true);
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [step, setStep] = useState(0);
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<QuizResult | null>(null);
  const [error, setError] = useState<string | null>(null);

  const resetAttempt = useCallback(() => {
    setAnswers({});
    setStep(0);
    setResult(null);
    setError(null);
  }, []);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    fetch(`/api/sak/${sakId}/knowledge`, { cache: 'no-store' })
      .then((res) => res.json())
      .then((json) => {
        if (cancelled) return;
        if (Array.isArray(json.questions)) {
          setQuiz({
            questions: json.questions,
            passScore: json.passScore ?? 2,
            passed: json.passed === true,
            loggedIn: json.loggedIn === true,
            contextLevel: json.contextLevel ?? 'minimal',
            hasAiSummary: json.hasAiSummary === true,
          });
        }
      })
      .catch(() => {
        if (!cancelled) setError('Kunne ikke laste kunnskapstesten.');
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [sakId]);

  const submit = async () => {
    if (!user) {
      router.push(`${routes.login}?next=${encodeURIComponent(`${routes.sak(sakId)}#kunnskapstest`)}`);
      return;
    }
    setBusy(true);
    setError(null);
    try {
      const res = await fetch(`/api/sak/${sakId}/knowledge`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'submit_quiz', answers }),
      });
      const json = await res.json();
      if (!res.ok) {
        setError(json.error || 'Kunne ikke rette testen.');
        return;
      }
      setResult({
        score: json.score,
        total: json.total,
        passed: json.passed === true,
        alreadyPassed: json.alreadyPassed === true,
        correctByQuestion: json.correctByQuestion,
      });
    } catch {
      setError('En feil oppstod.');
    } finally {
      setBusy(false);
    }
  };

  if (loading) {
    return (
      <section
        id="kunnskapstest"
        className="rounded-2xl border border-border bg-card p-6 shadow-sm"
      >
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <Loader2 className="h-4 w-4 animate-spin text-brand" />
          Laster kunnskapstest …
        </div>
      </section>
    );
  }

  if (!quiz || quiz.questions.length === 0) {
    return (
      <section
        id="kunnskapstest"
        className="rounded-2xl border border-dashed border-border bg-muted/30 p-6"
      >
        <div className="flex items-start gap-3">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-muted text-muted-foreground">
            <BrainCircuit className="h-5 w-5" />
          </div>
          <div>
            <h2 className="text-lg font-bold text-foreground">Kunnskapstest</h2>
            <p className="mt-1 text-sm text-muted-foreground">
              Vi mangler nok saksgrunnlag for å lage en meningsfull test akkurat nå. Les
              dokumentene eller kom tilbake når AI-sammendraget er klart.
            </p>
            <button
              type="button"
              onClick={goToDocumentsTab}
              className="mt-3 inline-flex items-center gap-1.5 text-sm font-medium text-brand hover:underline"
            >
              <BookOpen className="h-4 w-4" />
              Gå til dokumenter
            </button>
          </div>
        </div>
      </section>
    );
  }

  const alreadyPassed = quiz.passed && !result;
  const reviewing = Boolean(result);
  const currentQuestion = quiz.questions[step];
  const allAnswered = Object.keys(answers).length >= quiz.questions.length;
  const progressPct = reviewing
    ? 100
    : Math.round(((step + (answers[currentQuestion?.id ?? ''] ? 1 : 0)) / quiz.questions.length) * 100);
  const contextNote = contextMessage(quiz.contextLevel, quiz.hasAiSummary);

  const selectOption = (questionId: string, optionId: string) => {
    if (reviewing || (alreadyPassed && !result)) return;
    setAnswers((prev) => ({ ...prev, [questionId]: optionId }));
  };

  const goNext = () => {
    if (step < quiz.questions.length - 1) {
      setStep((value) => value + 1);
    }
  };

  const goPrev = () => {
    if (step > 0) {
      setStep((value) => value - 1);
    }
  };

  return (
    <section
      id="kunnskapstest"
      className={cn(
        'rounded-2xl border bg-card p-6 shadow-sm',
        variant === 'pre-vote' ? 'border-brand/30 ring-1 ring-brand/10' : 'border-border',
      )}
    >
      <div className="flex items-start gap-3">
        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-brand/10 text-brand">
          <BrainCircuit className="h-5 w-5" />
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <h2 className="text-lg font-bold text-foreground">Kunnskapstest</h2>
            {variant === 'pre-vote' ? (
              <span className="inline-flex items-center gap-1 rounded-full bg-brand/10 px-2 py-0.5 text-xs font-medium text-brand">
                <Sparkles className="h-3 w-3" />
                Før du stemmer
              </span>
            ) : null}
          </div>
          <p className="mt-1 text-sm text-muted-foreground">
            {variant === 'pre-vote'
              ? 'Sjekk at du forstår hva saken handler om, hvem som berøres og hvilke konsekvenser som nevnes — før du avgir stemme.'
              : `Du trenger ${quiz.passScore} av ${quiz.questions.length} riktige for å bestå og få merket Informert borger (+15 poeng).`}
          </p>
          {contextNote ? (
            <p
              className={cn(
                'mt-2 text-xs',
                quiz.contextLevel === 'minimal'
                  ? 'text-amber-700 dark:text-amber-300'
                  : 'text-muted-foreground',
              )}
            >
              {contextNote}
            </p>
          ) : null}
        </div>
      </div>

      {alreadyPassed ? (
        <p className="mt-4 inline-flex items-center gap-2 rounded-xl border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-800 dark:border-emerald-900 dark:bg-emerald-950/40 dark:text-emerald-200">
          <CheckCircle2 className="h-4 w-4" />
          Du har allerede bestått testen for denne saken.
        </p>
      ) : null}

      {!reviewing && !alreadyPassed ? (
        <div className="mt-5">
          <div className="mb-4 flex items-center justify-between gap-3 text-xs text-muted-foreground">
            <span>
              Spørsmål {step + 1} av {quiz.questions.length}
            </span>
            <span>{progressPct}%</span>
          </div>
          <div className="mb-5 h-1.5 overflow-hidden rounded-full bg-muted">
            <div
              className="h-full rounded-full bg-brand transition-all duration-300"
              style={{ width: `${progressPct}%` }}
            />
          </div>
          <div className="mb-3 flex flex-wrap gap-1.5">
            {quiz.questions.map((question, index) => (
              <button
                key={question.id}
                type="button"
                onClick={() => setStep(index)}
                className={cn(
                  'rounded-full px-2 py-0.5 text-xs font-medium transition-colors',
                  index === step
                    ? 'bg-brand text-white'
                    : answers[question.id]
                      ? 'bg-brand/15 text-brand'
                      : 'bg-muted text-muted-foreground',
                )}
              >
                {QUIZ_KIND_LABELS[question.kind as KnowledgeQuizQuestionKind]}
              </button>
            ))}
          </div>
        </div>
      ) : null}

      {reviewing ? (
        <ol className="mt-5 space-y-5">
          {quiz.questions.map((question, index) => (
            <li key={question.id}>
              <div className="mb-1 flex items-center gap-2">
                <span className="rounded-full bg-muted px-2 py-0.5 text-xs font-medium text-muted-foreground">
                  {QUIZ_KIND_LABELS[question.kind as KnowledgeQuizQuestionKind]}
                </span>
                <span className="text-xs text-muted-foreground">
                  {result?.correctByQuestion?.[question.id] ? 'Riktig' : 'Feil'}
                </span>
              </div>
              <p className="text-sm font-medium text-foreground">
                {index + 1}. {question.prompt}
              </p>
              <div className="mt-2 grid gap-2">
                {question.options.map((option) => {
                  const selected = answers[question.id] === option.id;
                  const marked = result?.correctByQuestion?.[question.id];
                  return (
                    <div
                      key={option.id}
                      className={cn(
                        'rounded-xl border px-3 py-2 text-left text-sm',
                        selected
                          ? 'border-brand bg-brand/10 text-foreground'
                          : 'border-border bg-background text-foreground',
                        marked === false && selected
                          ? 'border-rose-300 bg-rose-50 dark:border-rose-900 dark:bg-rose-950/30'
                          : null,
                        marked === true && selected
                          ? 'border-emerald-300 bg-emerald-50 dark:border-emerald-900 dark:bg-emerald-950/30'
                          : null,
                      )}
                    >
                      {option.text}
                    </div>
                  );
                })}
              </div>
            </li>
          ))}
        </ol>
      ) : currentQuestion ? (
        <div className="mt-2">
          <span className="inline-flex rounded-full bg-muted px-2 py-0.5 text-xs font-medium text-muted-foreground">
            {QUIZ_KIND_LABELS[currentQuestion.kind as KnowledgeQuizQuestionKind]}
          </span>
          <p className="mt-2 text-sm font-medium text-foreground">{currentQuestion.prompt}</p>
          <div className="mt-3 grid gap-2">
            {currentQuestion.options.map((option) => {
              const selected = answers[currentQuestion.id] === option.id;
              return (
                <button
                  key={option.id}
                  type="button"
                  disabled={alreadyPassed || busy}
                  onClick={() => selectOption(currentQuestion.id, option.id)}
                  className={cn(
                    'rounded-xl border px-3 py-2.5 text-left text-sm transition-colors',
                    selected
                      ? 'border-brand bg-brand/10 text-foreground ring-1 ring-brand/30'
                      : 'border-border bg-background text-foreground hover:bg-muted',
                  )}
                >
                  {option.text}
                </button>
              );
            })}
          </div>
        </div>
      ) : null}

      {result ? (
        <div
          className={cn(
            'mt-5 rounded-xl border px-4 py-3 text-sm',
            result.passed
              ? 'border-emerald-200 bg-emerald-50 text-emerald-900 dark:border-emerald-900 dark:bg-emerald-950/40 dark:text-emerald-100'
              : 'border-amber-200 bg-amber-50 text-amber-900 dark:border-amber-900 dark:bg-amber-950/40 dark:text-amber-100',
          )}
        >
          {result.passed
            ? result.alreadyPassed
              ? `Allerede bestått tidligere. ${result.score}/${result.total} riktige nå.`
              : `Bestått: ${result.score}/${result.total}. Du får 15 poeng og merket Informert borger.`
            : `Ikke bestått ennå (${result.score}/${result.total}). Les AI-sammendraget og dokumentene, og prøv igjen.`}
        </div>
      ) : null}

      {error ? <p className="mt-3 text-sm text-destructive">{error}</p> : null}

      {!alreadyPassed || result ? (
        <div className="mt-5 flex flex-wrap items-center gap-3">
          {!user && !reviewing ? (
            <p className="inline-flex w-full items-center gap-1.5 text-sm text-muted-foreground sm:w-auto">
              <Lock className="h-3.5 w-3.5" />
              Logg inn for å få poeng når du består.
            </p>
          ) : null}

          {reviewing ? (
            <>
              {!result?.passed ? (
                <>
                  <button
                    type="button"
                    onClick={goToDocumentsTab}
                    className="inline-flex items-center gap-1.5 rounded-lg border border-border bg-background px-4 py-2.5 text-sm font-medium text-foreground hover:bg-muted"
                  >
                    <BookOpen className="h-4 w-4" />
                    Les dokumenter
                  </button>
                  <button
                    type="button"
                    onClick={resetAttempt}
                    className="inline-flex items-center gap-1.5 rounded-lg bg-brand px-4 py-2.5 text-sm font-medium text-white hover:bg-brand/90"
                  >
                    <RotateCcw className="h-4 w-4" />
                    Prøv igjen
                  </button>
                </>
              ) : null}
            </>
          ) : (
            <>
              {step > 0 ? (
                <button
                  type="button"
                  onClick={goPrev}
                  disabled={busy}
                  className="rounded-lg border border-border bg-background px-4 py-2.5 text-sm font-medium text-foreground hover:bg-muted disabled:opacity-50"
                >
                  Tilbake
                </button>
              ) : null}
              {step < quiz.questions.length - 1 ? (
                <button
                  type="button"
                  onClick={goNext}
                  disabled={!answers[currentQuestion?.id ?? ''] || busy}
                  className="inline-flex items-center gap-1 rounded-lg bg-brand px-4 py-2.5 text-sm font-medium text-white hover:bg-brand/90 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  Neste
                  <ChevronRight className="h-4 w-4" />
                </button>
              ) : (
                <button
                  type="button"
                  onClick={submit}
                  disabled={busy || !allAnswered}
                  className="rounded-lg bg-brand px-4 py-2.5 text-sm font-medium text-white hover:bg-brand/90 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  {busy ? 'Retter …' : user ? 'Sjekk svar' : 'Logg inn og sjekk svar'}
                </button>
              )}
            </>
          )}
        </div>
      ) : null}
    </section>
  );
}
