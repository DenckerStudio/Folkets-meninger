'use client';

import { Plus, X } from 'lucide-react';
import { STANCE_VISUAL } from '@/lib/opinions/labels';
import {
  OPINION_POINTS_MAX,
  OPINION_POINTS_MIN,
  OPINION_POINT_STANCES,
  OPINION_POINT_TEXT_MAX,
  OPINION_POINT_TEXT_MIN,
  type OpinionPoint,
  type OpinionPointStance,
} from '@/lib/opinions/types';
import { CharacterCountTextarea } from '@/components/ui/character-count-textarea';
import { cn } from '@/lib/utils';

type OpinionPointsEditorProps = {
  value: OpinionPoint[];
  onChange: (next: OpinionPoint[]) => void;
  error?: string;
};

export function OpinionPointsEditor({ value, onChange, error }: OpinionPointsEditorProps) {
  const validCount = value.filter((point) => point.text.trim().length >= OPINION_POINT_TEXT_MIN).length;

  function updatePoint(index: number, patch: Partial<OpinionPoint>) {
    onChange(value.map((point, i) => (i === index ? { ...point, ...patch } : point)));
  }

  function removePoint(index: number) {
    if (value.length <= OPINION_POINTS_MIN) return;
    onChange(value.filter((_, i) => i !== index));
  }

  function addPoint() {
    if (value.length >= OPINION_POINTS_MAX) return;
    const forCount = value.filter((point) => point.stance === 'for').length;
    const imotCount = value.filter((point) => point.stance === 'imot').length;
    const nextStance: OpinionPointStance = forCount <= imotCount ? 'for' : 'imot';
    onChange([...value, { stance: nextStance, text: '' }]);
  }

  return (
    <div>
      <div className="mb-1.5 flex items-baseline justify-between gap-3">
        <label className="text-sm font-medium text-foreground">Kulepunkter for og imot</label>
        <span
          className={cn(
            'text-xs tabular-nums',
            validCount < OPINION_POINTS_MIN ? 'text-amber-700 dark:text-amber-300' : 'text-muted-foreground',
          )}
        >
          {validCount}/{OPINION_POINTS_MIN} minst
        </span>
      </div>
      <p className="mb-3 text-xs leading-relaxed text-muted-foreground">
        Del minst {OPINION_POINTS_MIN} korte argumenter merket For eller Imot, med minst ett av hvert.
        Hvert kulepunkt: {OPINION_POINT_TEXT_MIN}–{OPINION_POINT_TEXT_MAX} tegn.
      </p>
      <ul className="space-y-2">
        {value.map((point, index) => {
          const length = point.text.trim().length;
          const tooShort = length > 0 && length < OPINION_POINT_TEXT_MIN;
          const atMax = point.text.length >= OPINION_POINT_TEXT_MAX;
          return (
            <li key={index} className="space-y-1">
              <div className="rounded-2xl border border-border bg-background p-3">
                <div className="mb-2 flex items-start justify-between gap-2">
                  <div
                    role="group"
                    aria-label={`Standpunkt for kulepunkt ${index + 1}`}
                    className="flex min-w-0 flex-1 flex-col gap-1.5"
                  >
                    {OPINION_POINT_STANCES.map((stance) => {
                      const visual = STANCE_VISUAL[stance];
                      const selected = point.stance === stance;
                      return (
                        <button
                          key={stance}
                          type="button"
                          aria-pressed={selected}
                          onClick={() => updatePoint(index, { stance })}
                          className={cn(
                            'min-h-11 w-full rounded-xl border px-3 text-left text-xs font-semibold transition-colors',
                            selected ? 'border-transparent' : 'border-border',
                            !selected && (stance === 'imot' ? 'text-brand-accent' : 'text-brand'),
                          )}
                          style={
                            selected
                              ? { backgroundColor: visual.bg, color: visual.fg, boxShadow: 'none' }
                              : { boxShadow: 'none' }
                          }
                        >
                          {visual.label}
                        </button>
                      );
                    })}
                  </div>
                  {value.length > OPINION_POINTS_MIN ? (
                    <button
                      type="button"
                      aria-label="Fjern kulepunkt"
                      onClick={() => removePoint(index)}
                      className="inline-flex min-h-11 min-w-11 items-center justify-center rounded-xl text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
                    >
                      <X className="h-4 w-4" />
                    </button>
                  ) : null}
                </div>
                <CharacterCountTextarea
                  value={point.text}
                  maxLength={OPINION_POINT_TEXT_MAX}
                  rows={2}
                  onChange={(text) => updatePoint(index, { text })}
                  placeholder={point.stance === 'for' ? 'Argument for …' : 'Argument imot …'}
                  aria-invalid={tooShort || undefined}
                />
              </div>
              {tooShort ? (
                <p className="px-1 text-xs font-medium text-amber-700 dark:text-amber-300">
                  Minst {OPINION_POINT_TEXT_MIN} tegn ({OPINION_POINT_TEXT_MIN - length} igjen).
                </p>
              ) : null}
              {atMax ? (
                <p className="px-1 text-xs text-muted-foreground">
                  Maks {OPINION_POINT_TEXT_MAX} tegn nådd.
                </p>
              ) : null}
            </li>
          );
        })}
      </ul>
      {value.length < OPINION_POINTS_MAX ? (
        <button
          type="button"
          onClick={addPoint}
          className="mt-2 inline-flex items-center gap-1.5 text-xs font-medium text-brand hover:underline"
        >
          <Plus className="h-3.5 w-3.5" />
          Legg til kulepunkt
        </button>
      ) : null}
      {error ? (
        <p className="mt-2 text-sm font-medium text-destructive">
          {error}
        </p>
      ) : null}
    </div>
  );
}
