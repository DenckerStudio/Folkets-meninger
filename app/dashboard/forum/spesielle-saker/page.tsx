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
            <Sparkles className="w-5 h-5 text-indigo-600" />
            <h1 className="text-2xl font-bold text-gray-900">Spesielle saker</h1>
          </div>
        </header>

        <div className="rounded-2xl border border-dashed border-indigo-200 bg-indigo-50/50 p-8 text-center">
          <Clock className="mx-auto mb-4 h-10 w-10 text-indigo-400" />
          <h2 className="text-lg font-semibold text-gray-900">Kommer snart</h2>
          <p className="mx-auto mt-2 max-w-md text-sm text-gray-600">
            Vi forbereder nye spørsmål og avstemninger fra nyhetsbildet. Funksjonen rulles ut til alle
            brukere når kvaliteten er på plass.
          </p>
          <Link
            href={routes.forumForeslaReel}
            className="mt-6 inline-flex items-center gap-2 rounded-xl border border-indigo-200 bg-white px-4 py-2 text-sm font-semibold text-indigo-700 hover:bg-indigo-50"
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
            <Sparkles className="w-5 h-5 text-indigo-600" />
            <h1 className="text-2xl font-bold text-gray-900">Spesielle saker</h1>
          </div>
          <p className="text-sm text-gray-600 mt-1">
            Nye spørsmål legges inn fortløpende. Scroll for å laste flere.
          </p>
        </div>
        <Link
          href={routes.forumForeslaReel}
          className="inline-flex items-center gap-2 rounded-xl border border-indigo-200 bg-indigo-50 px-4 py-2 text-sm font-semibold text-indigo-700 hover:bg-indigo-100"
        >
          <Plus className="h-4 w-4" />
          Foreslå reel
        </Link>
      </header>

      <ForumPromptsFeed initialItems={page.items} initialCursor={page.nextCursor} />
    </div>
  );
}
