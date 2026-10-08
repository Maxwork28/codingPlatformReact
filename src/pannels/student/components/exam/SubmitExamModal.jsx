import React from 'react';
import { Send } from 'lucide-react';
import Modal from '../../../../common/ui/Modal';
import { Button } from '../../../../common/ui/primitives';
import { formatClock } from './examUtils';

function Count({ label, value, tone }) {
  return (
    <div className="rounded-xl border border-line bg-inset px-3 py-2.5">
      <p className="text-[10px] font-bold uppercase tracking-wider text-muted">{label}</p>
      <p className={`text-xl font-bold tabular-nums ${tone}`}>{value}</p>
    </div>
  );
}

/**
 * `items` is the ordered question list: { id, number, state: saved | dirty | empty | locked, flagged, away }.
 * `away` marks unsaved changes in a timed question/section the student has left: the server only accepts
 * those while that timer runs, so they are not saved on submit.
 */
export default function SubmitExamModal({ open, onClose, onConfirm, submitting, items, remainingSeconds }) {
  const saved = items.filter((i) => i.state === 'saved').length;
  const dirty = items.filter((i) => i.state === 'dirty');
  const saveable = dirty.filter((i) => !i.away);
  const away = dirty.filter((i) => i.away);
  const empty = items.filter((i) => i.state === 'empty');
  const flagged = items.filter((i) => i.flagged);
  const list = (rows) => rows.map((r) => r.number).join(', ');

  return (
    <Modal
      open={open}
      onClose={submitting ? undefined : onClose}
      title="Submit exam?"
      icon={Send}
      accent="emerald"
      width="max-w-lg"
      footer={
        <>
          <Button variant="secondary" onClick={onClose} disabled={submitting}>
            Keep working
          </Button>
          <Button icon={Send} onClick={onConfirm} disabled={submitting}>
            {submitting ? 'Submitting…' : saveable.length ? 'Save and submit' : 'Submit exam'}
          </Button>
        </>
      }
    >
      <div className="grid grid-cols-3 gap-2">
        <Count label="Saved" value={`${saved}/${items.length}`} tone="text-ok" />
        <Count label="Not saved" value={dirty.length} tone={dirty.length ? 'text-warn' : 'text-fg'} />
        <Count label="Unanswered" value={empty.length} tone={empty.length ? 'text-bad' : 'text-fg'} />
      </div>
      <div className="space-y-2 text-xs text-body">
        {saveable.length > 0 && (
          <p>
            Questions {list(saveable)} have changes that are not saved yet. They will be saved before the exam is submitted. Coding answers are checked
            again, which can take a few seconds.
          </p>
        )}
        {away.length > 0 && (
          <p className="text-warn">
            Questions {list(away)} have unsaved changes in a timed part of the exam you have left. Go back to them and save while their timer
            runs; otherwise those changes are not submitted.
          </p>
        )}
        {empty.length > 0 && <p>Questions {list(empty)} have no answer and will score zero.</p>}
        {flagged.length > 0 && <p>You flagged questions {list(flagged)} to come back to.</p>}
        <p className="text-muted">
          {remainingSeconds > 0 ? `You still have ${formatClock(remainingSeconds)}. ` : ''}
          Once you submit, you cannot change any answers.
        </p>
      </div>
    </Modal>
  );
}
