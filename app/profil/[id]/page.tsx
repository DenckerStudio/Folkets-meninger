import Link from 'next/link';
import { EyeOff, MessageSquare, ShieldCheck, UserCircle } from 'lucide-react';
import { notFound } from 'next/navigation';
import { BackButton } from '@/components/dashboard/back-button';
import { PointsProgress, PointsTierBadge } from '@/components/profile/points-progress';
import { getPublicProfile } from '@/lib/public-profile';
import { routes } from '@/lib/routes';

export const dynamic = 'force-dynamic';

export default async function PublicProfilePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const profile = await getPublicProfile(id);

  if (!profile) {
    notFound();
  }

  return (
    <div className="mx-auto max-w-5xl space-y-6 pb-12">
      <BackButton fallbackHref={routes.forum} />

      <section className="rounded-2xl border border-gray-200 bg-gradient-to-br from-[#00205b]/5 via-white to-[#ba0c2f]/5 p-6 shadow-sm">
        <div className="flex flex-col gap-5 lg:flex-row lg:items-center lg:justify-between">
          <div className="flex min-w-0 items-center gap-4">
            <div className="flex h-16 w-16 shrink-0 items-center justify-center rounded-2xl bg-[#00205b] text-xl font-bold text-white shadow-md">
              {profile.initials}
            </div>
            <div className="min-w-0">
              <p className="mb-1 inline-flex items-center gap-1.5 rounded-full bg-white/80 px-2.5 py-1 text-xs font-semibold text-indigo-700 ring-1 ring-indigo-100">
                <UserCircle className="h-3.5 w-3.5" />
                Offentlig forumprofil
              </p>
              <h1 className="truncate text-2xl font-bold tracking-tight text-gray-900 sm:text-3xl">
                {profile.displayName}
              </h1>
              <div className="mt-2">
                <PointsTierBadge points={profile.points} />
              </div>
            </div>
          </div>

          <dl className="grid grid-cols-3 gap-3 lg:min-w-[22rem]">
            <StatCard label="Tråder" value={profile.stats.threads} />
            <StatCard label="Kommentarer" value={profile.stats.replies} />
            <StatCard label="Poeng" value={profile.points} />
          </dl>
        </div>
      </section>

      <PointsProgress points={profile.points} progress={profile.pointsProgress} compact />

      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_300px]">
        <div className="space-y-6">
          <section className="rounded-xl border border-gray-200 bg-white p-6 shadow-sm">
            <h2 className="text-lg font-semibold text-gray-900">Om brukeren</h2>
            {profile.isPublic ? (
              <p className="mt-3 text-sm leading-6 text-gray-700">
                {profile.bio || 'Brukeren har ikke skrevet bio ennå.'}
              </p>
            ) : (
              <div className="mt-4 flex gap-3 rounded-xl border border-blue-100 bg-blue-50 p-4 text-sm leading-6 text-blue-800">
                <EyeOff className="mt-0.5 h-5 w-5 shrink-0" />
                <p>
                  Bio og parti er ikke delt offentlig. Foruminnlegg, kommentarer og poeng vises fordi de er en del av
                  offentlig aktivitet.
                </p>
              </div>
            )}
          </section>

          <section className="rounded-xl border border-gray-200 bg-white p-6 shadow-sm">
            <h2 className="flex items-center gap-2 text-lg font-semibold text-gray-900">
              <MessageSquare className="h-5 w-5 text-gray-400" />
              Forumaktivitet
            </h2>

            {profile.activity.length === 0 ? (
              <p className="mt-4 text-sm text-gray-500">Ingen offentlige innlegg eller kommentarer ennå.</p>
            ) : (
              <div className="mt-5 space-y-3">
                {profile.activity.map((item) => (
                  <Link
                    key={`${item.kind}:${item.id}`}
                    href={routes.forumTopic(item.threadId)}
                    className="group block rounded-xl border border-gray-200 bg-white p-4 transition-colors hover:border-indigo-200 hover:bg-indigo-50/40"
                  >
                    <div className="flex flex-wrap items-center gap-2 text-xs text-gray-500">
                      <span className="rounded-full bg-indigo-50 px-2 py-0.5 font-semibold text-indigo-700 ring-1 ring-indigo-100">
                        {item.kind === 'thread' ? 'Tråd' : 'Kommentar'}
                      </span>
                      <span>·</span>
                      <span>{item.createdAtLabel}</span>
                    </div>
                    <h3 className="mt-2 font-semibold text-gray-900 group-hover:text-indigo-700">
                      {item.kind === 'thread' ? item.title : item.threadTitle}
                    </h3>
                    <p className="mt-1 line-clamp-2 text-sm leading-6 text-gray-600">{item.excerpt}</p>
                  </Link>
                ))}
              </div>
            )}
          </section>
        </div>

        <aside className="space-y-4">
          <section className="rounded-xl border border-gray-200 bg-white p-6 shadow-sm">
            <h2 className="text-sm font-semibold uppercase tracking-wide text-gray-500">Delte preferanser</h2>
            <div className="mt-4 space-y-3">
              <InfoRow label="Nivå" value={profile.pointsProgress.tier.name} />
              <InfoRow label="Poeng" value={`${profile.points} poeng`} />
              <InfoRow label="Parti" value={profile.partyPreference || 'Ikke delt'} />
            </div>
          </section>

          <section className="rounded-xl border border-emerald-100 bg-emerald-50 p-5">
            <div className="flex items-start gap-3">
              <ShieldCheck className="mt-0.5 h-5 w-5 text-emerald-600" />
              <div>
                <p className="text-sm font-semibold text-emerald-950">Personvern først</p>
                <p className="mt-1 text-sm leading-6 text-emerald-800">
                  Stemmer forblir anonyme og teller likt. Poeng viser aktivitet og tillit, ikke stemmevekt.
                </p>
              </div>
            </div>
          </section>

          {profile.pointsProgress.nextUnlock && (
            <section className="rounded-xl border border-amber-200 bg-amber-50 p-5 text-amber-950">
              <p className="text-sm font-semibold">Neste nivå</p>
              <p className="mt-2 text-sm leading-6 text-amber-800">{profile.pointsProgress.nextUnlock}</p>
              <p className="mt-3 text-sm font-bold tabular-nums text-amber-900">
                {profile.pointsProgress.progressLabel}
              </p>
            </section>
          )}
        </aside>
      </div>
    </div>
  );
}

function StatCard({ label, value }: { label: string; value: number | string }) {
  return (
    <div className="rounded-xl border border-gray-100 bg-white/85 px-4 py-3 shadow-sm">
      <dt className="text-xs font-medium uppercase tracking-wide text-gray-500">{label}</dt>
      <dd className="mt-0.5 text-2xl font-bold text-[#00205b]">{value}</dd>
    </div>
  );
}

function InfoRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between gap-3 rounded-xl bg-gray-50 px-3 py-2">
      <span className="text-sm text-gray-500">{label}</span>
      <span className="text-sm font-semibold text-gray-900">{value}</span>
    </div>
  );
}
