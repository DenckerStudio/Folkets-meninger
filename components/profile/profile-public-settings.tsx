'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { ExternalLink, Trophy } from 'lucide-react';
import { ProfileCard } from '@/components/profile/profile-card';
import { routes } from '@/lib/routes';

type ProfilePayload = {
  bio?: string;
  party_preference?: string;
  profile_is_public?: boolean;
  show_party_preference?: boolean;
  show_points?: boolean;
  points?: number;
};

export function ProfilePublicSettings({ userId }: { userId: string }) {
  const [bio, setBio] = useState('');
  const [partyPreference, setPartyPreference] = useState('');
  const [isPublic, setIsPublic] = useState(false);
  const [showParty, setShowParty] = useState(false);
  const [showPoints, setShowPoints] = useState(true);
  const [points, setPoints] = useState(0);
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
        setShowPoints(data.show_points !== false);
        setPoints(data.points ?? 0);
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
        show_points: showPoints,
      }),
    });
    const data = await res.json().catch(() => ({}));
    setSaving(false);
    setMessage(res.ok ? 'Offentlig profil lagret.' : data.error || 'Kunne ikke lagre profil');
  };

  return (
    <div className="space-y-6">
      <ProfileCard
        title="Offentlig profil"
        description="Innlegg og kommentarer er offentlige. Bio, parti og poeng deles bare hvis du velger det her."
      >
        <div className="grid gap-4">
          <label className="flex items-start gap-3 rounded-xl border border-gray-200 p-4">
            <input
              type="checkbox"
              checked={isPublic}
              onChange={(e) => setIsPublic(e.target.checked)}
              className="mt-1 rounded border-gray-300 text-indigo-600 focus:ring-indigo-500"
            />
            <span>
              <span className="block text-sm font-medium text-gray-900">Gjør profilen min offentlig</span>
              <span className="block text-sm text-gray-500">
                Andre kan se bio, synlige preferanser og forumaktivitet på profilsiden din.
              </span>
            </span>
          </label>

          <div>
            <label htmlFor="public-bio" className="block text-sm font-medium text-gray-700">
              Bio
            </label>
            <textarea
              id="public-bio"
              rows={4}
              value={bio}
              maxLength={500}
              onChange={(e) => setBio(e.target.value)}
              className="mt-1 w-full rounded-xl border border-gray-300 px-3 py-2 text-sm focus:border-indigo-500 focus:ring-indigo-500"
              placeholder="Kort om deg og hva du bryr deg om politisk."
            />
            <p className="mt-1 text-xs text-gray-500">{bio.length}/500 tegn</p>
          </div>

          <div>
            <label htmlFor="party-preference" className="block text-sm font-medium text-gray-700">
              Parti du holder mest med
            </label>
            <input
              id="party-preference"
              value={partyPreference}
              onChange={(e) => setPartyPreference(e.target.value)}
              className="mt-1 w-full rounded-xl border border-gray-300 px-3 py-2 text-sm focus:border-indigo-500 focus:ring-indigo-500"
              placeholder="Valgfritt, f.eks. Venstre"
            />
            <label className="mt-2 flex items-center gap-2 text-sm text-gray-700">
              <input
                type="checkbox"
                checked={showParty}
                onChange={(e) => setShowParty(e.target.checked)}
                className="rounded border-gray-300 text-indigo-600 focus:ring-indigo-500"
              />
              Vis partipreferanse offentlig
            </label>
          </div>

          <label className="flex items-center justify-between gap-4 rounded-xl border border-gray-200 p-4">
            <span className="flex items-center gap-3">
              <Trophy className="h-5 w-5 text-amber-500" />
              <span>
                <span className="block text-sm font-medium text-gray-900">Vis poeng offentlig</span>
                <span className="block text-sm text-gray-500">Du har {points} poeng fra aktivitet.</span>
              </span>
            </span>
            <input
              type="checkbox"
              checked={showPoints}
              onChange={(e) => setShowPoints(e.target.checked)}
              className="rounded border-gray-300 text-indigo-600 focus:ring-indigo-500"
            />
          </label>
        </div>

        {message && <p className="text-sm text-gray-600">{message}</p>}

        <div className="flex flex-wrap gap-3">
          <button
            type="button"
            onClick={save}
            disabled={saving}
            className="inline-flex rounded-lg bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-700 disabled:opacity-50"
          >
            {saving ? 'Lagrer…' : 'Lagre offentlig profil'}
          </button>
          <Link
            href={routes.profile(userId)}
            className="inline-flex items-center gap-1.5 rounded-lg border border-gray-300 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50"
          >
            Se offentlig profil <ExternalLink className="h-4 w-4" />
          </Link>
        </div>
      </ProfileCard>
    </div>
  );
}
