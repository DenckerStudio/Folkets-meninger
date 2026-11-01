import { redirect } from 'next/navigation';
import { routes } from '@/lib/routes';

/** System-Reels er avviklet — gamle lenker sendes til Avstemninger. */
export default function ReelsPage() {
  redirect(routes.avstemninger);
}
