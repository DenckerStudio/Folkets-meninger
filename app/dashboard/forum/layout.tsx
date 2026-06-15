import { ForumMobileRules } from '@/components/forum/forum-mobile-rules';

export default function ForumLayout({ children }: { children: React.ReactNode }) {
  return (
    <>
      <ForumMobileRules />
      {children}
    </>
  );
}
