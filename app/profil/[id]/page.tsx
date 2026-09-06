import { EyeOff, ShieldCheck, UserCircle } from 'lucide-react';
import { notFound } from 'next/navigation';
import { BackButton } from '@/components/dashboard/back-button';
import { KnowledgeBadges } from '@/components/profile/knowledge-badges';
import { StemmePlusBadge } from '@/components/profile/stemme-plus-badge';
import { activityVisibilityLabel } from '@/lib/identity/activity-visibility';
import { getPublicProfile } from '@/lib/public-profile';
import { routes } from '@/lib/routes';

export const dynamic = 'force-dynamic';

export default async function PublicProfilePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const profile = await getPublicProfile(id);

  if (!profile) {
    notFound();
  }

  const shareActivity =
    profile.activityVisibility === 'summary' || profile.activityVisibility === 'full';

  return (
    <div className="mx-auto max-w-3xl space-y-6 pb-12">
      <BackButton fallbackHref={routes.utforsk} />

      <section className="rounded-2xl border border-border bg-card p-6 shadow-sm">
        <div className="flex min-w-0 items-center gap-4">
          <div className="flex h-16 w-16 shrink-0 items-center justify-center rounded-2xl bg-brand text-xl font-bold text-white">
            {profile.initials}
          </div>
          <div className="min-w-0">
            <p className="mb-1 inline-flex items-center gap-1.5 rounded-full bg-muted px-2.5 py-1 text-xs font-semibold text-muted-foreground">
              <UserCircle className="h-3.5 w-3.5" />
              Offentlig profil
            </p>
            <h1 className="truncate text-2xl font-bold tracking-tight text-foreground sm:text-3xl">
              {profile.displayName}
            </h1>
            {profile.isStemmePlusSupporter ? (
              <div className="mt-2">
                <StemmePlusBadge size="md" />
              </div>
            ) : null}
          </div>
        </div>
      </section>

      <section className="rounded-xl border border-border bg-card p-6 shadow-sm">
        <h2 className="text-lg font-semibold text-foreground">Om brukeren</h2>
        {profile.isPublic ? (
          <p className="mt-3 text-sm leading-6 text-foreground">
            {profile.bio || 'Brukeren har ikke skrevet bio ennå.'}
          </p>
        ) : (
          <div className="mt-4 flex gap-3 rounded-xl border border-border bg-muted/40 p-4 text-sm leading-6 text-muted-foreground">
            <EyeOff className="mt-0.5 h-5 w-5 shrink-0" />
            <p>Brukeren har ikke delt bio eller preferanser offentlig.</p>
          </div>
        )}
        {profile.partyPreference ? (
          <p className="mt-4 text-sm text-muted-foreground">
            Partipreferanse: <span className="font-medium text-foreground">{profile.partyPreference}</span>
          </p>
        ) : null}
      </section>

      <section className="rounded-xl border border-border bg-card p-6 shadow-sm">
        <h2 className="text-lg font-semibold text-foreground">Aktivitet</h2>
        <p className="mt-1 text-sm text-muted-foreground">
          Deling: {activityVisibilityLabel(profile.activityVisibility)}
        </p>
        {shareActivity ? (
          <>
            <dl className="mt-4 grid grid-cols-2 gap-3">
              <StatCard label="Stemmer avgitt" value={profile.stats.votesCast ?? 0} />
              <StatCard label="Høringsinnspill" value={profile.stats.hearingComments ?? 0} />
            </dl>
            {profile.badges.length > 0 ? (
              <div className="mt-5">
                <h3 className="mb-3 text-sm font-semibold text-foreground">Kunnskapsmerker</h3>
                <KnowledgeBadges earned={profile.badges} />
              </div>
            ) : null}
          </>
        ) : (
          <p className="mt-4 text-sm text-muted-foreground">
            Brukeren har valgt å ikke dele aktivitet offentlig.
          </p>
        )}
      </section>

      <section className="rounded-xl border border-border bg-muted/30 p-5">
        <div className="flex items-start gap-3">
          <ShieldCheck className="mt-0.5 h-5 w-5 text-brand" />
          <div>
            <p className="text-sm font-semibold text-foreground">Personvern først</p>
            <p className="mt-1 text-sm leading-6 text-muted-foreground">
              Stemmevalg forblir anonyme. Offentlig aktivitet er valgfri og viser aldri hva du stemte.
            </p>
          </div>
        </div>
      </section>
    </div>
  );
}

function StatCard({ label, value }: { label: string; value: number | string }) {
  return (
    <div className="rounded-xl border border-border bg-card px-4 py-3">
      <dt className="text-xs font-medium uppercase tracking-wide text-muted-foreground">{label}</dt>
      <dd className="mt-0.5 text-2xl font-bold text-brand">{value}</dd>
    </div>
  );
}
