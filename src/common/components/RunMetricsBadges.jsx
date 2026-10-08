import React from 'react';
import { formatMemoryKb, formatTimeMs, pickRunMetrics } from '../utils/runMetrics';

const RunMetricsBadges = ({ timeMs, memoryKb, result, className = '', alwaysShow = true }) => {
  const metrics = result ? pickRunMetrics(result) : { timeMs, memoryKb };
  const timeLabel = formatTimeMs(metrics.timeMs);
  const memoryLabel = formatMemoryKb(metrics.memoryKb);
  if (!alwaysShow && !timeLabel && !memoryLabel) return null;

  return (
    <span className={`inline-flex flex-wrap items-center gap-x-3 gap-y-0.5 text-xs font-semibold tabular-nums ${className}`} style={{ color: 'var(--muted)' }}>
      <span>Time: {timeLabel || '—'}</span>
      <span>Memory: {memoryLabel || '—'}</span>
    </span>
  );
};

export default RunMetricsBadges;
