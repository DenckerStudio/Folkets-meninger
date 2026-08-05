import Link from 'next/link';
import InitiativeProgress from '@/components/polls/initiative-progress';
import { CreateInitiativeForm } from '@/components/polls/create-initiative-form';
import { listCitizenInitiatives } from '@/lib/polls/service';
import { routes } from '@/lib/routes';

export const dynamic = 'force-dynamic';

export default async function InitiativPage() {
  const initiatives = await listCitizenInitiatives(40);

  return (
    <div className="mx-auto max-w-4xl px-4 py-8 sm:px-6">
      <header className="mb-8">
        <p className="text-sm font-semibold uppercase tracking-wide text-[#00205b]/70">Borgersporet</p>
        <h1 className="mt-1 text-3xl font-semibold tracking-tight text-gray-900">Borgerinitiativ</h1>
        <p className="mt-2 max-w-2xl text-sm leading-relaxed text-gray-600">
          Foreslå en sak i forumet. Når nok innbyggere støtter initiativet, kan det oppgraderes til en
          nasjonal Ja/Nei/Blank-avstemning.
        </p>
        <Link href={routes.avstemninger} className="mt-3 inline-block text-sm font-medium text-indigo-700 hover:underline">
          Se nasjonale avstemninger
        </Link>
      </header>

      <div className="mb-8">
        <CreateInitiativeForm />
      </div>

      {initiatives.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-gray-300 bg-white px-6 py-10 text-center text-sm text-gray-600">
          Ingen borgerinitiativ ennå. Vær den første til å foreslå en sak.
        </div>
      ) : (
        <div className="space-y-4">
          {initiatives.map((initiative) => (
            <InitiativeProgress key={initiative.id} initiative={initiative} />
          ))}
        </div>
      )}
    </div>
  );
}
