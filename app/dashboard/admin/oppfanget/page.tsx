import AdminOppfangetClient from './admin-oppfanget-client';
import { parseOppfangetFilters } from '@/lib/admin/oppfanget/query';
import { listOppfangetForAdmin } from '@/lib/admin/oppfanget/service';

export const dynamic = 'force-dynamic';

type PageProps = {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

export default async function AdminOppfangetPage({ searchParams }: PageProps) {
  const params = await searchParams;
  const preview =
    typeof params.preview === 'string' ? params.preview : undefined;
  const initialData = await listOppfangetForAdmin(parseOppfangetFilters(params), preview);

  return <AdminOppfangetClient initialData={initialData} />;
}
