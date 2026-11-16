'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { LogIn } from 'lucide-react';
import { PageHeader } from '@/components/page-header';
import { ProfileStanceHistory } from '@/components/profile/profile-stance-history';
import { ProfileValgomat } from '@/components/profile/profile-valgomat';
import { ProfileInterests } from '@/components/profile/profile-interests';
import { ProfileFylkePicker } from '@/components/profile/profile-fylke-picker';
import { ProfileNotifications } from '@/components/profile/profile-notifications';
import { ProfileAppPreferences } from '@/components/profile/profile-app-preferences';
import { ProfileStemmePlus } from '@/components/profile/profile-stemme-plus';
import { ProfilePrivacy } from '@/components/profile/profile-privacy';
import { ProfileVoteHistory, type VoteHistoryItem } from '@/components/profile/profile-vote-history';
import { ByokSettings, type ByokMetaView } from '@/components/profile/byok-settings';
import { AccountDeletionSlot } from '@/components/min-side/account-deletion-slot';
import { ProfileCard } from '@/components/profile/profile-card';
import { EmptyState } from '@/components/dashboard/empty-state';
import { useAuth } from '@/hooks/use-auth';
import { useMinSideProfileData } from '@/hooks/use-min-side-profile-data';
import { minSideSectionHref } from '@/lib/min-side/sections';
import { routes } from '@/lib/routes';
import { loginWithNext } from '@/lib/safe-redirect';
import type { LlmProvider } from '@/lib/byok/providers';

function MinSideLoginGate({ children }: { children: React.ReactNode }) {
  const { user, loading } = useAuth();
  const pathname = usePathname() ?? routes.minSide;
  if (loading) {
    return <p className="text-center text-sm text-muted-foreground">Laster…</p>;
  }
  if (!user) {
    return (
      <EmptyState
        title="Logg inn for å se Min side"
        description="Du må være logget inn for å se innstillinger og historikk."
        action={
          <Link
            href={loginWithNext(pathname)}
            className="inline-flex min-h-11 items-center rounded-xl bg-brand px-6 py-3 font-medium text-brand-foreground hover:bg-brand/90"
          >
            <LogIn className="mr-2 h-5 w-5" />
            Logg inn
          </Link>
        }
      />
    );
  }
  return children;
}

export function MinSideStemmerPage() {
  const data = useMinSideProfileData();
  const [votes, setVotes] = useState<VoteHistoryItem[]>([]);
  const [votesLoading, setVotesLoading] = useState(true);
  const [votesError, setVotesError] = useState(false);

  useEffect(() => {
    fetch('/api/user/vote-history')
      .then((res) => {
        if (!res.ok) {
          setVotesError(true);
          return null;
        }
        return res.json();
      })
      .then((json) => {
        if (json === null) return;
        if (Array.isArray(json)) setVotes(json);
        else setVotesError(true);
      })
      .catch(() => setVotesError(true))
      .finally(() => setVotesLoading(false));
  }, []);

  const engagedCount = data.stanceHistory.filter((item) => item.stance !== 'ikke_interessert').length;

  return (
    <MinSideLoginGate>
      <div className="space-y-6">
        <PageHeader
          as="h2"
          title="Mine stemmer og meninger"
          description="Holdninger på saker, avstemninger, valgomat og hjertesaker."
        />
        <ProfileFylkePicker fylkeCode={data.fylkeCode} onSaved={data.onFylkeSaved} />
        <ProfileStanceHistory items={data.stanceHistory} loading={data.historyLoading} />
        <ProfileVoteHistory items={votes} loading={votesLoading} error={votesError} />
        <ProfileValgomat stanceCount={engagedCount} />
        <ProfileInterests
          interestCategories={data.interestCategories}
          onCategoriesChange={data.setInterestCategories}
          interestLabels={data.interestLabels}
          onLabelsChange={data.setInterestLabels}
          saving={data.categoriesSaving}
          labelsSaving={data.labelsSaving}
          onSave={data.onCategoriesSave}
          onLabelsSave={data.onLabelsSave}
        />
      </div>
    </MinSideLoginGate>
  );
}

export function MinSideVarslerPage() {
  const data = useMinSideProfileData();

  return (
    <MinSideLoginGate>
      <div className="space-y-6">
        <PageHeader
          as="h2"
          title="Varsler"
          description="E-post og app-innstillinger. Bjellen i toppmenyen påvirkes ikke her."
        />
        <ProfileCard title="Push-varsler" description="Kommer senere.">
          <p className="text-sm text-muted-foreground">
            Push-varsler er ikke slått på i appen ennå. Du får fortsatt varsler i appen via bjellen
            når det er aktivitet å vise.
          </p>
        </ProfileCard>
        <ProfileNotifications
          emailEnabled={data.notifEmailEnabled}
          onEmailEnabledChange={data.onNotifEmailChange}
          frequencies={data.notifFreq}
          onFrequencyChange={data.onNotifFreqChange}
          saving={data.notifSaving}
          onSave={data.onNotifSave}
          isStemmePlus={data.isStemmePlus}
        />
        <ProfileAppPreferences />
      </div>
    </MinSideLoginGate>
  );
}

export function MinSideStemmePlusPage({
  checkoutConfigured,
  isAdmin,
}: {
  checkoutConfigured: boolean;
  isAdmin: boolean;
}) {
  return (
    <MinSideLoginGate>
      <div className="space-y-6">
        <PageHeader
          as="h2"
          title="Stemme+"
          description="Støtt oss og få fordeler."
        />
        <ProfileStemmePlus checkoutConfigured={checkoutConfigured} isAdmin={isAdmin} showByok={false} />
        <p className="text-sm text-muted-foreground">
          <Link href={minSideSectionHref('nokler')} className="text-brand hover:underline">
            Språkmodellnøkkel
          </Link>{' '}
          administreres på egen side.
        </p>
      </div>
    </MinSideLoginGate>
  );
}

export function MinSideNoklerPage({ isAdmin }: { isAdmin: boolean }) {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [encryptionReady, setEncryptionReady] = useState(false);
  const [initial, setInitial] = useState<ByokMetaView>(null);

  useEffect(() => {
    fetch('/api/stemme-plus/status', { cache: 'no-store' })
      .then(async (res) => {
        const json = await res.json();
        if (!res.ok) throw new Error(typeof json.error === 'string' ? json.error : 'Kunne ikke hente status');
        setEncryptionReady(Boolean(json.byok_encryption_ready));
        setInitial(
          json.byok
            ? {
                provider: json.byok.provider as LlmProvider,
                model: json.byok.model,
                keyLast4: json.byok.key_last4,
              }
            : null,
        );
      })
      .catch((e) => setError(e instanceof Error ? e.message : 'Kunne ikke hente status'))
      .finally(() => setLoading(false));
  }, []);

  return (
    <MinSideLoginGate>
      <div className="space-y-6">
        <PageHeader
          as="h2"
          title="Språkmodellnøkkel"
          description="Koble egen modell til Stemme+-chatten."
        />
        {loading ? <p className="text-sm text-muted-foreground">Laster…</p> : null}
        {error ? (
          <p className="rounded-xl border border-border bg-muted/30 px-4 py-3 text-sm text-muted-foreground">
            Midlertidig utilgjengelig.
          </p>
        ) : (
          <ByokSettings encryptionReady={encryptionReady} initial={initial} isAdmin={isAdmin} />
        )}
      </div>
    </MinSideLoginGate>
  );
}

export function MinSidePersonvernPage({ userId }: { userId: string }) {
  return (
    <MinSideLoginGate>
      <div className="space-y-6">
        <PageHeader
          as="h2"
          title="Personvern og konto"
          description="Data, samtykke og kontoinnstillinger."
        />
        <ProfilePrivacy userId={userId} />
        <AccountDeletionSlot />
      </div>
    </MinSideLoginGate>
  );
}