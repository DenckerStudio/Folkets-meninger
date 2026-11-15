import type { ReactNode } from 'react';
import Link from 'next/link';
import type { WeeklyOverview } from '@/lib/weekly-overview';
import { weeklyPeriodLabelMidSentence } from '@/lib/weekly-overview-labels';
import { routes } from '@/lib/routes';
import { cn } from '@/lib/utils';
import { touchTargetLinkClass } from '@/lib/touch-target';

const focusRing =
  'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2';

type WeeklyOverviewSectionsProps = {
  overview: WeeklyOverview;
};

function SectionShell({
  title,
  description,
  children,
  id,
}: {
  id: string;
  title: string;
  description: string;
  children: ReactNode;
}) {
  return (
    <section aria-labelledby={id} className="space-y-4">
      <div>
        <h2 id={id} className="text-xl font-semibold tracking-tight text-foreground">
          {title}
        </h2>
        <p className="mt-1 text-sm text-muted-foreground">{description}</p>
      </div>
      {children}
    </section>
  );
}

function EmptySectionMessage({
  children,
  action,
}: {
  children: string;
  action?: { href: string; label: string };
}) {
  return (
    <div
      className="space-y-3 rounded-2xl border border-dashed border-border bg-card px-4 py-8 text-center"
      role="status"
    >
      <p className="text-sm text-muted-foreground">{children}</p>
      {action ? (
        <Link
          href={action.href}
          className={cn(
            touchTargetLinkClass,
            focusRing,
            'inline-flex rounded-md text-sm font-medium text-brand underline-offset-2 hover:underline',
          )}
        >
          {action.label}
        </Link>
      ) : null}
    </div>
  );
}

function OverviewList({
  items,
  renderMeta,
}: {
  items: Array<{ href: string; title: string; key: string }>;
  renderMeta?: (key: string) => string | null;
}) {
  return (
    <ul className="divide-y divide-border rounded-2xl border border-border bg-card">
      {items.map((item) => {
        const meta = renderMeta?.(item.key);
        return (
          <li key={item.key}>
            <Link
              href={item.href}
              className={cn(
                touchTargetLinkClass,
                focusRing,
                'block px-4 py-3 text-left transition-colors hover:bg-muted/60',
              )}
            >
              <span className="font-medium text-foreground">{item.title}</span>
              {meta ? <span className="mt-1 block text-sm text-muted-foreground">{meta}</span> : null}
            </Link>
          </li>
        );
      })}
    </ul>
  );
}

export function WeeklyOverviewLoadError() {
  return (
    <div
      className="rounded-2xl border border-destructive/40 bg-destructive/5 px-6 py-10 text-center"
      role="alert"
    >
      <p className="text-base font-semibold text-foreground">Kunne ikke laste ukeoversikten</p>
      <p className="mt-2 text-sm text-muted-foreground">Prøv igjen senere, eller utforsk saker i mellomtiden.</p>
      <Link
        href={routes.utforsk}
        className={cn(
          touchTargetLinkClass,
          focusRing,
          'mt-4 inline-flex rounded-md text-sm font-medium text-brand underline-offset-2 hover:underline',
        )}
      >
        Gå til Utforsk
      </Link>
    </div>
  );
}

export function WeeklyOverviewSections({ overview }: WeeklyOverviewSectionsProps) {
  const metaByVotingSoon = new Map(
    overview.votingSoon.map((item) => [item.issueId, item.daysLeftLabel]),
  );
  const metaByVoted = new Map(
    overview.votedRecently.map((item) => [item.issueId, item.votedAtLabel ?? null]),
  );
  const metaByHearing = new Map(
    overview.openHearings.map((item) => [item.hearingId, item.fristLabel]),
  );

  return (
    <div className="grid gap-10">
      <SectionShell
        id="votering-snart"
        title="Saker nær votering"
        description={`Åpne saker med planlagt votering: ${weeklyPeriodLabelMidSentence(overview.window.futureRangeLabel)}.`}
      >
        {overview.votingSoon.length === 0 ? (
          <EmptySectionMessage action={{ href: routes.utforsk, label: 'Utforsk saker' }}>
            Ingen saker med planlagt votering i denne perioden.
          </EmptySectionMessage>
        ) : (
          <OverviewList
            items={overview.votingSoon.map((item) => ({
              key: item.issueId,
              href: item.href,
              title: item.title,
            }))}
            renderMeta={(key) => metaByVotingSoon.get(key) ?? null}
          />
        )}
      </SectionShell>

      <SectionShell
        id="votering-nettopp"
        title="Nylig votert"
        description={`Ferdig behandlet etter voteringsdato i saksgangen: ${weeklyPeriodLabelMidSentence(overview.window.pastRangeLabel)}.`}
      >
        {overview.votedRecently.length === 0 ? (
          <EmptySectionMessage action={{ href: routes.utforsk, label: 'Se saker på Utforsk' }}>
            Ingen voteringer med dato i denne perioden.
          </EmptySectionMessage>
        ) : (
          <OverviewList
            items={overview.votedRecently.map((item) => ({
              key: item.issueId,
              href: item.href,
              title: item.title,
            }))}
            renderMeta={(key) => metaByVoted.get(key) ?? null}
          />
        )}
      </SectionShell>

      <SectionShell
        id="horingsfrister"
        title="Åpne høringer med frist snart"
        description={`Innspillsfrist: ${weeklyPeriodLabelMidSentence(overview.window.futureRangeLabel)} (Europe/Oslo).`}
      >
        {overview.openHearings.length === 0 ? (
          <EmptySectionMessage action={{ href: routes.horinger, label: 'Se alle høringer' }}>
            Ingen åpne høringer med frist i denne perioden.
          </EmptySectionMessage>
        ) : (
          <OverviewList
            items={overview.openHearings.map((item) => ({
              key: item.hearingId,
              href: item.href,
              title: item.title,
            }))}
            renderMeta={(key) => metaByHearing.get(key) ?? null}
          />
        )}
      </SectionShell>

      <SectionShell
        id="sammendrag"
        title="Oppdaterte sammendrag"
        description={`Oppdatert sakssammendrag: ${weeklyPeriodLabelMidSentence(overview.window.pastRangeLabel)}.`}
      >
        {overview.newSummaries.length === 0 ? (
          <EmptySectionMessage action={{ href: routes.utforsk, label: 'Utforsk saker med sammendrag' }}>
            Ingen nye eller oppdaterte sammendrag i denne perioden.
          </EmptySectionMessage>
        ) : (
          <OverviewList
            items={overview.newSummaries.map((item) => ({
              key: item.issueId,
              href: item.href,
              title: item.title,
            }))}
            renderMeta={(key) => {
              const row = overview.newSummaries.find((item) => item.issueId === key);
              if (!row?.updatedAt) return null;
              const date = new Date(row.updatedAt);
              if (Number.isNaN(date.getTime())) return null;
              return `Oppdatert ${date.toLocaleDateString('nb-NO', {
                day: 'numeric',
                month: 'long',
                timeZone: 'Europe/Oslo',
              })}`;
            }}
          />
        )}
      </SectionShell>

      <SectionShell
        id="skriftlige-sporsmal"
        title="Skriftlige spørsmål"
        description={`Antall nye fra Stortinget ${weeklyPeriodLabelMidSentence(overview.window.pastRangeLabel)} — uten spørsmålstekst.`}
      >
        <div className="rounded-2xl border border-border bg-card px-4 py-6">
          <p className="text-base font-medium text-foreground">{overview.skriftligeSporsmal.label}</p>
          <Link
            href={overview.skriftligeSporsmal.href}
            className={cn(
              touchTargetLinkClass,
              focusRing,
              'mt-3 inline-flex rounded-md text-sm font-medium text-brand underline-offset-2 hover:underline',
            )}
          >
            Se spørsmålsoversikten
          </Link>
        </div>
      </SectionShell>
    </div>
  );
}