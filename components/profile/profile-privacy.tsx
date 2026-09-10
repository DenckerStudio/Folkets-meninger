'use client';

import Link from 'next/link';
import { Shield } from 'lucide-react';
import { ProfileCard } from '@/components/profile/profile-card';
import { ProfilePublicSettings } from '@/components/profile/profile-public-settings';
import { routes } from '@/lib/routes';

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
              title: 'Bekreftelse, ikke overvåking',
              body: 'Identiteten din brukes til å bekrefte at du er en ekte person og forhindre dobbeltstemmer.',
            },
            {
              step: '2',
              title: 'Anonyme stemmer',
              body: 'Stemmer lagres anonymisert. Ingen kan koble navnet ditt til en spesifikk stemme i statistikken.',
            },
            {
              step: '3',
              title: 'Personvern by design',
              body: 'Data lagres på sikre servere i tråd med GDPR. Offentlig aktivitet er av som standard.',
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

      <ProfilePublicSettings userId={userId} />

      <ProfileCard
        title="Slett konto og data"
        description="I tråd med norsk lov og GDPR har du rett til å bli glemt."
      >
        <div className="flex flex-col gap-4 rounded-xl border border-border bg-muted/30 p-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex gap-3">
            <Shield className="mt-0.5 h-5 w-5 shrink-0 text-muted-foreground" aria-hidden />
            <div>
              <h4 className="text-sm font-medium text-foreground">Be om sletting</h4>
              <p className="mt-1 text-sm text-muted-foreground">
                Send oss en henvendelse, så sletter vi profil, innstillinger og stemmehistorikk.
              </p>
            </div>
          </div>
          <Link
            href={routes.innspill}
            className="inline-flex shrink-0 items-center justify-center rounded-lg border border-border bg-card px-4 py-2 text-sm font-medium text-foreground transition-colors hover:bg-muted"
          >
            Kontakt oss
          </Link>
        </div>
      </ProfileCard>
    </div>
  );
}
