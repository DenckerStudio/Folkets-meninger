import Link from 'next/link';
import { TrustDocLayout } from '@/components/trust/trust-doc-layout';
import { DATA_CONTROLLER, formatDataControllerBlock } from '@/lib/legal/controller';
import { TERMS_SECTIONS, TERMS_UPDATED, buildTermsIntro } from '@/lib/legal/terms-content';
import { buildPageMetadata } from '@/lib/seo/metadata';
import { routes } from '@/lib/routes';

export const metadata = buildPageMetadata({
  title: 'Brukervilkår',
  description: 'Vilkår for bruk av Folkets Meninger.',
  canonicalPath: routes.vilkar,
});

export default function VilkarPage() {
  const controllerBlock = formatDataControllerBlock();

  return (
    <TrustDocLayout
      title="Brukervilkår"
      description={`Sist oppdatert: ${TERMS_UPDATED}.`}
    >
      <p className="text-sm leading-relaxed">{buildTermsIntro()}</p>

      {controllerBlock ? (
        <p className="mt-4 text-sm leading-relaxed">
          Tjenesten drives av {controllerBlock}. Kontakt:{' '}
          <a className="font-medium text-[#00205b] underline" href={`mailto:${DATA_CONTROLLER.privacyEmail}`}>
            {DATA_CONTROLLER.privacyEmail}
          </a>
          .
        </p>
      ) : null}

      <div className="mt-8 space-y-6">
        {TERMS_SECTIONS.map((section) => (
          <section key={section.title}>
            <h2 className="text-lg font-bold text-[#001433]">{section.title}</h2>
            <p className="mt-2 text-sm leading-relaxed text-[#001433]/80">{section.body}</p>
          </section>
        ))}
      </div>

      <p className="mt-8 text-sm">
        Se også{' '}
        <Link href={routes.personvern} className="font-medium text-[#00205b] underline">
          personvernerklæringen
        </Link>
        .
      </p>
    </TrustDocLayout>
  );
}
