import AdminOppfangetClient from './admin-oppfanget-client';
import { requireAdminPage } from '@/lib/admin/gate';
import { parseOppfangetFilters } from '@/lib/admin/oppfanget/query';
import { listOppfangetForAdmin } from '@/lib/admin/oppfanget/service';
import { routes } from '@/lib/routes';

export const dynamic = 'force-dynamic';

type PageProps = {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

export default async function AdminOppfangetPage({ searchParams }: PageProps) {
  await requireAdminPage(routes.adminOppfanget);

  const params = await searchParams;
  const preview = typeof params.preview === 'string' ? params.preview : undefined;
  const filters = parseOppfangetFilters(params);
  const initialData = await listOppfangetForAdmin(filters, preview);

  return <AdminOppfangetClient initialData={initialData} initialFilters={filters} />;
}
