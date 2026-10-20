import { redirect } from 'next/navigation';

/** Legacy route — content lives on the landing page. */
export default function HvaErAnnerledesRedirectPage() {
  redirect('/#hva-er-annerledes');
}
