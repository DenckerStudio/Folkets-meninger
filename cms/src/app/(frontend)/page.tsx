import Link from 'next/link';

export default function CmsHomePage() {
  return (
    <main className="mx-auto flex min-h-screen max-w-lg flex-col justify-center gap-4 px-6 py-16 font-sans">
      <h1 className="text-2xl font-bold text-[#001433]">Folkets Meninger CMS</h1>
      <p className="text-sm leading-relaxed text-[#001433]/70">
        Dette er redaksjonssystemet for bloggen. Publisert innhold vises på{' '}
        <code className="rounded bg-[#00205b]/5 px-1">/blogg</code> på hovednettstedet.
      </p>
      <Link
        href="/admin"
        className="inline-flex min-h-11 items-center justify-center rounded-full bg-[#00205b] px-5 text-sm font-semibold text-white hover:bg-[#ba0c2f]"
      >
        Åpne admin
      </Link>
    </main>
  );
}
