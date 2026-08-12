import assert from 'node:assert/strict';
import test from 'node:test';
import {
  STREAM_MAX_MINTS_PER_REQUEST,
  STREAM_TOKEN_REFRESH_MARGIN_SECONDS,
  STREAM_TOKEN_TTL_SECONDS,
  __resetStreamTokenCacheForTests,
  buildSignedVideoUrls,
  customerSubdomainFromUrl,
  getStreamToken,
  isCachedTokenUsable,
  signedUrlsForRows,
} from './stream-tokens';

const NOW = 1_700_000_000_000;
const DEPS = { accountId: 'acct', apiToken: 'tok', now: () => NOW };

function fakeFetch(handler: (url: string) => unknown, calls: string[] = []) {
  return Object.assign(
    async (url: string) => {
      calls.push(url);
      const body = handler(url);
      if (body === null) return { ok: false, json: async () => ({}) } as unknown as Response;
      return { ok: true, json: async () => body } as unknown as Response;
    },
    { calls }
  ) as unknown as typeof fetch & { calls: string[] };
}

test('a token about to expire is not reused', () => {
  // Handing over a token with seconds left breaks playback partway through.
  const margin = STREAM_TOKEN_REFRESH_MARGIN_SECONDS * 1000;
  assert.equal(isCachedTokenUsable({ token: 't', expiresAt: NOW + margin + 1000 }, NOW), true);
  assert.equal(isCachedTokenUsable({ token: 't', expiresAt: NOW + margin - 1000 }, NOW), false);
  assert.equal(isCachedTokenUsable({ token: 't', expiresAt: NOW - 1 }, NOW), false);
});

test('a malformed cache entry is never trusted', () => {
  assert.equal(isCachedTokenUsable(undefined, NOW), false);
  assert.equal(isCachedTokenUsable({ token: '', expiresAt: NOW + 1e9 }, NOW), false);
  assert.equal(isCachedTokenUsable({ token: 't', expiresAt: Infinity }, NOW), false);
  assert.equal(isCachedTokenUsable({ token: 't', expiresAt: NaN }, NOW), false);
});

test('the delivery subdomain is recovered from a stored URL', () => {
  assert.equal(
    customerSubdomainFromUrl('https://customer-ui0aafvrqw1vaprv.cloudflarestream.com/abc/manifest/video.m3u8'),
    'customer-ui0aafvrqw1vaprv',
  );
  assert.equal(customerSubdomainFromUrl('https://example.com/video.m3u8'), null);
  assert.equal(customerSubdomainFromUrl(null), null);
});

test('both the manifest and the thumbnail carry the token', () => {
  // The thumbnail is on the same host and is exactly as exposed as the manifest.
  const urls = buildSignedVideoUrls('customer-abc', 'TOKEN123');
  assert.equal(urls.playbackUrl, 'https://customer-abc.cloudflarestream.com/TOKEN123/manifest/video.m3u8');
  assert.equal(urls.thumbnailUrl, 'https://customer-abc.cloudflarestream.com/TOKEN123/thumbnails/thumbnail.jpg');
});

test('a token is requested once and then served from cache', async () => {
  __resetStreamTokenCacheForTests();
  const calls: string[] = [];
  const fetchImpl = fakeFetch(() => ({ result: { token: 'T1' } }), calls);

  const first = await getStreamToken('vid1', { ...DEPS, fetchImpl });
  const second = await getStreamToken('vid1', { ...DEPS, fetchImpl });

  assert.equal(first?.token, 'T1');
  assert.equal(second?.token, 'T1');
  assert.equal(calls.length, 1, 'the second read must not hit Cloudflare');
});

test('concurrent misses for one video collapse into a single call', async () => {
  // Otherwise a cold feed render fires one request per pitch simultaneously.
  __resetStreamTokenCacheForTests();
  const calls: string[] = [];
  const fetchImpl = fakeFetch(() => ({ result: { token: 'T2' } }), calls);

  const results = await Promise.all([
    getStreamToken('vid2', { ...DEPS, fetchImpl }),
    getStreamToken('vid2', { ...DEPS, fetchImpl }),
    getStreamToken('vid2', { ...DEPS, fetchImpl }),
  ]);

  assert.deepEqual(results.map((r) => r?.token), ['T2', 'T2', 'T2']);
  assert.equal(calls.length, 1);
});

test('the token expiry matches the requested TTL', async () => {
  __resetStreamTokenCacheForTests();
  const fetchImpl = fakeFetch(() => ({ result: { token: 'T3' } }));
  const entry = await getStreamToken('vid3', { ...DEPS, fetchImpl });
  const expectedSeconds = Math.floor(NOW / 1000) + STREAM_TOKEN_TTL_SECONDS;
  assert.equal(entry?.expiresAt, expectedSeconds * 1000);
});

test('a Cloudflare failure yields no token rather than a broken one', async () => {
  __resetStreamTokenCacheForTests();
  // Phase 1 contract: the caller keeps the stored unsigned URL, so an outage
  // degrades to today's behaviour instead of a player that cannot load.
  assert.equal(await getStreamToken('vid4', { ...DEPS, fetchImpl: fakeFetch(() => null) }), null);

  __resetStreamTokenCacheForTests();
  const throwing = (async () => {
    throw new Error('network down');
  }) as unknown as typeof fetch;
  assert.equal(await getStreamToken('vid5', { ...DEPS, fetchImpl: throwing }), null);

  __resetStreamTokenCacheForTests();
  const malformed = fakeFetch(() => ({ result: {} }));
  assert.equal(await getStreamToken('vid6', { ...DEPS, fetchImpl: malformed }), null);
});

test('a failed mint is not cached, so the next request retries', async () => {
  __resetStreamTokenCacheForTests();
  const calls: string[] = [];
  let fail = true;
  const fetchImpl = fakeFetch(() => (fail ? null : { result: { token: 'T7' } }), calls);

  assert.equal(await getStreamToken('vid7', { ...DEPS, fetchImpl }), null);
  fail = false;
  const recovered = await getStreamToken('vid7', { ...DEPS, fetchImpl });

  assert.equal(recovered?.token, 'T7', 'a transient failure must not poison the cache');
  assert.equal(calls.length, 2);
});

test('missing credentials mint nothing at all', async () => {
  __resetStreamTokenCacheForTests();
  const calls: string[] = [];
  const fetchImpl = fakeFetch(() => ({ result: { token: 'X' } }), calls);
  assert.equal(await getStreamToken('vid8', { accountId: '', apiToken: 'tok', fetchImpl }), null);
  assert.equal(await getStreamToken('vid8', { accountId: 'acct', apiToken: '', fetchImpl }), null);
  assert.equal(calls.length, 0, 'never call Cloudflare without credentials');
});

test('rows are signed per distinct video, not per row', async () => {
  __resetStreamTokenCacheForTests();
  const calls: string[] = [];
  const fetchImpl = fakeFetch((url) => ({ result: { token: `T-${url.split('/stream/')[1].split('/')[0]}` } }), calls);

  const rows = [
    { video_id: 'a', visibility: 'private', video_url: 'https://customer-zzz.cloudflarestream.com/a/manifest/video.m3u8' },
    { video_id: 'a', visibility: 'private', video_url: null },
    { video_id: 'b', visibility: 'private', video_url: null },
  ];
  const signed = await signedUrlsForRows(rows, { ...DEPS, fetchImpl });

  assert.equal(calls.length, 2, 'the repeated video must not be minted twice');
  assert.match(signed.get('a')!.playbackUrl, /customer-zzz\.cloudflarestream\.com\/T-a\/manifest/);
  assert.match(signed.get('b')!.thumbnailUrl, /\/T-b\/thumbnails\/thumbnail\.jpg$/);
});

test('with no derivable subdomain nothing is signed', async () => {
  __resetStreamTokenCacheForTests();
  const calls: string[] = [];
  const fetchImpl = fakeFetch(() => ({ result: { token: 'T' } }), calls);
  // Guessing a delivery host would produce URLs that 404 for every viewer.
  const signed = await signedUrlsForRows([{ video_id: 'a', visibility: 'private', video_url: null }], { ...DEPS, fetchImpl });
  assert.equal(signed.size, 0);
  assert.equal(calls.length, 0);
});


test('each video is minted against its own Cloudflare endpoint', () => {
  // The earlier version of this test had a fake that derived the token from the
  // requested URL, so "different videos get different tokens" asserted the stub
  // rather than the code. What is actually ours to guarantee is that we ask
  // Cloudflare for the right video — the provider scopes the token, not us.
  __resetStreamTokenCacheForTests();
  const calls: string[] = [];
  const fetchImpl = fakeFetch(() => ({ result: { token: 'SAME' } }), calls);

  return signedUrlsForRows(
    [
      { video_id: 'alpha', visibility: 'private', video_url: 'https://customer-zzz.cloudflarestream.com/x/manifest/video.m3u8' },
      { video_id: 'beta', visibility: 'private', video_url: null },
    ],
    { ...DEPS, fetchImpl },
  ).then(() => {
    assert.equal(calls.length, 2);
    assert.ok(calls.some((url) => url.endsWith('/stream/alpha/token')), 'alpha was not requested by id');
    assert.ok(calls.some((url) => url.endsWith('/stream/beta/token')), 'beta was not requested by id');
  });
});

test('a hanging Cloudflare call is abandoned rather than holding the feed open', async () => {
  __resetStreamTokenCacheForTests();
  // The feed awaits minting, so without a timeout one stuck request stalls the
  // entire response.
  const hanging = ((_url: string, init?: { signal?: AbortSignal }) =>
    new Promise((_resolve, reject) => {
      init?.signal?.addEventListener('abort', () => reject(new Error('aborted')));
    })) as unknown as typeof fetch;

  const started = Date.now();
  const entry = await getStreamToken('slow', { ...DEPS, fetchImpl: hanging, timeoutMs: 50 });
  assert.equal(entry, null, 'a timeout must fall back to the stored URL');
  assert.ok(Date.now() - started < 2000, 'the call must not wait on the default timeout');
});

function memoryStore(seed: Record<string, { token: string; expiresAt: number }> = {}) {
  const rows = new Map(Object.entries(seed));
  const reads: string[][] = [];
  return {
    reads,
    store: {
      async read(ids: string[]) {
        reads.push(ids);
        const out = new Map<string, { token: string; expiresAt: number }>();
        for (const id of ids) {
          const row = rows.get(id);
          if (row) out.set(id, row);
        }
        return out;
      },
      async write(id: string, entry: { token: string; expiresAt: number }) {
        rows.set(id, entry);
      },
    },
    rows,
  };
}

test('a token minted by another instance is reused, not re-minted', async () => {
  // The whole point of the shared store: a cold instance must not re-mint what
  // a warm one already has, or concurrent cold starts fan out into the
  // account-wide Cloudflare quota that uploads also depend on.
  __resetStreamTokenCacheForTests();
  const calls: string[] = [];
  const fetchImpl = fakeFetch(() => ({ result: { token: 'FRESH' } }), calls);
  const { store } = memoryStore({ vidX: { token: 'FROM-OTHER-INSTANCE', expiresAt: NOW + 3_600_000 } });

  const entry = await getStreamToken('vidX', { ...DEPS, fetchImpl, store });

  assert.equal(entry?.token, 'FROM-OTHER-INSTANCE');
  assert.equal(calls.length, 0, 'a shared hit must not call Cloudflare');
});

test('a freshly minted token is written back for other instances', async () => {
  __resetStreamTokenCacheForTests();
  const fetchImpl = fakeFetch(() => ({ result: { token: 'MINTED' } }));
  const { store, rows } = memoryStore();

  await getStreamToken('vidY', { ...DEPS, fetchImpl, store });

  assert.equal(rows.get('vidY')?.token, 'MINTED', 'the mint was not shared');
});

test('an expired shared entry is re-minted rather than served', async () => {
  __resetStreamTokenCacheForTests();
  const calls: string[] = [];
  const fetchImpl = fakeFetch(() => ({ result: { token: 'REMINTED' } }), calls);
  const { store } = memoryStore({ vidZ: { token: 'STALE', expiresAt: NOW - 1 } });

  const entry = await getStreamToken('vidZ', { ...DEPS, fetchImpl, store });

  assert.equal(entry?.token, 'REMINTED');
  assert.equal(calls.length, 1);
});

test('the whole response costs one shared read, not one per video', async () => {
  __resetStreamTokenCacheForTests();
  const fetchImpl = fakeFetch(() => ({ result: { token: 'T' } }));
  const { store, reads } = memoryStore();

  await signedUrlsForRows(
    [
      { video_id: 'a', visibility: 'private', video_url: 'https://customer-zzz.cloudflarestream.com/a/manifest/video.m3u8' },
      { video_id: 'b', visibility: 'private', video_url: null },
      { video_id: 'c', visibility: 'private', video_url: null },
    ],
    { ...DEPS, fetchImpl, store },
  );

  assert.equal(reads[0].length, 3, 'the batch read must cover every distinct video');
});

test('a broken shared store degrades to minting, never to a failed response', async () => {
  __resetStreamTokenCacheForTests();
  const fetchImpl = fakeFetch(() => ({ result: { token: 'OK' } }));
  const brokenStore = {
    async read() {
      throw new Error('store down');
    },
    async write() {
      throw new Error('store down');
    },
  };

  const entry = await getStreamToken('vidBroken', { ...DEPS, fetchImpl, store: brokenStore });
  assert.equal(entry?.token, 'OK');
});

test('a single response cannot fan out unbounded mints', async () => {
  // Backstop for the case the shared store is unavailable: without a ceiling,
  // one cold request could issue a Cloudflare call per video and pressure the
  // account-wide quota that uploads share.
  __resetStreamTokenCacheForTests();
  const calls: string[] = [];
  const fetchImpl = fakeFetch(() => ({ result: { token: 'T' } }), calls);

  const rows = Array.from({ length: 40 }, (_, i) => ({
    video_id: `v${i}`,
    visibility: 'private',
    video_url: i === 0 ? 'https://customer-zzz.cloudflarestream.com/v0/manifest/video.m3u8' : null,
  }));
  const signed = await signedUrlsForRows(rows, { ...DEPS, fetchImpl });

  assert.equal(calls.length, STREAM_MAX_MINTS_PER_REQUEST, 'the mint ceiling was not applied');
  assert.equal(signed.size, STREAM_MAX_MINTS_PER_REQUEST);
  // Everything beyond the cap simply keeps its stored URL — the Phase 1 path.
  assert.equal(signed.has('v39'), false);
});

test('public rows are excluded before any Cloudflare call', () => {
  // The sharing guarantee, enforced at the mint layer as well as the apply
  // layer: a public pitch must never cost a token or receive an expiring URL.
  __resetStreamTokenCacheForTests();
  const calls: string[] = [];
  const fetchImpl = fakeFetch(() => ({ result: { token: 'T' } }), calls);

  return signedUrlsForRows(
    [
      { video_id: 'pub', visibility: 'public', video_url: 'https://customer-zzz.cloudflarestream.com/pub/manifest/video.m3u8' },
      { video_id: 'priv', visibility: 'private', video_url: null },
    ],
    { ...DEPS, fetchImpl },
  ).then((signed) => {
    assert.equal(calls.length, 1, 'only the private video may be minted');
    assert.ok(calls[0].endsWith('/stream/priv/token'));
    assert.equal(signed.has('pub'), false);
    assert.equal(signed.has('priv'), true);
  });
});
