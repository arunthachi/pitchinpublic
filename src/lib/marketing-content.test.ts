import assert from 'node:assert/strict';
import test from 'node:test';
import {
  marketingRouteOrder,
  marketingRoutes,
  marketingSitemapRoutes,
  prohibitedMarketingClaims,
  productFacts,
} from './marketing-content';

test('defines unique metadata for every canonical marketing route', () => {
  assert.deepEqual(
    marketingSitemapRoutes.map((route) => route.path),
    ['/', '/for-events', '/founders', '/about', '/contact']
  );
  assert.equal(new Set(marketingRouteOrder.map((key) => marketingRoutes[key].title)).size, marketingRouteOrder.length);
  assert.equal(
    new Set(marketingRouteOrder.map((key) => marketingRoutes[key].description)).size,
    marketingRouteOrder.length
  );
});

test('keeps route FAQs answerable and scoped to the three explanatory routes', () => {
  assert.ok(marketingRoutes.home.faq.length > 0);
  assert.ok(marketingRoutes.forEvents.faq.length > 0);
  assert.ok(marketingRoutes.founders.faq.length > 0);
  assert.deepEqual(marketingRoutes.about.faq, []);
  assert.deepEqual(marketingRoutes.contact.faq, []);
  assert.deepEqual(marketingRoutes.terms.faq, []);

  for (const route of [marketingRoutes.home, marketingRoutes.forEvents, marketingRoutes.founders]) {
    for (const item of route.faq) {
      assert.ok(item.question.endsWith('?'));
      assert.ok(item.answer.length >= 40);
    }
  }
});

test('records product truth and prohibited claim boundaries', () => {
  assert.match(productFacts.coaching, /does not use AI/i);
  assert.match(productFacts.eventPrivacy, /private to the event by default/i);
  assert.match(productFacts.reporting, /without claiming.*caused/i);
  assert.ok(prohibitedMarketingClaims.includes('guaranteed improvement'));

  const approvedContent = JSON.stringify({ marketingRoutes, productFacts });
  for (const prohibitedClaim of prohibitedMarketingClaims) {
    assert.equal(approvedContent.includes(prohibitedClaim), false);
  }
});

test('holds terms out of the sitemap until legal indexing is approved', () => {
  assert.doesNotMatch(marketingSitemapRoutes.map((route) => route.path).join(','), /\/terms(?:,|$)/);
});
