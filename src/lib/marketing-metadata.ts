import type { Metadata } from 'next';
import { marketingRoutes, type MarketingRouteKey } from './marketing-content';
import { marketingUrlFor } from './site-urls';

export function buildMarketingMetadata(routeKey: MarketingRouteKey): Metadata {
  const route = marketingRoutes[routeKey];
  const canonical = marketingUrlFor(route.path);
  const image = marketingUrlFor('/og-pip-v2.png');
  const legalApprovalPending = routeKey === 'terms';

  return {
    title: route.title,
    description: route.description,
    alternates: { canonical },
    robots: legalApprovalPending ? { index: false, follow: true } : { index: true, follow: true },
    openGraph: {
      type: 'website',
      url: canonical,
      siteName: 'Pitch in Public',
      title: route.title,
      description: route.description,
      images: [{ url: image, width: 1200, height: 630, alt: 'Pitch in Public guided pitch preparation' }],
    },
    twitter: {
      card: 'summary_large_image',
      title: route.title,
      description: route.description,
      images: [image],
    },
  };
}
