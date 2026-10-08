import { answerKey } from './reportUtils';
import { isCodingType } from '../../../../common/domain/questions';

/** Shown wherever an AI similarity score appears. */
export const AI_DISCLAIMER =
  'Similarity to AI-generated reference solutions — an indicator for review, not proof. Short or standard problems naturally score higher; compare with the class median.';

export const AI_SOURCE_LABELS = {
  openai: 'ChatGPT',
  gemini: 'Gemini',
  anthropic: 'Claude',
  manual: 'Teacher-pasted',
};

export const aiSourceLabel = (source) => AI_SOURCE_LABELS[source] || source || 'Reference';

/** < 40 neutral, 40–69 warn, ≥ 70 bad. */
export const aiTone = (percent) => (percent == null ? 'text-subtle' : percent >= 70 ? 'text-bad' : percent >= 40 ? 'text-warn' : 'text-body');
export const aiChipKind = (percent) => (percent == null ? 'neutral' : percent >= 70 ? 'fail' : percent >= 40 ? 'warning' : 'neutral');

export const AI_STATUS_TEXT = {
  pending: 'Checking…',
  no_references: 'No AI references yet',
  too_short: 'Too short to compare',
  error: 'Check failed',
  not_checked: 'Not checked yet',
};

/** One-line description of an attempt answer's AI check (for tooltips). */
export function describeAiEntry(entry) {
  if (!entry) return 'not answered';
  if (entry.status === 'done' && entry.percent != null) {
    const median = entry.cohortMedian != null ? ` · class median ${entry.cohortMedian}%` : '';
    return `${entry.percent}%${entry.matchedSource ? ` (${aiSourceLabel(entry.matchedSource)})` : ''}${median}`;
  }
  return AI_STATUS_TEXT[entry.status] || entry.status;
}

/** [{ question, index, entry }] for the attempt's coding questions (entry may be undefined). */
export function attemptAiRows(byAttempt, attempt, questions) {
  const entries = byAttempt?.[attempt?._id] || {};
  return (questions || [])
    .map((question, i) => ({ question, index: i + 1, entry: entries[answerKey(question.questionId)] }))
    .filter((row) => isCodingType(row.question.type));
}

/**
 * Split `code` into plain / highlighted segments from character ranges [{ start, end, id }].
 * Overlaps are resolved in favour of the earlier range.
 */
export function highlightSegments(code, ranges) {
  const text = String(code ?? '');
  const sorted = (ranges || []).filter((r) => r && r.end > r.start).sort((a, b) => a.start - b.start);
  const out = [];
  let pos = 0;
  for (const r of sorted) {
    const start = Math.max(r.start, pos);
    const end = Math.min(r.end, text.length);
    if (end <= start) continue;
    if (start > pos) out.push({ text: text.slice(pos, start) });
    out.push({ text: text.slice(start, end), id: r.id, tokens: r.tokens });
    pos = end;
  }
  if (pos < text.length) out.push({ text: text.slice(pos) });
  return out;
}
