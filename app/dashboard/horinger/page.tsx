import { fetchStortingetHoringer, sortHoringer } from '@/lib/stortinget-horinger';
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
    <div className="space-y-8 pb-12">
      <div className="bg-white p-8 md:p-10 border border-gray-100 shadow-sm rounded-3xl">
        <h1 className="text-3xl md:text-4xl font-extrabold text-[#00205b] mb-3 tracking-tight">Høringer</h1>
        <p className="text-base md:text-lg text-gray-600 max-w-2xl leading-relaxed">
          Se høringer fra Stortinget. Søk, filtrer og gi innspill før fristen — eller les hva andre mener.
        </p>
      </div>

      {hearings.length === 0 ? (
        <div className="text-center py-12 text-gray-500">
          Klarte ikke å hente høringer. Prøv igjen senere.
        </div>
      ) : (
        <HoringerList hearings={sortHoringer(hearings)} />
      )}
    </div>
  );
}
