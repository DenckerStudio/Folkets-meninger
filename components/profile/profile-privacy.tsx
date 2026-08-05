'use client';

import { Shield } from 'lucide-react';
import { ProfileCard } from '@/components/profile/profile-card';

export function ProfilePrivacy() {
  return (
    <div className="space-y-6">
      <ProfileCard title="Dine data og personvern">
        <div className="rounded-xl border border-blue-100 bg-blue-50 p-4">
          <div className="flex gap-3">
            <Shield className="h-5 w-5 text-blue-500 shrink-0 mt-0.5" aria-hidden />
            <div className="text-sm text-blue-800 space-y-2">
              <p className="font-medium">Hvordan vi beskytter deg</p>
              <p>1. Din identitet brukes kun til å bekrefte at du er en ekte person og forhindre dobbelstemmer.</p>
              <p>2. Dine stemmer lagres i en separat, anonymisert database. Ingen kan koble ditt navn til en spesifikk stemme.</p>
              <p>3. All data lagres på sikre servere i henhold til GDPR (Privacy by Design).</p>
            </div>
          </div>
        </div>
      </ProfileCard>

      <ProfileCard
        title="Slett historikk og data"
        description="I tråd med norsk lov og GDPR har du rett til å bli glemt."
      >
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between p-4 border border-destructive/30 rounded-xl bg-destructive/10">
          <div>
            <h4 className="text-sm font-medium text-red-900">Slett profil og all data</h4>
            <p className="text-xs text-destructive mt-1">
              Sletter profilen din, innstillinger og all stemmehistorikk permanent.
            </p>
          </div>
          <button
            type="button"
            className="inline-flex items-center px-4 py-2 border border-destructive/40 shadow-sm text-sm font-medium rounded-lg text-destructive bg-card hover:bg-destructive/10 shrink-0"
          >
            Slett alt
          </button>
        </div>
      </ProfileCard>
    </div>
  );
}
