import Link from 'next/link';
import { LandingSectionContainer } from '@/components/landing-section-container';
import { routes } from '@/lib/routes';

export function BlogCmsUnavailable() {
  return (
    <LandingSectionContainer>
      <div
        className="mx-auto max-w-lg rounded-2xl border border-[#00205b]/10 bg-white/90 px-6 py-14 text-center shadow-sm"
        data-landing-section
      >
        <h1 className="text-2xl font-bold text-[#001433]">Bloggen er midlertidig utilgjengelig</h1>
        <p className="mt-4 text-sm leading-relaxed text-[#001433]/70">
          Vi klarte ikke å hente artikler fra redaksjonssystemet akkurat nå. Prøv igjen om litt, eller gå
          tilbake til bloggforsiden.
        </p>
        <Link
          href={routes.blogg}
          className="mt-8 inline-flex min-h-11 items-center justify-center rounded-full bg-[#00205b] px-5 text-sm font-semibold text-white hover:bg-[#00205b]/90"
        >
          Til bloggforsiden
        </Link>
      </div>
    </LandingSectionContainer>
  );
}
