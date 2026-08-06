import Link from 'next/link';
import type { ComponentType, ReactNode } from 'react';
import {
  Database,
  Info,
  Lightbulb,
  Lock,
  Map,
  MessageSquarePlus,
  Shield,
  Trophy,
} from 'lucide-react';
import { routes } from '@/lib/routes';

export default function OmOssPage() {
  return (
    <div className="max-w-4xl mx-auto space-y-16 pb-8">
      <div className="text-center space-y-4 pt-4">
        <p className="text-xs font-semibold uppercase tracking-[0.2em] text-[#ba0c2f]">Om oss</p>
        <h1 className="text-4xl font-extrabold text-[#001433] tracking-tight sm:text-5xl">
          Om Folkets Stemme
        </h1>
        <p className="text-lg text-[#001433]/65 max-w-2xl mx-auto leading-relaxed">
          En uavhengig plattform bygget for å styrke demokratiet ved å gi innbyggerne en direkte, verifisert stemme i
          løpende politiske saker.
        </p>
      </div>

      <section className="rounded-2xl border border-[#00205b]/12 bg-white p-8 md:p-11">
        <h2 className="text-2xl font-bold text-[#001433] mb-4">Vår misjon</h2>
        <div className="space-y-4 text-[#001433]/70 text-lg leading-relaxed">
          <p>
            Demokratiet stopper ikke på valgdagen. Mellom valgene fattes det tusenvis av beslutninger på Stortinget som
            påvirker hverdagen vår. Folkets Stemme ble skapt for å tette gapet mellom politikerne og folket i disse
            periodene.
          </p>
          <p>
            Vi tror at hvis politikere får tilgang til reell, verifisert statistikk over hva velgerne deres faktisk
            mener om konkrete saker, vil det føre til bedre og mer representative beslutninger. Samtidig gir det
            innbyggerne en følelse av å bli hørt.
          </p>
        </div>
      </section>

      <section className="grid grid-cols-1 md:grid-cols-3 gap-5">
        <StepCard
          icon={Database}
          accent="blue"
          step="1"
          title="Data fra kilden"
          description="Vi henter saker, forslag og voteringer direkte og ufiltrert fra Stortingets åpne API."
        />
        <StepCard
          icon={Shield}
          accent="red"
          step="2"
          title="Sikker innlogging"
          description="E-post, Google eller SMS. Én konto per person ved soft launch — BankID kommer senere."
        />
        <StepCard
          icon={Info}
          accent="blue"
          step="3"
          title="Anonym innsikt"
          description="Stemmen kobles fra identiteten din. Politikere ser kun aggregerte trender."
        />
      </section>

      <section className="rounded-2xl border border-[#00205b]/12 bg-gradient-to-br from-[#00205b]/[0.04] via-white to-[#ba0c2f]/[0.05] p-8 md:p-11">
        <div className="flex items-center gap-3 mb-6">
          <span className="inline-flex h-10 w-10 items-center justify-center rounded-full border border-[#00205b]/15 bg-white text-[#00205b]">
            <Lock className="h-5 w-5" />
          </span>
          <h2 className="text-2xl font-bold text-[#001433]">Personvern og sikkerhet</h2>
        </div>
        <div className="space-y-5 text-[#001433]/70 leading-relaxed">
          <p>
            Å lagre politiske meninger innebærer behandling av sensitive personopplysninger. Vi bygger plattformen etter
            prinsippet om <strong className="text-[#001433]">innebygd personvern</strong>.
          </p>
          <ul className="space-y-3">
            {[
              ['Dataminimering', 'Vi lagrer kun det som er nødvendig for konto og stemmegivning.'],
              ['Anonymisering', 'Stemmen lagres uten kobling til navn eller fødselsnummer.'],
              ['Norsk lagring', 'Data lagres i Norge eller EU/EØS. Ingen data til tredjeland.'],
              ['Sletting', 'Du kan slette profil og historikk når som helst.'],
            ].map(([label, text]) => (
              <li key={label} className="flex gap-3">
                <span className="mt-2 h-1.5 w-1.5 shrink-0 rounded-full bg-[#ba0c2f]" aria-hidden />
                <span>
                  <strong className="text-[#001433]">{label}:</strong> {text}
                </span>
              </li>
            ))}
          </ul>
        </div>
      </section>

      <section className="rounded-2xl border border-[#00205b]/12 bg-white p-8 md:p-11">
        <div className="flex items-center gap-3 mb-8">
          <span className="inline-flex h-10 w-10 items-center justify-center rounded-full border border-[#ba0c2f]/20 bg-[#ba0c2f]/[0.06] text-[#ba0c2f]">
            <Map className="h-5 w-5" />
          </span>
          <h2 className="text-2xl font-bold text-[#001433]">Veien videre</h2>
        </div>
        <div className="space-y-0">
          <RoadmapItem
            active
            title="Fase 1: Lansering"
            description="Saker fra Stortinget, AI-forenkling, sikker stemmegivning, forum med reels og offentlige profiler."
          />
          <RoadmapItem
            active
            title="Fase 2: Poeng og tillit"
            description="Poeng belønner konstruktiv aktivitet. Pålitelige brukere kan foreslå reels; kuratorer publiserer fra godkjente kilder."
          >
            <div className="mt-4 rounded-2xl border border-[#00205b]/12 bg-[#00205b]/[0.03] p-5">
              <div className="flex items-center gap-2 text-[#00205b] font-semibold">
                <Trophy className="h-4 w-4 text-[#ba0c2f]" />
                Poengnivåer
              </div>
              <ul className="mt-3 space-y-2 text-sm text-[#001433]/70">
                <li>
                  <strong className="text-[#001433]">Aktiv (250):</strong> Synlig merke som bidragsyter.
                </li>
                <li>
                  <strong className="text-[#001433]">Pålitelig (750):</strong> Foreslå forum-reels.
                </li>
                <li>
                  <strong className="text-[#001433]">Kurator (2 000):</strong> Publiser fra godkjente kilder.
                </li>
                <li>
                  <strong className="text-[#001433]">Veteran (5 000):</strong> Foreslå nye kilder.
                </li>
              </ul>
              <Link
                href={routes.login}
                className="mt-4 inline-flex items-center rounded-full bg-[#00205b] px-4 py-2 text-sm font-semibold text-white hover:bg-[#ba0c2f] transition-colors"
              >
                Opprett konto
              </Link>
            </div>
          </RoadmapItem>
          <RoadmapItem
            title="Fase 3: Valgløfter"
            description="Følge politikere og spore om valgløfter holdes over tid."
          />
          <RoadmapItem
            last
            title="Fase 4: Kommune og fylke"
            description="Lokale saker fra kommunestyrer og fylkesting for mer lokal innflytelse."
          />
        </div>
      </section>

      <section className="rounded-2xl border border-[#00205b]/12 bg-gradient-to-br from-[#ba0c2f]/[0.06] via-white to-[#00205b]/[0.08] p-8 md:p-10 flex flex-col md:flex-row items-start md:items-center gap-8">
        <div className="flex-1 space-y-3">
          <div className="flex items-center gap-3 text-[#00205b]">
            <Lightbulb className="h-6 w-6 text-[#ba0c2f]" />
            <h2 className="text-xl font-bold text-[#001433]">Har du en idé eller funnet en feil?</h2>
          </div>
          <p className="text-[#001433]/70 leading-relaxed">
            Plattformen formes av brukerne. Send ønsker, bugs eller tilbakemeldinger — vi leser alt.
          </p>
        </div>
        <Link
          href={routes.innspill}
          className="inline-flex w-full md:w-auto items-center justify-center gap-2 rounded-full bg-[#00205b] px-6 py-3 text-sm font-semibold text-white hover:bg-[#ba0c2f] transition-colors shrink-0"
        >
          <MessageSquarePlus className="h-4 w-4" />
          Send innspill
        </Link>
      </section>

      <div className="text-center pb-6">
        <h2 className="text-2xl font-bold text-[#001433] mb-3">Har du spørsmål?</h2>
        <p className="text-[#001433]/65 mb-6 max-w-lg mx-auto">
          Vi er under utvikling og tar gjerne imot tilbakemeldinger fra både innbyggere og politikere.
        </p>
        <Link
          href={routes.innspill}
          className="inline-flex items-center rounded-full border border-[#00205b]/15 bg-white px-6 py-3 text-sm font-semibold text-[#00205b] hover:border-[#00205b]/40 hover:bg-[#00205b]/[0.04] transition-colors"
        >
          Kontakt oss
        </Link>
      </div>
    </div>
  );
}

function StepCard({
  icon: Icon,
  accent,
  step,
  title,
  description,
}: {
  icon: ComponentType<{ className?: string }>;
  accent: 'red' | 'blue';
  step: string;
  title: string;
  description: string;
}) {
  const iconTone =
    accent === 'red'
      ? 'border-[#ba0c2f]/20 bg-[#ba0c2f]/[0.06] text-[#ba0c2f] group-hover:bg-[#ba0c2f] group-hover:text-white group-hover:border-[#ba0c2f]'
      : 'border-[#00205b]/15 bg-[#00205b]/[0.06] text-[#00205b] group-hover:bg-[#00205b] group-hover:text-white group-hover:border-[#00205b]';

  return (
    <div className="group rounded-2xl border border-[#00205b]/10 bg-white p-7 text-center transition-all hover:border-[#00205b]/30 hover:shadow-[0_8px_30px_rgba(0,32,91,0.06)]">
      <div
        className={`mx-auto mb-5 inline-flex h-14 w-14 items-center justify-center rounded-full border transition-colors ${iconTone}`}
      >
        <Icon className="h-6 w-6" />
      </div>
      <p className="text-xs font-semibold uppercase tracking-widest text-[#ba0c2f] mb-2">Steg {step}</p>
      <h3 className="text-lg font-bold text-[#001433] mb-2">{title}</h3>
      <p className="text-sm text-[#001433]/65 leading-relaxed">{description}</p>
    </div>
  );
}

function RoadmapItem({
  title,
  description,
  active = false,
  last = false,
  children,
}: {
  title: string;
  description: string;
  active?: boolean;
  last?: boolean;
  children?: ReactNode;
}) {
  return (
    <div className={`relative border-l border-[#00205b]/15 pl-6 ${last ? '' : 'pb-8'}`}>
      <div
        className={`absolute -left-[5px] top-1.5 h-2.5 w-2.5 rounded-full ring-4 ring-white ${
          active ? 'bg-[#ba0c2f]' : 'bg-[#00205b]/25'
        }`}
      />
      <h3 className="text-lg font-bold text-[#001433]">{title}</h3>
      <p className="mt-2 text-[#001433]/65 leading-relaxed">{description}</p>
      {children}
    </div>
  );
}
