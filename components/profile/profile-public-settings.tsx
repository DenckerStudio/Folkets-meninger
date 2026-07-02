'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { CheckCircle2, ExternalLink, Mail, Phone, Trophy, XCircle } from 'lucide-react';
import { ProfileCard } from '@/components/profile/profile-card';
import { PointsProgress } from '@/components/profile/points-progress';
import type { UserPointsProgress } from '@/lib/user-points-levels';
import { getUserPointsProgress } from '@/lib/user-points-levels';
import type { UserVerificationStatus } from '@/lib/user-verification';
import { routes } from '@/lib/routes';

type ProfilePayload = {
  bio?: string;
  party_preference?: string;
  profile_is_public?: boolean;
  show_party_preference?: boolean;
  points?: number;
  points_progress?: UserPointsProgress;
  verification?: UserVerificationStatus;
  profile_bio_min_length?: number;
  profile_points_eligible?: boolean;
};

function VerificationRow({
  label,
  verified,
  hint,
}: {
  label: string;
  verified: boolean;
  hint: string;
}) {
  return (
    <div className="flex items-start justify-between gap-3 rounded-xl border border-gray-200 bg-gray-50 px-3 py-2.5">
      <div>
        <p className="text-sm font-medium text-gray-900">{label}</p>
        <p className="text-xs text-gray-500">{hint}</p>
      </div>
      <span
        className={`inline-flex items-center gap-1 text-xs font-semibold ${verified ? 'text-emerald-700' : 'text-amber-700'}`}
      >
        {verified ? <CheckCircle2 className="h-4 w-4" /> : <XCircle className="h-4 w-4" />}
        {verified ? 'Bekreftet' : 'Mangler'}
      </span>
    </div>
  );
}

export function ProfilePublicSettings({ userId }: { userId: string }) {
  const [bio, setBio] = useState('');
  const [partyPreference, setPartyPreference] = useState('');
  const [isPublic, setIsPublic] = useState(false);
  const [showParty, setShowParty] = useState(false);
  const [points, setPoints] = useState(0);
  const [pointsProgress, setPointsProgress] = useState<UserPointsProgress>(() => getUserPointsProgress(0));
  const [verification, setVerification] = useState<UserVerificationStatus>({
    emailVerified: false,
    phoneVerified: false,
    fullyVerified: false,
  });
  const [bioMinLength, setBioMinLength] = useState(20);
  const [profilePointsEligible, setProfilePointsEligible] = useState(false);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState('');

  const loadProfile = () => {
    fetch('/api/user/profile', { cache: 'no-store' })
      .then((res) => res.json())
      .then((data: ProfilePayload) => {
        setBio(data.bio ?? '');
        setPartyPreference(data.party_preference ?? '');
        setIsPublic(data.profile_is_public === true);
        setShowParty(data.show_party_preference === true);
        setPoints(data.points ?? 0);
        setPointsProgress(data.points_progress ?? getUserPointsProgress(data.points ?? 0));
        if (data.verification) setVerification(data.verification);
        if (typeof data.profile_bio_min_length === 'number') setBioMinLength(data.profile_bio_min_length);
        setProfilePointsEligible(data.profile_points_eligible === true);
      })
      .catch(() => {});
  };

  useEffect(() => {
    loadProfile();
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
      }),
    });
    const data = await res.json().catch(() => ({}));
    setSaving(false);
    if (res.ok) {
      if (typeof data.points === 'number') setPoints(data.points);
      if (data.points_progress) setPointsProgress(data.points_progress);
      if (data.verification) setVerification(data.verification);
      setProfilePointsEligible(data.profile_points_eligible === true);
      setMessage('Offentlig profil lagret.');
      return;
    }
    setMessage(data.error || 'Kunne ikke lagre profil');
  };

  return (
    <div className="space-y-6">
      <PointsProgress points={points} progress={pointsProgress} />

      <ProfileCard
        title="Offentlig profil"
        description="Poeng er alltid synlige og viser tillit bygget gjennom aktivitet. Bio og parti deles bare hvis du velger det."
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

          <div className="rounded-xl border border-amber-200 bg-amber-50 p-4">
            <div className="flex items-center gap-2 text-sm font-semibold text-amber-950">
              <Trophy className="h-4 w-4" />
              +15 poeng for fullført profil
            </div>
            <p className="mt-2 text-sm leading-6 text-amber-900">
              For å få bonuspoeng må du bekrefte e-post og telefon, skrive minst {bioMinLength} tegn i bioen og
              gjøre profilen offentlig.
            </p>
            <div className="mt-3 space-y-2">
              <VerificationRow
                label="E-post"
                verified={verification.emailVerified}
                hint="Bekreft lenken i e-posten du fikk ved registrering."
              />
              <VerificationRow
                label="Telefon"
                verified={verification.phoneVerified}
                hint="Bekreft med SMS-kode under innlogging."
              />
            </div>
            {!verification.fullyVerified && (
              <Link
                href={routes.login}
                className="mt-3 inline-flex items-center gap-2 text-sm font-medium text-indigo-700 hover:text-indigo-600"
              >
                <Phone className="h-4 w-4" />
                Gå til innlogging for å fullføre verifisering
              </Link>
            )}
            {profilePointsEligible && (
              <p className="mt-3 inline-flex items-center gap-1.5 text-sm font-medium text-emerald-800">
                <CheckCircle2 className="h-4 w-4" />
                Profilen din er klar for bonuspoeng ved lagring.
              </p>
            )}
            {verification.emailVerified && !verification.phoneVerified && (
              <p className="mt-2 inline-flex items-center gap-1.5 text-xs text-gray-600">
                <Mail className="h-3.5 w-3.5" />
                E-post er bekreftet. Telefon gjenstår.
              </p>
            )}
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

          <div className="rounded-xl border border-gray-200 bg-gray-50 p-4 text-sm text-gray-600">
            Du har <span className="font-semibold text-gray-900">{points} poeng</span>. Poeng kan ikke skjules —
            de viser troverdighet bygget over tid.
          </div>
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
