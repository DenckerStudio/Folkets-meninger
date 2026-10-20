import type { Metadata } from 'next';
import { LandingExperience } from '@/components/landing-experience';
import { blogRssPath } from '@/lib/blog/urls';

export const metadata: Metadata = {
  alternates: {
    types: {
      'application/rss+xml': blogRssPath(),
    },
  },
};

export default function BloggLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-[#f7f8fb] text-[#001433]">
      <LandingExperience>
        <div className="pb-16 pt-6">{children}</div>
      </LandingExperience>
    </div>
  );
}
