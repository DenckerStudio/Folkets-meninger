import type { Metadata } from 'next';
import Link from 'next/link';
import { Clock, Plus, Sparkles } from 'lucide-react';
import { getActiveForumPromptsPage } from '@/lib/forum/prompt-queries';
import { canViewForumReels } from '@/lib/forum/reels-visibility';
import { ForumPromptsFeed } from '@/components/forum/forum-prompts-feed';
import { routes } from '@/lib/routes';

export const dynamic = 'force-dynamic';

export const metadata: Metadata = {
  title: 'Spesielle saker | Forum',
  description: 'Kontinuerlig oppdaterte spørsmål og avstemninger fra nyhetsbildet.',
};

export default async function ForumSpesielleSakerPage() {
  const reelsVisible = await canViewForumReels();

  if (!reelsVisible) {
    return (
      <div className="space-y-6">
        <header>
          <div className="flex items-center gap-2">
            <Sparkles className="w-5 h-5 text-indigo-600 dark:text-indigo-400" />
            <h1 className="text-2xl font-bold text-foreground">Spesielle saker</h1>
          </div>
        </header>

        <div className="rounded-2xl border border-dashed border-indigo-200 bg-indigo-50 dark:bg-indigo-950/40/50 p-8 text-center">
          <Clock className="mx-auto mb-4 h-10 w-10 text-indigo-400" />
          <h2 className="text-lg font-semibold text-foreground">Kommer snart</h2>
          <p className="mx-auto mt-2 max-w-md text-sm text-muted-foreground">
            Vi fyller opp med grounded spørsmål (Stortinget-sak RAG og Regjeringen) før Spesielle
            saker åpnes for alle. Forum-admin godkjenner utkast i pipeline-fanen.
          </p>
          <Link
            href={routes.forumForeslaReel}
            className="mt-6 inline-flex items-center gap-2 rounded-xl border border-indigo-200 dark:border-indigo-800 bg-card px-4 py-2 text-sm font-semibold text-indigo-700 hover:bg-indigo-50 dark:bg-indigo-950/40"
          >
            <Plus className="h-4 w-4" />
            Foreslå reel (Pålitelig+)
          </Link>
        </div>
      </div>
    );
  }

  const page = await getActiveForumPromptsPage({ limit: 16 });

  return (
    <div className="space-y-6">
      <header className="flex items-start justify-between gap-3">
        <div>
          <div className="flex items-center gap-2">
            <Sparkles className="w-5 h-5 text-indigo-600 dark:text-indigo-400" />
            <h1 className="text-2xl font-bold text-foreground">Spesielle saker</h1>
          </div>
          <p className="text-sm text-muted-foreground mt-1">
            Nye spørsmål legges inn fortløpende. Scroll for å laste flere.
          </p>
        </div>
        <Link
          href={routes.forumForeslaReel}
          className="inline-flex items-center gap-2 rounded-xl border border-indigo-200 bg-indigo-50 dark:bg-indigo-950/40 px-4 py-2 text-sm font-semibold text-indigo-700 hover:bg-indigo-100 dark:bg-indigo-950/50"
        >
          <Plus className="h-4 w-4" />
          Foreslå reel
        </Link>
      </header>

      {page.items.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-indigo-200 bg-indigo-50/60 p-8 text-center dark:border-indigo-900 dark:bg-indigo-950/30">
          <Sparkles className="mx-auto mb-3 h-8 w-8 text-indigo-400" />
          <h2 className="text-lg font-semibold text-foreground">Ingen aktive spørsmål akkurat nå</h2>
          <p className="mx-auto mt-2 max-w-md text-sm text-muted-foreground">
            Nye reels dukker opp fortløpende fra nyhetsbildet og Stortinget-saker. Foreslå et spørsmål
            mens du venter — Pålitelig+ kan sende inn.
          </p>
          <Link
            href={routes.forumForeslaReel}
            className="mt-5 inline-flex items-center gap-2 rounded-full bg-indigo-600 px-5 py-2.5 text-sm font-semibold text-white hover:bg-indigo-500"
          >
            <Plus className="h-4 w-4" />
            Foreslå reel
          </Link>
        </div>
      ) : (
        <ForumPromptsFeed initialItems={page.items} initialCursor={page.nextCursor} />
      )}
    </div>
  );
}
