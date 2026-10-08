import React, { useState } from 'react';
import { Bot, Columns2, Info, Loader2 } from 'lucide-react';
import { Button, StatusChip } from '../../../../common/ui/primitives';
import { isCodingType, languageLabel } from '../../../../common/domain/questions';
import { useExamAi } from './aiStore';
import { answerKey } from './reportUtils';
import { AI_DISCLAIMER, AI_STATUS_TEXT, aiChipKind, aiSourceLabel } from './aiUtils';
import AiCompareModal from './AiCompareModal';

/**
 * Under each coding answer in the attempt modal: similarity to AI-generated reference solutions,
 * the closest reference, the class median, and a side-by-side comparison.
 */
export default function AttemptAiSection({ attempt, question, answer }) {
  const { data, loading, error } = useExamAi();
  const [comparing, setComparing] = useState(false);
  if (!question || !isCodingType(question.type)) return null;
  if (!answer || answer.answer == null || answer.answer === '') return null;

  const entry = data?.byAttempt?.[attempt?._id]?.[answerKey(question.questionId)];
  let body;
  if (!data) {
    body = loading ? (
      <span className="inline-flex items-center gap-1 text-subtle">
        <Loader2 className="w-3 h-3 animate-spin" /> Loading…
      </span>
    ) : (
      <span className="text-subtle">{error || 'Not available'}</span>
    );
  } else if (!entry) {
    body = <span className="text-subtle">{AI_STATUS_TEXT.not_checked} — use “Re-check all submissions” in AI references.</span>;
  } else if (entry.status === 'done' && entry.percent != null) {
    const closest = entry.matchedLabel || aiSourceLabel(entry.matchedSource);
    body = (
      <>
        <StatusChip kind={aiChipKind(entry.percent)} className="tabular-nums">
          {entry.percent}%
        </StatusChip>
        <span className="text-body">
          closest: {closest}
          {entry.matchedModel ? <span className="text-subtle"> ({entry.matchedModel})</span> : null}
        </span>
        {entry.cohortMedian != null && <span className="text-subtle">· class median {entry.cohortMedian}%</span>}
      </>
    );
  } else if (entry.status === 'pending') {
    body = (
      <span className="inline-flex items-center gap-1 text-subtle">
        <Loader2 className="w-3 h-3 animate-spin" /> {entry.message || AI_STATUS_TEXT.pending}
      </span>
    );
  } else if (entry.status === 'no_references') {
    body = (
      <span className="text-subtle">
        No AI reference solutions for {languageLabel(entry.language) || 'this language'} yet. Add or generate them from “AI references”.
      </span>
    );
  } else if (entry.status === 'too_short') {
    body = <span className="text-subtle">Too short to compare reliably once the starter code is removed.</span>;
  } else {
    body = <span className="text-subtle">{entry.message || AI_STATUS_TEXT[entry.status] || 'Check failed'}</span>;
  }

  const canCompare = entry?.submissionId && entry.status === 'done' && entry.percent != null;

  return (
    <div className="mt-2 flex flex-wrap items-center gap-x-2 gap-y-1 rounded-xl border border-line bg-inset px-3 py-2 text-xs">
      <span className="inline-flex items-center gap-1 font-semibold text-muted">
        <Bot className="w-3.5 h-3.5" /> AI match
      </span>
      {body}
      <span className="ml-auto flex items-center gap-1">
        <span className="p-1 text-subtle cursor-help" title={AI_DISCLAIMER} aria-label={AI_DISCLAIMER} role="img">
          <Info className="w-3.5 h-3.5" />
        </span>
        {canCompare && (
          <Button variant="secondary" icon={Columns2} className="h-7" onClick={() => setComparing(true)}>
            Compare
          </Button>
        )}
      </span>
      {comparing && (
        <AiCompareModal
          submissionId={entry.submissionId}
          referenceId={entry.matchedReferenceId}
          title={`${attempt?.student?.name || 'Student'} · ${question.title}`}
          onClose={() => setComparing(false)}
        />
      )}
    </div>
  );
}
