'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import {
  POLL_DRAFT_POLL_INTERVAL_MS,
  findCompletedDraft,
  isPollDraftGenerationTimedOut,
  pollDraftGenerationKey,
  type PollDraftGenerationJob,
  type PollDraftGenerationStatus,
} from '@/lib/admin/poll-draft-generation';
import type { PollRecord } from '@/lib/polls/types';

type DraftsResponse = { drafts: PollRecord[] };

async function fetchDrafts(): Promise<PollRecord[]> {
  const res = await fetch('/api/admin/polls');
  if (!res.ok) {
    throw new Error('Kunne ikke hente utkast');
  }
  const data = (await res.json()) as DraftsResponse;
  return data.drafts ?? [];
}

export function usePollDraftGeneration() {
  const [jobs, setJobs] = useState<PollDraftGenerationJob[]>([]);
  const jobsRef = useRef(jobs);

  useEffect(() => {
    jobsRef.current = jobs;
  }, [jobs]);

  const dismissJob = useCallback((key: string) => {
    setJobs((current) => current.filter((job) => job.key !== key));
  }, []);

  const startGeneration = useCallback(async (issueId?: string) => {
    const key = pollDraftGenerationKey(issueId);
    const currentDrafts = await fetchDrafts();
    const knownDraftIds = currentDrafts.map((draft) => draft.id);

    const res = await fetch('/api/admin/poll-drafts', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(issueId ? { stortinget_issue_id: issueId } : {}),
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      throw new Error(typeof data.error === 'string' ? data.error : 'Kunne ikke starte generering');
    }

    const job: PollDraftGenerationJob = {
      key,
      issueId: issueId?.trim() ? issueId.trim() : null,
      startedAt: Date.now(),
      status: 'generating',
      knownDraftIds,
    };

    setJobs((current) => {
      const withoutKey = current.filter((entry) => entry.key !== key);
      return [...withoutKey, job];
    });

    return job;
  }, []);

  const getJob = useCallback(
    (issueId?: string) => jobs.find((job) => job.key === pollDraftGenerationKey(issueId)),
    [jobs],
  );

  const isGenerating = useCallback(
    (issueId?: string) => getJob(issueId)?.status === 'generating',
    [getJob],
  );

  useEffect(() => {
    const poll = async () => {
      const activeJobs = jobsRef.current.filter((job) => job.status === 'generating');
      if (activeJobs.length === 0) return;

      try {
        const drafts = await fetchDrafts();
        const now = Date.now();
        let draftsChanged = false;

        setJobs((current) =>
          current.map((job) => {
            if (job.status !== 'generating') return job;

            const completedDraft = findCompletedDraft(job, drafts);
            if (completedDraft) {
              draftsChanged = true;
              return {
                ...job,
                status: 'ready',
                draftId: completedDraft.id,
              };
            }

            if (isPollDraftGenerationTimedOut(job, now)) {
              return { ...job, status: 'timeout' };
            }

            return job;
          }),
        );

        if (draftsChanged) {
          window.dispatchEvent(new CustomEvent('poll-drafts:ready'));
        }
      } catch {
        // Keep polling — transient network errors should not abort generation tracking.
      }
    };

    const intervalId = window.setInterval(() => {
      void poll();
    }, POLL_DRAFT_POLL_INTERVAL_MS);

    return () => {
      window.clearInterval(intervalId);
    };
  }, []);

  return {
    jobs,
    startGeneration,
    dismissJob,
    getJob,
    isGenerating,
  };
}

export type { PollDraftGenerationJob, PollDraftGenerationStatus };
