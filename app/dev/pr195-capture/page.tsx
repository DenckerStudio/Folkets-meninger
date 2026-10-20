'use client';

import { ContentFeedbackPanel } from '@/components/admin/content-feedback-panel';

export default function Pr195CapturePage() {
  return (
    <main className="mx-auto max-w-3xl space-y-8 p-4 sm:p-8">
      <section id="panel-approve" aria-label="Godkjenn">
        <ContentFeedbackPanel
          contentType="reel"
          contentId="00000000-0000-4000-8000-000000000001"
          lockedVerdict="approve"
          contentSubjectTitle="Bør Norge forby salg av engangsplast?"
          title="Hva fungerte med utkastet?"
          description="Valgfritt, men hjelper oss å forbedre neste generering."
          onSkip={() => undefined}
        />
      </section>
      <section id="panel-reject" aria-label="Avvis">
        <ContentFeedbackPanel
          contentType="reel"
          contentId="00000000-0000-4000-8000-000000000002"
          lockedVerdict="reject"
          contentSubjectTitle="Bør staten øke støtten til næringslivet i distriktene?"
          title="Hva fungerte med utkastet?"
          description="Valgfritt, men hjelper oss å forbedre neste generering."
          onSkip={() => undefined}
        />
      </section>
      <section id="panel-vurdert" aria-label="Vurdert">
        <ContentFeedbackPanel
          contentType="reel"
          contentId="00000000-0000-4000-8000-000000000003"
          contentSubjectTitle="Skal offentlig sektor kreve grønn innkjøpsstandard?"
          title="Hva fungerte med utkastet?"
          description="Valgfritt, men hjelper oss å forbedre neste generering."
          onSkip={() => undefined}
        />
      </section>
    </main>
  );
}
