import { redirect } from 'next/navigation';
import Link from 'next/link';
import { getFiderBaseUrl, getFiderSsoStartUrl, isFiderConfigured } from '@/lib/fider/config';
import { routes } from '@/lib/routes';

export const metadata = {
  title: 'Forslag og tilbakemelding',
  description: 'Del idéer og stem på forbedringer for Folkets Stemme.',
};

export default function ForslagPage() {
  if (!isFiderConfigured()) {
    return (
      <div className="mx-auto max-w-2xl space-y-4 px-4 py-10">
        <h1 className="text-2xl font-semibold tracking-tight">Forslag og tilbakemelding</h1>
        <p className="text-muted-foreground">
          Forslagstavlen er under oppsett. Kom tilbake snart for å dele idéer og stemme på
          forbedringer.
        </p>
        <Link href={routes.utforsk} className="text-sm font-medium text-brand hover:underline">
          Tilbake til Utforsk
        </Link>
      </div>
    );
  }

  redirect(getFiderSsoStartUrl(getFiderBaseUrl()));
}
