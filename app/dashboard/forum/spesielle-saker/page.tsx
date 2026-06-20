import type { Metadata } from 'next';
import Link from 'next/link';
import { Plus, Sparkles } from 'lucide-react';
import { getActiveForumPromptsPage } from '@/lib/forum/prompt-queries';
import { ForumPromptsFeed } from '@/components/forum/forum-prompts-feed';
import { routes } from '@/lib/routes';

export const dynamic = 'force-dynamic';

export const metadata: Metadata = {
  title: 'Spesielle saker | Forum',
  description: 'Kontinuerlig oppdaterte spørsmål og avstemninger fra nyhetsbildet.',
};

export default async function ForumSpesielleSakerPage() {
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

