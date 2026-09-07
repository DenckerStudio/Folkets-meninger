'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { BackButton } from '@/components/dashboard/back-button';
import { StanceExpandModal } from '@/components/opinions/stance-expand-modal';
import { useAuth } from '@/hooks/use-auth';
import { formatOpinionDate, stanceLabel, STANCE_VISUAL } from '@/lib/opinions/labels';
import { OPINION_REPLY_BODY_MIN, type OpinionDetail, type OpinionStance } from '@/lib/opinions/types';
import { routes } from '@/lib/routes';
import { formatNumber } from '@/lib/utils';

type OpinionDetailClientProps = {
  opinion: OpinionDetail;
  isAuthor: boolean;
};

export function OpinionDetailClient({ opinion, isAuthor }: OpinionDetailClientProps) {
  const { user } = useAuth();
  const router = useRouter();
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const visual = STANCE_VISUAL[opinion.stance];

  const submit = async (stance: OpinionStance, body: string) => {
    if (!user) {
      router.push(`${routes.login}?next=${encodeURIComponent(routes.opinion(opinion.id))}`);
      return;
    }
    setBusy(true);
    setError('');
    try {
      const res = await fetch(`/api/opinions/${opinion.id}/stance`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ stance, body }),
      });
      const data = (await res.json()) as { error?: string };
      if (!res.ok) {
        setError(data.error || 'Kunne ikke lagre svaret');
        return;
      }
      router.refresh();
    } catch {
      setError('En feil oppstod');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="space-y-8 pb-12">
      <BackButton fallbackHref={routes.folketsMeninger} />

      <article className="overflow-hidden rounded-2xl border border-border bg-card shadow-sm">
        <div className="p-6">
          <div className="mb-4 flex flex-wrap items-center gap-2">
            <span
              className="inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-semibold"
              style={{
                backgroundColor: visual.bg,
                color: visual.fg,
                boxShadow: opinion.stance === 'blank' ? `inset 0 0 0 1px ${visual.ring}` : undefined,
              }}
            >
              {stanceLabel(opinion.stance)}
            </span>
            {opinion.stortingetIssueId ? (
              <Link
                href={routes.sak(opinion.stortingetIssueId)}
                className="inline-flex items-center rounded-full bg-brand/10 px-2.5 py-0.5 text-xs font-medium text-brand hover:bg-brand/15"
              >
                {opinion.issueTitle ?? `Sak ${opinion.stortingetIssueId}`}
              </Link>
            ) : null}
            <span className="text-xs text-muted-foreground">{formatOpinionDate(opinion.createdAt)}</span>
          </div>
          <h1 className="text-2xl font-bold tracking-tight text-foreground">{opinion.title}</h1>
          <p className="mt-2 text-sm text-muted-foreground">
            {opinion.authorName ? `Delt av ${opinion.authorName}` : 'Delt av en innbygger'}
          </p>
          <p className="mt-4 whitespace-pre-wrap text-sm leading-relaxed text-foreground">{opinion.body}</p>
        </div>
        <div className="grid grid-cols-3 border-t border-border text-center text-sm">
          <div className="px-3 py-3" style={{ backgroundColor: 'color-mix(in oklab, #00205B 8%, transparent)' }}>
            <p className="font-semibold text-[#00205B]">For</p>
            <p className="text-muted-foreground">{formatNumber(opinion.counts.for)}</p>
          </div>
          <div className="px-3 py-3">
            <p className="font-semibold text-foreground">Blank</p>
            <p className="text-muted-foreground">{formatNumber(opinion.counts.blank)}</p>
          </div>
          <div className="px-3 py-3" style={{ backgroundColor: 'color-mix(in oklab, #BA0C2F 8%, transparent)' }}>
            <p className="font-semibold text-[#BA0C2F]">Imot</p>
            <p className="text-muted-foreground">{formatNumber(opinion.counts.imot)}</p>
          </div>
        </div>
      </article>

      <section className="space-y-3">
        <h2 className="text-lg font-semibold text-foreground">Hva mener du?</h2>
        {isAuthor ? (
          <p className="rounded-2xl border border-dashed border-border px-4 py-6 text-sm text-muted-foreground">
            Dette er din mening. Andre kan svare For, Blank eller Imot her.
          </p>
        ) : (
          <StanceExpandModal
            key={`${opinion.viewerReply?.id ?? 'new'}-${opinion.viewerReply?.updatedAt ?? ''}`}
            minLength={OPINION_REPLY_BODY_MIN}
            submitLabel={opinion.viewerReply ? 'Oppdater begrunnelse' : 'Publiser begrunnelse'}
            onSubmit={submit}
            busy={busy}
            error={error}
            initialStance={opinion.viewerReply?.stance ?? null}
            initialBody={opinion.viewerReply?.body ?? ''}
          />
        )}
      </section>

      <section className="space-y-4">
        <h2 className="text-lg font-semibold text-foreground">
          Begrunnelser ({formatNumber(opinion.replies.length)})
        </h2>
        {opinion.replies.length === 0 ? (
          <p className="rounded-2xl border border-dashed border-border px-4 py-8 text-center text-sm text-muted-foreground">
            Ingen har svart ennå. Vær den første til å si For, Blank eller Imot.
          </p>
        ) : (
          <ul className="space-y-3">
            {opinion.replies.map((reply) => {
              const replyVisual = STANCE_VISUAL[reply.stance];
              return (
                <li key={reply.id} className="rounded-2xl border border-border bg-card p-5 shadow-sm">
                  <div className="flex flex-wrap items-center gap-2">
                    <span
                      className="inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-semibold"
                      style={{
                        backgroundColor: replyVisual.bg,
                        color: replyVisual.fg,
                        boxShadow: reply.stance === 'blank' ? `inset 0 0 0 1px ${replyVisual.ring}` : undefined,
                      }}
                    >
                      {stanceLabel(reply.stance)}
                    </span>
                    <span className="text-sm font-medium text-foreground">
                      {reply.authorName ?? 'Innbygger'}
                    </span>
                    <span className="text-xs text-muted-foreground">{formatOpinionDate(reply.createdAt)}</span>
                  </div>
                  <p className="mt-3 whitespace-pre-wrap text-sm leading-relaxed text-muted-foreground">{reply.body}</p>
                </li>
              );
            })}
          </ul>
        )}
      </section>
    </div>
  );
}
