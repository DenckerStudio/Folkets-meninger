'use client';

import { useEffect, useState } from 'react';
import { LogIn } from 'lucide-react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import type { User as SupabaseUser } from '@supabase/supabase-js';
import { useAuth } from '@/hooks/use-auth';
import { routes } from '@/lib/routes';
import { ProfileHero } from '@/components/profile/profile-hero';
import { ProfileOverview } from '@/components/profile/profile-overview';
import { ProfileStanceHistory } from '@/components/profile/profile-stance-history';
import type { StanceHistoryItem } from '@/lib/stances/types';
import { ProfileValgomat } from '@/components/profile/profile-valgomat';
import { ProfileInterests } from '@/components/profile/profile-interests';
import { ProfileNotifications } from '@/components/profile/profile-notifications';
import { ProfilePrivacy } from '@/components/profile/profile-privacy';
import { ProfileStemmePlus } from '@/components/profile/profile-stemme-plus';
import { ProfileFylkePicker } from '@/components/profile/profile-fylke-picker';
import { useIsAdmin } from '@/hooks/use-is-admin';
import { getProfileTabDescription, getProfileTabLabel, resolveProfileTab, type ProfileTabId } from '@/components/profile/profile-tabs';
import { ProfileAppPreferences } from '@/components/profile/profile-app-preferences';
import { BackButton } from '@/components/dashboard/back-button';
import { DashboardPage } from '@/components/dashboard/dashboard-page';
import { EmptyState } from '@/components/dashboard/empty-state';
import { PageHeader } from '@/components/page-header';
import type { EarnedBadge } from '@/lib/knowledge/types';
import type { UserPointsProgress } from '@/lib/user-points-levels';

export function ProfileShell() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const { user, loading: isPending, signOut } = useAuth();
  const tabParam = searchParams.get('tab');
  const activeTab = resolveProfileTab(tabParam);

  const [stanceHistory, setStanceHistory] = useState<StanceHistoryItem[]>([]);
  const [historyLoading, setHistoryLoading] = useState(true);
  const [interestCategories, setInterestCategories] = useState<string[]>([]);
  const [interestLabels, setInterestLabels] = useState<string[]>([]);
  const [categoriesSaving, setCategoriesSaving] = useState(false);
  const [labelsSaving, setLabelsSaving] = useState(false);
  const [notifEmailEnabled, setNotifEmailEnabled] = useState(true);
  const [notifFreq, setNotifFreq] = useState<Record<string, string>>({
    categories: 'daily',
    labels: 'daily',
  });
  const [notifSaving, setNotifSaving] = useState(false);
  const [points, setPoints] = useState(0);
  const [pointsProgress, setPointsProgress] = useState<UserPointsProgress | null>(null);
  const [badges, setBadges] = useState<EarnedBadge[]>([]);
  const [fylkeCode, setFylkeCode] = useState<string | null>(null);
  const [isStemmePlus, setIsStemmePlus] = useState(false);
  useEffect(() => {
    if (!user) {
      setHistoryLoading(false);
      return;
    }

    fetch('/api/user/stance-history')
      .then((res) => res.json())
      .then((data) => {
        if (Array.isArray(data)) setStanceHistory(data);
      })
      .catch(() => {})
      .finally(() => setHistoryLoading(false));
  }, [user]);

  useEffect(() => {
    if (!user) return;
    fetch('/api/notifications/categories', { cache: 'no-store' })
      .then((res) => res.json())
      .then((json) => {
        if (Array.isArray(json.categories)) setInterestCategories(json.categories);
      })
      .catch(() => {});

    fetch('/api/notifications/labels', { cache: 'no-store' })
      .then((res) => res.json())
      .then((json) => {
        if (Array.isArray(json.labels)) setInterestLabels(json.labels);
      })
      .catch(() => {});

    fetch('/api/user/profile', { cache: 'no-store' })
      .then((res) => res.json())
      .then((json) => {
        if (typeof json.points === 'number') setPoints(json.points);
        if (json.points_progress) setPointsProgress(json.points_progress);
        if (Array.isArray(json.badges)) setBadges(json.badges);
        if (typeof json.fylke_code === 'string' || json.fylke_code === null) {
          setFylkeCode(json.fylke_code);
        }
        if (typeof json.stemme_plus === 'boolean') {
          setIsStemmePlus(json.stemme_plus);
        }
      })
      .catch(() => {});

    fetch('/api/stemme-plus/status', { cache: 'no-store' })
      .then((res) => res.json())
      .then((json) => {
        if (json.tier === 'stemme_plus') setIsStemmePlus(true);
      })
      .catch(() => {});

    fetch('/api/notifications/preferences', { cache: 'no-store' })
      .then((res) => res.json())
      .then((json) => {
        if (json.preferences) {
          if (typeof json.preferences.email_enabled === 'boolean') {
            setNotifEmailEnabled(json.preferences.email_enabled);
          }
          if (
            json.preferences.email_frequency_by_channel &&
            typeof json.preferences.email_frequency_by_channel === 'object'
          ) {
            setNotifFreq((prev) => ({
              ...prev,
              ...json.preferences.email_frequency_by_channel,
            }));
          }
        }
        if (typeof json.stemme_plus === 'boolean') {
          setIsStemmePlus(json.stemme_plus);
        }
      })
      .catch(() => {});
  }, [user]);

  const handleSignOut = async () => {
    await signOut();
    router.push('/');
    router.refresh();
  };

  if (isPending) {
    return <div className="p-8 text-center text-muted-foreground">Laster…</div>;
  }

  if (!user) {
    return <ProfileLoginPrompt />;
  }

  return (
    <ProfileShellAuthenticated
      user={user}
      activeTab={activeTab}
      stanceHistory={stanceHistory}
      historyLoading={historyLoading}
      interestCategories={interestCategories}
      interestLabels={interestLabels}
      categoriesSaving={categoriesSaving}
      labelsSaving={labelsSaving}
      notifEmailEnabled={notifEmailEnabled}
      notifFreq={notifFreq}
      notifSaving={notifSaving}
      onSignOut={handleSignOut}
      points={points}
      pointsProgress={pointsProgress}
      badges={badges}
      isStemmePlus={isStemmePlus}
      fylkeCode={fylkeCode}
      onFylkeSaved={(code) => {
        setFylkeCode(code);
        fetch('/api/user/profile', { cache: 'no-store' })
          .then((res) => res.json())
          .then((json) => {
            if (typeof json.points === 'number') setPoints(json.points);
            if (Array.isArray(json.badges)) setBadges(json.badges);
          })
          .catch(() => {});
      }}
      onCategoriesChange={setInterestCategories}
      onLabelsChange={setInterestLabels}
      onCategoriesSave={async () => {
        setCategoriesSaving(true);
        try {
          await fetch('/api/notifications/categories', {
            method: 'POST',
            headers: { 'content-type': 'application/json' },
            body: JSON.stringify({ categories: interestCategories }),
          });
        } finally {
          setCategoriesSaving(false);
        }
      }}
      onLabelsSave={async () => {
        setLabelsSaving(true);
        try {
          await fetch('/api/notifications/labels', {
            method: 'POST',
            headers: { 'content-type': 'application/json' },
            body: JSON.stringify({ labels: interestLabels }),
          });
        } finally {
          setLabelsSaving(false);
        }
      }}
      onNotifEmailChange={setNotifEmailEnabled}
      onNotifFreqChange={(channel, value) =>
        setNotifFreq((prev) => ({ ...prev, [channel]: value }))
      }
      onNotifSave={async () => {
        setNotifSaving(true);
        try {
          await fetch('/api/notifications/preferences', {
            method: 'POST',
            headers: { 'content-type': 'application/json' },
            body: JSON.stringify({
              email_enabled: notifEmailEnabled,
              email_frequency_by_channel: notifFreq,
            }),
          });
        } finally {
          setNotifSaving(false);
        }
      }}
    />
  );
}

function ProfileLoginPrompt() {
  return (
    <DashboardPage className="mx-auto max-w-md">
      <EmptyState
        title="Logg inn for å se din profil"
        description="Du må være logget inn for å se holdningshistorikk, valgomat og innstillinger."
        action={
          <Link
            href={routes.login}
            className="inline-flex items-center rounded-xl bg-brand px-6 py-3 font-medium text-brand-foreground hover:bg-brand/90"
          >
            <LogIn className="mr-2 h-5 w-5" />
            Logg inn
          </Link>
        }
      />
    </DashboardPage>
  );
}

type ProfileShellAuthenticatedProps = {
  user: SupabaseUser;
  activeTab: ProfileTabId | null;
  stanceHistory: StanceHistoryItem[];
  historyLoading: boolean;
  interestCategories: string[];
  interestLabels: string[];
  categoriesSaving: boolean;
  labelsSaving: boolean;
  notifEmailEnabled: boolean;
  notifFreq: Record<string, string>;
  notifSaving: boolean;
  onSignOut: () => void;
  points: number;
  pointsProgress: UserPointsProgress | null;
  badges: EarnedBadge[];
  isStemmePlus: boolean;
  fylkeCode: string | null;
  onFylkeSaved: (code: string | null) => void;
  onCategoriesChange: (next: string[]) => void;
  onLabelsChange: (next: string[]) => void;
  onCategoriesSave: () => Promise<void>;
  onLabelsSave: () => Promise<void>;
  onNotifEmailChange: (value: boolean) => void;
  onNotifFreqChange: (channel: string, value: string) => void;
  onNotifSave: () => Promise<void>;
};

function ProfileShellAuthenticated({
  user,
  activeTab,
  stanceHistory,
  historyLoading,
  interestCategories,
  interestLabels,
  categoriesSaving,
  labelsSaving,
  notifEmailEnabled,
  notifFreq,
  notifSaving,
  onSignOut,
  points,
  pointsProgress,
  badges,
  isStemmePlus,
  fylkeCode,
  onFylkeSaved,
  onCategoriesChange,
  onLabelsChange,
  onCategoriesSave,
  onLabelsSave,
  onNotifEmailChange,
  onNotifFreqChange,
  onNotifSave,
}: ProfileShellAuthenticatedProps) {
  const isAdminUser = useIsAdmin();

  return (
    <DashboardPage className="mx-auto max-w-5xl px-1">
      {activeTab === null ? (
        <>
          <ProfileHero
            user={user}
            stanceCount={stanceHistory.filter((item) => item.stance !== 'ikke_interessert').length}
            points={points}
            pointsProgress={pointsProgress}
            badges={badges}
            isStemmePlus={isStemmePlus}
            onSignOut={onSignOut}
          />
          <ProfileFylkePicker fylkeCode={fylkeCode} onSaved={onFylkeSaved} />
          <ProfileOverview showAdminLink={isAdminUser} />
        </>
      ) : (
        <div className="min-w-0 space-y-6">
          <div className="space-y-3">
            <BackButton fallbackHref={routes.minSide} />
            <PageHeader
              as="h2"
              title={getProfileTabLabel(activeTab)}
              description={getProfileTabDescription(activeTab)}
            />
          </div>

          {activeTab === 'historikk' && (
            <ProfileStanceHistory items={stanceHistory} loading={historyLoading} />
          )}
          {activeTab === 'valgomat' && (
            <ProfileValgomat
              stanceCount={stanceHistory.filter((item) => item.stance !== 'ikke_interessert').length}
            />
          )}
          {activeTab === 'innstillinger' && (
            <>
              <ProfileFylkePicker fylkeCode={fylkeCode} onSaved={onFylkeSaved} />
              <ProfileInterests
                interestCategories={interestCategories}
                onCategoriesChange={onCategoriesChange}
                interestLabels={interestLabels}
                onLabelsChange={onLabelsChange}
                saving={categoriesSaving}
                labelsSaving={labelsSaving}
                onSave={onCategoriesSave}
                onLabelsSave={onLabelsSave}
              />
            </>
          )}
          {activeTab === 'preferanser' && (
            <div className="space-y-6">
              <ProfileAppPreferences />
              <ProfileNotifications
                emailEnabled={notifEmailEnabled}
                onEmailEnabledChange={onNotifEmailChange}
                frequencies={notifFreq}
                onFrequencyChange={onNotifFreqChange}
                saving={notifSaving}
                onSave={onNotifSave}
                isStemmePlus={isStemmePlus}
              />
            </div>
          )}
          {activeTab === 'stemme-plus' && <ProfileStemmePlus />}
          {activeTab === 'min-data' && <ProfilePrivacy userId={user.id} />}
        </div>
      )}
    </DashboardPage>
  );
}
