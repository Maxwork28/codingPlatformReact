import { parseTestCaseResultsList } from './testCaseResults';
import { summarizeRunMetrics } from './runMetrics';

/** Range the server accepts for a question's limits (updateQuestionLimits / test overrides). */
export const TIME_MIN = 0.1;
export const TIME_MAX = 5;
export const MEMORY_MIN = 16;
export const MEMORY_MAX = 1024;

/**
 * Headroom applied to a measured average. Must stay identical to `fieldLimitsFromAverages`
 * in codingPlatformNode/utils/judge.js.
 */
export const LIMIT_TIME_FACTOR = 3;
export const LIMIT_TIME_PAD_S = 0.3;
export const LIMIT_TIME_MIN_S = 0.5;
export const LIMIT_MEM_FACTOR = 2;
export const LIMIT_MEM_PAD_MB = 32;
export const LIMIT_MEM_MIN_MB = 64;
export const LIMIT_MEM_STEP_MB = 16;

/**
 * Convert an average run (ms / KB) into suggested question limits (seconds / MB) with headroom:
 *   time   = clamp(ceil((avgS × 3 + 0.3) to 0.1 s), 0.5, 5)
 *   memory = clamp(ceil((avgMb × 2 + 32) to a multiple of 16 MB), 64, 1024)
 */
export const limitsFromAverageMetrics = (avgTimeMs, avgMemoryKb) => {
  const avgS = Math.max(0, Number(avgTimeMs) || 0) / 1000;
  const avgMb = Math.max(0, Number(avgMemoryKb) || 0) / 1024;
  const rawTime = avgS * LIMIT_TIME_FACTOR + LIMIT_TIME_PAD_S;
  const timeLimit = Math.min(TIME_MAX, Math.max(LIMIT_TIME_MIN_S, Math.ceil(rawTime * 10) / 10));
  const rawMem = avgMb * LIMIT_MEM_FACTOR + LIMIT_MEM_PAD_MB;
  const memoryLimit = Math.min(
    MEMORY_MAX,
    Math.max(LIMIT_MEM_MIN_MB, Math.ceil(rawMem / LIMIT_MEM_STEP_MB) * LIMIT_MEM_STEP_MB)
  );
  return { timeLimit, memoryLimit };
};

/** Suggested limits from the slowest / largest case of the last test run, or null when there are no metrics. */
export const suggestLimitsFromTestResults = (testResults) => {
  if (!testResults || testResults.error) return null;
  const rows = parseTestCaseResultsList(testResults.results || testResults.testResults || []);
  const { maxTimeMs, maxMemoryKb } = summarizeRunMetrics(rows);
  if (!Number.isFinite(maxTimeMs) && !Number.isFinite(maxMemoryKb)) return null;
  return {
    ...limitsFromAverageMetrics(maxTimeMs, maxMemoryKb),
    maxTimeMs,
    maxMemoryKb,
  };
};
