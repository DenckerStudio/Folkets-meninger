import type { ReactNode } from 'react';
import Link from 'next/link';
import type { WeeklyOverview } from '@/lib/weekly-overview';
import { cn } from '@/lib/utils';
import { touchTargetLinkClass } from '@/lib/touch-target';

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

function EmptySectionMessage({ children }: { children: string }) {
  return (
    <p
      className="rounded-2xl border border-dashed border-border bg-card px-4 py-8 text-center text-sm text-muted-foreground"
      role="status"
    >
      {children}
    </p>
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
                'block px-4 py-3 text-left transition-colors hover:bg-muted/60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
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

export function WeeklyOverviewSections({ overview }: WeeklyOverviewSectionsProps) {
  const metaByVotingSoon = new Map(
    overview.votingSoon.map((item) => [item.issueId, item.daysLeftLabel]),
  );
  const metaByHearing = new Map(
    overview.openHearings.map((item) => [item.hearingId, item.fristLabel]),
  );

  return (
    <div className="grid gap-10">
      <SectionShell
        id="votering-snart"
        title="Saker nær votering"
        description="Offentlige saker der votering er ventet innen de neste sju dagene."
      >
        {overview.votingSoon.length === 0 ? (
          <EmptySectionMessage>Ingen saker med planlagt votering i denne perioden.</EmptySectionMessage>
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
        title="Saker med votering denne uken"
        description="Saker som er ferdig behandlet og votert i løpet av de siste sju dagene."
      >
        {overview.votedRecently.length === 0 ? (
          <EmptySectionMessage>Ingen registrerte voteringer i denne perioden.</EmptySectionMessage>
        ) : (
          <OverviewList
            items={overview.votedRecently.map((item) => ({
              key: item.issueId,
              href: item.href,
              title: item.title,
            }))}
            renderMeta={() => 'Votert i perioden'}
          />
        )}
      </SectionShell>

      <SectionShell
        id="horingsfrister"
        title="Åpne høringer med frist snart"
        description="Innspillsfrist innen sju dager (Europe/Oslo)."
      >
        {overview.openHearings.length === 0 ? (
          <EmptySectionMessage>Ingen åpne høringer med frist i denne perioden.</EmptySectionMessage>
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
        description="Saker med oppdatert sakssammendrag de siste sju dagene."
      >
        {overview.newSummaries.length === 0 ? (
          <EmptySectionMessage>Ingen nye eller oppdaterte sammendrag i denne perioden.</EmptySectionMessage>
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
        description="Antall nye skriftlige spørsmål fra Stortinget i perioden — uten spørsmålstekst."
      >
        <div className="rounded-2xl border border-border bg-card px-4 py-6">
          <p className="text-base font-medium text-foreground">{overview.skriftligeSporsmal.label}</p>
          <Link
            href={overview.skriftligeSporsmal.href}
            className={cn(
              touchTargetLinkClass,
              'mt-3 inline-flex text-sm font-medium text-brand underline-offset-2 hover:underline',
            )}
          >
            Se spørsmålsoversikt i appen
          </Link>
        </div>
      </SectionShell>
    </div>
  );
}