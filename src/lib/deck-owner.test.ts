import assert from 'node:assert/strict';
import test from 'node:test';
import { resolveOwnerCompany } from './deck-owner';

type Filter = { method: string; column: string; value: unknown };

/**
 * Records the query it was asked to build. A source-text assertion would pass
 * even if the founder_id filter were deleted; this fake fails, because the
 * recorded filters are the assertion.
 */
function recordingSupabase(row: { id: string } | null = { id: 'company-1' }) {
  const filters: Filter[] = [];
  let table = '';
  const builder: Record<string, unknown> = {};

  for (const method of ['eq', 'select', 'order', 'limit'] as const) {
    builder[method] = (column: unknown, value?: unknown) => {
      filters.push({ method, column: String(column), value });
      return builder;
    };
  }
  builder.maybeSingle = async () => ({ data: row, error: null });

  return {
    filters,
    tableOf: () => table,
    client: {
      from: (name: string) => {
        table = name;
        return builder as never;
      },
    },
  };
}

test('a deck is bound to the caller own active company', async () => {
  const fake = recordingSupabase();
  const result = await resolveOwnerCompany(fake.client, 'user-abc');

  assert.equal(fake.tableOf(), 'companies');
  assert.deepEqual(result.company, { id: 'company-1' });

  const equality = fake.filters.filter((filter) => filter.method === 'eq');
  assert.deepEqual(equality, [
    { method: 'eq', column: 'founder_id', value: 'user-abc' },
    { method: 'eq', column: 'status', value: 'active' },
  ]);
});

test('the founder filter always carries the id it was called with', async () => {
  // Two different callers must never resolve to the same company by accident.
  const first = recordingSupabase();
  const second = recordingSupabase();
  await resolveOwnerCompany(first.client, 'user-one');
  await resolveOwnerCompany(second.client, 'user-two');

  const founderFilter = (fake: ReturnType<typeof recordingSupabase>) =>
    fake.filters.find((filter) => filter.column === 'founder_id')?.value;

  assert.equal(founderFilter(first), 'user-one');
  assert.equal(founderFilter(second), 'user-two');
  assert.notEqual(founderFilter(first), founderFilter(second));
});

test('a founder with no active company resolves to nothing rather than a fallback', async () => {
  const fake = recordingSupabase(null);
  const result = await resolveOwnerCompany(fake.client, 'user-abc');
  assert.equal(result.company, null);
  assert.equal(result.error, null);
});

test('the deck company lookup is deterministic, taking the oldest active company', async () => {
  const fake = recordingSupabase();
  await resolveOwnerCompany(fake.client, 'user-abc');

  const order = fake.filters.find((filter) => filter.method === 'order');
  assert.deepEqual(order, {
    method: 'order',
    column: 'created_at',
    value: { ascending: true },
  });
  assert.equal(fake.filters.find((filter) => filter.method === 'limit')?.column, '1');
});
