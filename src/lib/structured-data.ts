import { marketingRoutes, type MarketingRouteKey } from './marketing-content';
import { appUrl, appUrlFor, marketingUrlFor } from './site-urls';

export type JsonLdPrimitive = string | number | boolean | null;
export type JsonLdValue = JsonLdPrimitive | JsonLdObject | readonly JsonLdValue[];
export type JsonLdObject = { readonly [key: string]: JsonLdValue };

const organizationId = marketingUrlFor('/#organization');
const websiteId = marketingUrlFor('/#website');
const softwareId = appUrlFor('/#software');

function breadcrumbName(routeKey: MarketingRouteKey) {
  switch (routeKey) {
    case 'forEvents':
      return 'For organizers';
    case 'founders':
      return 'For founders';
    case 'about':
      return 'About';
    case 'contact':
      return 'Contact';
    case 'terms':
      return 'Terms of Service';
    default:
      return 'Home';
  }
}

export function buildMarketingStructuredData(routeKey: MarketingRouteKey): JsonLdObject {
  const route = marketingRoutes[routeKey];
  const canonical = marketingUrlFor(route.path);
  const webpageId = `${canonical}#webpage`;
  const graph: JsonLdObject[] = [
    {
      '@type': 'Organization',
      '@id': organizationId,
      name: 'Pitch in Public',
      url: marketingUrlFor('/'),
    },
    {
      '@type': 'WebSite',
      '@id': websiteId,
      name: 'Pitch in Public',
      url: marketingUrlFor('/'),
      publisher: { '@id': organizationId },
    },
    {
      '@type': 'SoftwareApplication',
      '@id': softwareId,
      name: 'Pitch in Public',
      applicationCategory: 'BusinessApplication',
      operatingSystem: 'Web',
      url: appUrl,
      description:
        'A guided pitch-preparation workspace for founder programs, startup events, and participating founders.',
      publisher: { '@id': organizationId },
      audience: {
        '@type': 'Audience',
        audienceType: 'Founder-program organizers, startup-event organizers, and founders',
      },
    },
    {
      '@type': 'WebPage',
      '@id': webpageId,
      url: canonical,
      name: route.title,
      description: route.description,
      isPartOf: { '@id': websiteId },
      about: { '@id': softwareId },
    },
  ];

  if (routeKey !== 'home') {
    const breadcrumbId = `${canonical}#breadcrumb`;
    graph.push({
      '@type': 'BreadcrumbList',
      '@id': breadcrumbId,
      itemListElement: [
        {
          '@type': 'ListItem',
          position: 1,
          name: 'Home',
          item: marketingUrlFor('/'),
        },
        {
          '@type': 'ListItem',
          position: 2,
          name: breadcrumbName(routeKey),
          item: canonical,
        },
      ],
    });
  }

  if (route.faq.length > 0) {
    graph.push({
      '@type': 'FAQPage',
      '@id': `${canonical}#faq`,
      url: canonical,
      isPartOf: { '@id': webpageId },
      mainEntity: route.faq.map((item) => ({
        '@type': 'Question',
        name: item.question,
        acceptedAnswer: {
          '@type': 'Answer',
          text: item.answer,
        },
      })),
    });
  }

  return {
    '@context': 'https://schema.org',
    '@graph': graph,
  };
}

export function serializeJsonLd(data: JsonLdValue) {
  return JSON.stringify(data).replace(/</g, '\\u003c');
}
