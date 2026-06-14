import Link from 'next/link';
import { MessageSquare, Trophy, UserCircle } from 'lucide-react';
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
    <div className="mx-auto max-w-4xl space-y-6 pb-12">
      <section className="rounded-2xl border border-gray-200 bg-white p-6 shadow-sm">
        <div className="flex flex-col gap-5 sm:flex-row sm:items-start sm:justify-between">
          <div className="flex items-center gap-4">
            <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-indigo-600 text-xl font-bold text-white">
              {profile.initials}
            </div>
            <div>
              <h1 className="text-2xl font-bold text-gray-900">{profile.displayName}</h1>
              <p className="mt-1 flex items-center gap-1.5 text-sm text-gray-500">
                <UserCircle className="h-4 w-4" />
                Offentlig forumprofil
              </p>
            </div>
          </div>

          {profile.points !== null && (
            <div className="inline-flex items-center gap-2 rounded-xl border border-amber-200 bg-amber-50 px-4 py-2 text-amber-900">
              <Trophy className="h-5 w-5" />
              <span className="text-sm font-semibold">{profile.points} poeng</span>
            </div>
          )}
        </div>

        {profile.isPublic ? (
          <div className="mt-6 grid gap-4 sm:grid-cols-2">
            <div className="rounded-xl border border-gray-100 bg-gray-50 p-4">
              <h2 className="text-sm font-semibold uppercase tracking-wide text-gray-500">Bio</h2>
              <p className="mt-2 text-sm text-gray-700">
                {profile.bio || 'Brukeren har ikke skrevet bio ennå.'}
              </p>
            </div>
            <div className="rounded-xl border border-gray-100 bg-gray-50 p-4">
              <h2 className="text-sm font-semibold uppercase tracking-wide text-gray-500">Partipreferanse</h2>
              <p className="mt-2 text-sm text-gray-700">
                {profile.partyPreference || 'Ikke delt offentlig.'}
              </p>
            </div>
          </div>
        ) : (
          <div className="mt-6 rounded-xl border border-blue-100 bg-blue-50 p-4 text-sm text-blue-800">
            Brukeren har ikke gjort bio, parti og poeng offentlig. Foruminnlegg og kommentarer vises fordi de allerede er offentlige.
          </div>
        )}

        <dl className="mt-6 grid grid-cols-2 gap-3 sm:max-w-sm">
          <div className="rounded-xl border border-gray-100 bg-white px-4 py-3">
            <dt className="text-xs font-medium uppercase tracking-wide text-gray-500">Tråder</dt>
            <dd className="mt-1 text-2xl font-bold text-gray-900">{profile.stats.threads}</dd>
          </div>
          <div className="rounded-xl border border-gray-100 bg-white px-4 py-3">
            <dt className="text-xs font-medium uppercase tracking-wide text-gray-500">Kommentarer</dt>
            <dd className="mt-1 text-2xl font-bold text-gray-900">{profile.stats.replies}</dd>
          </div>
        </dl>
      </section>

      <section className="rounded-2xl border border-gray-200 bg-white p-6 shadow-sm">
        <h2 className="flex items-center gap-2 text-lg font-bold text-gray-900">
          <MessageSquare className="h-5 w-5 text-gray-400" />
          Forumaktivitet
        </h2>

        {profile.activity.length === 0 ? (
          <p className="mt-4 text-sm text-gray-500">Ingen offentlige innlegg eller kommentarer ennå.</p>
        ) : (
          <div className="mt-4 space-y-3">
            {profile.activity.map((item) => (
              <Link
                key={`${item.kind}:${item.id}`}
                href={routes.forumTopic(item.threadId)}
                className="block rounded-xl border border-gray-200 p-4 transition-colors hover:border-indigo-200 hover:bg-indigo-50/30"
              >
                <div className="flex flex-wrap items-center gap-2 text-xs text-gray-500">
                  <span className="font-semibold text-indigo-700">
                    {item.kind === 'thread' ? 'Tråd' : 'Kommentar'}
                  </span>
                  <span>·</span>
                  <span>{item.createdAtLabel}</span>
                </div>
                <h3 className="mt-1 font-semibold text-gray-900">
                  {item.kind === 'thread' ? item.title : item.threadTitle}
                </h3>
                <p className="mt-1 line-clamp-2 text-sm text-gray-600">{item.excerpt}</p>
              </Link>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
