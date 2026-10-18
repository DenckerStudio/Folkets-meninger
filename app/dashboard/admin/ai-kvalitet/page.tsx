import Link from 'next/link';
import { AdminBackLink } from '@/components/admin/admin-shell';
import { PageHeader } from '@/components/page-header';
import { routes } from '@/lib/routes';

export const dynamic = 'force-dynamic';

export default function AdminAiKvalitetPage() {
  return (
    <div className="space-y-6">
      <AdminBackLink />
      <PageHeader
        as="h1"
        title="AI-kvalitet"
        description="Metrikker, eval-løp og promptversjoner kommer i fase 2–4. Tilbakemeldinger logges allerede i ai_feedback."
      />
      <section className="rounded-xl border border-border bg-card p-5 shadow-sm">
        <h2 className="text-lg font-semibold text-foreground">Kommer snart</h2>
        <ul className="mt-3 list-disc space-y-2 pl-5 text-sm text-muted-foreground">
          <li>Godkjenningsrate og redigeringsavstand per workflow</li>
          <li>Eval-rapporter og kandidat-promptversjoner (Aktiver/Avvis)</li>
          <li>Forslag til nye eval-tilfeller fra avvisninger</li>
        </ul>
        <p className="mt-4 text-sm text-muted-foreground">
          Reels-admin og sammendrag-regenerering logger allerede grunnkoder. Se også{' '}
          <Link href={routes.adminReels} className="font-medium text-brand hover:underline">
            Reels-utkast
          </Link>
          .
        </p>
      </section>
    </div>
  );
}
