import Link from 'next/link';
import { EyeOff, MessageSquare, ShieldCheck, Sparkles, Trophy, UserCircle } from 'lucide-react';
import { notFound } from 'next/navigation';
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
    <div className="mx-auto max-w-6xl space-y-6 pb-12">
      <section className="overflow-hidden rounded-[2rem] border border-gray-200 bg-white shadow-sm">
        <div className="bg-[radial-gradient(circle_at_top_left,#dbeafe,transparent_35%),linear-gradient(135deg,#00205b,#4338ca_55%,#ba0c2f)] px-6 py-10 text-white sm:px-8">
          <div className="flex flex-col gap-6 sm:flex-row sm:items-end sm:justify-between">
            <div className="flex items-center gap-5">
              <div className="flex h-20 w-20 items-center justify-center rounded-3xl border border-white/30 bg-white/15 text-2xl font-black shadow-lg backdrop-blur">
                {profile.initials}
              </div>
              <div>
                <p className="mb-2 inline-flex items-center gap-1.5 rounded-full bg-white/15 px-3 py-1 text-xs font-semibold uppercase tracking-wide text-white/90">
                  <UserCircle className="h-3.5 w-3.5" />
                  Offentlig forumprofil
                </p>
                <h1 className="text-3xl font-black tracking-tight sm:text-4xl">{profile.displayName}</h1>
                <p className="mt-2 max-w-xl text-sm text-white/75">
                  Foruminnlegg, svar og offentlig valgte preferanser samlet på ett sted.
                </p>
              </div>
            </div>

            <div className="grid grid-cols-3 gap-3 sm:min-w-96">
              <StatCard label="Tråder" value={profile.stats.threads} />
              <StatCard label="Kommentarer" value={profile.stats.replies} />
              <StatCard label="Poeng" value={profile.points ?? 'Skjult'} />
            </div>
          </div>
        </div>

        <div className="grid gap-6 p-6 lg:grid-cols-[minmax(0,1fr)_320px] sm:p-8">
          <div className="space-y-6">
            <div className="rounded-2xl border border-gray-200 bg-gray-50 p-6">
              <div className="mb-3 flex items-center gap-2">
                <Sparkles className="h-5 w-5 text-indigo-600" />
                <h2 className="text-lg font-bold text-gray-900">Om brukeren</h2>
              </div>
              {profile.isPublic ? (
                <p className="text-sm leading-6 text-gray-700">
                  {profile.bio || 'Brukeren har ikke skrevet bio ennå.'}
                </p>
              ) : (
                <div className="flex gap-3 rounded-xl border border-blue-100 bg-blue-50 p-4 text-sm text-blue-800">
                  <EyeOff className="mt-0.5 h-5 w-5 shrink-0" />
                  <p>
                    Bio, parti og poeng er ikke delt offentlig. Foruminnlegg og kommentarer vises fordi de allerede er offentlige.
                  </p>
                </div>
              )}
            </div>

            <section className="rounded-2xl border border-gray-200 bg-white p-6">
              <h2 className="flex items-center gap-2 text-lg font-bold text-gray-900">
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
                      className="group block rounded-2xl border border-gray-200 bg-gray-50 p-4 transition-colors hover:border-indigo-200 hover:bg-indigo-50/50"
                    >
                      <div className="flex flex-wrap items-center gap-2 text-xs text-gray-500">
                        <span className="rounded-full bg-white px-2 py-0.5 font-semibold text-indigo-700 ring-1 ring-indigo-100">
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
            <div className="rounded-2xl border border-gray-200 bg-white p-5 shadow-sm">
              <h2 className="mb-3 text-sm font-bold uppercase tracking-wide text-gray-500">Delte preferanser</h2>
              <div className="space-y-3">
                <InfoRow label="Parti" value={profile.partyPreference || 'Ikke delt'} />
                <InfoRow label="Poeng" value={profile.points !== null ? `${profile.points} poeng` : 'Ikke delt'} />
              </div>
            </div>

            <div className="rounded-2xl border border-emerald-100 bg-emerald-50 p-5">
              <div className="flex items-start gap-3">
                <ShieldCheck className="mt-0.5 h-5 w-5 text-emerald-600" />
                <div>
                  <p className="text-sm font-bold text-emerald-950">Personvern først</p>
                  <p className="mt-1 text-sm leading-6 text-emerald-800">
                    Stemmer forblir anonyme. Profilfelt deles bare når brukeren velger det.
                  </p>
                </div>
              </div>
            </div>

            {profile.points !== null && (
              <div className="rounded-2xl border border-amber-200 bg-amber-50 p-5 text-amber-950">
                <div className="flex items-center gap-2">
                  <Trophy className="h-5 w-5" />
                  <p className="text-sm font-bold">Aktiv bidragsyter</p>
                </div>
                <p className="mt-2 text-sm leading-6 text-amber-800">
                  Poeng kommer fra forumaktivitet, likes og deltakelse.
                </p>
              </div>
            )}
          </aside>
        </div>
      </section>
    </div>
  );
}

function StatCard({ label, value }: { label: string; value: number | string }) {
  return (
    <div className="rounded-2xl border border-white/15 bg-white/10 px-3 py-3 text-center backdrop-blur">
      <div className="text-xl font-black">{value}</div>
      <div className="mt-0.5 text-[11px] font-semibold uppercase tracking-wide text-white/70">{label}</div>
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
