import AdminStatistikkClient from './admin-statistikk-client';

export const dynamic = 'force-dynamic';

export default async function AdminStatistikkPage() {
  const umamiAdminUrl = process.env.UMAMI_ADMIN_URL?.trim() || null;
  return <AdminStatistikkClient umamiAdminUrl={umamiAdminUrl} />;
}
