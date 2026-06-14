import { redirect } from 'next/navigation';
import { getServerSupabase } from '@/lib/supabase-server';
import { isForumAdmin } from '@/lib/forum/admin';
import { routes } from '@/lib/routes';

export async function requireForumAdminPage(): Promise<void> {
  const supabase = await getServerSupabase();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect(`${routes.login}?next=${encodeURIComponent(routes.adminForumPrompts)}`);
  }

  const admin = await isForumAdmin(user.id, user.email);
  if (!admin) {
    redirect(routes.forum);
  }
}
