import React, { useEffect, useRef, useState } from 'react';
import { Bot } from 'lucide-react';
import { Button } from '../../../../common/ui/primitives';
import { isCodingType } from '../../../../common/domain/questions';
import { getExamAiState, loadExamAi, resetExamAi, useExamAi } from './aiStore';
import AiReferencesModal from './AiReferencesModal';

const REFRESH_MIN_MS = 5000;

/**
 * Header action on the exam report: opens the AI reference manager. It also owns the shared AI
 * similarity data used by the "AI match" column and the attempt modal: loaded once on mount,
 * re-fetched when the report itself reloads (refresh button / live polling), reset on unmount.
 */
export default function AiReferencesButton({ exam }) {
  const [open, setOpen] = useState(false);
  const { data } = useExamAi();
  const examId = exam?._id;
  const hasCoding = (exam?.questions || []).some((q) => isCodingType(q.type));
  const firstLoad = useRef(true);

  useEffect(() => {
    if (!examId || !hasCoding) return undefined;
    loadExamAi(examId);
    return undefined;
  }, [examId, hasCoding]);

  useEffect(() => () => resetExamAi(), []);

  // The report hands us a new `exam` object every time it reloads: refresh the AI data with it.
  useEffect(() => {
    if (!examId || !hasCoding) return;
    if (firstLoad.current) {
      firstLoad.current = false;
      return;
    }
    const loaded = getExamAiState();
    if (loaded.examId !== examId || Date.now() - loaded.fetchedAt >= REFRESH_MIN_MS) loadExamAi(examId, { force: true });
  }, [exam, examId, hasCoding]);

  if (!hasCoding) return null;
  const refs = (data?.questions || []).reduce((sum, q) => sum + (q.references?.total || 0), 0);

  return (
    <>
      <Button
        variant="secondary"
        icon={Bot}
        className="h-9"
        onClick={() => setOpen(true)}
        title="AI reference solutions used to estimate AI-generated code in coding answers"
      >
        AI references
        {data && <span className="text-subtle font-normal tabular-nums">{refs}</span>}
      </Button>
      {open && <AiReferencesModal exam={exam} onClose={() => setOpen(false)} />}
    </>
  );
}

