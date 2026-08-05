import Link from 'next/link';
import { notFound } from 'next/navigation';
import InitiativeProgress from '@/components/polls/initiative-progress';
import { getCitizenInitiative } from '@/lib/polls/service';
import { routes } from '@/lib/routes';

export const dynamic = 'force-dynamic';

type PageProps = {
  params: Promise<{ id: string }>;
};

export default async function InitiativeDetailPage({ params }: PageProps) {
  const { id } = await params;
  const initiative = await getCitizenInitiative(id);
  if (!initiative) notFound();

  return (
    <div className="mx-auto max-w-3xl space-y-6 px-4 py-8 sm:px-6">
      <Link href={routes.initiativ} className="text-sm font-medium text-indigo-700 hover:underline">
        ← Alle borgerinitiativ
      </Link>
      <InitiativeProgress initiative={initiative} />
      <article className="rounded-2xl border border-gray-200 bg-white p-5 shadow-sm">
        <h2 className="text-base font-semibold text-gray-900">Full begrunnelse</h2>
        <p className="mt-3 whitespace-pre-wrap text-sm leading-relaxed text-gray-700">{initiative.body}</p>
      </article>
    </div>
  );
}
