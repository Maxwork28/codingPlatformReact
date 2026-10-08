import { useSyncExternalStore } from 'react';
import { getExamAiReport } from '../../../../common/services/aiCheckApi';

/**
 * Module-level cache of the exam report's AI similarity data, shared by every AiMatchCell,
 * AttemptAiSection and the AI references manager on the page (one request per load/refresh).
 * AiReferencesButton owns the lifecycle: it loads on mount, refreshes when the report reloads,
 * and resets on unmount. While any answer is still being checked the store polls.
 */

const POLL_MS = 4000;
const MAX_POLL_MS = 5 * 60 * 1000;
const EMPTY = { examId: null, data: null, loading: false, error: '', fetchedAt: 0 };

let state = EMPTY;
const listeners = new Set();
let inflight = null;
let queued = false;
let pollTimer = null;
let pollingSince = 0;

const emit = (patch) => {
  state = { ...state, ...patch };
  listeners.forEach((listener) => listener());
};

const subscribe = (listener) => {
  listeners.add(listener);
  return () => listeners.delete(listener);
};
const snapshot = () => state;

const hasPending = (data) =>
  Boolean(
    data &&
      (data.generation?.status === 'running' ||
        (data.questions || []).some((q) => q.pending > 0) ||
        Object.values(data.byAttempt || {}).some((answers) => Object.values(answers).some((a) => a.status === 'pending'))),
  );

const clearPoll = () => {
  if (pollTimer) clearTimeout(pollTimer);
  pollTimer = null;
};

const schedulePoll = (examId) => {
  clearPoll();
  if (!hasPending(state.data)) {
    pollingSince = 0;
    return;
  }
  if (!pollingSince) pollingSince = Date.now();
  if (Date.now() - pollingSince > MAX_POLL_MS) return;
  pollTimer = setTimeout(() => {
    if (state.examId === examId && (typeof document === 'undefined' || document.visibilityState === 'visible')) loadExamAi(examId, { force: true });
    else schedulePoll(examId);
  }, POLL_MS);
};

/** Fetch (or re-fetch with force) the AI data for an exam. Concurrent calls share one request. */
export function loadExamAi(examId, { force = false } = {}) {
  if (!examId) return Promise.resolve();
  if (state.examId !== examId) {
    clearPoll();
    pollingSince = 0;
    inflight = null;
    queued = false;
    state = { ...EMPTY, examId };
  }
  if (inflight) {
    if (force) queued = true;
    return inflight;
  }
  if (!force && state.data) return Promise.resolve();
  emit({ loading: true });
  const request = getExamAiReport(examId)
    .then((data) => {
      if (state.examId !== examId) return;
      emit({ data, loading: false, error: '', fetchedAt: Date.now() });
    })
    .catch((err) => {
      if (state.examId !== examId) return;
      emit({ loading: false, error: typeof err === 'string' ? err : 'Failed to load AI similarity results' });
    })
    .finally(() => {
      if (inflight !== request) return;
      inflight = null;
      if (state.examId !== examId) return;
      if (queued) {
        queued = false;
        loadExamAi(examId, { force: true });
      } else {
        schedulePoll(examId);
      }
    });
  inflight = request;
  return request;
}

/** Re-fetch soon after an action that changes scores (adds references, re-check…). */
export function refreshExamAi(examId) {
  pollingSince = 0;
  return loadExamAi(examId || state.examId, { force: true });
}

/** Forget everything (report page unmounted). */
export function resetExamAi() {
  clearPoll();
  inflight = null;
  queued = false;
  pollingSince = 0;
  state = EMPTY;
  listeners.forEach((listener) => listener());
}

export const getExamAiState = () => state;

/** { examId, data, loading, error, fetchedAt } — re-renders when the shared data changes. */
export function useExamAi() {
  return useSyncExternalStore(subscribe, snapshot, snapshot);
}
