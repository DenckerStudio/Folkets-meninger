import { Info, Shield, Database, Lock, Map, Lightbulb, MessageSquarePlus } from 'lucide-react';

export default function OmOssPage() {
  return (
    <div className="max-w-4xl mx-auto space-y-12">
      {/* Header */}
      <div className="text-center space-y-4">
        <h1 className="text-4xl font-extrabold text-gray-900 tracking-tight sm:text-5xl">
          Om Folkets Stemme
        </h1>
        <p className="text-xl text-gray-500 max-w-2xl mx-auto">
          En uavhengig plattform bygget for å styrke demokratiet ved å gi innbyggerne en direkte, verifisert stemme i løpende politiske saker.
        </p>
      </div>

      {/* Mission */}
      <div className="bg-white rounded-3xl shadow-sm border border-gray-100 p-8 md:p-12">
        <h2 className="text-2xl font-bold text-gray-900 mb-4">Vår misjon</h2>
        <div className="prose prose-indigo max-w-none text-gray-600">
          <p className="text-lg leading-relaxed">
            Demokratiet stopper ikke på valgdagen. Mellom valgene fattes det tusenvis av beslutninger på Stortinget som påvirker hverdagen vår. 
            Folkets Stemme ble skapt for å tette gapet mellom politikerne og folket i disse periodene.
          </p>
          <p className="text-lg leading-relaxed mt-4">
            Vi tror at hvis politikere får tilgang til reell, verifisert statistikk over hva velgerne deres faktisk mener om konkrete saker, 
            vil det føre til bedre og mer representative beslutninger. Samtidig gir det innbyggerne en følelse av å bli hørt.
          </p>
        </div>
      </div>

      {/* How it works */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
        <div className="bg-white p-8 rounded-3xl shadow-sm border border-gray-100 text-center">
          <div className="mx-auto w-16 h-16 bg-indigo-100 text-indigo-600 rounded-2xl flex items-center justify-center mb-6">
            <Database className="w-8 h-8" />
          </div>
          <h3 className="text-xl font-bold text-gray-900 mb-3">1. Data fra kilden</h3>
          <p className="text-gray-600">
            Vi henter alle saker, forslag og voteringer direkte og ufiltrert fra Stortingets åpne API (data.stortinget.no).
          </p>
        </div>

        <div className="bg-white p-8 rounded-3xl shadow-sm border border-gray-100 text-center">
          <div className="mx-auto w-16 h-16 bg-emerald-100 text-emerald-600 rounded-2xl flex items-center justify-center mb-6">
            <Shield className="w-8 h-8" />
          </div>
          <h3 className="text-xl font-bold text-gray-900 mb-3">2. Sikker innlogging</h3>
          <p className="text-gray-600">
            Du logger inn med e-post, Google eller SMS. Det reduserer spam og troll, og gir én konto per person ved soft launch. BankID kommer senere.
          </p>
        </div>

        <div className="bg-white p-8 rounded-3xl shadow-sm border border-gray-100 text-center">
          <div className="mx-auto w-16 h-16 bg-amber-100 text-amber-600 rounded-2xl flex items-center justify-center mb-6">
            <Info className="w-8 h-8" />
          </div>
          <h3 className="text-xl font-bold text-gray-900 mb-3">3. Anonym innsikt</h3>
          <p className="text-gray-600">
            Når du stemmer, kobles stemmen fra din identitet. Politikere ser kun aggregerte trender (f.eks. aldersgrupper i et fylke).
          </p>
        </div>
      </div>

      {/* Privacy & Security */}
      <div className="bg-gray-50 rounded-3xl p-8 md:p-12 border border-gray-200">
        <div className="flex items-center mb-6">
          <Lock className="w-8 h-8 text-indigo-600 mr-4" />
          <h2 className="text-2xl font-bold text-gray-900">Personvern og sikkerhet (GDPR)</h2>
        </div>
        
        <div className="space-y-6 text-gray-600">
          <p>
            Å lagre politiske meninger innebærer behandling av sensitive personopplysninger. Vi tar dette på største alvor og bygger plattformen etter prinsippet om <strong>innebygd personvern (Privacy by Design)</strong>.
          </p>
          
          <ul className="list-disc pl-5 space-y-3">
            <li><strong>Dataminimering:</strong> Vi lagrer kun det som er nødvendig for konto og stemmegivning i soft launch.</li>
            <li><strong>Anonymisering:</strong> I det øyeblikket du avgir en stemme, lagres den i en separat database uten kobling til ditt navn eller fødselsnummer.</li>
            <li><strong>Norsk lagring:</strong> All data lagres på servere fysisk plassert i Norge eller EU/EØS. Ingen data sendes til tredjeland.</li>
            <li><strong>Sletting:</strong> Du kan når som helst slette din profil og all tilknyttet historikk med ett klikk.</li>
          </ul>
        </div>
      </div>

      {/* Roadmap */}
      <div className="bg-white rounded-3xl shadow-sm border border-gray-100 p-8 md:p-12">
        <div className="flex items-center mb-6">
          <Map className="w-8 h-8 text-emerald-600 mr-4" />
          <h2 className="text-2xl font-bold text-gray-900">Veien videre (Roadmap)</h2>
        </div>
        <div className="space-y-8">
          <div className="relative border-l-2 border-emerald-200 pl-6 pb-2">
            <div className="absolute w-4 h-4 bg-emerald-500 rounded-full -left-[9px] top-1 ring-4 ring-white"></div>
            <h3 className="text-lg font-bold text-gray-900">Fase 1: Lansering & Kjernefunksjonalitet (Nå)</h3>
            <p className="text-gray-600 mt-2">Visning av saker fra Stortinget, forenkling av tekst med AI, og sikker innlogging for å avgi stemme på saker og høringer.</p>
          </div>
          <div className="relative border-l-2 border-gray-200 pl-6 pb-2">
            <div className="absolute w-4 h-4 bg-gray-300 rounded-full -left-[9px] top-1 ring-4 ring-white"></div>
            <h3 className="text-lg font-bold text-gray-900">Fase 2: Interaksjon & Valgløfter</h3>
            <p className="text-gray-600 mt-2">Lansering av diskusjonsforum, mulighet for å følge politikere, og sporing av hvorvidt politikere holder sine valgløfter over tid.</p>
          </div>
          <div className="relative border-l-2 border-transparent pl-6">
            <div className="absolute w-4 h-4 bg-gray-300 rounded-full -left-[9px] top-1 ring-4 ring-white"></div>
            <h3 className="text-lg font-bold text-gray-900">Fase 3: Kommune & Fylkesnivå</h3>
            <p className="text-gray-600 mt-2">Utvidelse av datagrunnlaget til å inkludere lokale politiske saker fra kommunestyrer og fylkesting for mer lokal innflytelse.</p>
          </div>
        </div>
      </div>

      {/* Feedback & Ideas */}
      <div className="bg-indigo-50 rounded-3xl shadow-sm border border-indigo-100 p-8 md:p-12 flex flex-col md:flex-row items-center gap-8">
        <div className="flex-1 space-y-4">
          <div className="flex items-center text-indigo-600">
            <Lightbulb className="w-8 h-8 mr-4" />
            <h2 className="text-2xl font-bold text-gray-900">Har du en idé eller funnet en feil?</h2>
          </div>
          <p className="text-gray-700 text-lg leading-relaxed">
            Folkets Stemme utvikles kontinuerlig, og vi ønsker at plattformen skal formes av brukerne. Har du ønsker om ny funksjonalitet, funnet en bug, eller har generelle tilbakemeldinger?
          </p>
          <p className="text-indigo-800 font-medium">Bruk knappen for å sende oss dine innspill!</p>
        </div>
        <div className="flex-shrink-0 w-full md:w-auto">
          <a href="mailto:feedback@folketsstemme.no?subject=Innspill%20til%20Folkets%20Stemme" className="w-full md:w-auto flex items-center justify-center px-8 py-4 border border-transparent text-lg font-medium rounded-xl shadow-sm text-white bg-indigo-600 hover:bg-indigo-700 transition-colors">
            <MessageSquarePlus className="w-5 h-5 mr-2" />
            Send innspill
          </a>
        </div>
      </div>

      {/* FAQ / Contact */}
      <div className="text-center pb-12">
        <h2 className="text-2xl font-bold text-gray-900 mb-4">Har du spørsmål?</h2>
        <p className="text-gray-600 mb-6">
          Vi er under utvikling og tar gjerne imot tilbakemeldinger fra både innbyggere og politikere.
        </p>
        <a href="mailto:kontakt@folketsstemme.no" className="inline-flex items-center px-6 py-3 border border-transparent text-base font-medium rounded-xl shadow-sm text-white bg-indigo-600 hover:bg-indigo-700">
          Kontakt oss
        </a>
      </div>
    </div>
  );
}
