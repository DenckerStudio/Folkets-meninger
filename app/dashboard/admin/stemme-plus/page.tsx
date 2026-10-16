import { StemmePlusAdmin } from '@/components/admin/stemme-plus-admin';
import { isStripeCheckoutConfigured } from '@/lib/stripe/config';

export const dynamic = 'force-dynamic';

export default function AdminStemmePlusPage() {
  return <StemmePlusAdmin checkoutConfigured={isStripeCheckoutConfigured()} />;
}
