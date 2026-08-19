'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { ExternalLink } from 'lucide-react';
import { ProfileCard } from '@/components/profile/profile-card';
import {
  ACTIVITY_VISIBILITY_VALUES,
  activityVisibilityLabel,
  parseActivityVisibility,
  type ActivityVisibility,
} from '@/lib/identity/activity-visibility';
import { routes } from '@/lib/routes';

type ProfilePayload = {
  bio?: string;
  party_preference?: string;
  profile_is_public?: boolean;
  show_party_preference?: boolean;
  activity_visibility?: ActivityVisibility;
};

export function ProfilePublicSettings({ userId }: { userId: string }) {
  const [bio, setBio] = useState('');
  const [partyPreference, setPartyPreference] = useState('');
  const [isPublic, setIsPublic] = useState(false);
  const [showParty, setShowParty] = useState(false);
  const [activityVisibility, setActivityVisibility] = useState<ActivityVisibility>('private');
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState('');

  useEffect(() => {
    fetch('/api/user/profile', { cache: 'no-store' })
      .then((res) => res.json())
      .then((data: ProfilePayload) => {
        setBio(data.bio ?? '');
        setPartyPreference(data.party_preference ?? '');
        setIsPublic(data.profile_is_public === true);
        setShowParty(data.show_party_preference === true);
        setActivityVisibility(parseActivityVisibility(data.activity_visibility));
      })
      .catch(() => {});
  }, []);

  const save = async () => {
    setSaving(true);
    setMessage('');
    const res = await fetch('/api/user/profile', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        bio,
        party_preference: partyPreference,
        profile_is_public: isPublic,
        show_party_preference: showParty,
        activity_visibility: activityVisibility,
      }),
    });
    const data = await res.json().catch(() => ({}));
    setSaving(false);
    if (res.ok) {
      setMessage('Offentlig profil lagret.');
      return;
    }
    setMessage(data.error || 'Kunne ikke lagre profil');
  };

  return (
    <div className="space-y-6">
      <ProfileCard
        title="Offentlig profil"
        description="Bio og preferanser er valgfrie. Aktivitet deles bare hvis du aktivt velger det."
      >
        <div className="grid gap-4">
          <label className="flex items-start gap-3 rounded-xl border border-border p-4">
            <input
              type="checkbox"
              checked={isPublic}
              onChange={(e) => setIsPublic(e.target.checked)}
              className="mt-1 rounded border-border text-brand focus:ring-brand"
            />
            <span>
              <span className="block text-sm font-medium text-foreground">Gjør profilen min offentlig</span>
              <span className="block text-sm text-muted-foreground">
                Andre kan se bio og synlige preferanser på profilsiden din.
              </span>
            </span>
          </label>

          <div>
            <label htmlFor="activity-visibility" className="block text-sm font-medium text-foreground">
              Del aktivitet
            </label>
            <select
              id="activity-visibility"
              value={activityVisibility}
              onChange={(e) => setActivityVisibility(parseActivityVisibility(e.target.value))}
              className="mt-1 w-full rounded-xl border border-border bg-background px-3 py-2 text-sm"
            >
              {ACTIVITY_VISIBILITY_VALUES.map((value) => (
                <option key={value} value={value}>
                  {activityVisibilityLabel(value)}
                </option>
              ))}
            </select>
            <p className="mt-1 text-xs text-muted-foreground">
              Standard er privat. «All aktivitet» viser antall stemmer og høringsinnspill — aldri hva du stemte.
            </p>
          </div>

          <div>
            <label htmlFor="public-bio" className="block text-sm font-medium text-foreground">
              Bio
            </label>
            <textarea
              id="public-bio"
              rows={4}
              value={bio}
              maxLength={500}
              onChange={(e) => setBio(e.target.value)}
              className="mt-1 w-full rounded-xl border border-border px-3 py-2 text-sm focus:border-brand focus:ring-brand"
              placeholder="Kort om deg og hva du bryr deg om politisk."
            />
            <p className="mt-1 text-xs text-muted-foreground">{bio.length}/500 tegn</p>
          </div>

          <div>
            <label htmlFor="party-preference" className="block text-sm font-medium text-foreground">
              Parti du holder mest med
            </label>
            <input
              id="party-preference"
              value={partyPreference}
              onChange={(e) => setPartyPreference(e.target.value)}
              className="mt-1 w-full rounded-xl border border-border px-3 py-2 text-sm focus:border-brand focus:ring-brand"
              placeholder="Valgfritt, f.eks. Venstre"
            />
            <label className="mt-2 flex items-center gap-2 text-sm text-foreground">
              <input
                type="checkbox"
                checked={showParty}
                onChange={(e) => setShowParty(e.target.checked)}
                className="rounded border-border text-brand focus:ring-brand"
              />
              Vis partipreferanse offentlig
            </label>
          </div>
        </div>

        {message && <p className="text-sm text-muted-foreground">{message}</p>}

        <div className="flex flex-wrap gap-3">
          <button
            type="button"
            onClick={() => void save()}
            disabled={saving}
            className="inline-flex rounded-lg bg-brand px-4 py-2 text-sm font-medium text-white hover:opacity-90 disabled:opacity-50"
          >
            {saving ? 'Lagrer…' : 'Lagre offentlig profil'}
          </button>
          <Link
            href={routes.profile(userId)}
            className="inline-flex items-center gap-1.5 rounded-lg border border-border px-4 py-2 text-sm font-medium text-foreground hover:bg-muted/50"
          >
            Se offentlig profil <ExternalLink className="h-4 w-4" />
          </Link>
        </div>
      </ProfileCard>
    </div>
  );
}
