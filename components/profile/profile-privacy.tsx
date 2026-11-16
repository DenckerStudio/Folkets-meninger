'use client';

import { ProfileCard } from '@/components/profile/profile-card';
import { ProfilePublicSettings } from '@/components/profile/profile-public-settings';
import { DeleteAccountSettings } from '@/components/profile/delete-account-settings';
import { STANCE_PROFILE_PRIVACY_SUMMARY } from '@/lib/copy/stance-privacy';
import { PoliticalConsentSettings } from '@/components/consent/political-consent-settings';

type ProfilePrivacyProps = {
  userId: string;
};

export function ProfilePrivacy({ userId }: ProfilePrivacyProps) {
  return (
    <div className="space-y-6">
      <ProfileCard title="Slik beskytter vi deg">
        <ol className="space-y-4">
          {[
            {
              step: '1',
              title: 'Konto og innlogging',
              body: 'Navn og e-post brukes til konto, innlogging og navngitte innlegg du selv publiserer. Vi gjør ikke BankID-verifisering.',
            },
            {
              step: '2',
              title: 'Holdninger og avstemninger',
              body: STANCE_PROFILE_PRIVACY_SUMMARY,
            },
            {
              step: '3',
              title: 'Drift og synlighet',
              body: 'App og database driftes på server i Norge. Offentlig aktivitet på profilen er av som standard. Se personvernerklæringen for underleverandører.',
            },
          ].map((item) => (
            <li key={item.step} className="flex gap-3">
              <span className="mt-0.5 inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-brand/10 text-xs font-semibold text-brand">
                {item.step}
              </span>
              <div className="min-w-0">
                <p className="text-sm font-semibold text-foreground">{item.title}</p>
                <p className="mt-0.5 text-sm text-muted-foreground">{item.body}</p>
              </div>
            </li>
          ))}
        </ol>
      </ProfileCard>

      <PoliticalConsentSettings userId={userId} />

      <ProfilePublicSettings userId={userId} />

      <DeleteAccountSettings />
    </div>
  );
}
