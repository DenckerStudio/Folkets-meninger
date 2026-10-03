import { redirect } from 'next/navigation';
import Link from 'next/link';
import { DashboardPage } from '@/components/dashboard/dashboard-page';
import { EmptyState } from '@/components/dashboard/empty-state';
import { PageHeader } from '@/components/page-header';
import { getFiderBaseUrl, getFiderSsoStartUrl, isFiderConfigured } from '@/lib/fider/config';
import { routes } from '@/lib/routes';

export const metadata = {
  title: 'Forslag og tilbakemelding',
  description: 'Del idéer og stem på forbedringer for Folkets Stemme.',
};

export default function ForslagPage() {
  if (!isFiderConfigured()) {
    return (
      <DashboardPage>
        <PageHeader
          title="Forslag og tilbakemelding"
          description="Del idéer og stem på forbedringer for Folkets Stemme."
        />
        <EmptyState
          title="Forslagstavlen er under oppsett"
          description="Kom tilbake snart for å dele idéer og stemme på forbedringer."
          action={
            <Link href={routes.utforsk} className="text-sm font-medium text-brand hover:underline">
              Tilbake til Utforsk
            </Link>
          }
        />
      </DashboardPage>
    );
  }

  redirect(getFiderSsoStartUrl(getFiderBaseUrl()));
}
