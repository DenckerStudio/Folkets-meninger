'use client';

import { ProfileCard } from '@/components/profile/profile-card';

const CHANNELS = [
  { key: 'forum', label: 'Forum' },
  { key: 'mentions', label: 'Mentions' },
  { key: 'categories', label: 'Kategorier/hjertesaker' },
  { key: 'labels', label: 'AI-emner' },
] as const;

type ProfileNotificationsProps = {
  emailEnabled: boolean;
  onEmailEnabledChange: (value: boolean) => void;
  frequencies: Record<string, string>;
  onFrequencyChange: (channel: string, value: string) => void;
  saving: boolean;
  onSave: () => Promise<void>;
};

export function ProfileNotifications({
  emailEnabled,
  onEmailEnabledChange,
  frequencies,
  onFrequencyChange,
  saving,
  onSave,
}: ProfileNotificationsProps) {
  return (
    <ProfileCard
      title="Varslingsinnstillinger"
      description="Slå av/på e-postvarsler. In-app varsler påvirkes ikke."
    >
      <div className="flex items-center justify-between rounded-xl border border-gray-100 bg-gray-50/50 px-4 py-3">
        <div>
          <h4 className="text-sm font-medium text-gray-900">E-postvarsler</h4>
          <p className="text-xs text-gray-500 mt-0.5">Mottak av oppdateringer på e-post</p>
        </div>
        <button
          type="button"
          onClick={() => onEmailEnabledChange(!emailEnabled)}
          className={`${emailEnabled ? 'bg-indigo-600' : 'bg-gray-200'} relative inline-flex h-6 w-11 shrink-0 rounded-full transition-colors`}
          role="switch"
          aria-checked={emailEnabled}
        >
          <span
            aria-hidden
            className={`${emailEnabled ? 'translate-x-5' : 'translate-x-0'} pointer-events-none inline-block h-5 w-5 rounded-full bg-white shadow transform transition`}
          />
        </button>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {CHANNELS.map((row) => (
          <div key={row.key} className="rounded-xl border border-gray-200 p-4">
            <div className="text-sm font-medium text-gray-900 mb-2">{row.label}</div>
            <select
              value={frequencies[row.key] || 'daily'}
              onChange={(e) => onFrequencyChange(row.key, e.target.value)}
              className="w-full rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm"
            >
              <option value="realtime">Sanntid</option>
              <option value="daily">Daglig</option>
              <option value="weekly">Ukentlig</option>
            </select>
          </div>
        ))}
      </div>

      <button
        type="button"
        onClick={() => void onSave()}
        disabled={saving}
        className="inline-flex items-center px-4 py-2 rounded-lg bg-indigo-600 text-white text-sm font-medium hover:bg-indigo-700 disabled:opacity-60"
      >
        {saving ? 'Lagrer…' : 'Lagre varslingsinnstillinger'}
      </button>
    </ProfileCard>
  );
}
