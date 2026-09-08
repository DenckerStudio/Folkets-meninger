'use client';

import { useCallback, useEffect, useId, useRef, useState, type FormEvent, type MouseEvent } from 'react';
import { AnimatePresence, motion } from 'motion/react';
import { FLAG_RED, STANCE_VISUAL, stanceLabel } from '@/lib/opinions/labels';
import { OPINION_BODY_MAX, OPINION_STANCES, type OpinionStance } from '@/lib/opinions/types';
import { cn } from '@/lib/utils';

const COMPACT_HEIGHT = 72;
const FILL_DURATION_MS = 560;

type Phase = 'idle' | 'filling' | 'expanded';

type FillOrigin = { x: number; y: number };

function stanceButtonRadius(stance: OpinionStance, phase: Phase): string {
  const expandedLike = phase === 'filling' || phase === 'expanded';
  switch (stance) {
    case 'for':
      return expandedLike ? '2rem 0 0 0' : '2rem 0 0 2rem';
    case 'blank':
      return '0';
    case 'imot':
      return expandedLike ? '0 2rem 0 0' : '0 2rem 2rem 0';
    default: {
      const _exhaustive: never = stance;
      return _exhaustive;
    }
  }
}

type StanceExpandModalProps = {
  minLength: number;
  submitLabel: string;
  onSubmit: (stance: OpinionStance, body: string) => Promise<void>;
  busy?: boolean;
  error?: string;
  initialStance?: OpinionStance | null;
  initialBody?: string;
  disabled?: boolean;
  disabledReason?: string;
  className?: string;
};

export function StanceExpandModal({
  minLength,
  submitLabel,
  onSubmit,
  busy = false,
  error,
  initialStance = null,
  initialBody = '',
  disabled = false,
  disabledReason,
  className,
}: StanceExpandModalProps) {
  const titleId = useId();
  const bodyId = useId();
  const cardRef = useRef<HTMLDivElement>(null);
  const [phase, setPhase] = useState<Phase>('idle');
  const [selected, setSelected] = useState<OpinionStance | null>(null);
  const [fillOrigin, setFillOrigin] = useState<FillOrigin | null>(null);
  const [body, setBody] = useState(initialBody);
  const [localError, setLocalError] = useState('');

  const remaining = Math.max(0, minLength - body.trim().length);
  const displayError = localError || error;
  const expanded = phase === 'expanded';
  const filling = phase === 'filling';
  const fillColor = selected ? STANCE_VISUAL[selected].bg : 'transparent';
  const fillFg = selected ? STANCE_VISUAL[selected].fg : undefined;

  const collapse = useCallback(() => {
    if (busy) return;
    setPhase('idle');
    setSelected(null);
    setFillOrigin(null);
    setLocalError('');
    setBody(initialBody);
  }, [busy, initialBody]);

  useEffect(() => {
    setBody(initialBody);
  }, [initialBody]);

  useEffect(() => {
    if (phase !== 'filling') return;
    const timer = window.setTimeout(() => setPhase('expanded'), FILL_DURATION_MS);
    return () => window.clearTimeout(timer);
  }, [phase]);

  useEffect(() => {
    if (!expanded) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') collapse();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [expanded, collapse]);

  function pickStance(stance: OpinionStance, event: MouseEvent<HTMLButtonElement>) {
    if (disabled || busy || filling) return;
    if (phase === 'expanded') {
      setSelected(stance);
      setLocalError('');
      return;
    }
    const card = cardRef.current;
    const button = event.currentTarget;
    if (card) {
      const cardRect = card.getBoundingClientRect();
      const buttonRect = button.getBoundingClientRect();
      setFillOrigin({
        x: buttonRect.left - cardRect.left + buttonRect.width / 2,
        y: buttonRect.top - cardRect.top + buttonRect.height / 2,
      });
    }
    setSelected(stance);
    setLocalError('');
    setPhase('filling');
  }

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    if (!selected || busy) return;
    const trimmed = body.trim();
    if (trimmed.length < minLength) {
      setLocalError(`Skriv minst ${minLength} tegn om hvorfor du mener dette.`);
      return;
    }
    if (trimmed.length > OPINION_BODY_MAX) {
      setLocalError(`Begrunnelsen kan ikke være lengre enn ${OPINION_BODY_MAX} tegn`);
      return;
    }
    await onSubmit(selected, trimmed);
  }

  return (
    <div className={cn('relative w-full max-w-7xl', className)} style={{ minHeight: COMPACT_HEIGHT }}>
      <AnimatePresence>
        {expanded ? (
          <motion.button
            type="button"
            aria-label="Lukk"
            className="fixed inset-0 z-40 cursor-default bg-foreground/25 backdrop-blur-[1px]"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={collapse}
          />
        ) : null}
      </AnimatePresence>

      <motion.div
        ref={cardRef}
        data-stance-modal=""
        data-phase={phase}
        aria-modal={expanded || undefined}
        aria-labelledby={expanded ? titleId : undefined}
        className={cn(
          'rounded-xxl absolute inset-x-0 top-0 w-full overflow-hidden bg-card shadow-sm',
          expanded || filling ? 'z-50 shadow-2xl' : 'z-10',
        )}
        animate={{
          height: expanded ? 'auto' : COMPACT_HEIGHT,
        }}
        transition={{
          height: expanded
            ? { type: 'spring', stiffness: 300, damping: 30, bounce: 0 }
            : { duration: 0 },
        }}
        style={{ maxWidth: '80rem', height: expanded ? undefined : COMPACT_HEIGHT }}
      >
        <div className="pointer-events-none absolute inset-0 overflow-hidden rounded-xxl" aria-hidden>
          {fillOrigin && selected && (filling || expanded) ? (
            <motion.div
              className="absolute inset-0"
              style={{ backgroundColor: fillColor }}
              initial={{
                clipPath: `circle(18px at ${fillOrigin.x}px ${fillOrigin.y}px)`,
              }}
              animate={{
                clipPath: 'circle(150% at 50% 50%)',
              }}
              transition={{ duration: FILL_DURATION_MS / 1000, ease: [0.22, 1, 0.36, 1] }}
            />
          ) : null}
        </div>

        {/*
          Compact For/Blank/Imot bar inspired by 21st.dev Motion Button
          (expanding circle fill) + Expandable Dialog (spring height expand).
        */}
        <div className="relative z-10 flex h-[72px] items-stretch gap-0 p-0">
          {OPINION_STANCES.map((stance) => {
            const visual = STANCE_VISUAL[stance];
            const isPicked = selected === stance;
            const isCurrent = !selected && initialStance === stance;
            return (
              <button
                key={stance}
                type="button"
                disabled={disabled || busy}
                onClick={(event) => pickStance(stance, event)}
                className={cn(
                  'flex flex-1 items-center justify-center border-0 shadow-none text-sm font-semibold tracking-wide sm:text-base',
                  disabled && 'cursor-not-allowed opacity-60',
                )}
                aria-pressed={isPicked || isCurrent}
                style={
                  filling || expanded
                    ? {
                        backgroundColor: 'transparent',
                        color: fillFg,
                        opacity: isPicked ? 1 : 0.35,
                        borderRadius: stanceButtonRadius(stance, phase),
                        boxShadow: 'none',
                      }
                    : {
                        backgroundColor: visual.bg,
                        color: visual.fg,
                        borderRadius: stanceButtonRadius(stance, phase),
                        boxShadow: 'none',
                      }
                }
              >
                {visual.label}
              </button>
            );
          })}
        </div>

        {disabled && disabledReason ? (
          <p className="relative z-10 px-4 pb-3 text-center text-xs text-muted-foreground">{disabledReason}</p>
        ) : null}

        <AnimatePresence>
          {expanded && selected ? (
            <motion.form
              key="expand-body"
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.22, delay: 0.05 }}
              onSubmit={handleSubmit}
              className="relative z-10 px-4 pb-4 pt-1 sm:px-5 sm:pb-5"
            >
              <h3
                id={titleId}
                className="text-base font-semibold"
                style={{ color: fillFg }}
              >
                Hvorfor {stanceLabel(selected).toLowerCase()}?
              </h3>
              <label htmlFor={bodyId} className="sr-only">
                Begrunnelse
              </label>
              <textarea
                id={bodyId}
                value={body}
                onChange={(event) => setBody(event.target.value)}
                rows={6}
                maxLength={OPINION_BODY_MAX}
                placeholder={`Skriv minst ${minLength} tegn om hvorfor du er ${stanceLabel(selected).toLowerCase()}.`}
                className="mt-3 w-full resize-none rounded-2xl border bg-white/95 px-3 py-2.5 text-sm text-foreground outline-none placeholder:text-muted-foreground focus:ring-2"
                style={{
                  borderColor: selected === 'blank' ? 'rgba(0,32,91,0.2)' : 'transparent',
                  color: '#001433',
                }}
              />
              <div className="mt-2 flex flex-wrap items-center justify-between gap-2 text-xs" style={{ color: fillFg }}>
                <span>
                  {remaining > 0 ? `${remaining} tegn igjen` : `${body.trim().length} tegn`}
                </span>
                <span className="opacity-80">Maks {OPINION_BODY_MAX} tegn</span>
              </div>
              {displayError ? (
                <p className="mt-2 text-sm font-medium" style={{ color: selected === 'blank' ? FLAG_RED : '#fff' }}>
                  {displayError}
                </p>
              ) : null}
              <div className="mt-4 flex flex-wrap justify-end gap-2">
                <button
                  type="button"
                  onClick={collapse}
                  disabled={busy}
                  className="rounded-full px-4 py-2 text-sm font-medium"
                  style={{
                    color: fillFg,
                    backgroundColor: selected === 'blank' ? 'rgba(0,32,91,0.08)' : 'rgba(255,255,255,0.12)',
                  }}
                >
                  Avbryt
                </button>
                <button
                  type="submit"
                  disabled={busy || body.trim().length < minLength}
                  className="rounded-full px-5 py-2 text-sm font-semibold disabled:cursor-not-allowed disabled:opacity-50"
                  style={{
                    backgroundColor: fillFg,
                    color: fillColor,
                  }}
                >
                  {busy ? 'Lagrer…' : submitLabel}
                </button>
              </div>
            </motion.form>
          ) : null}
        </AnimatePresence>
      </motion.div>
    </div>
  );
}
