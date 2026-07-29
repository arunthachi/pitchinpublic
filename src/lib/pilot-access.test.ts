import assert from 'node:assert/strict';
import test from 'node:test';
import type { SupabaseClient } from '@supabase/supabase-js';
import { hasPilotMembershipForEmail } from './pilot-access';

type LookupResult = {
  data: Array<{ id: string }> | { user_id: string } | null;
  error: { code?: string; message: string } | null;
};

function createLookupClient(options: {
  profileIds?: string[];
  profileError?: LookupResult['error'];
  membershipUserId?: string | null;
  membershipError?: LookupResult['error'];
}) {
  const calls: Array<{ table: string; operation: string; value: unknown }> = [];

  const client = {
    from(table: string) {
      if (table === 'profiles') {
        return {
          select() {
            return this;
          },
          eq(column: string, value: string) {
            calls.push({ table, operation: `eq:${column}`, value });
            return this;
          },
          async limit() {
            return {
              data: options.profileIds?.map((id) => ({ id })) || [],
              error: options.profileError || null,
            };
          },
        };
      }

      if (table === 'pilot_members') {
        return {
          select() {
            return this;
          },
          in(column: string, value: string[]) {
            calls.push({ table, operation: `in:${column}`, value });
            return this;
          },
          limit() {
            return this;
          },
          async maybeSingle() {
            return {
              data: options.membershipUserId
                ? { user_id: options.membershipUserId }
                : null,
              error: options.membershipError || null,
            };
          },
        };
      }

      throw new Error(`Unexpected table: ${table}`);
    },
  } as unknown as SupabaseClient;

  return { client, calls };
}

test('allows an email only when its profile has an active pilot membership', async () => {
  const { client, calls } = createLookupClient({
    profileIds: ['user-1'],
    membershipUserId: 'user-1',
  });

  assert.equal(await hasPilotMembershipForEmail(client, ' Founder@Example.com '), true);
  assert.deepEqual(calls, [
    { table: 'profiles', operation: 'eq:email', value: 'founder@example.com' },
    { table: 'pilot_members', operation: 'in:user_id', value: ['user-1'] },
  ]);
});

test('denies a profile whose pilot membership has been removed', async () => {
  const { client } = createLookupClient({
    profileIds: ['user-1'],
    membershipUserId: null,
  });

  assert.equal(await hasPilotMembershipForEmail(client, 'founder@example.com'), false);
});

test('denies unknown emails without querying memberships', async () => {
  const { client, calls } = createLookupClient({ profileIds: [] });

  assert.equal(await hasPilotMembershipForEmail(client, 'unknown@example.com'), false);
  assert.equal(calls.some((call) => call.table === 'pilot_members'), false);
});

test('uses exact matching for email characters that have SQL pattern meaning', async () => {
  const { client, calls } = createLookupClient({ profileIds: [] });

  assert.equal(await hasPilotMembershipForEmail(client, 'a_b%test@example.com'), false);
  assert.deepEqual(calls[0], {
    table: 'profiles',
    operation: 'eq:email',
    value: 'a_b%test@example.com',
  });
});

test('fails closed when the profile lookup errors', async () => {
  const { client, calls } = createLookupClient({
    profileError: { message: 'database unavailable' },
  });

  assert.equal(await hasPilotMembershipForEmail(client, 'founder@example.com'), false);
  assert.equal(calls.some((call) => call.table === 'pilot_members'), false);
});
