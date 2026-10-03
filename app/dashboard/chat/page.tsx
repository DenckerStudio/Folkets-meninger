import Link from 'next/link';
import { StemmeChat } from '@/components/chat/stemme-chat';
import { DashboardPage } from '@/components/dashboard/dashboard-page';
import { StemmePlusBadge } from '@/components/profile/stemme-plus-badge';
import { PageHeader } from '@/components/page-header';
import { getByokMeta, byokStorageReady } from '@/lib/byok/service';
import { loadIssueMeta } from '@/lib/chat/rag';
import { isStripeCheckoutConfigured } from '@/lib/stripe/config';
import { STEMME_PLUS_MONTHLY_PRICE_NOK } from '@/lib/stemme-plus/constants';
import { userHasStemmePlus } from '@/lib/stemme-plus/service';
import { getUser } from '@/lib/supabase-server';
import { routes } from '@/lib/routes';

export const dynamic = 'force-dynamic';

type ChatPageProps = {
  searchParams: Promise<{ sak?: string }>;
};

export default async function ChatPage({ searchParams }: ChatPageProps) {
  const { sak } = await searchParams;
  const user = await getUser();
  const issueId = sak?.trim() || null;
  const issue = issueId ? await loadIssueMeta(issueId) : null;

  const plus = user ? await userHasStemmePlus(user.id) : false;
  const byok = plus && user ? await getByokMeta(user.id) : null;
  const gate = !plus ? 'free' : byok ? 'ready' : 'no-key';

  return (
    <DashboardPage>
      <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <PageHeader
          title="AI-chat"
          description="Snakk om Stortinget-saker med vår cache og dokumentutdrag, hent oppdaterte kilder, eller få hjelp med rettskriving av dine egne utkast. Chatten bruker nøkkelen din — vi genererer ikke innlegg for deg."
        />
        {plus ? <StemmePlusBadge /> : null}
      </div>
      {issueId ? (
        <p className="text-sm text-foreground">
          Åpen sak:{' '}
          <Link href={routes.sak(issueId)} className="font-medium text-brand hover:underline">
            {issue?.title || issueId}
          </Link>
        </p>
      ) : null}

      <StemmeChat
        gate={gate}
        issueId={issueId}
        issueTitle={issue?.title ?? null}
        priceNok={STEMME_PLUS_MONTHLY_PRICE_NOK}
        checkoutConfigured={isStripeCheckoutConfigured()}
      />

      <p className="text-xs text-muted-foreground">
        Kryptert nøkkel-lagring {byokStorageReady() ? 'er klar' : 'mangler BYOK_ENCRYPTION_KEY'}.
        Stripe-kasse {isStripeCheckoutConfigured() ? 'er konfigurert' : 'er ikke konfigurert ennå'}.
      </p>
    </DashboardPage>
  );
}
