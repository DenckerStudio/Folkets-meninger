import { redirect } from 'next/navigation';

/** Legacy `/om-oss` route — content now lives on the landing page. */
export default function OmOssRedirectPage() {
  redirect('/');
}
