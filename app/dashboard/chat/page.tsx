import { redirect } from 'next/navigation';
import { chatDeepLinkQuery } from '@/lib/chat/overlay';
import { routes } from '@/lib/routes';

export const dynamic = 'force-dynamic';

type ChatPageProps = {
  searchParams: Promise<{ sak?: string }>;
};

/** Legacy destination — chat now lives in the dashboard orb overlay. */
export default async function ChatPage({ searchParams }: ChatPageProps) {
  const { sak } = await searchParams;
  redirect(`${routes.utforsk}?${chatDeepLinkQuery(sak)}`);
}
