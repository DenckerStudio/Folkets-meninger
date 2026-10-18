import { Suspense } from 'react';
import AdminBlogClient from './admin-blog-client';

export const dynamic = 'force-dynamic';

export default function AdminBlogPage() {
  return (
    <Suspense fallback={<p className="text-sm text-muted-foreground">Laster bloggutkast …</p>}>
      <AdminBlogClient />
    </Suspense>
  );
}
