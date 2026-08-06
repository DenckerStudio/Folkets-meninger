import Link from 'next/link';
import { ArrowRight, ShieldCheck, Users } from 'lucide-react';
import FadeIn from '@/components/fade-in';
import HeroSection from '@/components/hero-section';
import { LandingHowItWorks } from '@/components/landing-how-it-works';
import { LandingPopularIssuesLazy } from '@/components/landing-popular-issues-lazy';
import { routes } from '@/lib/routes';

export default async function LandingPage() {
  return (
    <div className="space-y-28 pb-16">
      <HeroSection />

      <FadeIn delay={0.1} direction="up">
        <LandingHowItWorks />
      </FadeIn>

      <FadeIn delay={0.2} direction="up">
        <section className="grid grid-cols-1 gap-5 lg:grid-cols-3">
          <div className="group rounded-2xl border border-[#00205b]/12 bg-white p-7 transition-colors hover:border-[#00205b]/35 lg:col-span-1">
            <div className="mb-5 inline-flex h-11 w-11 items-center justify-center rounded-full border border-[#00205b]/15 bg-[#00205b]/[0.06] text-[#00205b] transition-colors group-hover:border-[#00205b]/40 group-hover:bg-[#00205b] group-hover:text-white">
              <ShieldCheck className="h-5 w-5" />
            </div>
            <h3 className="text-lg font-semibold text-[#001433]">Verifisert og sikkert</h3>
            <p className="mt-2 text-base text-[#001433]/65 leading-relaxed">
              Sikker innlogging sikrer én person, én stemme. Identiteten din er beskyttet, og stemmen lagres anonymt.
            </p>
          </div>
          <div className="relative overflow-hidden rounded-2xl border border-[#00205b]/12 bg-gradient-to-br from-[#ba0c2f]/[0.08] via-white to-[#00205b]/[0.1] p-7 lg:col-span-2 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-6">
            <div className="pointer-events-none absolute -right-16 -top-16 h-40 w-40 rounded-full bg-[#ba0c2f]/10 blur-2xl" aria-hidden />
            <div className="pointer-events-none absolute -bottom-12 -left-10 h-36 w-36 rounded-full bg-[#00205b]/10 blur-2xl" aria-hidden />
            <div className="relative">
              <h3 className="text-xl font-semibold text-[#001433]">Klar til å delta?</h3>
              <p className="mt-2 text-[#001433]/65 max-w-md">
                Opprett konto gratis og få tilgang til saker, stemmegivning, forum og høringer.
              </p>
            </div>
            <div className="relative flex flex-col sm:flex-row gap-3 shrink-0 w-full sm:w-auto">
              <Link
                href={routes.login}
                className="inline-flex items-center justify-center rounded-full px-6 py-3 text-sm font-semibold text-white bg-[#00205b] hover:bg-[#ba0c2f] transition-colors"
              >
                Kom i gang
              </Link>
              <Link
                href={routes.dashboard}
                className="inline-flex items-center justify-center rounded-full px-6 py-3 text-sm font-semibold text-[#00205b] bg-white/80 border border-[#00205b]/15 hover:border-[#00205b]/40 hover:bg-white transition-colors"
              >
                Dashboard <ArrowRight className="ml-2 h-4 w-4" />
              </Link>
            </div>
          </div>
        </section>
      </FadeIn>

      <LandingPopularIssuesLazy />

      <FadeIn delay={0.25} direction="up">
        <section className="relative overflow-hidden text-center rounded-2xl border border-[#00205b]/15 bg-[#00205b] px-6 py-14 text-white">
          <div className="pointer-events-none absolute inset-0" aria-hidden>
            <div className="absolute -left-10 top-0 h-40 w-40 rounded-full bg-[#ba0c2f]/40 blur-3xl" />
            <div className="absolute -right-8 bottom-0 h-36 w-36 rounded-full bg-white/10 blur-2xl" />
          </div>
          <div className="relative">
            <Users className="mx-auto mb-4 h-9 w-9 text-white/90" />
            <h2 className="text-2xl sm:text-3xl font-bold tracking-tight">Demokratiet fortsetter mellom valgene</h2>
            <p className="mt-4 max-w-xl mx-auto text-white/75 leading-relaxed">
              Uavhengig plattform — vi samarbeider ikke med Regjeringen eller Stortinget. Et initiativ for å styrke
              dialogen mellom innbyggere og folkevalgte.
            </p>
            <Link
              href={routes.omOss}
              className="mt-8 inline-flex items-center rounded-full border border-white/25 bg-white/5 px-5 py-2.5 text-sm font-medium text-white hover:bg-white hover:text-[#00205b] transition-colors"
            >
              Les mer om oss
            </Link>
          </div>
        </section>
      </FadeIn>
    </div>
  );
}
