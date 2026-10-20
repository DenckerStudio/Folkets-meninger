import Link from 'next/link';
import { notFound } from 'next/navigation';
import { ResearchClusterDetailView } from '@/components/admin/research-cluster-detail';
import { requireAdminPage } from '@/lib/admin/gate';
import { loadResearchClusterDetail } from '@/lib/admin/research/cluster-detail';
import { routes } from '@/lib/routes';
import { getServerSupabase } from '@/lib/supabase-server';

export const dynamic = 'force-dynamic';

type PageProps = {
  params: Promise<{ id: string }>;
};

export default async function AdminResearchClusterPage({ params }: PageProps) {
  await requireAdminPage(routes.adminResearch);
  const { id } = await params;
  const detail = await loadResearchClusterDetail(id);
  if (!detail) notFound();

  const supabase = await getServerSupabase();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  return (
    <div className="space-y-6" lang="nb-NO">
      <div>
        <p className="text-sm text-muted-foreground">
          <Link href={routes.adminResearch} className="text-brand hover:underline">
            Research
          </Link>
          <span aria-hidden> / </span>
          <span className="line-clamp-1 text-foreground">{detail.row.title || 'Detaljer'}</span>
        </p>
        <h1 className="mt-2 text-2xl font-bold text-foreground">{detail.row.title}</h1>
      </div>
      <ResearchClusterDetailView
        row={detail.row}
        briefs={detail.briefs}
        adminUserId={user?.id}
      />
      <Link
        href={routes.adminResearch}
        className="inline-flex min-h-11 items-center text-sm font-medium text-brand hover:underline"
      >
        ← Tilbake til Research
      </Link>
    </div>
  );
}
