import assert from 'node:assert/strict';
import test from 'node:test';
import { hasServerSupabaseConfig } from './server';

test('requires both server Supabase values before rendering data-backed pages', () => {
  const previousUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const previousKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  try {
    delete process.env.NEXT_PUBLIC_SUPABASE_URL;
    delete process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
    assert.equal(hasServerSupabaseConfig(), false);

    process.env.NEXT_PUBLIC_SUPABASE_URL = 'https://project.supabase.co';
    assert.equal(hasServerSupabaseConfig(), false);

    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = 'anon-key';
    assert.equal(hasServerSupabaseConfig(), true);
  } finally {
    if (previousUrl === undefined) delete process.env.NEXT_PUBLIC_SUPABASE_URL;
    else process.env.NEXT_PUBLIC_SUPABASE_URL = previousUrl;
    if (previousKey === undefined) delete process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
    else process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = previousKey;
  }
});
