import { StemmePlusAdmin } from '@/components/admin/stemme-plus-admin';
import { requireAdminPage } from '@/lib/admin/gate';
import { routes } from '@/lib/routes';
import { isStripeCheckoutConfigured } from '@/lib/stripe/config';

export const dynamic = 'force-dynamic';

export default async function AdminStemmePlusPage() {
  await requireAdminPage(routes.adminStemmePlus);
  return <StemmePlusAdmin checkoutConfigured={isStripeCheckoutConfigured()} />;
}
