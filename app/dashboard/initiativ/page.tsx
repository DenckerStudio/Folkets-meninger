import Link from 'next/link';
import { CreateInitiativeForm } from '@/components/polls/create-initiative-form';
import { PageHeader } from '@/components/page-header';
import { initiativeStatusLabel } from '@/lib/polls/labels';
import { listCitizenInitiatives } from '@/lib/polls/service';
import { routes } from '@/lib/routes';

export const dynamic = 'force-dynamic';

export default async function InitiativPage() {
  const initiatives = await listCitizenInitiatives(40);

  return (
    <div className="space-y-8 pb-12">
      <PageHeader
        title="Borgerinitiativ"
        description="Foreslå et spørsmål. Når nok innbyggere støtter det, kan det bli en nasjonal avstemning med Ja, Nei eller Blank."
      />
      <CreateInitiativeForm />
      {initiatives.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-border px-6 py-12 text-center text-muted-foreground">
          Ingen initiativ er publisert ennå.
        </div>
      ) : (
        <ul className="grid gap-4">
          {initiatives.map((initiative) => (
            <li key={initiative.id} className="rounded-2xl border border-border bg-card p-5 shadow-sm">
              <div className="flex flex-wrap items-center gap-2 text-xs font-medium">
                <span className="rounded-full bg-muted px-2.5 py-0.5 text-muted-foreground">
                  {initiativeStatusLabel(initiative.status)}
                </span>
                <span className="text-muted-foreground">
                  {initiative.supportCount}/{initiative.supportThreshold} støtteerklæringer
                </span>
              </div>
              <h2 className="mt-3 text-lg font-semibold text-foreground">
                <Link href={routes.initiative(initiative.id)} className="hover:text-brand">
                  {initiative.title}
                </Link>
              </h2>
              <p className="mt-2 line-clamp-3 text-sm text-muted-foreground">{initiative.body}</p>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
