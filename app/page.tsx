import type { ComponentType } from 'react';
import Link from 'next/link';
import { ArrowRight, BarChart2, MessageSquare, ShieldCheck, TrendingUp, Users, Vote } from 'lucide-react';
import FadeIn from '@/components/fade-in';
import HeroSection from '@/components/hero-section';
import { LandingPopularIssuesLazy } from '@/components/landing-popular-issues-lazy';
import { routes } from '@/lib/routes';

export default async function LandingPage() {
  return (
    <div className="space-y-24 pb-12">
      <HeroSection />

      <FadeIn delay={0.2} direction="up">
        <section>
          <div className="text-center max-w-2xl mx-auto mb-12">
            <h2 className="text-3xl font-bold text-foreground tracking-tight">Slik fungerer det</h2>
            <p className="mt-3 text-muted-foreground">
              Fra Stortingets åpne data til din stemme — en enkel vei inn i demokratiet mellom valgene.
            </p>
          </div>
          <div className="grid grid-cols-1 gap-8 sm:grid-cols-2 lg:grid-cols-4">
            <FeatureCard
              icon={TrendingUp}
              iconClass="bg-emerald-100 text-emerald-600"
              title="Direkte fra Stortinget"
              description="Vi henter lovforslag og representantforslag fra Stortingets åpne API — saker som egner seg for enkelt ja/nei-engasjement."
            />
            <FeatureCard
              icon={Vote}
              iconClass="bg-indigo-100 text-indigo-600"
              title="Stem på saker"
              description="Si din mening med verifisert stemmegivning. Én person, én stemme — anonymt i statistikken."
            />
            <FeatureCard
              icon={MessageSquare}
              iconClass="bg-amber-100 text-amber-600"
              title="Delta i debatten"
              description="Forum og høringer med navngitte innlegg — diskuter åpent med fornavn og etternavn."
            />
            <FeatureCard
              icon={BarChart2}
              iconClass="bg-violet-100 text-violet-600"
              title="Innsikt for politikere"
              description="Anonymisert statistikk hjelper representanter å forstå hva velgerne mener."
            />
          </div>
        </section>
      </FadeIn>

      <FadeIn delay={0.25} direction="up">
        <section className="grid grid-cols-1 gap-8 lg:grid-cols-3">
          <div className="bg-card p-6 rounded-2xl shadow-sm border border-border lg:col-span-1">
            <div className="w-12 h-12 inline-flex items-center justify-center rounded-xl bg-indigo-100 text-indigo-600 mb-4">
              <ShieldCheck className="w-6 h-6" />
            </div>
            <h3 className="text-lg font-medium text-foreground">Verifisert og sikkert</h3>
            <p className="mt-2 text-base text-muted-foreground">
              Sikker innlogging sikrer én person, én stemme. Identiteten din er beskyttet, og stemmen lagres
              anonymt.
            </p>
          </div>
          <div className="bg-gradient-to-br from-[#00205b]/5 to-[#ba0c2f]/5 p-8 rounded-2xl border border-border lg:col-span-2 flex flex-col sm:flex-row items-center justify-between gap-6">
            <div>
              <h3 className="text-xl font-semibold text-foreground">Klar til å delta?</h3>
              <p className="mt-2 text-muted-foreground">
                Opprett konto gratis og få tilgang til alle saker, stemmegivning, forum og høringer i dashboardet.
              </p>
            </div>
            <div className="flex flex-col sm:flex-row gap-3 shrink-0 w-full sm:w-auto">
              <Link
                href={routes.login}
                className="inline-flex items-center justify-center px-6 py-3 text-base font-medium text-primary-foreground bg-primary hover:bg-primary/90 rounded-xl transition-colors"
              >
                Kom i gang
              </Link>
              <Link
                href={routes.dashboard}
                className="inline-flex items-center justify-center px-6 py-3 text-base font-medium text-foreground bg-card border border-border hover:bg-muted/50 rounded-xl transition-colors"
              >
                Dashboard <ArrowRight className="ml-2 w-4 h-4" />
              </Link>
            </div>
          </div>
        </section>
      </FadeIn>

      <LandingPopularIssuesLazy />

      <FadeIn delay={0.35} direction="up">
        <section className="text-center py-12 px-6 rounded-2xl bg-[#00205b] text-white">
          <Users className="w-10 h-10 mx-auto mb-4 opacity-90" />
          <h2 className="text-2xl sm:text-3xl font-bold">Demokratiet fortsetter mellom valgene</h2>
          <p className="mt-4 max-w-xl mx-auto text-white/80">
            Uavhengig plattform — vi samarbeider ikke med Regjeringen eller Stortinget. Et initiativ for å styrke
            dialogen mellom innbyggere og folkevalgte.
          </p>
          <Link
            href={routes.omOss}
            className="mt-8 inline-flex items-center text-sm font-medium text-white/90 hover:text-white underline underline-offset-4"
          >
            Les mer om oss
          </Link>
        </section>
      </FadeIn>
    </div>
  );
}

function FeatureCard({
  icon: Icon,
  iconClass,
  title,
  description,
}: {
  icon: ComponentType<{ className?: string }>;
  iconClass: string;
  title: string;
  description: string;
}) {
  return (
    <div className="bg-card p-6 rounded-2xl shadow-sm border border-border">
      <div className={`w-12 h-12 inline-flex items-center justify-center rounded-xl mb-4 ${iconClass}`}>
        <Icon className="w-6 h-6" />
      </div>
      <h3 className="text-lg font-medium text-foreground">{title}</h3>
      <p className="mt-2 text-base text-muted-foreground">{description}</p>
    </div>
  );
}
