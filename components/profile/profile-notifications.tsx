'use client';

import Link from 'next/link';
import { ProfileCard } from '@/components/profile/profile-card';
import { CHANNEL_UI_COPY, NOTIFICATION_CHANNELS } from '@/lib/notifications/channels';
import { routes } from '@/lib/routes';

type ProfileNotificationsProps = {
  emailEnabled: boolean;
  onEmailEnabledChange: (value: boolean) => void;
  frequencies: Record<string, string>;
  onFrequencyChange: (channel: string, value: string) => void;
  saving: boolean;
  onSave: () => Promise<void>;
  isStemmePlus?: boolean;
};

export function ProfileNotifications({
  emailEnabled,
  onEmailEnabledChange,
  frequencies,
  onFrequencyChange,
  saving,
  onSave,
  isStemmePlus = false,
}: ProfileNotificationsProps) {
  return (
    <ProfileCard
      title="Varslingsinnstillinger"
      description="Velg hvordan du vil motta e-postvarsler. In-app varsler på Varsler-siden påvirkes ikke av disse innstillingene."
    >
      <p className="text-sm text-muted-foreground">
        Abonnement på{' '}
        <Link href={`${routes.minSide}?tab=innstillinger`} className="text-brand hover:underline">
          hjertesaker og AI-emner
        </Link>{' '}
        styres under Mine hjertesaker.
      </p>

      <div className="flex items-center justify-between rounded-xl border border-border bg-muted/50 px-4 py-3">
        <div>
          <h4 className="text-sm font-medium text-foreground">E-postvarsler</h4>
          <p className="text-xs text-muted-foreground mt-0.5">
            Hovedbryter for alle e-postvarsler (sanntid og oppsummeringer)
          </p>
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
        {NOTIFICATION_CHANNELS.map((channel) => {
          const copy = CHANNEL_UI_COPY[channel];
          return (
            <div
              key={channel}
              className="flex flex-col gap-2 rounded-xl border border-border px-4 py-3 sm:flex-row sm:items-center sm:justify-between"
            >
              <div className="min-w-0">
                <span className="text-sm font-medium text-foreground">{copy.label}</span>
                <p className="text-xs text-muted-foreground mt-0.5">{copy.description}</p>
              </div>
              <select
                value={frequencies[channel] ?? 'daily'}
                onChange={(e) => onFrequencyChange(channel, e.target.value)}
                disabled={!emailEnabled}
                className="rounded-lg border border-border bg-background px-3 py-1.5 text-sm disabled:opacity-60"
              >
                <option value="realtime" disabled={!isStemmePlus}>
                  Sanntid (én e-post per varsel){!isStemmePlus ? ' — Stemme+' : ''}
                </option>
                <option value="daily">Daglig oppsummering</option>
                <option value="weekly">Ukentlig oppsummering{isStemmePlus ? '' : ' (smakebit)'}</option>
              </select>
            </div>
          );
        })}
      </div>

      {!isStemmePlus ? (
        <p className="mt-4 text-sm text-muted-foreground">
          <Link href={`${routes.minSide}?tab=stemme-plus`} className="text-brand hover:underline">
            Stemme+
          </Link>{' '}
          gir sanntidsvarsler, rikere ukentlig oppsummering og smartere hjertesak-varsler.
        </p>
      ) : null}

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
