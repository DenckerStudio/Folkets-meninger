import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import {
  buildResearchTopicSakPollFormValidationInput,
  validateResearchTopicSakPollIngress,
} from '@/lib/admin/research/topic-sak-poll-client';
import { validateStortingetPollAdminForm } from '@/lib/polls/stortinget-poll-admin';

const topicId = '550e8400-e29b-41d4-a716-446655440000';
const dedicatedIssueId = `research-topic:${topicId}`;

const validationInput = buildResearchTopicSakPollFormValidationInput({
  suggestedIssueId: dedicatedIssueId,
  title: 'Formueskatt i kommunene',
  neutralSummary: 'Kort nøytral ingress fra brief.',
  closesAtDate: '',
  closesAtTime: '',
});

assert.equal(validationInput.issueId, dedicatedIssueId);
const validated = validateStortingetPollAdminForm(validationInput);
assert.ok(validated.ok, !validated.ok ? validated.error : 'validering feilet');

const brokenSnakeCase = validateStortingetPollAdminForm({
  issue_id: dedicatedIssueId,
  title: 'Formueskatt',
  neutral_summary: 'Ingress',
});
assert.equal(brokenSnakeCase.ok, false);
if (!brokenSnakeCase.ok) {
  assert.equal(brokenSnakeCase.error, 'Mangler sak.');
}

const migration = readFileSync(
  join(process.cwd(), 'supabase/migrations/20261102120000_admin_publish_stortinget_poll.sql'),
  'utf8',
);
assert.match(
  migration,
  /v_issue_id := nullif\(btrim\(coalesce\(p_issue_id, ''\)\), ''\)/,
  'admin_publish_stortinget_poll aksepterer vilkårlig tekst-issue_id (inkl. research-topic:)',
);
assert.doesNotMatch(
  migration.slice(migration.indexOf('admin_publish_stortinget_poll')),
  /issue_id.*numeric|p_issue_id.*\d{5}/i,
);

assert.equal(
  validateResearchTopicSakPollIngress('Nøytral oppsummering av temaet, basert på brief-funnene.'),
  'Skriv en egen nøytral ingress.',
);

console.log('lib/admin/research/topic-sak-poll-client-validation.test.ts: ok');
