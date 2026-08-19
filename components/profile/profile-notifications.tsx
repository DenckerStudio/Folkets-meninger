'use client';

import { ProfileCard } from '@/components/profile/profile-card';

const CHANNELS = [
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
      <div className="flex items-center justify-between rounded-xl border border-border bg-muted/50 px-4 py-3">
        <div>
          <h4 className="text-sm font-medium text-foreground">E-postvarsler</h4>
          <p className="text-xs text-muted-foreground mt-0.5">Mottak av oppdateringer på e-post</p>
        </div>
        <button
          type="button"
          role="switch"
          aria-checked={emailEnabled}
          onClick={() => onEmailEnabledChange(!emailEnabled)}
          className={`relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors ${
            emailEnabled ? 'bg-brand' : 'bg-muted'
          }`}
        >
          <span
            className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow ring-0 transition ${
              emailEnabled ? 'translate-x-5' : 'translate-x-0'
            }`}
          />
        </button>
      </div>

      <div className="mt-4 space-y-3">
        {CHANNELS.map((channel) => (
          <div
            key={channel.key}
            className="flex flex-col gap-2 rounded-xl border border-border px-4 py-3 sm:flex-row sm:items-center sm:justify-between"
          >
            <span className="text-sm font-medium text-foreground">{channel.label}</span>
            <select
              value={frequencies[channel.key] ?? 'daily'}
              onChange={(e) => onFrequencyChange(channel.key, e.target.value)}
              className="rounded-lg border border-border bg-background px-3 py-1.5 text-sm"
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
        className="mt-4 inline-flex items-center justify-center rounded-lg bg-brand px-4 py-2 text-sm font-semibold text-white disabled:opacity-60"
      >
        {saving ? 'Lagrer…' : 'Lagre varsler'}
      </button>
    </ProfileCard>
  );
}
