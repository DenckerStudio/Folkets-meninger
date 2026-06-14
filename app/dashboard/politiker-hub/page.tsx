'use client';

import { useState, useEffect, useMemo } from 'react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, PieChart, Pie, Cell } from 'recharts';
import { Users, TrendingUp, MessageSquare, CheckCircle, AlertCircle, Search } from 'lucide-react';
import { getSaker, getPolitikereOversikt, type PolitikerOversikt } from '@/lib/stortinget';
import { formatNumber } from '@/lib/utils';
import Link from 'next/link';
import Image from 'next/image';

const partyLogos: Record<string, string> = {
  'Arbeiderpartiet': 'https://upload.wikimedia.org/wikipedia/commons/thumb/1/15/Arbeiderpartiet_logo.svg/200px-Arbeiderpartiet_logo.svg.png',
  'Høyre': 'https://upload.wikimedia.org/wikipedia/commons/thumb/b/b6/H%C3%B8yre_logo.svg/200px-H%C3%B8yre_logo.svg.png',
  'Senterpartiet': 'https://upload.wikimedia.org/wikipedia/commons/thumb/0/06/Senterpartiet_logo.svg/200px-Senterpartiet_logo.svg.png',
  'Fremskrittspartiet': 'https://upload.wikimedia.org/wikipedia/commons/thumb/b/b2/Fremskrittspartiet_logo.svg/200px-Fremskrittspartiet_logo.svg.png',
  'Sosialistisk Venstreparti': 'https://upload.wikimedia.org/wikipedia/commons/thumb/c/c5/Sosialistisk_Venstreparti_logo.svg/200px-Sosialistisk_Venstreparti_logo.svg.png',
  'Rødt': 'https://upload.wikimedia.org/wikipedia/commons/thumb/d/d4/R%C3%B8dt_logo.svg/200px-R%C3%B8dt_logo.svg.png',
  'Venstre': 'https://upload.wikimedia.org/wikipedia/commons/thumb/1/11/Venstre_logo.svg/200px-Venstre_logo.svg.png',
  'Kristelig Folkeparti': 'https://upload.wikimedia.org/wikipedia/commons/thumb/4/4e/Kristelig_Folkeparti_logo.svg/200px-Kristelig_Folkeparti_logo.svg.png',
  'Miljøpartiet De Grønne': 'https://upload.wikimedia.org/wikipedia/commons/thumb/e/e0/Milj%C3%B8partiet_De_Gr%C3%B8nne_logo.svg/200px-Milj%C3%B8partiet_De_Gr%C3%B8nne_logo.svg.png',
  'Pasientfokus': 'https://upload.wikimedia.org/wikipedia/commons/thumb/9/9d/Pasientfokus_logo.png/200px-Pasientfokus_logo.png',
};

function PolitikerListItem({ rep }: { rep: PolitikerOversikt }) {
  const roleOrLocation = rep.tittel || rep.departement || rep.fylke.navn;

  return (
    <div className="p-4 border border-gray-100 rounded-xl flex items-center bg-gray-50 hover:bg-gray-100 transition-colors">
      <div className="h-12 w-12 rounded-full bg-indigo-100 flex items-center justify-center text-indigo-600 font-bold mr-4 flex-shrink-0 overflow-hidden relative">
        <Image
          src={`https://data.stortinget.no/eksport/personbilde?personid=${encodeURIComponent(rep.id)}&storrelse=lite&erstatningsbilde=true`}
          alt={`${rep.fornavn} ${rep.etternavn}`}
          fill
          className="object-cover"
          sizes="48px"
        />
      </div>
      <div className="overflow-hidden">
        <h3 className="font-semibold text-gray-900 truncate" title={`${rep.fornavn} ${rep.etternavn}`}>
          {rep.fornavn} {rep.etternavn}
        </h3>
        <div className="flex items-center text-xs text-gray-500 mt-1">
          {partyLogos[rep.parti.navn] && (
            <div className="relative w-4 h-4 mr-1.5 flex-shrink-0">
              <Image
                src={partyLogos[rep.parti.navn]}
                alt={`${rep.parti.navn} logo`}
                fill
                className="object-contain"
                referrerPolicy="no-referrer"
              />
            </div>
          )}
          <span className="font-medium text-indigo-600 mr-2">{rep.parti.navn}</span>
          <span className="truncate">{roleOrLocation}</span>
        </div>
      </div>
    </div>
  );
}

export default function PolitikerHubPage() {
  const [isVerified, setIsVerified] = useState(false);
  const [isMounted, setIsMounted] = useState(false);
  const [issues, setIssues] = useState<any[]>([]);
  const [politikere, setPolitikere] = useState<PolitikerOversikt[]>([]);
  const [repSearchQuery, setRepSearchQuery] = useState('');
  const [showAllPolitikere, setShowAllPolitikere] = useState(false);

  const categoryStats = useMemo(() => {
    const stats: Record<string, number> = {};
    let total = 0;
    issues.forEach(issue => {
      const eng = issue.votes?.total || 0;
      stats[issue.category] = (stats[issue.category] || 0) + eng;
      total += eng;
    });
    return Object.entries(stats)
      .map(([name, value]) => ({ 
        name: name.length > 20 ? name.substring(0, 20) + '...' : name, 
        value,
        percentage: total > 0 ? Math.round((value / total) * 100) : 0,
        fullName: name
      }))
      .sort((a, b) => b.value - a.value);
  }, [issues]);

  useEffect(() => {
    let isMountedLocal = true;
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setIsMounted(true);
    getSaker().then((data) => {
      if (isMountedLocal) {
        setIssues(data);
      }
    });
    getPolitikereOversikt().then((data) => {
      if (isMountedLocal) {
        setPolitikere(data);
      }
    });
    fetch('/api/user/politician-status')
      .then(res => res.json())
      .then(data => {
        if (isMountedLocal) setIsVerified(data.isVerified || false);
      })
      .catch(() => {});
    return () => {
      isMountedLocal = false;
    };
  }, []);

  const filteredPolitikere = useMemo(() => {
    if (!repSearchQuery.trim()) return politikere;
    const query = repSearchQuery.toLowerCase();
    return politikere.filter(
      (rep) =>
        rep.fornavn.toLowerCase().includes(query) ||
        rep.etternavn.toLowerCase().includes(query) ||
        rep.parti.navn.toLowerCase().includes(query) ||
        rep.fylke.navn.toLowerCase().includes(query) ||
        (rep.tittel?.toLowerCase().includes(query) ?? false) ||
        (rep.departement?.toLowerCase().includes(query) ?? false)
    );
  }, [politikere, repSearchQuery]);

  const regjeringsmedlemmer = useMemo(
    () =>
      filteredPolitikere
        .filter((p) => p.erRegjeringsmedlem)
        .sort((a, b) => (a.regjeringsSortering ?? 999) - (b.regjeringsSortering ?? 999)),
    [filteredPolitikere]
  );

  const andrePolitikere = useMemo(
    () =>
      filteredPolitikere
        .filter((p) => !p.erRegjeringsmedlem)
        .sort((a, b) => a.etternavn.localeCompare(b.etternavn, 'no')),
    [filteredPolitikere]
  );

  const displayedAndre = repSearchQuery || showAllPolitikere ? andrePolitikere : andrePolitikere.slice(0, 12);

  if (!isVerified) {
    return (
      <div className="max-w-md mx-auto mt-20 text-center">
        <h2 className="text-3xl font-bold text-gray-900 mb-4">Politiker-verifisering</h2>
        <p className="text-gray-600 mb-8">Logg inn med din @stortinget.no e-post for å få tilgang til innsikt og statistikk for ditt distrikt.</p>
        <p className="text-sm text-gray-500">
          Kontakt administrator for å knytte din konto til en verifisert politikerprofil.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-8">
      <div className="bg-white p-8 rounded-3xl shadow-sm border border-gray-100">
        <h1 className="text-2xl font-bold text-gray-900">Politiker-hub</h1>
        <p className="text-gray-600 mt-2 flex items-center gap-1">
          <CheckCircle className="w-4 h-4 text-emerald-500" />
          Verifisert konto — aggregert engasjement fra anonyme stemmer i appen.
        </p>
      </div>

      {/* Main Stats */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        
        {/* Left Column: Specific Issue Analysis */}
        <div className="lg:col-span-2 space-y-8">
          <div className="bg-white p-8 rounded-3xl shadow-sm border border-gray-100">
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-xl font-bold text-gray-900">Engasjement per kategori</h2>
            </div>
            
            <p className="text-gray-600 mb-8">
              Oversikt over hvilke politiske saksområder som skaper mest engasjement blant innbyggerne.
            </p>

            <div className="h-80 w-full">
              {isMounted ? (
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart
                    data={categoryStats.slice(0, 5)}
                    margin={{ top: 20, right: 30, left: 20, bottom: 5 }}
                  >
                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e5e7eb" />
                    <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{fontSize: 12}} interval={0} />
                    <YAxis axisLine={false} tickLine={false} />
                    <Tooltip cursor={{fill: '#f3f4f6'}} contentStyle={{borderRadius: '8px', border: 'none', boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1)'}} />
                    <Bar dataKey="value" name="Engasjement" fill="#4f46e5" radius={[4, 4, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              ) : (
                <div className="w-full h-full bg-gray-50 rounded-xl animate-pulse"></div>
              )}
            </div>
            
            <div className="mt-8 bg-indigo-50 rounded-xl p-6 border border-indigo-100">
              <h3 className="text-lg font-semibold text-indigo-900 mb-2 flex items-center">
                <TrendingUp className="w-5 h-5 mr-2" />
                AI-Analyse av trenden
              </h3>
              <p className="text-indigo-800">
                Basert på data fra Stortinget ser vi at saker innen <strong>{categoryStats[0]?.fullName || 'visse kategorier'}</strong> skaper desidert mest engasjement for tiden. Dette indikerer at velgerne er spesielt opptatt av disse temaene i den nåværende politiske debatten.
              </p>
            </div>
          </div>

          {/* Direct Response Feature */}
          <div className="bg-white p-8 rounded-3xl shadow-sm border border-gray-100">
            <h2 className="text-xl font-bold text-gray-900 mb-4 flex items-center">
              <MessageSquare className="w-5 h-5 mr-2 text-indigo-600" />
              Publiser ditt svar
            </h2>
            <p className="text-gray-600 mb-4">
              Forklar velgerne hvorfor du stemte som du gjorde, eller hva partiet ditt mener om saken. Dette vil vises øverst for alle brukere fra Hordaland som ser på denne saken.
            </p>
            <textarea 
              rows={4} 
              className="w-full border border-gray-300 rounded-xl p-4 focus:ring-indigo-500 focus:border-indigo-500 mb-4"
              placeholder="Skriv din kommentar her..."
            ></textarea>
            <div className="flex justify-end">
              <button className="px-6 py-2 bg-indigo-600 text-white font-medium rounded-lg hover:bg-indigo-700 transition-colors">
                Publiser offisielt svar
              </button>
            </div>
          </div>
        </div>

        {/* Right Column: Quick Stats & Alerts */}
        <div className="space-y-8">
          <div className="bg-white p-6 rounded-3xl shadow-sm border border-gray-100">
            <h3 className="text-lg font-bold text-gray-900 mb-4">Mest engasjerende saker</h3>
            <p className="text-sm text-gray-500 mb-4">Saker med flest unike stemmer fra Hordaland.</p>
            <div className="space-y-3">
              {issues.slice(0, 3).map((issue, index) => (
                <Link href={`/dashboard/sak/${issue.id}`} key={issue.id} className="block p-4 bg-gray-50 rounded-xl hover:bg-gray-100 transition-colors border border-gray-100">
                  <div className="flex justify-between items-start mb-2">
                    <span className="text-sm font-medium text-indigo-600 line-clamp-2 pr-4">{issue.title}</span>
                    <span className="text-sm font-bold text-gray-400 whitespace-nowrap">#{index + 1}</span>
                  </div>
                  <div className="flex items-center justify-between text-xs text-gray-500">
                    <span className="truncate max-w-[120px]">{issue.category}</span>
                    <span className="flex items-center whitespace-nowrap"><Users className="w-3 h-3 mr-1"/> {formatNumber(Math.floor(issue.votes.total * 0.12))}</span>
                  </div>
                </Link>
              ))}
            </div>
          </div>

          <div className="bg-white p-6 rounded-3xl shadow-sm border border-gray-100">
            <h3 className="text-lg font-bold text-gray-900 mb-4">Kategorifordeling</h3>
            <div className="space-y-4">
              {categoryStats.slice(0, 5).map((stat, index) => (
                <div key={stat.name} className="flex items-center justify-between p-4 bg-gray-50 rounded-xl">
                  <div className="flex items-center">
                    <div className={`w-2 h-2 rounded-full mr-2 ${['bg-emerald-500', 'bg-blue-500', 'bg-amber-500', 'bg-purple-500', 'bg-rose-500'][index % 5]}`}></div>
                    <span className="text-sm font-medium text-gray-700 truncate max-w-[150px]" title={stat.fullName}>{stat.fullName}</span>
                  </div>
                  <span className="text-sm font-bold text-gray-900">{stat.percentage}%</span>
                </div>
              ))}
              {categoryStats.length === 0 && (
                <div className="text-sm text-gray-500 text-center py-4">Ingen data tilgjengelig</div>
              )}
            </div>
          </div>
        </div>

      </div>

      {/* Verified Politicians List */}
      <div className="bg-white p-8 rounded-3xl shadow-sm border border-gray-100">
        <div className="flex flex-col md:flex-row md:items-center justify-between mb-6 gap-4">
          <div>
            <h2 className="text-xl font-bold text-gray-900 flex items-center">
              <CheckCircle className="w-5 h-5 mr-2 text-indigo-600" />
              Verifiserte Politikere
            </h2>
            <p className="text-gray-600 mt-2">
              Dette er listen over politikere som har verifisert seg på plattformen og aktivt deltar i dialogen.
            </p>
          </div>
          <div className="relative w-full md:w-72">
            <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
              <Search className="h-4 w-4 text-gray-400" />
            </div>
            <input
              type="text"
              value={repSearchQuery}
              onChange={(e) => setRepSearchQuery(e.target.value)}
              className="block w-full pl-10 pr-3 py-2 border border-gray-300 rounded-xl leading-5 bg-gray-50 placeholder-gray-500 focus:outline-none focus:bg-white focus:ring-1 focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm transition-colors"
              placeholder="Søk på navn, parti eller fylke..."
            />
          </div>
        </div>
        
        {filteredPolitikere.length === 0 ? (
          <div className="text-center py-8 text-gray-500">
            Ingen politikere funnet som matcher &quot;{repSearchQuery}&quot;.
          </div>
        ) : (
          <div className="space-y-8">
            {regjeringsmedlemmer.length > 0 && (
              <div>
                <h3 className="text-sm font-semibold uppercase tracking-wide text-amber-700 mb-3">Regjeringen</h3>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                  {regjeringsmedlemmer.map((rep) => (
                    <PolitikerListItem key={rep.id} rep={rep} />
                  ))}
                </div>
              </div>
            )}
            {displayedAndre.length > 0 && (
              <div>
                {regjeringsmedlemmer.length > 0 && (
                  <h3 className="text-sm font-semibold uppercase tracking-wide text-gray-500 mb-3">
                    Stortingsrepresentanter
                  </h3>
                )}
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                  {displayedAndre.map((rep) => (
                    <PolitikerListItem key={rep.id} rep={rep} />
                  ))}
                </div>
              </div>
            )}
          </div>
        )}

        {!repSearchQuery && andrePolitikere.length > 12 && !showAllPolitikere && (
          <div className="mt-6 text-center">
            <button
              type="button"
              onClick={() => setShowAllPolitikere(true)}
              className="text-indigo-600 font-medium hover:text-indigo-800 text-sm"
            >
              Vis alle {filteredPolitikere.length} politikere
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
