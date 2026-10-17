import { InnspillForm } from '@/components/innspill-form';
import { buildPageMetadata } from '@/lib/seo/metadata';

export const metadata = buildPageMetadata({
  title: 'Gi innspill',
  description: 'Skriv til Folkets Meninger med en idé, en feil eller et spørsmål.',
  canonicalPath: '/innspill',
});

type InnspillPageProps = {
  searchParams: Promise<{ kategori?: string; side?: string }>;
};

export default async function InnspillPage({ searchParams }: InnspillPageProps) {
  const params = await searchParams;

  return (
    <div className="mx-auto max-w-2xl space-y-10 pb-8">
      <div className="space-y-4 pt-4 text-center">
        <p className="text-xs font-semibold uppercase tracking-[0.2em] text-[#ba0c2f]">Kontakt</p>
        <h1 className="text-4xl font-extrabold tracking-tight text-[#001433] sm:text-5xl">
          Gi innspill
        </h1>
        <p className="mx-auto max-w-xl text-lg leading-relaxed text-[#001433]/65">
          Send en idé, meld fra om en feil, eller si fra hvis et sammendrag virker skjevt.
        </p>
      </div>

      <InnspillForm initialCategory={params.kategori} initialPagePath={params.side} />

      <p className="text-center text-sm text-[#001433]/50">
        Du kan også nå oss på{' '}
        <a
          href="mailto:kontakt@folkets-meninger.no"
          className="font-medium text-[#00205b] underline-offset-2 hover:text-[#ba0c2f] hover:underline"
        >
          kontakt@folkets-meninger.no
        </a>
        .
      </p>
    </div>
  );
}
