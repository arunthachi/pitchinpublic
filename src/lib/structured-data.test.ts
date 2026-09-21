import assert from 'node:assert/strict';
import test from 'node:test';
import { marketingRoutes } from './marketing-content';
import { buildMarketingStructuredData, serializeJsonLd, type JsonLdObject } from './structured-data';

function graphFor(route: Parameters<typeof buildMarketingStructuredData>[0]) {
  const data = buildMarketingStructuredData(route);
  return data['@graph'] as readonly JsonLdObject[];
}

test('uses stable entity identifiers and keeps product and marketing URLs distinct', () => {
  const graph = graphFor('founders');
  assert.ok(graph.some((item) => item['@id'] === 'https://www.pitchinpublic.io/#organization'));
  assert.ok(graph.some((item) => item['@id'] === 'https://www.pitchinpublic.io/#website'));
  assert.ok(graph.some((item) => item['@id'] === 'https://app.pitchinpublic.io/#software'));
  assert.ok(graph.some((item) => item['@id'] === 'https://www.pitchinpublic.io/founders#webpage'));
  assert.ok(graph.some((item) => item['@id'] === 'https://www.pitchinpublic.io/founders#breadcrumb'));
});

test('creates FAQ entities from the same route content and only where FAQs are visible', () => {
  const founderFaq = graphFor('founders').find((item) => item['@type'] === 'FAQPage');
  const questions = founderFaq?.mainEntity as readonly JsonLdObject[];
  assert.equal(questions.length, marketingRoutes.founders.faq.length);
  assert.equal(questions[0].name, marketingRoutes.founders.faq[0].question);
  assert.equal(
    (questions[0].acceptedAnswer as JsonLdObject).text,
    marketingRoutes.founders.faq[0].answer
  );
  assert.equal(graphFor('about').some((item) => item['@type'] === 'FAQPage'), false);
});

test('does not publish offers, ratings, reviews, or synthetic performance claims', () => {
  function collectKeys(value: unknown): string[] {
    if (Array.isArray(value)) return value.flatMap(collectKeys);
    if (!value || typeof value !== 'object') return [];
    return Object.entries(value).flatMap(([key, child]) => [key, ...collectKeys(child)]);
  }

  for (const route of ['home', 'forEvents', 'founders', 'about', 'contact', 'terms'] as const) {
    const data = buildMarketingStructuredData(route);
    const keys = collectKeys(data).map((key) => key.toLowerCase());
    assert.equal(keys.some((key) => key === 'offer' || key === 'offers'), false);
    assert.equal(keys.some((key) => key === 'rating' || key === 'aggregaterating'), false);
    assert.equal(keys.some((key) => key === 'review' || key === 'reviews'), false);
    const serialized = JSON.stringify(data).toLowerCase();
    assert.equal(serialized.includes('42'), false);
    assert.equal(serialized.includes('926'), false);
  }
});

test('escapes less-than characters before embedding JSON in a script element', () => {
  const serialized = serializeJsonLd({ value: '</script><script>alert(1)</script>' });
  assert.equal(serialized.includes('<'), false);
  assert.match(serialized, /\\u003c\/script>/);
});
