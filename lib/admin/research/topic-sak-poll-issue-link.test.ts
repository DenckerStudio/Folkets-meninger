import { readFileSync } from 'node:fs';
import { join } from 'node:path';

const migration = readFileSync(
  join(
    process.cwd(),
    'supabase/migrations/20261115180000_fix_research_topic_poll_stortinget_issue.sql',
  ),
  'utf8',
);

if (!migration.includes('research_topic_derived_stortinget_issue_id')) {
  throw new Error('migration defines derived issue helper');
}
if (!migration.includes("LIKE 'research-topic:%'")) {
  throw new Error('migration targets research-topic issue ids');
}
if (!migration.includes('GRANT EXECUTE')) {
  throw new Error('migration grants execute to service_role');
}

const src = readFileSync(join(process.cwd(), 'lib/admin/research/topic-sak-poll.ts'), 'utf8');
if (!src.includes('resolveResearchTopicPollStortingetIssueId')) {
  throw new Error('publish uses poll stortinget issue resolver');
}
if (!src.includes('resolveResearchTopicRealStortingetIssueId')) {
  throw new Error('real stortinget issue resolver');
}

console.log('lib/admin/research/topic-sak-poll-issue-link.test.ts: ok');