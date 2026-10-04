import React, { useEffect, useState } from 'react';
import { CalendarClock } from 'lucide-react';
import { createAssignment, deleteAssignment } from '../../../../common/services/api';
import Modal from '../../../../common/ui/Modal';
import { Button } from '../../../../common/ui/primitives';
import { inputClass, labelClass, type } from '../../../../common/ui/format';
import { errorText } from './helpers';

const toLocalInput = (date) => {
  const d = new Date(date);
  d.setMinutes(d.getMinutes() - d.getTimezoneOffset());
  return d.toISOString().slice(0, 16);
};

const PRESETS = [
  { label: 'Tomorrow', days: 1 },
  { label: 'In 3 days', days: 3 },
  { label: 'In a week', days: 7 },
  { label: 'In 2 weeks', days: 14 },
];

/** Sets or replaces the deadline (class assignment) for one question. */
export default function DeadlineModal({ classId, question, onClose, onSaved }) {
  const [dueDate, setDueDate] = useState('');
  const [maxPoints, setMaxPoints] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const existing = question?.assignment;

  useEffect(() => {
    if (!question) return;
    const fallback = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);
    fallback.setHours(23, 59, 0, 0);
    const current = existing?.dueDate && new Date(existing.dueDate) > new Date() ? existing.dueDate : fallback;
    setDueDate(toLocalInput(current));
    setMaxPoints(existing?.maxPoints ?? question.points ?? '');
    setError('');
  }, [question, existing]);

  if (!question) return null;

  const applyPreset = (days) => {
    const d = new Date(Date.now() + days * 24 * 60 * 60 * 1000);
    d.setHours(23, 59, 0, 0);
    setDueDate(toLocalInput(d));
  };

  const submit = async (e) => {
    e.preventDefault();
    const due = new Date(dueDate);
    if (!dueDate || Number.isNaN(due.getTime())) return setError('Pick a due date and time.');
    if (due <= new Date()) return setError('The deadline must be in the future.');
    if (maxPoints !== '' && (Number(maxPoints) < 0 || Number.isNaN(Number(maxPoints)))) return setError('Points must be zero or more.');
    setSaving(true);
    setError('');
    try {
      if (existing?._id) await deleteAssignment(classId, existing._id);
      await createAssignment(classId, {
        questionId: question._id,
        dueDate: due.toISOString(),
        maxPoints: maxPoints === '' ? undefined : Number(maxPoints),
      });
      onSaved(existing ? 'Deadline updated' : 'Deadline set');
    } catch (err) {
      setError(errorText(err, 'Failed to save deadline'));
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal
      open
      onClose={() => !saving && onClose()}
      title={existing ? 'Change deadline' : 'Set deadline'}
      icon={CalendarClock}
      accent="cyan"
      width="max-w-md"
      footer={
        <>
          <Button variant="secondary" onClick={onClose} disabled={saving}>
            Cancel
          </Button>
          <Button type="submit" form="deadline-form" disabled={saving}>
            {saving ? 'Saving…' : 'Save deadline'}
          </Button>
        </>
      }
    >
      <form id="deadline-form" onSubmit={submit} className="space-y-4">
        <p className="text-xs text-fg font-semibold truncate" title={question.title}>
          {question.title}
        </p>
        <div className="space-y-1.5">
          <label htmlFor="deadline-date" className={labelClass}>
            Due
          </label>
          <input
            id="deadline-date"
            type="datetime-local"
            value={dueDate}
            min={toLocalInput(new Date())}
            onChange={(e) => setDueDate(e.target.value)}
            className={inputClass}
          />
          <div className="flex flex-wrap gap-1.5">
            {PRESETS.map((p) => (
              <button
                key={p.label}
                type="button"
                onClick={() => applyPreset(p.days)}
                className="rounded-lg border border-line bg-inset px-2 py-1 text-[11px] text-muted hover:text-fg hover:border-line-strong"
              >
                {p.label}
              </button>
            ))}
          </div>
        </div>
        <div className="space-y-1.5">
          <label htmlFor="deadline-points" className={labelClass}>
            Max points <span className="text-subtle font-normal">(optional)</span>
          </label>
          <input
            id="deadline-points"
            type="number"
            min="0"
            value={maxPoints}
            onChange={(e) => setMaxPoints(e.target.value)}
            className={`${inputClass} w-32`}
          />
          <p className={type.meta}>Defaults to the question's own points.</p>
        </div>
        {error && <p className="rounded-xl border border-bad-line bg-bad-soft px-3 py-2 text-xs font-semibold text-bad">{error}</p>}
      </form>
    </Modal>
  );
}
