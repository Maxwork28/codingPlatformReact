import React from 'react';

export const formatTimeMs = (timeMs) => {
  if (timeMs == null || timeMs === '') return null;
  const n = Number(timeMs);
  if (!Number.isFinite(n) || n < 0) return null;
  if (n < 1) return `${n.toFixed(2)} ms`;
  if (n < 1000) return `${n < 10 ? n.toFixed(1) : Math.round(n)} ms`;
  return `${(n / 1000).toFixed(2)} s`;
};

export const formatMemoryKb = (memoryKb) => {
  if (memoryKb == null || memoryKb === '') return null;
  const n = Number(memoryKb);
  if (!Number.isFinite(n) || n < 0) return null;
  if (n < 1024) return `${Math.round(n)} KB`;
  const mb = n / 1024;
  return `${mb >= 10 ? Math.round(mb) : mb.toFixed(1)} MB`;
};

export const pickRunMetrics = (source) => {
  if (!source || typeof source !== 'object') return { timeMs: null, memoryKb: null };
  const nested = source.testResult || (source.testResults && !Array.isArray(source.testResults) ? source.testResults : null);
  return {
    timeMs: source.timeMs ?? nested?.timeMs ?? null,
    memoryKb: source.memoryKb ?? nested?.memoryKb ?? null,
  };
};

const RunMetricsBadges = ({ timeMs, memoryKb, result, className = '' }) => {
  const metrics = result ? pickRunMetrics(result) : { timeMs, memoryKb };
  const timeLabel = formatTimeMs(metrics.timeMs);
  const memoryLabel = formatMemoryKb(metrics.memoryKb);
  if (!timeLabel && !memoryLabel) return null;

  return (
    <span className={`inline-flex flex-wrap items-center gap-x-3 gap-y-0.5 text-xs font-medium text-gray-600 ${className}`}>
      {timeLabel && <span>Time: {timeLabel}</span>}
      {memoryLabel && <span>Memory: {memoryLabel}</span>}
    </span>
  );
};

export default RunMetricsBadges;
