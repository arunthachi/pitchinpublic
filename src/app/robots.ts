import type { MetadataRoute } from 'next';
import { marketingUrl, marketingUrlFor } from '@/lib/site-urls';

export function isIndexableEnvironment(
  environment: Record<string, string | undefined> = process.env as Record<string, string | undefined>
) {
  const siteEnvironment = environment.SITE_ENV?.toLowerCase();
  const vercelEnvironment = environment.VERCEL_ENV?.toLowerCase();

  if (siteEnvironment) return siteEnvironment === 'production';
  return vercelEnvironment === 'production';
}

export default function robots(): MetadataRoute.Robots {
  if (!isIndexableEnvironment()) {
    return {
      rules: {
        userAgent: '*',
        disallow: '/',
      },
    };
  }

  return {
    rules: {
      userAgent: '*',
      allow: '/',
      disallow: [
        '/api/',
        '/auth/',
        '/me',
        '/profile/',
        '/pitch/',
        '/events/',
        '/notifications/',
        '/organizer/',
        '/founder/',
        '/reviewer/',
        '/pilot/',
        '/pip-super-admin/',
        '/marketing-home',
      ],
    },
    sitemap: marketingUrlFor('/sitemap.xml'),
    host: marketingUrl,
  };
}
