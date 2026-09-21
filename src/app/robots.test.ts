import assert from 'node:assert/strict';
import test from 'node:test';
import robots, { isIndexableEnvironment } from './robots';

test('indexes only an explicitly production deployment', () => {
  assert.equal(isIndexableEnvironment({ SITE_ENV: 'production' }), true);
  assert.equal(isIndexableEnvironment({ SITE_ENV: 'preview', VERCEL_ENV: 'production' }), false);
  assert.equal(isIndexableEnvironment({ VERCEL_ENV: 'production' }), true);
  assert.equal(isIndexableEnvironment({ VERCEL_ENV: 'preview' }), false);
  assert.equal(isIndexableEnvironment({ NODE_ENV: 'production' }), false);
  assert.equal(isIndexableEnvironment({}), false);
});

test('blocks every crawler in preview and local environments', () => {
  const previousSiteEnv = process.env.SITE_ENV;
  const previousVercelEnv = process.env.VERCEL_ENV;
  process.env.SITE_ENV = 'preview';
  process.env.VERCEL_ENV = 'production';

  try {
    assert.deepEqual(robots(), {
      rules: { userAgent: '*', disallow: '/' },
    });
  } finally {
    if (previousSiteEnv === undefined) delete process.env.SITE_ENV;
    else process.env.SITE_ENV = previousSiteEnv;
    if (previousVercelEnv === undefined) delete process.env.VERCEL_ENV;
    else process.env.VERCEL_ENV = previousVercelEnv;
  }
});

test('allows public discovery in production while excluding product and private surfaces', () => {
  const previousSiteEnv = process.env.SITE_ENV;
  process.env.SITE_ENV = 'production';

  try {
    const result = robots();
    assert.equal(result.host, 'https://www.pitchinpublic.io');
    assert.equal(result.sitemap, 'https://www.pitchinpublic.io/sitemap.xml');
    assert.deepEqual(result.rules, {
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
    });
  } finally {
    if (previousSiteEnv === undefined) delete process.env.SITE_ENV;
    else process.env.SITE_ENV = previousSiteEnv;
  }
});
