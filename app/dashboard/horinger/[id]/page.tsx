import Link from 'next/link';
import { notFound } from 'next/navigation';
import { ArrowLeft, Calendar, Clock, ExternalLink, MapPin, MessageSquare } from 'lucide-react';
import { getAnonSupabase } from '@/lib/supabase';
import {
  fetchStortingetHoringById,
  formatStortingetDate,
  formatStortingetDateTime,
  getHoringDeadline,
  getHoringTitle,
  isHoringOpen,
  normalizeStortingetUrl,
} from '@/lib/stortinget-horinger';
import { resolveHearingCommentAuthor } from '@/lib/forum/author-display';
import { ForumAuthorBadge } from '@/components/forum/forum-author-badge';
import { routes } from '@/lib/routes';
import HearingCommentForm from './comment-form';

export const dynamic = 'force-dynamic';

async function getComments(stortingetHearingId: string) {
  if (!process.env.NEXT_PUBLIC_SUPABASE_URL || !process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY) {
    return [];
  }

  const supabase = getAnonSupabase();
  const { data: comments } = await supabase
    .from('hearing_comments')
    .select(`
      id,
      body,
      created_at,
      author_user_id,
      users:author_user_id (first_name, last_name, name)
    `)
    .eq('stortinget_hearing_id', stortingetHearingId)
    .order('created_at', { ascending: true });

  return (comments || []).map((c) => ({
    id: c.id,
    body: c.body,
    createdAt: new Date(c.created_at).toLocaleDateString('nb-NO', {
      day: 'numeric',
      month: 'long',
      year: 'numeric',
    }),
    author: resolveHearingCommentAuthor(c.users),
  }));
}

export default async function HoringDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const hearing = await fetchStortingetHoringById(id);

  if (!hearing) {
    notFound();
  }

  const comments = await getComments(String(hearing.id));
  const deadline = getHoringDeadline(hearing);
  const open = isHoringOpen(hearing);
  const title = getHoringTitle(hearing);
  const komite = hearing.komite?.navn ?? 'Ukjent komité';
  const saker = hearing.horing_sak_info_liste ?? [];
  const tidspunkter = hearing.horingstidspunkt_liste ?? [];

  return (
    <div className="space-y-8 pb-12">
      <Link
        href={routes.horinger}
        className="inline-flex items-center text-indigo-600 hover:text-indigo-800 font-medium text-sm"
      >
        <ArrowLeft className="w-4 h-4 mr-2" />
        Tilbake til høringer
      </Link>

      <div className="bg-white border border-gray-100 rounded-3xl p-8 shadow-sm space-y-6">
        <div className="flex flex-wrap gap-2">
          <span
            className={`inline-flex px-2.5 py-0.5 rounded-full text-xs font-semibold ${
              open ? 'bg-emerald-100 text-emerald-800' : 'bg-gray-100 text-gray-800'
            }`}
          >
            {open ? 'Åpen for innspill' : hearing.horing_status || 'Avholdt'}
          </span>
          <span className="text-sm text-gray-500">{komite}</span>
          {hearing.skriftlig != null && (
            <span className="text-xs text-gray-400">{hearing.skriftlig ? 'Skriftlig høring' : 'Muntlig høring'}</span>
          )}
        </div>

        <h1 className="text-3xl font-bold text-[#00205b]">{title}</h1>

        <dl className="grid sm:grid-cols-2 gap-4 text-sm">
          {deadline && (
            <div className="flex gap-2">
              <Clock className="w-4 h-4 text-gray-400 mt-0.5 shrink-0" />
              <div>
                <dt className="text-gray-500">Frist for innspill</dt>
                <dd className="font-medium text-gray-900">
                  {deadline.toLocaleDateString('nb-NO', { day: 'numeric', month: 'long', year: 'numeric' })}
                </dd>
              </div>
            </div>
          )}
          {formatStortingetDate(hearing.soknadfrist_dato ?? undefined) && (
            <div className="flex gap-2">
              <Calendar className="w-4 h-4 text-gray-400 mt-0.5 shrink-0" />
              <div>
                <dt className="text-gray-500">Søknadsfrist (muntlig deltakelse)</dt>
                <dd className="font-medium text-gray-900">
                  {formatStortingetDate(hearing.soknadfrist_dato ?? undefined)}
                </dd>
              </div>
            </div>
          )}
        </dl>

        {tidspunkter.length > 0 && (
          <div>
            <h2 className="text-sm font-semibold text-gray-900 mb-2">Høringstidspunkter</h2>
            <ul className="space-y-2">
              {tidspunkter.map((tp, i) => (
                <li key={i} className="flex items-start gap-2 text-sm text-gray-700">
                  <MapPin className="w-4 h-4 text-gray-400 mt-0.5 shrink-0" />
                  <span>
                    {formatStortingetDateTime(tp.tidspunkt) ?? 'Ukjent tidspunkt'}
                    {tp.sted ? ` — ${tp.sted}` : ''}
                  </span>
                </li>
              ))}
            </ul>
          </div>
        )}

        {saker.length > 0 && (
          <div>
            <h2 className="text-sm font-semibold text-gray-900 mb-2">Relaterte saker</h2>
            <ul className="space-y-3">
              {saker.map((sak) => {
                const pubUrl = normalizeStortingetUrl(sak.sak_publikasjon);
                return (
                  <li key={sak.sak_id ?? sak.sak_tittel} className="rounded-xl border border-gray-100 p-4">
                    <p className="font-medium text-gray-900">{sak.sak_tittel ?? sak.sak_korttittel}</p>
                    {sak.sak_henvisning && (
                      <p className="text-xs text-gray-500 mt-1">{sak.sak_henvisning}</p>
                    )}
                    <div className="mt-2 flex flex-wrap gap-3">
                      {sak.sak_id && (
                        <Link
                          href={routes.sak(String(sak.sak_id))}
                          className="text-sm font-medium text-indigo-600 hover:text-indigo-500"
                        >
                          Se sak i Folkets Stemme
                        </Link>
                      )}
                      {pubUrl && (
                        <a
                          href={pubUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="inline-flex items-center gap-1 text-sm font-medium text-gray-600 hover:text-gray-900"
                        >
                          På stortinget.no
                          <ExternalLink className="w-3.5 h-3.5" />
                        </a>
                      )}
                    </div>
                  </li>
                );
              })}
            </ul>
          </div>
        )}

        <p className="text-sm text-gray-600 bg-indigo-50 border border-indigo-100 rounded-lg p-3">
          Innspill på høringer er offentlige og viser fornavn og etternavn. De sendes ikke automatisk til Stortinget.
        </p>
      </div>

      <section className="space-y-4">
        <h2 className="text-lg font-bold text-gray-900 flex items-center gap-2">
          <MessageSquare className="w-5 h-5" />
          Innspill ({comments.length})
        </h2>

        {comments.length === 0 ? (
          <p className="text-sm text-gray-500 py-6 text-center border border-dashed rounded-xl">
            Ingen innspill ennå. Vær den første til å dele din mening.
          </p>
        ) : (
          <div className="space-y-3">
            {comments.map((comment) => (
              <article key={comment.id} className="bg-white border border-gray-200 rounded-xl p-4">
                {comment.author ? (
                  <ForumAuthorBadge author={comment.author} className="mb-2" />
                ) : null}
                <p className="text-gray-700 text-sm whitespace-pre-wrap">{comment.body}</p>
                <p className="text-xs text-gray-400 mt-2">{comment.createdAt}</p>
              </article>
            ))}
          </div>
        )}

        {open && <HearingCommentForm stortingetHearingId={String(hearing.id)} />}
      </section>
    </div>
  );
}
