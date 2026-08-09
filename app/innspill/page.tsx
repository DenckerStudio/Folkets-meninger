import type { Metadata } from 'next';
import { InnspillForm } from '@/components/innspill-form';

export const metadata: Metadata = {
  title: 'Gi innspill | Folkets Stemme',
  description: 'Send idéer, feilmeldinger og tilbakemeldinger til Folkets Stemme.',
};

export default function InnspillPage() {
  return (
    <div className="mx-auto max-w-2xl space-y-10 pb-8">
      <div className="space-y-4 pt-4 text-center">
        <p className="text-xs font-semibold uppercase tracking-[0.2em] text-[#ba0c2f]">Kontakt</p>
        <h1 className="text-4xl font-extrabold tracking-tight text-[#001433] sm:text-5xl">
          Gi innspill
        </h1>
        <p className="mx-auto max-w-xl text-lg leading-relaxed text-[#001433]/65">
          Har du en idé, funnet en feil, eller spørsmål om plattformen? Send oss en melding — vi leser
          alt og bruker tilbakemeldingene til å forbedre Folkets Stemme.
        </p>
      </div>

      <InnspillForm />

      <p className="text-center text-sm text-[#001433]/50">
        Du kan også nå oss på{' '}
        <a
          href="mailto:kontakt@folketsstemme.no"
          className="font-medium text-[#00205b] underline-offset-2 hover:text-[#ba0c2f] hover:underline"
        >
          kontakt@folketsstemme.no
        </a>
        .
      </p>
    </div>
  );
}
