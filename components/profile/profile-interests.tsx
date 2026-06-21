'use client';

import { useEffect, useState } from 'react';
import { ProfileNameSettings } from '@/components/profile-name-settings';
import { ProfileCard } from '@/components/profile/profile-card';

const INTEREST_OPTIONS = [
  'Helse og omsorg',
  'Energi og miljø',
  'Utdanning og forskning',
  'Transport',
  'Næring',
  'Justis',
] as const;

type ProfileInterestsProps = {
  interestCategories: string[];
  onCategoriesChange: (next: string[]) => void;
  interestLabels: string[];
  onLabelsChange: (next: string[]) => void;
  saving: boolean;
  labelsSaving: boolean;
  onSave: () => Promise<void>;
  onLabelsSave: () => Promise<void>;
};

export function ProfileInterests({
  interestCategories,
  onCategoriesChange,
  interestLabels,
  onLabelsChange,
  saving,
  labelsSaving,
  onSave,
  onLabelsSave,
}: ProfileInterestsProps) {
  const [popularLabels, setPopularLabels] = useState<string[]>([]);
  const [customLabel, setCustomLabel] = useState('');

  useEffect(() => {
    fetch('/api/ai-summary/labels', { cache: 'no-store' })
      .then((res) => res.json())
      .then((json) => {
        if (Array.isArray(json.labels)) setPopularLabels(json.labels);
      })
      .catch(() => {});
  }, []);

  const addCustomLabel = () => {
    const trimmed = customLabel.trim();
    if (!trimmed) return;
    const formatted = trimmed.charAt(0).toUpperCase() + trimmed.slice(1);
    if (!interestLabels.includes(formatted)) {
      onLabelsChange([...interestLabels, formatted]);
    }
    setCustomLabel('');
  };

  return (
    <div className="space-y-6">
      <ProfileNameSettings />
      <ProfileCard
        title="Interesseområder"
        description="Velg hvilke saksområder du ønsker å følge ekstra nøye med på."
      >
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          {INTEREST_OPTIONS.map((cat) => (
            <label
              key={cat}
              className="flex items-center justify-between gap-3 rounded-xl border border-gray-200 px-4 py-3 cursor-pointer hover:bg-gray-50 transition-colors"
            >
              <span className="text-sm font-medium text-gray-900">{cat}</span>
              <input
                type="checkbox"
                checked={interestCategories.includes(cat)}
                onChange={(e) => {
                  const next = e.target.checked
                    ? [...new Set([...interestCategories, cat])]
                    : interestCategories.filter((c) => c !== cat);
                  onCategoriesChange(next);
                }}
                className="h-4 w-4 rounded border-gray-300 text-indigo-600 focus:ring-indigo-500"
              />
            </label>
          ))}
        </div>
        <button
          type="button"
          onClick={() => void onSave()}
          disabled={saving}
          className="inline-flex items-center px-4 py-2 rounded-lg bg-indigo-600 text-white text-sm font-medium hover:bg-indigo-700 disabled:opacity-60"
        >
          {saving ? 'Lagrer…' : 'Lagre interesseområder'}
        </button>
      </ProfileCard>

      <ProfileCard
        title="AI-emner"
        description="Abonner på varsler når nye saker får disse AI-genererte emneordene."
      >
        {popularLabels.length > 0 && (
          <div className="flex flex-wrap gap-2 mb-4">
            {popularLabels.slice(0, 24).map((label) => {
              const active = interestLabels.includes(label);
              return (
                <button
                  key={label}
                  type="button"
                  onClick={() => {
                    const next = active
                      ? interestLabels.filter((l) => l !== label)
                      : [...interestLabels, label];
                    onLabelsChange(next);
                  }}
                  className={`rounded-full px-3 py-1.5 text-sm font-medium border transition-colors ${
                    active
                      ? 'bg-indigo-600 text-white border-indigo-600'
                      : 'bg-white text-gray-700 border-gray-200 hover:border-gray-300'
                  }`}
                >
                  {label}
                </button>
              );
            })}
          </div>
        )}

        <div className="flex gap-2 mb-4">
          <input
            type="text"
            value={customLabel}
            onChange={(e) => setCustomLabel(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                e.preventDefault();
                addCustomLabel();
              }
            }}
            placeholder="Legg til eget emne…"
            className="flex-1 rounded-lg border border-gray-200 px-3 py-2 text-sm"
          />
          <button
            type="button"
            onClick={addCustomLabel}
            className="rounded-lg border border-gray-200 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50"
          >
            Legg til
          </button>
        </div>

        {interestLabels.length > 0 && (
          <p className="text-sm text-gray-600 mb-4">
            Abonnerer på: {interestLabels.join(', ')}
          </p>
        )}

        <button
          type="button"
          onClick={() => void onLabelsSave()}
          disabled={labelsSaving}
          className="inline-flex items-center px-4 py-2 rounded-lg bg-indigo-600 text-white text-sm font-medium hover:bg-indigo-700 disabled:opacity-60"
        >
          {labelsSaving ? 'Lagrer…' : 'Lagre AI-emner'}
        </button>
      </ProfileCard>
    </div>
  );
}
