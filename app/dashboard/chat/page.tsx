import Link from 'next/link';
import { MessageCircle } from 'lucide-react';
import { StemmeChat } from '@/components/chat/stemme-chat';
import { StemmePlusBadge } from '@/components/profile/stemme-plus-badge';
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
    <div className="mx-auto max-w-3xl space-y-6 px-4 py-8">
      <header className="space-y-2">
        <div className="flex flex-wrap items-center gap-2">
          <MessageCircle className="h-7 w-7 text-brand" aria-hidden />
          <h1 className="text-2xl font-bold text-foreground">AI-chat</h1>
          {plus ? <StemmePlusBadge /> : null}
        </div>
        <p className="text-sm text-muted-foreground">
          Snakk om Stortinget-saker med vår cache og dokumentutdrag, hent oppdaterte kilder, eller
          få hjelp med rettskriving av dine egne utkast. Chatten bruker nøkkelen din — vi genererer
          ikke innlegg for deg.
        </p>
        {issueId ? (
          <p className="text-sm text-foreground">
            Åpen sak:{' '}
            <Link href={routes.sak(issueId)} className="font-medium text-brand hover:underline">
              {issue?.title || issueId}
            </Link>
          </p>
        ) : null}
      </header>

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
    </div>
  );
}
