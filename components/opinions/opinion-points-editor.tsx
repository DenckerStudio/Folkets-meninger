'use client';

import { Plus, X } from 'lucide-react';
import { FLAG_BLUE, FLAG_RED, STANCE_VISUAL } from '@/lib/opinions/labels';
import {
  OPINION_POINTS_MAX,
  OPINION_POINTS_MIN,
  OPINION_POINT_STANCES,
  OPINION_POINT_TEXT_MAX,
  OPINION_POINT_TEXT_MIN,
  type OpinionPoint,
  type OpinionPointStance,
} from '@/lib/opinions/types';

type OpinionPointsEditorProps = {
  value: OpinionPoint[];
  onChange: (next: OpinionPoint[]) => void;
  error?: string;
};

export function OpinionPointsEditor({ value, onChange, error }: OpinionPointsEditorProps) {
  const filledCount = value.filter((point) => point.text.trim().length > 0).length;

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
        <label className="text-sm font-medium text-[#001433]">Kulepunkter for og imot</label>
        <span className="text-xs text-[#001433]/55">
          {filledCount}/{OPINION_POINTS_MIN} minst
        </span>
      </div>
      <p className="mb-3 text-xs leading-relaxed text-[#001433]/60">
        Del minst {OPINION_POINTS_MIN} korte argumenter merket For eller Imot, med minst ett av hvert.
        Hvert kulepunkt: {OPINION_POINT_TEXT_MIN}–{OPINION_POINT_TEXT_MAX} tegn.
      </p>
      <ul className="space-y-2">
        {value.map((point, index) => (
          <li key={index} className="flex items-stretch overflow-hidden rounded-2xl border border-[#00205b]/15 bg-white/90">
            <div className="flex">
              {OPINION_POINT_STANCES.map((stance) => {
                const visual = STANCE_VISUAL[stance];
                const selected = point.stance === stance;
                return (
                  <button
                    key={stance}
                    type="button"
                    aria-pressed={selected}
                    onClick={() => updatePoint(index, { stance })}
                    className="min-w-[4.25rem] border-0 px-2.5 text-xs font-semibold"
                    style={{
                      backgroundColor: selected ? visual.bg : 'transparent',
                      color: selected ? visual.fg : FLAG_BLUE,
                      boxShadow: 'none',
                    }}
                  >
                    {visual.label}
                  </button>
                );
              })}
            </div>
            <input
              type="text"
              value={point.text}
              maxLength={OPINION_POINT_TEXT_MAX}
              onChange={(event) => updatePoint(index, { text: event.target.value })}
              placeholder={point.stance === 'for' ? 'Argument for …' : 'Argument imot …'}
              className="min-w-0 flex-1 border-0 bg-transparent px-3 py-2.5 text-sm text-[#001433] outline-none placeholder:text-[#001433]/40"
            />
            <span className="self-center pr-2 text-[11px] tabular-nums text-[#001433]/45">
              {point.text.trim().length}/{OPINION_POINT_TEXT_MAX}
            </span>
            {value.length > OPINION_POINTS_MIN ? (
              <button
                type="button"
                aria-label="Fjern kulepunkt"
                onClick={() => removePoint(index)}
                className="px-2.5 text-[#001433]/40 hover:text-[#001433]"
              >
                <X className="h-4 w-4" />
              </button>
            ) : null}
          </li>
        ))}
      </ul>
      {value.length < OPINION_POINTS_MAX ? (
        <button
          type="button"
          onClick={addPoint}
          className="mt-2 inline-flex items-center gap-1.5 text-xs font-medium text-[#00205b] hover:underline"
        >
          <Plus className="h-3.5 w-3.5" />
          Legg til kulepunkt
        </button>
      ) : null}
      {error ? (
        <p className="mt-2 text-sm font-medium" style={{ color: FLAG_RED }}>
          {error}
        </p>
      ) : null}
    </div>
  );
}
