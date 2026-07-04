import type { MetadataRoute } from 'next';

const appUrl = (process.env.NEXT_PUBLIC_APP_URL || 'https://app.pitchinpublic.io').replace(/\/$/, '');
const isStaging = /staging|localhost|127\.0\.0\.1/i.test(appUrl);

export default function robots(): MetadataRoute.Robots {
  if (isStaging) {
    return {
      rules: {
        userAgent: '*',
        disallow: '/',
      },
      sitemap: `${appUrl}/sitemap.xml`,
      host: appUrl,
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
        '/events/*/dashboard',
      ],
    },
    sitemap: `${appUrl}/sitemap.xml`,
    host: appUrl,
  };
}
