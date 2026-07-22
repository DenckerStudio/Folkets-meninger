import Link from 'next/link';
import { MessageSquarePlus } from 'lucide-react';
import { SakMeningPromptCard } from '@/components/forum/sak-mening-prompt-card';
import { getSakMeningPromptsForIssue } from '@/lib/forum/prompt-queries';
import { routes } from '@/lib/routes';

type SakMeningSectionProps = {
  sakId: string;
  sakTitle: string;
};

export async function SakMeningSection({ sakId, sakTitle }: SakMeningSectionProps) {
  const prompts = await getSakMeningPromptsForIssue(sakId);

  return (
    <section className="rounded-2xl border border-border bg-card p-6 shadow-sm">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h2 className="text-xl font-bold text-foreground">Meninger i forumet</h2>
          <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
            Saker er for å forstå innholdet. Ja/nei-meninger deles i forumet og starter med «(Jeg mener)».
          </p>
        </div>
        <Link
          href={routes.forumMening(sakId)}
          className="inline-flex shrink-0 items-center justify-center gap-2 rounded-xl bg-indigo-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-indigo-700"
        >
          <MessageSquarePlus className="h-4 w-4" />
          Del din mening
        </Link>
      </div>

      {prompts.length > 0 ? (
        <div className="mt-6 space-y-4">
          {prompts.map((prompt) => (
            <SakMeningPromptCard key={prompt.id} prompt={prompt} />
          ))}
        </div>
      ) : (
        <div className="mt-6 rounded-xl border border-dashed border-border bg-muted/30 px-5 py-8 text-center">
          <p className="text-sm text-muted-foreground">
            Ingen har delt en ja/nei-mening om «{sakTitle}» ennå. Vær den første i forumet.
          </p>
        </div>
      )}

      <div className="mt-6 border-t border-border pt-4">
        <Link href={`${routes.forum}?sak=${sakId}`} className="text-sm font-medium text-indigo-600 hover:text-indigo-500">
          Se alle diskusjoner om saken →
        </Link>
      </div>
    </section>
  );
}
