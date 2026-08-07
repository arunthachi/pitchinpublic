import assert from 'node:assert/strict';
import test from 'node:test';
import {
  containsEmailSeparator,
  extractEmailsFromCsvText,
  isValidInviteEmail,
  mergeEmailChips,
  splitEmailTokens,
} from './email-chips';

test('splits typed input on commas, semicolons, and whitespace', () => {
  assert.deepEqual(
    splitEmailTokens('a@x.com, b@y.io;c@z.dev d@w.co'),
    ['a@x.com', 'b@y.io', 'c@z.dev', 'd@w.co'],
  );
});

test('splits a pasted spreadsheet column on tabs and newlines', () => {
  assert.deepEqual(
    splitEmailTokens('a@x.com\tb@y.io\nc@z.dev\r\nd@w.co'),
    ['a@x.com', 'b@y.io', 'c@z.dev', 'd@w.co'],
  );
});

test('lowercases and drops empty tokens', () => {
  assert.deepEqual(splitEmailTokens('  A@X.com ,, '), ['a@x.com']);
});

test('detects separators that should trigger a chip commit', () => {
  assert.equal(containsEmailSeparator('a@x.com,'), true);
  assert.equal(containsEmailSeparator('a@x.com\t'), true);
  assert.equal(containsEmailSeparator('a@x.com'), false);
});

test('extracts addresses from pasted mail-client display forms', () => {
  assert.deepEqual(
    splitEmailTokens('Jordan Lee <jordan@startup.com>, Sam Field <sam@field.io>'),
    ['jordan@startup.com', 'sam@field.io'],
  );
});

test('extracts multiple display forms inside one segment', () => {
  assert.deepEqual(
    splitEmailTokens('A <a@x.com> B <b@y.io>'),
    ['a@x.com', 'b@y.io'],
  );
});

test('strips mailto prefixes and wrapping quotes from typed tokens', () => {
  assert.deepEqual(
    splitEmailTokens('mailto:sam@field.io "jordan@startup.com"'),
    ['sam@field.io', 'jordan@startup.com'],
  );
});

test('merging dedupes case-insensitively against existing chips', () => {
  const { chips, overflow } = mergeEmailChips(['a@x.com'], ['A@X.com', 'b@y.io', 'b@y.io']);
  assert.deepEqual(chips, ['a@x.com', 'b@y.io']);
  assert.equal(overflow, 0);
});

test('merging normalizes the existing side of the dedupe too', () => {
  const { chips } = mergeEmailChips(['A@X.com'], ['a@x.com']);
  assert.deepEqual(chips, ['A@X.com']);
});

test('merging enforces the invite cap and reports overflow', () => {
  const existing = Array.from({ length: 49 }, (_, i) => `user${i}@x.com`);
  const { chips, overflow } = mergeEmailChips(existing, ['new1@x.com', 'new2@x.com', 'new3@x.com']);
  assert.equal(chips.length, 50);
  assert.equal(overflow, 2);
});

test('validates addresses with the shared invite pattern', () => {
  assert.equal(isValidInviteEmail('founder@startup.com'), true);
  assert.equal(isValidInviteEmail('not-an-email'), false);
  assert.equal(isValidInviteEmail('missing@tld'), false);
});

test('extracts the email column from CSV rows and skips other columns', () => {
  const csv = [
    'Name,Email,Company',
    'Jordan Lee,jordan@startup.com,Acme',
    '"Sam Field","sam@field.io","Field Co"',
  ].join('\n');
  assert.deepEqual(extractEmailsFromCsvText(csv), ['jordan@startup.com', 'sam@field.io']);
});

test('extracts emails from display-name and mailto forms', () => {
  const csv = 'Jordan <jordan@startup.com>\nmailto:sam@field.io';
  assert.deepEqual(extractEmailsFromCsvText(csv), ['jordan@startup.com', 'sam@field.io']);
});

test('handles tab-separated exports', () => {
  const tsv = 'Name\tEmail\nJordan\tjordan@startup.com';
  assert.deepEqual(extractEmailsFromCsvText(tsv), ['jordan@startup.com']);
});

test('returns nothing for files without addresses', () => {
  assert.deepEqual(extractEmailsFromCsvText('Name,Company\nJordan,Acme'), []);
});

test('skips social-handle columns instead of turning them into chips', () => {
  const csv = 'Name,Email,Twitter\nJordan,jordan@startup.com,@jordan\nSam,sam@field.io,@samf';
  assert.deepEqual(extractEmailsFromCsvText(csv), ['jordan@startup.com', 'sam@field.io']);
});

test('splits space-separated plain-text exports into individual addresses', () => {
  assert.deepEqual(
    extractEmailsFromCsvText('a@x.com b@y.io c@z.dev'),
    ['a@x.com', 'b@y.io', 'c@z.dev'],
  );
});

test('drops malformed addresses from file extraction rather than emitting junk chips', () => {
  assert.deepEqual(extractEmailsFromCsvText('Jordan,user@domain\nSam,sam@field.io'), ['sam@field.io']);
});
