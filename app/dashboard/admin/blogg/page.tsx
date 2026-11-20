import { AboutBlogDraftPanel } from '@/components/admin/about-blog-draft-panel';
import { PageHeader } from '@/components/page-header';
import { requireAdminPage } from '@/lib/admin/gate';
import {
  ABOUT_BLOG_ANGLE_MAX,
  ABOUT_BLOG_CATEGORY_SLUG,
  ABOUT_BLOG_TITLE_MIN,
} from '@/lib/blog/about-draft';
import { BLOG_TITLE_MAX } from '@/lib/blog/text-limits';
import { routes } from '@/lib/routes';

export const dynamic = 'force-dynamic';

export default async function AdminBloggPage() {
  await requireAdminPage(routes.adminBlogg);
  return (
    <div className="space-y-4">
      <PageHeader
        as="h2"
        title="Om Folkets Meninger"
        description="Lag bloggutkast om tjenesten."
      />
      <AboutBlogDraftPanel
        titleMax={BLOG_TITLE_MAX}
        titleMin={ABOUT_BLOG_TITLE_MIN}
        angleMax={ABOUT_BLOG_ANGLE_MAX}
        publicCategoryHref={`${routes.blogg}/tema/${ABOUT_BLOG_CATEGORY_SLUG}`}
      />
    </div>
  );
}
