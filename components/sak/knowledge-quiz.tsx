'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { BrainCircuit, CheckCircle2, Loader2, Lock } from 'lucide-react';
import { useAuth } from '@/hooks/use-auth';
import { routes } from '@/lib/routes';
import { cn } from '@/lib/utils';
import type { PublicKnowledgeQuizQuestion } from '@/lib/knowledge/types';

type QuizPayload = {
  questions: PublicKnowledgeQuizQuestion[];
  passScore: number;
  passed: boolean;
  loggedIn: boolean;
};

export function KnowledgeQuiz({ sakId }: { sakId: string }) {
  const { user } = useAuth();
  const router = useRouter();
  const [quiz, setQuiz] = useState<QuizPayload | null>(null);
  const [loading, setLoading] = useState(true);
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<{
    score: number;
    total: number;
    passed: boolean;
    alreadyPassed?: boolean;
    correctByQuestion?: Record<string, boolean>;
  } | null>(null);
  const [error, setError] = useState<string | null>(null);

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
      router.push(`${routes.login}?next=${encodeURIComponent(routes.sak(sakId))}`);
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
      <section className="rounded-2xl border border-border bg-card p-6 shadow-sm">
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <Loader2 className="h-4 w-4 animate-spin text-brand" />
          Laster kunnskapstest …
        </div>
      </section>
    );
  }

  if (!quiz || quiz.questions.length === 0) {
    return null;
  }

  const alreadyPassed = quiz.passed || result?.passed;

  return (
    <section className="rounded-2xl border border-border bg-card p-6 shadow-sm">
      <div className="flex items-start gap-3">
        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-brand/10 text-brand">
          <BrainCircuit className="h-5 w-5" />
        </div>
        <div>
          <h2 className="text-lg font-bold text-foreground">Kunnskapstest</h2>
          <p className="mt-1 text-sm text-muted-foreground">
            Spørsmålene er hentet fra saksgrunnlaget. Du trenger {quiz.passScore} av{' '}
            {quiz.questions.length} riktige for å få merket Informert borger.
          </p>
        </div>
      </div>

      {alreadyPassed && !result ? (
        <p className="mt-4 inline-flex items-center gap-2 rounded-xl border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-800 dark:border-emerald-900 dark:bg-emerald-950/40 dark:text-emerald-200">
          <CheckCircle2 className="h-4 w-4" />
          Du har allerede bestått testen for denne saken.
        </p>
      ) : null}

      <ol className="mt-5 space-y-5">
        {quiz.questions.map((question, index) => (
          <li key={question.id}>
            <p className="text-sm font-medium text-foreground">
              {index + 1}. {question.prompt}
            </p>
            <div className="mt-2 grid gap-2">
              {question.options.map((option) => {
                const selected = answers[question.id] === option.id;
                const marked = result?.correctByQuestion?.[question.id];
                return (
                  <button
                    key={option.id}
                    type="button"
                    disabled={Boolean(alreadyPassed && result == null) || busy}
                    onClick={() =>
                      setAnswers((prev) => ({ ...prev, [question.id]: option.id }))
                    }
                    className={cn(
                      'rounded-xl border px-3 py-2 text-left text-sm transition-colors',
                      selected
                        ? 'border-brand bg-brand/10 text-foreground'
                        : 'border-border bg-background text-foreground hover:bg-muted',
                      result && marked === false && selected
                        ? 'border-rose-300 bg-rose-50 dark:border-rose-900 dark:bg-rose-950/30'
                        : null,
                      result && marked === true && selected
                        ? 'border-emerald-300 bg-emerald-50 dark:border-emerald-900 dark:bg-emerald-950/30'
                        : null,
                    )}
                  >
                    {option.text}
                  </button>
                );
              })}
            </div>
          </li>
        ))}
      </ol>

      {result ? (
        <p className="mt-4 text-sm text-foreground">
          {result.passed
            ? result.alreadyPassed
              ? `Allerede bestått tidligere. ${result.score}/${result.total} riktige nå.`
              : `Bestått: ${result.score}/${result.total}. Du får poeng og merket Informert borger.`
            : `Ikke bestått ennå (${result.score}/${result.total}). Les dokumentene og prøv igjen.`}
        </p>
      ) : null}

      {error ? <p className="mt-3 text-sm text-destructive">{error}</p> : null}

      {!quiz.passed || result ? (
        <div className="mt-5">
          {!user ? (
            <p className="mb-3 inline-flex items-center gap-1.5 text-sm text-muted-foreground">
              <Lock className="h-3.5 w-3.5" />
              Logg inn for å få poeng når du består.
            </p>
          ) : null}
          <button
            type="button"
            onClick={submit}
            disabled={busy || Object.keys(answers).length < quiz.questions.length}
            className="rounded-lg bg-brand px-4 py-2.5 text-sm font-medium text-white hover:bg-brand/90 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {busy ? 'Retter …' : user ? 'Sjekk svar' : 'Logg inn og sjekk svar'}
          </button>
        </div>
      ) : null}
    </section>
  );
}
