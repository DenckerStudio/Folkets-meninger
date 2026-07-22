'use client';

import { useEffect, useState } from 'react';
import { LogIn, User } from 'lucide-react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import type { User as SupabaseUser } from '@supabase/supabase-js';
import { useAuth } from '@/hooks/use-auth';
import { routes } from '@/lib/routes';
import { ProfileHero } from '@/components/profile/profile-hero';
import { ProfileSidebarNav } from '@/components/profile/profile-sidebar-nav';
import { ProfileVoteHistory, type VoteHistoryItem } from '@/components/profile/profile-vote-history';
import { ProfileValgomat } from '@/components/profile/profile-valgomat';
import type { ForumVoteHistorySummary } from '@/lib/forum/vote-history';
import { summarizeForumVoteHistory } from '@/lib/forum/vote-history';
import { ProfileInterests } from '@/components/profile/profile-interests';
import { ProfileNotifications } from '@/components/profile/profile-notifications';
import { ProfilePrivacy } from '@/components/profile/profile-privacy';
import { ProfilePublicSettings } from '@/components/profile/profile-public-settings';
import { ProfileAppPreferences } from '@/components/profile/profile-app-preferences';
import { isProfileTabId, type ProfileTabId } from '@/components/profile/profile-tabs';
import { getUserPointsProgress } from '@/lib/user-points-levels';
import type { UserPointsProgress } from '@/lib/user-points-levels';

function resolveTab(tabParam: string | null): ProfileTabId {
  if (isProfileTabId(tabParam)) return tabParam;
  return 'historikk';
}

export function ProfileShell() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const { user, loading: isPending, signOut } = useAuth();
  const tabParam = searchParams.get('tab');
  const activeTab = resolveTab(tabParam);

  const [voteHistory, setVoteHistory] = useState<VoteHistoryItem[]>([]);
  const [voteSummary, setVoteSummary] = useState<ForumVoteHistorySummary>(() =>
    summarizeForumVoteHistory([]),
  );
  const [historyLoading, setHistoryLoading] = useState(true);
  const [interestCategories, setInterestCategories] = useState<string[]>([]);
  const [interestLabels, setInterestLabels] = useState<string[]>([]);
  const [categoriesSaving, setCategoriesSaving] = useState(false);
  const [labelsSaving, setLabelsSaving] = useState(false);
  const [notifEmailEnabled, setNotifEmailEnabled] = useState(true);
  const [notifFreq, setNotifFreq] = useState<Record<string, string>>({
    forum: 'realtime',
    mentions: 'realtime',
    categories: 'daily',
    labels: 'daily',
  });
  const [notifSaving, setNotifSaving] = useState(false);
  const [points, setPoints] = useState(0);
  const [pointsProgress, setPointsProgress] = useState<UserPointsProgress>(() => getUserPointsProgress(0));

  useEffect(() => {
    if (!user) {
      setHistoryLoading(false);
      return;
    }

    fetch('/api/user/vote-history')
      .then((res) => res.json())
      .then((data) => {
        if (Array.isArray(data)) {
          setVoteHistory(data);
          setVoteSummary(summarizeForumVoteHistory(data));
          return;
        }
        if (Array.isArray(data.items)) {
          setVoteHistory(data.items);
        }
        if (data.summary) {
          setVoteSummary(data.summary);
        } else if (Array.isArray(data.items)) {
          setVoteSummary(summarizeForumVoteHistory(data.items));
        }
      })
      .catch(() => {})
      .finally(() => setHistoryLoading(false));
  }, [user]);

  useEffect(() => {
    if (!user) return;

    fetch('/api/user/profile', { cache: 'no-store' })
      .then((res) => res.json())
      .then((data) => {
        if (typeof data.points === 'number') {
          setPoints(data.points);
        }
        if (data.points_progress) {
          setPointsProgress(data.points_progress);
        } else if (typeof data.points === 'number') {
          setPointsProgress(getUserPointsProgress(data.points));
        }
      })
      .catch(() => {});
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
      })
      .catch(() => {});
  }, [user]);

  const handleSignOut = async () => {
    await signOut();
    router.push('/');
    router.refresh();
  };

  if (isPending) {
    return <div className="p-8 text-center text-gray-500">Laster…</div>;
  }

  if (!user) {
    return <ProfileLoginPrompt />;
  }

  return (
    <ProfileShellAuthenticated
      user={user}
      activeTab={activeTab}
      voteHistory={voteHistory}
      voteSummary={voteSummary}
      historyLoading={historyLoading}
      points={points}
      pointsProgress={pointsProgress}
      interestCategories={interestCategories}
      interestLabels={interestLabels}
      categoriesSaving={categoriesSaving}
      labelsSaving={labelsSaving}
      notifEmailEnabled={notifEmailEnabled}
      notifFreq={notifFreq}
      notifSaving={notifSaving}
      onSignOut={handleSignOut}
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
    <div className="max-w-md mx-auto mt-20 text-center space-y-6">
      <div className="w-20 h-20 bg-indigo-100 rounded-2xl flex items-center justify-center mx-auto">
        <User className="w-10 h-10 text-indigo-600" />
      </div>
      <h2 className="text-3xl font-bold text-gray-900">Logg inn for å se din profil</h2>
      <p className="text-gray-600">
        Du må være logget inn for å se ja/nei-historikk, valgomat og innstillinger.
      </p>
      <Link
        href={routes.login}
        className="inline-flex items-center px-6 py-3 bg-indigo-600 text-white font-medium rounded-xl hover:bg-indigo-700 transition-colors"
      >
        <LogIn className="w-5 h-5 mr-2" />
        Logg inn
      </Link>
    </div>
  );
}

type ProfileShellAuthenticatedProps = {
  user: SupabaseUser;
  activeTab: ProfileTabId;
  voteHistory: VoteHistoryItem[];
  voteSummary: ForumVoteHistorySummary;
  historyLoading: boolean;
  points: number;
  pointsProgress: UserPointsProgress;
  interestCategories: string[];
  interestLabels: string[];
  categoriesSaving: boolean;
  labelsSaving: boolean;
  notifEmailEnabled: boolean;
  notifFreq: Record<string, string>;
  notifSaving: boolean;
  onSignOut: () => void;
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
  voteHistory,
  voteSummary,
  historyLoading,
  points,
  pointsProgress,
  interestCategories,
  interestLabels,
  categoriesSaving,
  labelsSaving,
  notifEmailEnabled,
  notifFreq,
  notifSaving,
  onSignOut,
  onCategoriesChange,
  onLabelsChange,
  onCategoriesSave,
  onLabelsSave,
  onNotifEmailChange,
  onNotifFreqChange,
  onNotifSave,
}: ProfileShellAuthenticatedProps) {
  const router = useRouter();
  const activeLabel =
    activeTab === 'historikk'
      ? 'Mine stemmer'
      : activeTab === 'valgomat'
        ? 'Valgomat 2.0'
        : activeTab === 'innstillinger'
          ? 'Mine hjertesaker'
        : activeTab === 'offentlig'
          ? 'Offentlig profil'
          : activeTab === 'preferanser'
            ? 'Preferanser'
          : activeTab === 'varsler'
            ? 'Varsler'
            : 'Privacy Hub';

  return (
    <div className="max-w-5xl mx-auto space-y-6 px-1">
      <ProfileHero
        user={user}
        voteCount={voteSummary.total}
        points={points}
        pointsProgress={pointsProgress}
        onSignOut={onSignOut}
      />
      <div className="lg:grid lg:grid-cols-[220px_minmax(0,1fr)] lg:gap-8">
        <aside className="hidden lg:block">
          <div className="sticky top-24">
            <ProfileSidebarNav activeTab={activeTab} />
          </div>
        </aside>

        <div className="min-w-0 space-y-4">
          <div className="lg:hidden">
            <label htmlFor="profile-tab-mobile" className="sr-only">
              Velg seksjon
            </label>
            <select
              id="profile-tab-mobile"
              value={activeTab}
              onChange={(e) => {
                const id = e.target.value;
                if (isProfileTabId(id)) {
                  router.replace(`${routes.minSide}?tab=${id}`, { scroll: false });
                }
              }}
              className="w-full rounded-xl border border-gray-200 bg-white px-3 py-2.5 text-sm font-medium text-gray-900"
            >
              <option value="historikk">Mine stemmer</option>
              <option value="valgomat">Valgomat 2.0</option>
              <option value="innstillinger">Mine hjertesaker</option>
              <option value="offentlig">Offentlig profil</option>
              <option value="preferanser">Preferanser</option>
              <option value="varsler">Varsler</option>
              <option value="min-data">Privacy Hub</option>
            </select>
          </div>

          <h2 className="text-lg font-semibold text-gray-900 lg:sr-only">{activeLabel}</h2>

          {activeTab === 'historikk' && (
            <ProfileVoteHistory
              items={voteHistory}
              summary={voteSummary}
              loading={historyLoading}
            />
          )}
          {activeTab === 'valgomat' && <ProfileValgomat summary={voteSummary} />}
          {activeTab === 'innstillinger' && (
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
          )}
          {activeTab === 'preferanser' && <ProfileAppPreferences />}
          {activeTab === 'varsler' && (
            <ProfileNotifications
              emailEnabled={notifEmailEnabled}
              onEmailEnabledChange={onNotifEmailChange}
              frequencies={notifFreq}
              onFrequencyChange={onNotifFreqChange}
              saving={notifSaving}
              onSave={onNotifSave}
            />
          )}
          {activeTab === 'offentlig' && <ProfilePublicSettings userId={user.id} />}
          {activeTab === 'min-data' && <ProfilePrivacy />}
        </div>
      </div>
    </div>
  );
}
