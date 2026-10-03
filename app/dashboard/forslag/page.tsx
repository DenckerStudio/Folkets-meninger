import { PageHeader } from '@/components/page-header';
import { SuggestionForm } from '@/components/forslag/suggestion-form';

export const metadata = {
  title: 'Forslag',
  description: 'Send et kort forslag til forbedring av Folkets Stemme.',
};

export default function ForslagPage() {
  return (
    <div className="mx-auto max-w-2xl space-y-8 pb-12">
      <PageHeader
        title="Forslag"
        description="Har du en idé til Folkets Stemme? Send et kort forslag — vi leser alt."
      />
      <SuggestionForm />
    </div>
  );
}
