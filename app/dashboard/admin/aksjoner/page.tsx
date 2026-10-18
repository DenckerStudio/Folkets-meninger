import { listActionClusters } from '@/lib/actions/service';
import AdminAksjonerClient from './admin-aksjoner-client';

export const dynamic = 'force-dynamic';

export default async function AdminAksjonerPage() {
  const clusters = await listActionClusters({ status: 'would_draft', limit: 80 });
  return <AdminAksjonerClient initialClusters={clusters} />;
}
