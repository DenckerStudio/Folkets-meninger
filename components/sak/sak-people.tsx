import Link from 'next/link';
import Image from 'next/image';
import { getPersonbildeUrl } from '@/lib/stortinget-utils';
import { routes } from '@/lib/routes';
import { cn } from '@/lib/utils';

type PersonChip = {
  id?: string | number | null;
  fornavn?: string | null;
  etternavn?: string | null;
  parti?: { navn?: string | null } | null;
};

function personName(person: PersonChip): string {
  return `${person.fornavn ?? ''} ${person.etternavn ?? ''}`.trim() || 'Ukjent';
}

function PersonCard({
  person,
  tone,
}: {
  person: PersonChip;
  tone: 'neutral' | 'accent';
}) {
  const name = personName(person);
  const content = (
    <>
      <div className="relative h-8 w-8 shrink-0 overflow-hidden rounded-full bg-muted">
        {person.id ? (
          <Image
            src={getPersonbildeUrl(String(person.id), 'lite', true)}
            alt={name}
            fill
            className="object-cover"
            sizes="32px"
          />
        ) : (
          <div
            className={cn(
              'flex h-full w-full items-center justify-center text-xs font-bold',
              tone === 'accent'
                ? 'bg-brand-accent-soft text-brand-accent'
                : 'bg-brand-soft text-brand',
            )}
          >
            {person.fornavn?.[0]}
            {person.etternavn?.[0]}
          </div>
        )}
      </div>
      <div className="min-w-0">
        <div className="truncate text-sm font-medium text-foreground">{name}</div>
        {person.parti?.navn ? (
          <div className="truncate text-xs text-muted-foreground">{person.parti.navn}</div>
        ) : null}
      </div>
    </>
  );

  const className =
    'flex items-center gap-2 rounded-lg border border-border bg-muted/40 px-2.5 py-1.5 hover:bg-muted';

  return person.id ? (
    <Link href={routes.politiker(String(person.id))} className={className}>
      {content}
    </Link>
  ) : (
    <div className={className}>{content}</div>
  );
}

export function SakPeople({
  forslagstillere,
  saksordfoerere,
}: {
  forslagstillere: PersonChip[];
  saksordfoerere: PersonChip[];
}) {
  if (forslagstillere.length === 0 && saksordfoerere.length === 0) return null;

  return (
    <div className="space-y-4">
      {forslagstillere.length > 0 ? (
        <section>
          <h2 className="mb-2 text-sm font-semibold text-foreground">Forslagstillere</h2>
          <div className="flex flex-wrap gap-2">
            {forslagstillere.map((person, index) => (
              <PersonCard key={person.id ?? `f-${index}`} person={person} tone="neutral" />
            ))}
          </div>
        </section>
      ) : null}
      {saksordfoerere.length > 0 ? (
        <section>
          <h2 className="mb-2 text-sm font-semibold text-foreground">Saksordførere</h2>
          <div className="flex flex-wrap gap-2">
            {saksordfoerere.map((person, index) => (
              <PersonCard key={person.id ?? `s-${index}`} person={person} tone="accent" />
            ))}
          </div>
        </section>
      ) : null}
    </div>
  );
}
