import { sitemapMetadata } from '@/lib/seo';

export const dynamic = 'force-dynamic';
export default function sitemap() {
  return sitemapMetadata();
}
