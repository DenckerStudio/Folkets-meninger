import FadeIn from '@/components/fade-in';
import { getPolitikereOversikt } from '@/lib/stortinget';
import PolitikereExplorer from './politikere-explorer';

export const dynamic = 'force-dynamic';

export default async function PolitikerePage() {
  const politikere = await getPolitikereOversikt();

  return (
    <div className="space-y-12 pb-12">
      <FadeIn delay={0.1}>
        <div className="bg-white rounded-[2.5rem] shadow-sm border border-gray-100 p-8 md:p-12 text-center relative overflow-hidden">
          <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[600px] h-[300px] bg-indigo-500/5 blur-[80px] rounded-full pointer-events-none" />
          <div className="relative z-10">
            <h1 className="text-4xl font-extrabold text-gray-900 sm:text-5xl mb-6 tracking-tight">
              Politiker-hub
            </h1>
            <p className="text-lg text-gray-600 max-w-2xl mx-auto leading-relaxed">
              Her finner du oversikt over stortingsrepresentanter og regjeringsmedlemmer.
              Verifiserte politikere kan svare direkte på saker og se anonymisert statistikk fra sine velgere.
            </p>
          </div>
        </div>
      </FadeIn>

      <PolitikereExplorer politikere={politikere} />
    </div>
  );
}
