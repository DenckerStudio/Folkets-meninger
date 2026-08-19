import Link from 'next/link';
import { notFound } from 'next/navigation';
import InitiativeProgress from '@/components/polls/initiative-progress';
import { isAdmin } from '@/lib/admin/gate';
import { getCitizenInitiative, userHasEndorsedInitiative } from '@/lib/polls/service';
import { getServerSupabase } from '@/lib/supabase-server';
import { routes } from '@/lib/routes';

export const dynamic = 'force-dynamic';

type PageProps = {
  params: Promise<{ id: string }>;
};

export default async function InitiativeDetailPage({ params }: PageProps) {
  const { id } = await params;
  const initiative = await getCitizenInitiative(id);
  if (!initiative) notFound();

  const supabase = await getServerSupabase();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const [endorsed, canPromote] = await Promise.all([
    user ? userHasEndorsedInitiative(user.id, id) : Promise.resolve(false),
    user ? isAdmin(user.id, user.email) : Promise.resolve(false),
  ]);

  return (
    <div className="mx-auto max-w-3xl space-y-6 pb-12">
      <Link href={routes.initiativ} className="text-sm font-medium text-brand hover:underline">
        ← Alle borgerinitiativ
      </Link>
      <InitiativeProgress initiative={initiative} endorsed={endorsed} canPromote={canPromote} />
      <article className="rounded-2xl border border-border bg-card p-5 shadow-sm">
        <h2 className="text-base font-semibold text-foreground">Full begrunnelse</h2>
        <p className="mt-3 whitespace-pre-wrap text-sm leading-relaxed text-muted-foreground">{initiative.body}</p>
      </article>
    </div>
  );
}
