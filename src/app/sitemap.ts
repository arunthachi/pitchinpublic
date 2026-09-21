import type { MetadataRoute } from 'next';
import { marketingSitemapRoutes } from '@/lib/marketing-content';
import { marketingUrlFor } from '@/lib/site-urls';

export default function sitemap(): MetadataRoute.Sitemap {
  return marketingSitemapRoutes.map((route) => ({
    url: marketingUrlFor(route.path),
    changeFrequency: route.sitemap.changeFrequency,
    priority: route.sitemap.priority,
  }));
}
