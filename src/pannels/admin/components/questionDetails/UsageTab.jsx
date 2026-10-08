import React, { useMemo, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { BarChart3, CalendarClock, CalendarX, ClipboardList, ExternalLink, Lock, Pencil, Plus, School, Trash2, Unlock } from 'lucide-react';
import {
  deleteAssignment,
  disableQuestion,
  enableQuestion,
  publishQuestion,
  removeQuestionFromClass,
  unpublishQuestion,
} from '../../../../common/services/api';
import { Button, EmptyState, Switch, Table } from '../../../../common/ui/primitives';
import ActionMenu from '../../../../common/ui/ActionMenu';
import { table as tableClass, type } from '../../../../common/ui/format';
import { confirmAction, notify } from '../../../../common/ui/Toast';
import DeadlineModal from '../classDetails/DeadlineModal';
import { RateBar } from '../classDetails/shared';
import { HIDE_MD, HIDE_SM, errorText, formatDate, plural } from '../classDetails/helpers';
import AddToClassModal from './AddToClassModal';
import { stripHtml } from './helpers';
import { EXAM_PHASES as PHASES } from '../../../../common/domain/exams';

const CLASS_COLUMNS = [
  { label: 'Class' },
  { label: 'Visible' },
  { label: 'Deadline', className: HIDE_SM },
  { label: 'Solved', className: 'text-right' },
  { label: 'Solve rate', className: HIDE_MD },
  { key: 'actions', label: '' },
];

const EXAM_COLUMNS = [
  { label: 'Exam' },
  { label: 'Status' },
  { label: 'Class', className: HIDE_SM },
  { label: 'Schedule', className: HIDE_MD },
  { label: 'Points', className: 'text-right' },
  { key: 'actions', label: '' },
];

function Deadline({ assignment }) {
  if (!assignment?.dueDate) return <span className="text-subtle">—</span>;
  const due = new Date(assignment.dueDate);
  const closed = due < new Date();
  return (
    <span className="whitespace-nowrap">
      <span className={`block ${closed ? 'text-muted line-through' : 'text-body'}`}>{formatDate(due, true)}</span>
      <span className={`block ${type.meta}`}>
        {closed ? 'Closed' : 'Open'}
        {assignment.maxPoints != null && ` · ${assignment.maxPoints} pts`}
      </span>
    </span>
  );
}

export default function UsageTab({ question, classes, exams, templateCount, reload, base = '/admin', canRemove = true }) {
  const navigate = useNavigate();
  const classHref = (id) => (base === '/admin' ? `/admin/classes/${id}?tab=questions` : `${base}/classes/${id}`);
  const [busy, setBusy] = useState(() => new Set());
  const [adding, setAdding] = useState(false);
  const [deadlineFor, setDeadlineFor] = useState(null);
  const qid = question._id;
  const deadlineQuestion = useMemo(
    () =>
      deadlineFor
        ? { _id: qid, title: stripHtml(question.title) || 'Question', points: question.points, assignment: deadlineFor.assignment }
        : null,
    [deadlineFor, qid, question.title, question.points],
  );

  const run = async (classId, action, success, fallback) => {
    setBusy((prev) => new Set(prev).add(classId));
    try {
      await action();
      notify(success, 'success');
      await reload();
    } catch (err) {
      notify(errorText(err, fallback), 'error');
    } finally {
      setBusy((prev) => {
        const next = new Set(prev);
        next.delete(classId);
        return next;
      });
    }
  };

  const setVisible = (c, on) =>
    run(
      c._id,
      () => (on ? publishQuestion(qid, c._id) : unpublishQuestion(qid, c._id)),
      on ? `Visible to students in ${c.name}` : `Hidden from students in ${c.name}`,
      'Failed to change visibility',
    );

  const setLocked = (c, on) =>
    run(
      c._id,
      () => (on ? disableQuestion(qid, c._id) : enableQuestion(qid, c._id)),
      on ? `Submissions locked in ${c.name}` : `Submissions unlocked in ${c.name}`,
      'Failed to update the question',
    );

  const clearDeadline = async (c) => {
    const ok = await confirmAction(`Remove the deadline in ${c.name}? Students can still practise the question.`, {
      title: 'Clear deadline',
      confirmLabel: 'Clear deadline',
    });
    if (ok) run(c._id, () => deleteAssignment(c._id, c.assignment._id), 'Deadline cleared', 'Failed to clear the deadline');
  };

  const removeFromClass = async (c) => {
    const ok = await confirmAction(
      `Remove this question from ${c.name}? Students will no longer see it${c.assignment ? ' and its deadline is cleared' : ''}. ` +
        'Past submissions are kept.',
      { title: 'Remove from class', confirmLabel: 'Remove', danger: true },
    );
    if (ok) run(c._id, () => removeQuestionFromClass(c._id, qid), `Removed from ${c.name}`, 'Failed to remove the question');
  };

  const addButton = !question.isExamOnly && (
    <Button icon={Plus} className="h-9" onClick={() => setAdding(true)}>
      Add to class
    </Button>
  );

  return (
    <div className="space-y-6">
      <section className="space-y-3">
        <div className="flex flex-wrap items-center gap-2">
          <h3 className={type.section}>Classes</h3>
          <span className={type.meta}>{plural(classes.length, 'class', 'classes')}</span>
          <div className="ml-auto">{classes.length > 0 && addButton}</div>
        </div>

        {question.isExamOnly && (
          <p className="rounded-xl border border-info-line bg-info-soft px-3 py-2 text-xs text-info">
            This is an exam-only question, so it can't be practised in classes.
          </p>
        )}

        {classes.length === 0 ? (
          !question.isExamOnly && (
            <EmptyState
              icon={School}
              title="Not in any class"
              message="Add it to a class so students can practise it."
              action={addButton}
            />
          )
        ) : (
          <Table columns={CLASS_COLUMNS}>
            {classes.map((c) => {
              const isBusy = busy.has(c._id);
              return (
                <tr key={c._id} className={`${tableClass.row} ${isBusy ? 'opacity-60' : ''}`}>
                  <td className={tableClass.td}>
                    <Link to={classHref(c._id)} className="block group min-w-0">
                      <span className="block text-xs font-semibold text-fg group-hover:text-accent-ink truncate max-w-[16rem]">{c.name}</span>
                      <span className={`block ${type.meta}`}>
                        {plural(c.studentCount, 'student')}
                        {c.status !== 'active' && <span className="text-warn"> · inactive</span>}
                        {c.isDisabled && <span className="text-bad"> · locked</span>}
                      </span>
                    </Link>
                  </td>
                  <td className={tableClass.td}>
                    <Switch
                      checked={c.isPublished}
                      disabled={isBusy}
                      onChange={(on) => setVisible(c, on)}
                      label={`${c.isPublished ? 'Hide from' : 'Show to'} students in ${c.name}`}
                    />
                  </td>
                  <td className={`${tableClass.td} ${HIDE_SM}`}>
                    <Deadline assignment={c.assignment} />
                  </td>
                  <td className={`${tableClass.td} text-right tabular-nums whitespace-nowrap`}>
                    <span className="text-fg font-semibold">{c.solved}</span>
                    <span className="text-muted">/{c.attempted}</span>
                    <span className={`block ${type.meta}`}>of {c.studentCount}</span>
                  </td>
                  <td className={`${tableClass.td} ${HIDE_MD}`}>
                    <RateBar value={c.solveRate} />
                  </td>
                  <td className={`${tableClass.td} text-right`}>
                    <ActionMenu
                      label={`Actions for ${c.name}`}
                      items={[
                        { label: 'Open class', icon: ExternalLink, onClick: () => navigate(classHref(c._id)) },
                        { divider: true },
                        {
                          label: c.assignment ? 'Change deadline' : 'Set deadline',
                          icon: CalendarClock,
                          onClick: () => setDeadlineFor(c),
                        },
                        ...(c.assignment ? [{ label: 'Clear deadline', icon: CalendarX, onClick: () => clearDeadline(c) }] : []),
                        {
                          label: c.isDisabled ? 'Unlock submissions' : 'Lock submissions',
                          icon: c.isDisabled ? Unlock : Lock,
                          onClick: () => setLocked(c, !c.isDisabled),
                        },
                        ...(canRemove
                          ? [{ divider: true }, { label: 'Remove from class', icon: Trash2, tone: 'danger', onClick: () => removeFromClass(c) }]
                          : []),
                      ]}
                    />
                  </td>
                </tr>
              );
            })}
          </Table>
        )}
      </section>

      <section className="space-y-3">
        <div className="flex flex-wrap items-center gap-2">
          <h3 className={type.section}>Exams</h3>
          <span className={type.meta}>
            {plural(exams.length, 'exam')}
            {templateCount > 0 && ` · also in ${plural(templateCount, 'template')}`}
          </span>
        </div>
        {exams.length === 0 ? (
          <p className={`${type.body} rounded-xl border border-dashed border-line px-3 py-4 text-center`}>Not used in any exam.</p>
        ) : (
          <Table columns={EXAM_COLUMNS}>
            {exams.map((e) => {
              const phase = PHASES[e.phase] || PHASES.draft;
              const examBase = e.classId ? `${base}/classes/${e.classId}/exams/${e._id}` : null;
              return (
                <tr key={e._id} className={tableClass.row}>
                  <td className={tableClass.td}>
                    <span className="block text-xs font-semibold text-fg truncate max-w-[16rem]">{e.title}</span>
                    <span className={`block ${type.meta}`}>{plural(e.questionCount, 'question')}</span>
                  </td>
                  <td className={tableClass.td}>
                    <span className={`inline-block px-2 py-0.5 rounded-full border text-[10px] font-semibold ${phase.chip}`}>{phase.label}</span>
                  </td>
                  <td className={`${tableClass.td} ${HIDE_SM}`}>{e.className || '—'}</td>
                  <td className={`${tableClass.td} ${HIDE_MD} whitespace-nowrap`}>{e.startTime ? formatDate(e.startTime, true) : 'Not scheduled'}</td>
                  <td className={`${tableClass.td} text-right tabular-nums`}>{e.points ?? '—'}</td>
                  <td className={`${tableClass.td} text-right`}>
                    {examBase && (
                      <ActionMenu
                        label={`Actions for ${e.title}`}
                        items={[
                          { label: 'View report', icon: BarChart3, onClick: () => navigate(`${examBase}/report`) },
                          {
                            label: 'Edit exam',
                            icon: Pencil,
                            onClick: () => navigate(`${examBase}/edit`),
                            disabled: e.phase === 'archived',
                          },
                          { label: 'All class exams', icon: ClipboardList, onClick: () => navigate(`${base}/classes/${e.classId}/exams`) },
                        ]}
                      />
                    )}
                  </td>
                </tr>
              );
            })}
          </Table>
        )}
      </section>

      <AddToClassModal
        open={adding}
        questionId={qid}
        existingIds={classes.map((c) => c._id)}
        onClose={() => setAdding(false)}
        onAdded={async (message) => {
          setAdding(false);
          notify(message, 'success');
          await reload();
        }}
      />
      <DeadlineModal
        classId={deadlineFor?._id}
        question={deadlineQuestion}
        onClose={() => setDeadlineFor(null)}
        onSaved={async (message) => {
          setDeadlineFor(null);
          notify(message, 'success');
          await reload();
        }}
      />
    </div>
  );
}
