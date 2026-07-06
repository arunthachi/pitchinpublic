import type { MetadataRoute } from 'next';

const appUrl = (process.env.NEXT_PUBLIC_APP_URL || 'https://app.pitchinpublic.io').replace(/\/$/, '');

const publicRoutes = [
  {
    path: '/',
    priority: 1,
    changeFrequency: 'daily' as const,
  },
  {
    path: '/for-events',
    priority: 0.8,
    changeFrequency: 'weekly' as const,
  },
  {
    path: '/pilot',
    priority: 0.85,
    changeFrequency: 'weekly' as const,
  },
  {
    path: '/events/new',
    priority: 0.6,
    changeFrequency: 'monthly' as const,
  },
  {
    path: '/leaderboard',
    priority: 0.5,
    changeFrequency: 'daily' as const,
  },
];

export default function sitemap(): MetadataRoute.Sitemap {
  const lastModified = new Date();

  return publicRoutes.map((route) => ({
    url: `${appUrl}${route.path}`,
    lastModified,
    changeFrequency: route.changeFrequency,
    priority: route.priority,
  }));
}
