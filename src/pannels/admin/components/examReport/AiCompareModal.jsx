import React, { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { Columns2, Loader2 } from 'lucide-react';
import Modal from '../../../../common/ui/Modal';
import { Button, StatusChip } from '../../../../common/ui/primitives';
import { type } from '../../../../common/ui/format';
import { languageLabel } from '../../../../common/domain/questions';
import { getAiComparison } from '../../../../common/services/aiCheckApi';
import { selectClass } from '../classDetails/helpers';
import { AI_DISCLAIMER, aiChipKind, aiSourceLabel, highlightSegments } from './aiUtils';

const FOCUSABLE = 'a[href], button:not([disabled]), textarea:not([disabled]), input:not([disabled]), select:not([disabled]), [tabindex]:not([tabindex="-1"])';

function CodePane({ title, subtitle, code, ranges, active, onHover }) {
  const segments = highlightSegments(code, ranges);
  return (
    <section className="min-w-0 flex flex-col gap-1.5">
      <div className="flex items-baseline gap-2 min-w-0">
        <h3 className={`${type.section} shrink-0`}>{title}</h3>
        {subtitle && <span className={`${type.meta} truncate`}>{subtitle}</span>}
      </div>
      <pre className="max-h-[60vh] overflow-auto rounded-xl bg-inset border border-line p-3 text-[11px] leading-relaxed text-body font-mono whitespace-pre">
        {segments.map((s, i) =>
          s.id == null ? (
            <React.Fragment key={i}>{s.text}</React.Fragment>
          ) : (
            <mark
              key={i}
              onMouseEnter={() => onHover(s.id)}
              onMouseLeave={() => onHover(null)}
              title={`Matched region (${s.tokens} tokens)`}
              className={`rounded-sm text-fg ${active === s.id ? 'bg-bad-line' : 'bg-bad-soft'}`}
            >
              {s.text}
            </mark>
          ),
        )}
      </pre>
    </section>
  );
}

/**
 * Side-by-side view: the student's answer vs an AI reference solution, matched regions highlighted
 * (hover a region to see its counterpart). Opened on top of the attempt modal, so it handles
 * Escape / Tab itself and keeps them from reaching the dialog underneath.
 */
export default function AiCompareModal({ submissionId, referenceId: initialReferenceId, title, onClose }) {
  const [referenceId, setReferenceId] = useState(initialReferenceId || null);
  const [result, setResult] = useState(null);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);
  const [active, setActive] = useState(null);
  const anchorRef = useRef(null);

  useEffect(() => {
    let alive = true;
    setLoading(true);
    getAiComparison(submissionId, referenceId)
      .then((data) => {
        if (!alive) return;
        setResult(data);
        setError('');
      })
      .catch((err) => alive && setError(String(err)))
      .finally(() => alive && setLoading(false));
    return () => {
      alive = false;
    };
  }, [submissionId, referenceId]);

  // Nested dialog: own Escape + focus trap in the capture phase so the attempt modal underneath
  // neither closes nor steals focus.
  useEffect(() => {
    const onKey = (event) => {
      const panel = anchorRef.current?.closest('[role="dialog"]');
      if (!panel) return;
      if (event.key === 'Escape') {
        event.stopPropagation();
        event.preventDefault();
        onClose();
        return;
      }
      if (event.key !== 'Tab') return;
      event.stopPropagation();
      const items = Array.from(panel.querySelectorAll(FOCUSABLE)).filter((el) => el.offsetParent !== null);
      if (!items.length) return;
      const first = items[0];
      const last = items[items.length - 1];
      const current = document.activeElement;
      if (event.shiftKey && (current === first || !panel.contains(current))) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && (current === last || !panel.contains(current))) {
        event.preventDefault();
        first.focus();
      }
    };
    window.addEventListener('keydown', onKey, true);
    return () => window.removeEventListener('keydown', onKey, true);
  }, [onClose]);

  const selected = result?.selected;
  const studentRanges = (selected?.matches || []).map((m, i) => ({ start: m.a.start, end: m.a.end, id: i, tokens: m.tokens }));
  const referenceRanges = (selected?.matches || []).map((m, i) => ({ start: m.b.start, end: m.b.end, id: i, tokens: m.tokens }));

  // Portal: the attempt modal's backdrop-filter would otherwise become the containing block of this
  // fixed overlay and clip it.
  return createPortal(
    <Modal
      open
      onClose={onClose}
      title="Compare with AI reference"
      icon={Columns2}
      width="max-w-6xl"
      footer={
        <Button variant="secondary" onClick={onClose}>
          Close
        </Button>
      }
    >
      <span ref={anchorRef} className="hidden" />
      <div className="flex flex-wrap items-center gap-x-3 gap-y-2 -mt-2">
        <p className="text-sm font-semibold text-fg truncate max-w-full">{title}</p>
        {result?.submission?.language && <span className={type.meta}>{languageLabel(result.submission.language)}</span>}
        {selected && (
          <StatusChip kind={aiChipKind(selected.percent)} className="tabular-nums">
            {selected.percent}% similar
          </StatusChip>
        )}
        {result?.references?.length > 1 && (
          <label className="ml-auto flex items-center gap-2 text-xs text-muted">
            Compare with
            <select className={selectClass} value={selected?.referenceId || ''} onChange={(e) => setReferenceId(e.target.value)} aria-label="Reference to compare with">
              {result.references.map((r) => (
                <option key={r._id} value={r._id}>
                  {r.label || aiSourceLabel(r.source)} · {r.percent}%
                </option>
              ))}
            </select>
          </label>
        )}
        {loading && <Loader2 className="w-4 h-4 animate-spin text-subtle" aria-label="Loading" />}
      </div>
      <p className={`${type.meta} -mt-3`}>{AI_DISCLAIMER}</p>

      {error ? (
        <p className="text-xs text-bad">{error}</p>
      ) : !result ? (
        <div className="grid md:grid-cols-2 gap-4">
          <div className="h-64 rounded-xl bg-hover animate-pulse" />
          <div className="h-64 rounded-xl bg-hover animate-pulse" />
        </div>
      ) : !selected ? (
        <p className="text-xs text-muted">
          {result.status === 'too_short'
            ? 'This answer is too short to compare once the starter code is removed.'
            : 'There are no AI reference solutions for this question and language anymore.'}
        </p>
      ) : (
        <>
          <div className="grid md:grid-cols-2 gap-4">
            <CodePane title="Student answer" subtitle={result.question?.title} code={result.submission.code} ranges={studentRanges} active={active} onHover={setActive} />
            <CodePane
              title="AI reference"
              subtitle={`${selected.label || aiSourceLabel(selected.source)}${selected.model ? ` · ${selected.model}` : ''}`}
              code={selected.code}
              ranges={referenceRanges}
              active={active}
              onHover={setActive}
            />
          </div>
          <p className={type.meta}>
            Highlighted: code that matches token-for-token after ignoring names, formatting, comments, the starter code and common input/output lines.
            {selected.detail
              ? ` ${Math.round(selected.detail.containStudent * 100)}% of the student's fingerprints appear in this reference; ${Math.round(selected.detail.containReference * 100)}% of the reference's appear in the answer.`
              : ''}
          </p>
        </>
      )}
    </Modal>,
    document.body,
  );
}
