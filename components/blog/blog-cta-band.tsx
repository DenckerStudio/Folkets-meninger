import Link from 'next/link';
import CallToAction from '@/components/ui/call-to-action';
import { blogRssPath } from '@/lib/blog/urls';
import { routes } from '@/lib/routes';

export function BlogCtaBand() {
  return (
    <CallToAction
      title="Få nye forklaringer rett i innboksen"
      subtitle="Én e-post i uka når nyhetsbrevet er klart. Inntil da kan du følge oss via RSS eller opprette konto for å delta i appen."
      primaryButtonText="Følg RSS"
      primaryButtonLink={blogRssPath()}
      secondaryButtonText="Opprett konto"
      secondaryButtonLink={routes.login}
      className="bg-[#00205b] text-white [&_h2]:text-white [&_p]:text-white/80 [&_a:first-of-type]:bg-[#ba0c2f] [&_a:first-of-type]:text-white [&_a:last-of-type]:border-white/30 [&_a:last-of-type]:text-white"
    />
  );
}
