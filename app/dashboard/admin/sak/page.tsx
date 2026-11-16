import Link from 'next/link';
import { requireAdminPage } from '@/lib/admin/gate';
import { listAdminSakPollIndex } from '@/lib/admin/sak-poll-index';
import { PageHeader } from '@/components/page-header';
import { AdminBackLink } from '@/components/admin/admin-shell';
import { AdminSakPollSearchForm } from '@/components/admin/admin-sak-poll-search-form';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { routes } from '@/lib/routes';
import { cn } from '@/lib/utils';

export const dynamic = 'force-dynamic';

type PageProps = {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

const STATUS_CLASS: Record<string, string> = {
  ingen: 'bg-muted text-muted-foreground',
  åpen: 'bg-emerald-100 text-emerald-900 dark:bg-emerald-950/50 dark:text-emerald-200',
  stengt: 'bg-muted text-foreground',
  utkast: 'bg-amber-100 text-amber-950 dark:bg-amber-950/40 dark:text-amber-100',
  annet: 'bg-muted text-muted-foreground',
};

export default async function AdminSakPollIndexPage({ searchParams }: PageProps) {
  await requireAdminPage(routes.adminSak);
  const params = await searchParams;
  const rawQ = params.q;
  const q = typeof rawQ === 'string' ? rawQ.trim() : '';

  const rows = await listAdminSakPollIndex(q || undefined);
  const serviceConfigured = Boolean(process.env.SUPABASE_SERVICE_ROLE_KEY?.trim());

  return (
    <div className="space-y-6" lang="nb-NO">
      <AdminBackLink />
      <PageHeader
        as="h2"
        title="Sak-avstemninger"
        description="Søk på saks-id eller tittel og administrer Nei / Blank / Ja-avstemninger knyttet til Stortingssaker."
      />

      <AdminSakPollSearchForm initialQuery={q} />

      {!serviceConfigured ? (
        <p className="rounded-xl border border-border bg-muted/40 p-4 text-sm text-muted-foreground">
          Tjenestenøkkel mangler lokalt — listen er tom i dev uten SUPABASE_SERVICE_ROLE_KEY.
        </p>
      ) : null}

      {rows.length === 0 ? (
        <p className="text-sm text-muted-foreground">
          {q
            ? `Ingen treff for «${q}». Prøv saks-id eller del av tittel.`
            : 'Ingen Stortinget-avstemninger funnet ennå.'}
        </p>
      ) : (
        <div className="overflow-x-auto rounded-xl border border-border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="min-w-[6rem]">Saks-id</TableHead>
                <TableHead className="min-w-[12rem]">Tittel</TableHead>
                <TableHead className="min-w-[7rem]">Avstemning</TableHead>
                <TableHead className="min-w-[6rem] text-right">Handling</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows.map((row) => (
                <TableRow key={`${row.issueId}:${row.pollId ?? 'none'}`}>
                  <TableCell className="font-mono text-sm tabular-nums">{row.issueId}</TableCell>
                  <TableCell className="max-w-md text-sm text-foreground">
                    <span className="line-clamp-2">{row.issueTitle ?? row.pollTitle ?? '—'}</span>
                  </TableCell>
                  <TableCell>
                    <span
                      className={cn(
                        'inline-flex rounded-full px-2.5 py-0.5 text-xs font-medium capitalize',
                        STATUS_CLASS[row.pollStatusLabel] ?? STATUS_CLASS.annet,
                      )}
                    >
                      {row.pollStatusLabel}
                    </span>
                  </TableCell>
                  <TableCell className="text-right">
                    <Link
                      href={routes.adminSakPoll(row.issueId)}
                      className="inline-flex min-h-11 items-center rounded-lg px-2 text-sm font-medium text-brand hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand"
                    >
                      Administrer
                    </Link>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}
    </div>
  );
}