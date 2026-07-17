import Link from 'next/link';
import { notFound } from 'next/navigation';
import {
  Calendar,
  Clock,
  ExternalLink,
  MapPin,
  MessageSquare,
  Users,
} from 'lucide-react';
import { BackButton } from '@/components/dashboard/back-button';
import { getAnonSupabase } from '@/lib/supabase';
import {
  fetchStortingetHoringById,
  formatDateNb,
  formatHoringDeadlineSummary,
  formatStortingetDateTime,
  getDaysUntilHoringDeadline,
  getHoringApplicationDeadline,
  getHoringInnspillDeadline,
  getHoringStartDate,
  getHoringStatusBadgeClass,
  getHoringStatusKind,
  getHoringStatusLabel,
  getHoringSubtitle,
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
  const innspillDeadline = getHoringInnspillDeadline(hearing);
  const applicationDeadline = getHoringApplicationDeadline(hearing);
  const startDate = getHoringStartDate(hearing);
  const open = isHoringOpen(hearing);
  const kind = getHoringStatusKind(hearing);
  const title = getHoringTitle(hearing);
  const subtitle = getHoringSubtitle(hearing);
  const komite = hearing.komite?.navn ?? 'Ukjent komité';
  const saker = hearing.horing_sak_info_liste ?? [];
  const tidspunkter = hearing.horingstidspunkt_liste ?? [];
  const daysLeft = getDaysUntilHoringDeadline(hearing);
  const statusInfo = hearing.status_info_tekst?.trim();

  return (
    <div className="space-y-8 pb-12">
      <BackButton fallbackHref={routes.horinger} />

      <div className="bg-card border border-border rounded-3xl p-8 shadow-sm space-y-6">
        <div className="flex flex-wrap gap-2">
          <span
            className={`inline-flex px-2.5 py-0.5 rounded-full text-xs font-semibold ${getHoringStatusBadgeClass(kind)}`}
          >
            {getHoringStatusLabel(hearing)}
          </span>
          <span className="text-sm text-muted-foreground">{komite}</span>
          {hearing.skriftlig != null && (
            <span className="text-xs text-muted-foreground">
              {hearing.skriftlig ? 'Skriftlig høring' : 'Muntlig høring'}
            </span>
          )}
        </div>

        <div>
          <h1 className="text-3xl font-bold text-foreground">{title}</h1>
          {subtitle && subtitle !== title ? (
            <p className="mt-2 text-muted-foreground">{subtitle}</p>
          ) : null}
        </div>

        {open && daysLeft != null && daysLeft >= 0 ? (
          <div className="rounded-xl border border-emerald-200 bg-emerald-50 dark:border-emerald-900 dark:bg-emerald-950/40 px-4 py-3 text-sm text-emerald-900 dark:text-emerald-100">
            {daysLeft === 0
              ? 'Siste dag for å sende innspill.'
              : daysLeft === 1
                ? '1 dag igjen til fristen for innspill.'
                : `${daysLeft} dager igjen til fristen for innspill.`}
          </div>
        ) : null}

        {kind === 'planned' ? (
          <div className="rounded-xl border border-sky-200 bg-sky-50 dark:border-sky-900 dark:bg-sky-950/40 px-4 py-3 text-sm text-sky-900 dark:text-sky-100">
            Høringen er planlagt. Frist for innspill og eventuell søknadsfrist publiseres når Stortinget
            oppdaterer høringen.
          </div>
        ) : null}

        {statusInfo ? (
          <p className="text-sm text-muted-foreground border-l-2 border-border pl-4">{statusInfo}</p>
        ) : null}

        <dl className="grid sm:grid-cols-2 gap-4 text-sm">
          <div className="flex gap-2 rounded-xl border border-border bg-muted/30 p-4">
            <Clock className="w-4 h-4 text-muted-foreground mt-0.5 shrink-0" />
            <div>
              <dt className="text-muted-foreground">Frist for innspill</dt>
              <dd className="font-medium text-foreground">
                {innspillDeadline ? formatDateNb(innspillDeadline) : 'Ikke publisert'}
              </dd>
            </div>
          </div>
          <div className="flex gap-2 rounded-xl border border-border bg-muted/30 p-4">
            <Calendar className="w-4 h-4 text-muted-foreground mt-0.5 shrink-0" />
            <div>
              <dt className="text-muted-foreground">Søknadsfrist (muntlig deltakelse)</dt>
              <dd className="font-medium text-foreground">
                {applicationDeadline ? formatDateNb(applicationDeadline) : 'Ikke publisert'}
              </dd>
            </div>
          </div>
          {startDate ? (
            <div className="flex gap-2 rounded-xl border border-border bg-muted/30 p-4">
              <Calendar className="w-4 h-4 text-muted-foreground mt-0.5 shrink-0" />
              <div>
                <dt className="text-muted-foreground">Første høringsdag</dt>
                <dd className="font-medium text-foreground">{formatDateNb(startDate)}</dd>
              </div>
            </div>
          ) : null}
          <div className="flex gap-2 rounded-xl border border-border bg-muted/30 p-4 sm:col-span-2">
            <Users className="w-4 h-4 text-muted-foreground mt-0.5 shrink-0" />
            <div>
              <dt className="text-muted-foreground">Oppsummert</dt>
              <dd className="font-medium text-foreground">{formatHoringDeadlineSummary(hearing)}</dd>
            </div>
          </div>
        </dl>

        {tidspunkter.length > 0 && (
          <div>
            <h2 className="text-sm font-semibold text-foreground mb-3">Høringstidspunkter</h2>
            <ul className="space-y-2">
              {tidspunkter.map((tp, i) => (
                <li
                  key={i}
                  className="flex items-start gap-3 rounded-xl border border-border bg-muted/20 p-3 text-sm text-foreground"
                >
                  <MapPin className="w-4 h-4 text-muted-foreground mt-0.5 shrink-0" />
                  <span>
                    <span className="font-medium">
                      {formatStortingetDateTime(tp.tidspunkt) ?? 'Ukjent tidspunkt'}
                    </span>
                    {tp.sted ? <span className="text-muted-foreground"> — {tp.sted}</span> : null}
                  </span>
                </li>
              ))}
            </ul>
          </div>
        )}

        {saker.length > 0 && (
          <div>
            <h2 className="text-sm font-semibold text-foreground mb-3">Relaterte saker</h2>
            <ul className="space-y-3">
              {saker.map((sak) => {
                const pubUrl = normalizeStortingetUrl(sak.sak_publikasjon);
                return (
                  <li key={sak.sak_id ?? sak.sak_tittel} className="rounded-xl border border-border p-4">
                    <p className="font-medium text-foreground">{sak.sak_tittel ?? sak.sak_korttittel}</p>
                    {sak.sak_henvisning && (
                      <p className="text-xs text-muted-foreground mt-1">{sak.sak_henvisning}</p>
                    )}
                    <div className="mt-2 flex flex-wrap gap-3">
                      {sak.sak_id && (
                        <Link
                          href={routes.sak(String(sak.sak_id))}
                          className="text-sm font-medium text-indigo-600 hover:text-indigo-500 dark:text-indigo-400"
                        >
                          Se sak i Folkets Stemme
                        </Link>
                      )}
                      {pubUrl && (
                        <a
                          href={pubUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="inline-flex items-center gap-1 text-sm font-medium text-muted-foreground hover:text-foreground"
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

        <div className="flex flex-wrap gap-3">
          <Link
            href={`${routes.forum}?q=${encodeURIComponent(title.slice(0, 80))}`}
            className="inline-flex items-center gap-2 text-sm font-medium text-indigo-600 hover:text-indigo-500 dark:text-indigo-400"
          >
            <MessageSquare className="w-4 h-4" />
            Diskuter i forumet
          </Link>
        </div>

        <p className="text-sm text-muted-foreground bg-muted/40 border border-border rounded-lg p-3">
          Innspill her er offentlige og viser fornavn og etternavn. De sendes ikke automatisk til Stortinget —
          for offisielle høringsinnspill følg lenker på stortinget.no.
        </p>
      </div>

      <section className="space-y-4">
        <h2 className="text-lg font-bold text-foreground flex items-center gap-2">
          <MessageSquare className="w-5 h-5" />
          Innspill i Folkets Stemme ({comments.length})
        </h2>

        {comments.length === 0 ? (
          <p className="text-sm text-muted-foreground py-6 text-center border border-dashed border-border rounded-xl">
            {open
              ? 'Ingen innspill ennå. Vær den første til å dele din mening.'
              : 'Ingen innspill ennå på denne høringen.'}
          </p>
        ) : (
          <div className="space-y-3">
            {comments.map((comment) => (
              <article key={comment.id} className="bg-card border border-border rounded-xl p-4">
                {comment.author ? (
                  <ForumAuthorBadge author={comment.author} className="mb-2" />
                ) : null}
                <p className="text-foreground text-sm whitespace-pre-wrap">{comment.body}</p>
                <p className="text-xs text-muted-foreground mt-2">{comment.createdAt}</p>
              </article>
            ))}
          </div>
        )}

        {open ? (
          <HearingCommentForm stortingetHearingId={String(hearing.id)} />
        ) : (
          <p className="text-sm text-muted-foreground text-center py-4 rounded-xl border border-border bg-muted/20">
            {kind === 'planned'
              ? 'Du kan gi innspill her når høringen åpner og frist er publisert.'
              : 'Denne høringen tar ikke lenger imot innspill.'}
          </p>
        )}
      </section>
    </div>
  );
}
