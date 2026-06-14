import Link from 'next/link';
import { notFound } from 'next/navigation';
import { ArrowLeft, Clock, MessageSquare } from 'lucide-react';
import { getAnonSupabase } from '@/lib/supabase';
import {
  fetchStortingetHoringById,
  getHoringDeadline,
  getHoringTitle,
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
  const isOpen = deadline ? deadline > new Date() : true;
  const title = getHoringTitle(hearing);
  const komite = hearing.komite?.navn ?? 'Ukjent komité';

  return (
    <div className="max-w-5xl mx-auto space-y-8 pb-12">
      <Link
        href={routes.horinger}
        className="inline-flex items-center text-indigo-600 hover:text-indigo-800 font-medium"
      >
        <ArrowLeft className="w-4 h-4 mr-2" />
        Tilbake til høringer
      </Link>

      <div className="bg-white border border-gray-100 rounded-3xl p-8 shadow-sm">
        <div className="flex flex-wrap gap-2 mb-4">
          <span
            className={`inline-flex px-2.5 py-0.5 rounded-full text-xs font-semibold ${
              isOpen ? 'bg-emerald-100 text-emerald-800' : 'bg-gray-100 text-gray-800'
            }`}
          >
            {hearing.horing_status || (isOpen ? 'Åpen' : 'Avsluttet')}
          </span>
          <span className="text-sm text-gray-500">{komite}</span>
        </div>
        <h1 className="text-3xl font-bold text-[#00205b] mb-4">{title}</h1>
        {deadline && (
          <p className="text-sm text-gray-600 flex items-center gap-2 mb-4">
            <Clock className="w-4 h-4" />
            Frist for innspill:{' '}
            {deadline.toLocaleDateString('nb-NO', { day: 'numeric', month: 'long', year: 'numeric' })}
          </p>
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
            Ingen innspill ennå.
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

        {isOpen && <HearingCommentForm stortingetHearingId={String(hearing.id)} />}
      </section>
    </div>
  );
}
