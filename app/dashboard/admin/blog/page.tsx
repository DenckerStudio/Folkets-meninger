import Link from 'next/link';
import { AdminBackLink } from '@/components/admin/admin-shell';

export const dynamic = 'force-dynamic';

export default function AdminBlogRedirectPage() {
  const cmsUrl = process.env.CMS_URL?.replace(/\/+$/, '');

  return (
    <div className="space-y-4">
      <AdminBackLink />
      <h2 className="text-lg font-semibold text-foreground">Blogg (Payload CMS)</h2>
      {cmsUrl ? (
        <p className="text-sm text-muted-foreground">
          Redaksjon og publisering skjer i{' '}
          <Link href={`${cmsUrl}/admin`} className="font-medium text-brand hover:underline">
            Payload-admin
          </Link>
          . Utkast fra n8n venter der til en redaktør publiserer.
        </p>
      ) : (
        <p className="text-sm text-muted-foreground">
          Sett <code className="rounded bg-muted px-1">CMS_URL</code> i Coolify for å åpne redaksjonssystemet.
        </p>
      )}
    </div>
  );
}
