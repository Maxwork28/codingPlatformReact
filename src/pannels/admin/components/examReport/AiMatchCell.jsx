import React from 'react';
import { Loader2 } from 'lucide-react';
import { useExamAi } from './aiStore';
import { AI_DISCLAIMER, aiTone, attemptAiRows, describeAiEntry } from './aiUtils';

/**
 * "AI match" column: the highest similarity to AI-generated reference solutions across the
 * attempt's coding answers. Tooltip lists every coding question. Data comes from the shared store
 * that AiReferencesButton loads once per report load / refresh.
 */
export default function AiMatchCell({ attempt, questions }) {
  const { data, loading } = useExamAi();
  const rows = attemptAiRows(data?.byAttempt, attempt, questions);
  if (!rows.length) return <span className="text-subtle">—</span>;
  if (!data) {
    return loading ? <Loader2 className="inline w-3 h-3 animate-spin text-subtle" aria-label="Loading AI similarity" /> : <span className="text-subtle">—</span>;
  }

  const answered = rows.filter((r) => r.entry);
  if (!answered.length) return <span className="text-subtle" title="No coding answers yet">—</span>;

  const scores = answered.map((r) => r.entry.percent).filter((p) => p != null);
  const best = scores.length ? Math.max(...scores) : null;
  const pending = answered.some((r) => r.entry.status === 'pending');
  const title = [
    'Similarity to AI-generated reference solutions',
    ...answered.map((r) => `Q${r.index} ${r.question.title}: ${describeAiEntry(r.entry)}`),
    '',
    AI_DISCLAIMER,
  ].join('\n');

  return (
    <span className="inline-flex items-center justify-end gap-1 tabular-nums" title={title}>
      {best != null ? <span className={`font-semibold ${aiTone(best)}`}>{best}%</span> : !pending && <span className="text-subtle">—</span>}
      {pending && (
        <span className="inline-flex items-center gap-1 text-[11px] text-subtle">
          <Loader2 className="w-3 h-3 animate-spin" aria-hidden="true" />
          {best == null && 'pending'}
        </span>
      )}
    </span>
  );
}
