'use client';

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
  saving: boolean;
  onSave: () => Promise<void>;
};

export function ProfileInterests({
  interestCategories,
  onCategoriesChange,
  saving,
  onSave,
}: ProfileInterestsProps) {
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
    </div>
  );
}
