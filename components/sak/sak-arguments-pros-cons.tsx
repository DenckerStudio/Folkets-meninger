import Link from 'next/link';
import { Scale } from 'lucide-react';
import type { SakArgumentItem, SakArgumentsBundle } from '@/lib/sak/arguments/types';
import { STANCE_VISUAL } from '@/lib/opinions/labels';

const SOURCE_LINK_CLASS =
  'inline-flex min-h-9 items-center rounded-sm font-medium text-brand hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand focus-visible:ring-offset-2';

function ArgumentSourceLink({ item }: { item: SakArgumentItem }) {
  if (item.source.href) {
    const external = item.source.href.startsWith('http');
    if (external) {
      return (
        <a href={item.source.href} className={SOURCE_LINK_CLASS} target="_blank" rel="noopener noreferrer">
          Kildelenke
        </a>
      );
    }
    return (
      <Link href={item.source.href} className={SOURCE_LINK_CLASS}>
        Gå til kilden
      </Link>
    );
  }
  if (item.source.anchorId) {
    return (
      <a href={`#${item.source.anchorId}`} className={SOURCE_LINK_CLASS}>
        Gå til kilden
      </a>
    );
  }
  return null;
}

function ArgumentList({
  title,
  items,
  accentClass,
  stripeColor,
}: {
  title: string;
  items: SakArgumentItem[];
  accentClass: string;
  stripeColor: string;
}) {
  return (
    <div className="min-w-0 flex-1 rounded-2xl border border-border bg-muted/20 p-4 sm:p-5">
      <div className="mb-3 flex items-center gap-2">
        <span className="h-2 w-8 rounded-full" style={{ backgroundColor: stripeColor }} aria-hidden />
        <h3 className={`text-sm font-semibold ${accentClass}`}>{title}</h3>
      </div>
      {items.length === 0 ? (
        <p className="text-sm text-muted-foreground">Ingen treff i tilgjengelige kilder.</p>
      ) : (
        <ul className="space-y-3">
          {items.map((item) => (
            <li key={item.id} className="rounded-xl border border-border bg-card px-3 py-3 text-sm shadow-sm">
              <p className="leading-relaxed text-foreground">{item.text}</p>
              <div className="mt-2 flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-muted-foreground">
                <span>{item.source.label}</span>
                {item.supportCount ? (
                  <span className="tabular-nums">· {item.supportCount} liknende punkter</span>
                ) : null}
                <ArgumentSourceLink item={item} />
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

export function SakArgumentsProsCons({ bundle }: { bundle: SakArgumentsBundle }) {
  return (
    <section
      id="sak-argumenter"
      data-sak-argumenter=""
      className="rounded-2xl border border-border bg-card p-4 shadow-sm sm:p-6"
    >
      <div className="flex items-center gap-2">
        <Scale className="h-5 w-5 text-brand" aria-hidden />
        <h2 className="text-lg font-bold text-foreground">Argumenter for og mot</h2>
      </div>

      {bundle.emptyMessage ? (
        <p className="mt-3 text-sm text-muted-foreground">{bundle.emptyMessage}</p>
      ) : (
        <div className="mt-4 flex flex-col gap-4 lg:flex-row">
          <ArgumentList
            title="Argumenter for"
            items={bundle.for}
            accentClass="text-brand"
            stripeColor={STANCE_VISUAL.for.bg}
          />
          <ArgumentList
            title="Argumenter mot"
            items={bundle.mot}
            accentClass="text-brand-accent"
            stripeColor={STANCE_VISUAL.imot.bg}
          />
        </div>
      )}

      <p className="mt-4 text-xs leading-relaxed text-muted-foreground">
        Kun tekst fra dokumentmerknader med tydelig avsender og offentlige meninger (aggregert). Vi finner
        ikke opp nye argumenter.
      </p>
    </section>
  );
}