'use client';

import { useState, useEffect } from 'react';
import { ThumbsUp, ThumbsDown, EyeOff, CheckCircle, LogIn } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { useAuth } from '@/hooks/use-auth';
import Link from 'next/link';
import { ISSUE_STANCE_LABELS, type IssueStance } from '@/lib/stances/types';
import { routes } from '@/lib/routes';

interface StanceSectionProps {
  sakId: string;
  sakTitle?: string;
  sakSummary?: string;
  onStanceSaved?: (stance: IssueStance) => void;
}

export default function StanceSection({
  sakId,
  sakTitle,
  sakSummary,
  onStanceSaved,
}: StanceSectionProps) {
  const [userStance, setUserStance] = useState<IssueStance | null>(null);
  const [error, setError] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const { user } = useAuth();

  useEffect(() => {
    let cancelled = false;

    async function loadStance() {
      try {
        const res = await fetch(`/api/stance?issueId=${encodeURIComponent(sakId)}`);
        const data = await res.json();
        if (cancelled) return;

        if (data.stance && ['enig', 'uenig', 'ikke_interessert'].includes(data.stance)) {
          const stance = data.stance as IssueStance;
          setUserStance(stance);
          onStanceSaved?.(stance);
        }
      } catch {
        // Keep empty state on failure
      } finally {
        if (!cancelled) setIsLoading(false);
      }
    }

    loadStance();
    return () => {
      cancelled = true;
    };
  }, [sakId, user?.id, onStanceSaved]);

  const handleStance = async (stance: IssueStance) => {
    if (isSubmitting) return;

    if (!user) {
      setError('Du må logge inn for å lagre holdning.');
      return;
    }

    setIsSubmitting(true);
    setError('');

    try {
      const res = await fetch('/api/stance', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          issueId: sakId,
          stance,
          title: sakTitle,
          summary: sakSummary,
        }),
      });

      const data = await res.json();

      if (!res.ok) {
        setError(data.error || 'Kunne ikke lagre holdning.');
        setIsSubmitting(false);
        return;
      }

      const saved = (data.stance as IssueStance) ?? stance;
      setUserStance(saved);
      onStanceSaved?.(saved);
    } catch {
      setError('En feil oppstod. Prøv igjen.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const canChoose = !isLoading && !isSubmitting;

  return (
    <div className="rounded-2xl border border-border bg-card p-4 shadow-sm sm:p-8">
      <h2 className="mb-2 text-center text-xl font-bold text-foreground sm:text-2xl">
        Hva er din holdning?
      </h2>
      <p className="mb-6 text-center text-sm text-muted-foreground">
        Marker om du er enig, uenig eller ikke interessert. Holdningen er personlig og brukes til
        Valgomat og hjertesaker — ikke som offentlig stemme.
      </p>

      {isLoading && user && (
        <p className="mb-4 text-center text-sm text-muted-foreground">Laster din holdning…</p>
      )}

      {!user && (
        <div className="mb-6 space-y-2 text-center">
          <Link
            href={`${routes.login}?next=${encodeURIComponent(routes.sak(sakId))}`}
            className="inline-flex items-center text-sm font-medium text-indigo-600 hover:text-indigo-500 dark:text-indigo-400 dark:hover:text-indigo-300"
          >
            <LogIn className="mr-1.5 h-4 w-4" />
            Logg inn for å lagre holdning
          </Link>
        </div>
      )}

      {error && (
        <div className="mb-6 rounded-lg bg-destructive/10 py-2 text-center text-sm font-medium text-destructive dark:bg-red-950/40 dark:text-red-400">
          {error}
        </div>
      )}

      <div className="mb-6 grid grid-cols-3 gap-2 sm:mb-8 sm:gap-4">
        {(['enig', 'uenig', 'ikke_interessert'] as IssueStance[]).map((stance) => {
          const selected = userStance === stance;
          const tone =
            stance === 'enig'
              ? {
                  active:
                    'border-emerald-500 bg-emerald-100 text-emerald-800 dark:bg-emerald-950/50 dark:text-emerald-200 shadow-md ring-2 ring-emerald-500 ring-offset-2 ring-offset-background',
                  idle:
                    'border-emerald-100 dark:border-emerald-900/50 bg-emerald-50 dark:bg-emerald-950/30 text-emerald-700 dark:text-emerald-300 hover:bg-emerald-100 dark:hover:bg-emerald-950/50 hover:border-emerald-200 dark:hover:border-emerald-800',
                  icon: ThumbsUp,
                  check: 'fill-emerald-500',
                }
              : stance === 'uenig'
                ? {
                    active:
                      'border-rose-500 bg-rose-100 text-rose-800 dark:bg-rose-950/50 dark:text-rose-200 shadow-md ring-2 ring-rose-500 ring-offset-2 ring-offset-background',
                    idle:
                      'border-rose-100 dark:border-rose-900/50 bg-rose-50 dark:bg-rose-950/30 text-rose-700 dark:text-rose-300 hover:bg-rose-100 dark:hover:bg-rose-950/50 hover:border-rose-200 dark:hover:border-rose-800',
                    icon: ThumbsDown,
                    check: 'fill-rose-500',
                  }
                : {
                    active:
                      'border-muted-foreground bg-muted text-foreground shadow-md ring-2 ring-muted-foreground ring-offset-2 ring-offset-background',
                    idle:
                      'border-border bg-muted/50 text-foreground hover:bg-muted hover:border-muted-foreground/30',
                    icon: EyeOff,
                    check: 'fill-gray-600',
                  };

          const Icon = tone.icon;

          return (
            <motion.button
              key={stance}
              whileTap={canChoose ? { scale: 0.95 } : {}}
              whileHover={canChoose ? { scale: 1.02 } : {}}
              onClick={() => handleStance(stance)}
              disabled={!canChoose}
              aria-pressed={selected}
              aria-label={ISSUE_STANCE_LABELS[stance]}
              className={`relative flex min-h-[5.5rem] flex-col items-center justify-center rounded-xl border-2 px-1 py-3 transition-all duration-200 sm:min-h-0 sm:px-4 sm:py-6 ${
                selected ? tone.active : canChoose ? `${tone.idle} cursor-pointer` : 'border-border bg-muted text-muted-foreground opacity-50 cursor-not-allowed'
              }`}
            >
              {selected && (
                <motion.div
                  initial={{ scale: 0, opacity: 0 }}
                  animate={{ scale: 1, opacity: 1 }}
                  transition={{ type: 'spring', bounce: 0.6 }}
                  className="absolute right-1.5 top-1.5 sm:right-3 sm:top-3"
                >
                  <CheckCircle className={`h-5 w-5 text-white sm:h-6 sm:w-6 ${tone.check}`} />
                </motion.div>
              )}
              <Icon className="mb-1 h-6 w-6 sm:mb-2 sm:h-8 sm:w-8" />
              <span className="text-center text-xs font-semibold sm:text-base">
                {ISSUE_STANCE_LABELS[stance]}
              </span>
            </motion.button>
          );
        })}
      </div>

      <AnimatePresence>
        {userStance && (
          <motion.div
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            className="mb-2 text-center text-sm font-medium text-indigo-600 dark:text-indigo-400"
          >
            Lagret: {ISSUE_STANCE_LABELS[userStance]}. Du kan endre valget når som helst.
          </motion.div>
        )}
      </AnimatePresence>

      <p className="mt-4 text-center text-xs text-muted-foreground">
        Nasjonale ja/nei-avstemninger finner du under Avstemninger og borgerinitiativ.
      </p>
    </div>
  );
}
