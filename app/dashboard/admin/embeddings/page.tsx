import AdminEmbeddingsClient from './admin-embeddings-client';
import { requireAdminPage } from '@/lib/admin/gate';
import {
  embeddingCoverageNotReady,
  loadAdminEmbeddingCoverage,
} from '@/lib/admin/embeddings/coverage';
import { routes } from '@/lib/routes';
import { getServerSupabase } from '@/lib/supabase-server';

export const dynamic = 'force-dynamic';

export default async function AdminEmbeddingsPage() {
  await requireAdminPage(routes.adminEmbeddings);

  const supabase = await getServerSupabase();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  let coverage = embeddingCoverageNotReady;
  if (user?.id) {
    try {
      coverage = await loadAdminEmbeddingCoverage(user.id);
    } catch {
      coverage = embeddingCoverageNotReady;
    }
  }

  return <AdminEmbeddingsClient initialData={coverage} />;
}