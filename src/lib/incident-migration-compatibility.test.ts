import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import test from 'node:test';

const repoRoot = process.cwd();
const migrationsDirectory = join(repoRoot, 'supabase', 'migrations');
const migration = (name: string) => readFileSync(join(migrationsDirectory, name), 'utf8');

const secureLegacy = migration('20260718120000_secure_review_submission.sql');
const expand = migration('20260829000021_add_incident_database_contracts.sql');
const eventAtomicity = migration('20260829002326_make_event_submission_atomic.sql');
const hardening = migration('20260829002403_harden_incident_contracts_review_followup.sql');
const lifecycle = migration('20260829002500_preserve_assignment_history_on_access_changes.sql');
const compatibility = readFileSync(join(repoRoot, 'supabase', 'INCIDENT_MIXED_VERSION_COMPATIBILITY.md'), 'utf8');
const pr1IncidentMigrations = readdirSync(migrationsDirectory)
  .filter((name) => /^2026082900.*\.sql$/.test(name))
  .sort();
const pr1IncidentSql = pr1IncidentMigrations.map(migration).join('\n');

test('PR1 adds every safe read contract before any identity privilege contraction', () => {
  for (const signature of [
    'get_founder_pitch_feedback',
    'get_my_feedback_history',
    'can_rate_feedback',
    'get_review_queue_snapshot',
    'get_review_assignment_detail',
  ]) {
    assert.match(expand, new RegExp(`CREATE OR REPLACE FUNCTION public\\.${signature}`));
  }

  assert.doesNotMatch(pr1IncidentSql, /REVOKE SELECT ON public\.feedback FROM anon, authenticated/);
  assert.doesNotMatch(pr1IncidentSql, /REVOKE ALL ON public\.review_assignments FROM PUBLIC, anon, authenticated/);
});

test('PR1 preserves previous-application reads while extending structured feedback', () => {
  assert.match(secureLegacy, /GRANT SELECT \([\s\S]*user_id[\s\S]*reviewer_role[\s\S]*\) ON public\.feedback TO anon, authenticated/);
  assert.match(secureLegacy, /GRANT SELECT ON public\.review_assignments TO authenticated/);
  assert.match(expand, /GRANT SELECT \([\s\S]*event_guideline_version_id[\s\S]*criterion_key[\s\S]*observation[\s\S]*next_step[\s\S]*disclosure_mode[\s\S]*\) ON public\.feedback TO anon, authenticated/);
});

test('PR1 includes the application-required atomic submission and hardened disclosure contracts', () => {
  assert.match(eventAtomicity, /CREATE OR REPLACE FUNCTION public\.submit_legacy_event_final_take_atomic/);
  assert.match(eventAtomicity, /CREATE OR REPLACE FUNCTION public\.bind_legacy_submission_pitch/);
  assert.match(eventAtomicity, /request\.jwt\.claim\.role[\s\S]*service_role/);
  assert.match(eventAtomicity, /BEFORE INSERT OR UPDATE OF event_id, pitch_id, user_id\s+ON public\.pitch_event_submissions/);
  assert.match(eventAtomicity, /UPDATE public\.pitches[\s\S]*INSERT INTO public\.pitch_event_submissions/);
  assert.match(hardening, /ELSE 'Anonymous reviewer'\s+END/);
  assert.doesNotMatch(hardening, /Anonymous reviewer ['"]?\s*\|\||md5\(\s*feedback\.user_id/);
  assert.match(hardening, /scoped_feedback\.has_accountability_access\s+OR scoped_feedback\.user_id = caller_id\s+OR scoped_feedback\.disclosure_mode = 'named'/);
  assert.match(hardening, /assignment\.event_id IS NOT NULL\s+AND public\.can_manage_review_event\(assignment\.event_id\)/);
  assert.match(lifecycle, /CREATE OR REPLACE FUNCTION public\.is_review_assignment_eligible_for/);
});

test('PR1 contains no prematurely named contract migration', () => {
  assert.deepEqual(
    pr1IncidentMigrations.filter((name) => /contract_feedback_identity_access|contract_review_assignment_access/.test(name)),
    [],
  );
});

test('release documentation requires a separately gated PR2 and forward-only rollback', () => {
  assert.match(compatibility, /PR1: expand and cut over the application/i);
  assert.match(compatibility, /PR2: contract identity access after production cutover/i);
  assert.match(compatibility, /Previous application \| PR1 expanded schema \| Yes/);
  assert.match(compatibility, /Previous application \| PR2 contracted identity grants \| No, by design/);
  assert.match(compatibility, /fails closed instead of exposing feedback or\s+assignment identity/i);
  assert.match(compatibility, /deploy a forward-fix\s+migration and a compatible application build/i);
  assert.match(compatibility, /Do not restore broad browser\s+table grants/i);
  assert.match(compatibility, /cannot prove which application deployment is live/i);
  assert.match(compatibility, /apply all PR1 expand migrations while the previous application is\s+still live[\s\S]*Only after the database push succeeds, deploy the exact verified\s+compatible application commit/i);
});
