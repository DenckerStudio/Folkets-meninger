import { fetchStortingetHoringer } from '@/lib/stortinget-horinger';
import HoringerList from '@/components/horinger/horinger-list';

export const dynamic = 'force-dynamic';

export default async function HoringerPage() {
  let hearings: Awaited<ReturnType<typeof fetchStortingetHoringer>> = [];
  try {
    hearings = await fetchStortingetHoringer();
  } catch (error) {
    console.error('Error fetching horinger:', error);
  }

  return (
    <div className="max-w-5xl mx-auto space-y-12 pb-12">
      <div className="bg-white p-8 md:p-12 border border-blue-100 shadow-sm rounded-3xl relative overflow-hidden">
        <div className="absolute top-0 right-0 w-64 h-64 bg-emerald-50 rounded-full blur-3xl -mr-20 -mt-20 opacity-50 pointer-events-none" />
        <div className="relative z-10">
          <h1 className="text-4xl md:text-5xl font-extrabold text-[#00205b] mb-4 tracking-tight">Høringer</h1>
          <p className="text-lg md:text-xl text-gray-600 max-w-2xl leading-relaxed">
            Se alle nåværende og nyligste høringer fra Stortinget. Her kan du si din mening før beslutninger blir tatt.
            Innspill vises med ditt navn.
          </p>
        </div>
      </div>

      {hearings.length === 0 ? (
        <div className="text-center py-12 text-gray-500">
          Klarte ikke å hente høringer. Prøv igjen senere.
        </div>
      ) : (
        <HoringerList hearings={hearings} />
      )}
    </div>
  );
}
