import { readFileSync } from 'node:fs';
import { join } from 'node:path';

const bundleSrc = readFileSync(
  join(process.cwd(), 'lib/sak/dedicated-research-topic-bundle.ts'),
  'utf8',
);

if (!bundleSrc.includes('loadDedicatedResearchTopicBundleFromTopic')) {
  throw new Error('dedikert sak faller tilbake på research_topics når stortinget_issues mangler');
}

const linkSrc = readFileSync(join(process.cwd(), 'lib/polls/stortinget-issue-link.ts'), 'utf8');
if (!linkSrc.includes('resolvePollSourceSakLink')) {
  throw new Error('poll sak-lenke bruker resolvePollSourceSakLink');
}

const publishSrc = readFileSync(join(process.cwd(), 'lib/admin/research/topic-sak-poll.ts'), 'utf8');
if (publishSrc.includes('resolveResearchTopicPollStortingetIssueId')) {
  throw new Error('publish skal ikke overskrive poll issue med cluster-avledet sak');
}

console.log('lib/admin/research/topic-sak-poll-issue-link.test.ts: ok');