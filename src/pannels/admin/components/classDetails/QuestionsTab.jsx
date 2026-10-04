import React, { useMemo, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { BarChart3, BookOpen, BookPlus, CalendarClock, CalendarX, Copy, Eye, Lock, Pencil, Play, Trash2, Unlock } from 'lucide-react';
import {
  deleteAssignment,
  disableQuestion,
  enableQuestion,
  publishQuestion,
  removeQuestionFromClass,
  unpublishQuestion,
} from '../../../../common/services/api';
import { Button, EmptyState, Pagination, Switch, Table } from '../../../../common/ui/primitives';
import ActionMenu from '../../../../common/ui/ActionMenu';
import { table as tableClass, type } from '../../../../common/ui/format';
import { confirmAction, notify } from '../../../../common/ui/Toast';
import AttachQuestionsModal from './AttachQuestionsModal';
import DeadlineModal from './DeadlineModal';
import { RateBar, SearchBox, Segmented } from './shared';
import { HIDE_MD, HIDE_SM, QUESTION_TYPES, errorText, formatDate, paginate, plural, selectClass, useStaffBase, useUrlState } from './helpers';

const PAGE_SIZE = 15;

const FILTERS = [
  { id: 'all', label: 'All', test: () => true },
  { id: 'published', label: 'Published', test: (q) => q.isPublished },
  { id: 'hidden', label: 'Hidden', test: (q) => !q.isPublished },
  { id: 'locked', label: 'Locked', test: (q) => q.isDisabled },
  { id: 'deadline', label: 'With deadline', test: (q) => Boolean(q.assignment?.dueDate) },
];

const SORTS = {
  title: { label: 'Title A–Z', compare: (a, b) => a.title.localeCompare(b.title) },
  solve: { label: 'Lowest solve rate', compare: (a, b) => (a.solveRate ?? 101) - (b.solveRate ?? 101) },
  attempts: { label: 'Most attempted', compare: (a, b) => b.attempted - a.attempted },
  due: {
    label: 'Due soonest',
    compare: (a, b) => new Date(a.assignment?.dueDate || 8.64e15) - new Date(b.assignment?.dueDate || 8.64e15),
  },
};

const DEFAULTS = { q: '', filter: 'all', type: '', sort: 'title', page: 1 };

const DIFFICULTY_TONE = { easy: 'text-ok', medium: 'text-warn', hard: 'text-bad' };

function Deadline({ assignment }) {
  if (!assignment?.dueDate) return <span className="text-subtle">—</span>;
  const due = new Date(assignment.dueDate);
  const overdue = due < new Date();
  return (
    <span className="whitespace-nowrap">
      <span className={`block ${overdue ? 'text-muted line-through' : 'text-body'}`}>{formatDate(due, true)}</span>
      <span className={`block ${type.meta}`}>
        {overdue ? 'Closed' : 'Open'}
        {assignment.maxPoints != null && ` · ${assignment.maxPoints} pts`}
      </span>
    </span>
  );
}

export default function QuestionsTab({ classId, data, reload }) {
  const navigate = useNavigate();
  const { base, isTeacher } = useStaffBase();
  const [get, update] = useUrlState(DEFAULTS);
  const [busyIds, setBusyIds] = useState(() => new Set());
  const [attachOpen, setAttachOpen] = useState(false);
  const [deadlineFor, setDeadlineFor] = useState(null);

  const query = get('q');
  const filter = FILTERS.find((f) => f.id === get('filter')) || FILTERS[0];
  const typeFilter = get('type');
  const sort = SORTS[get('sort')] ? get('sort') : 'title';
  const enrolled = data.counts.students;

  const counts = useMemo(
    () => Object.fromEntries(FILTERS.map((f) => [f.id, data.questions.filter(f.test).length])),
    [data.questions],
  );
  const typesPresent = useMemo(() => [...new Set(data.questions.map((q) => q.type))], [data.questions]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return data.questions
      .filter(filter.test)
      .filter((x) => !typeFilter || x.type === typeFilter)
      .filter((x) => !q || x.title.toLowerCase().includes(q) || x.tags.some((t) => t.toLowerCase().includes(q)) || String(x._id) === q)
      .sort(SORTS[sort].compare);
  }, [data.questions, filter, typeFilter, query, sort]);

  const { current, rows } = paginate(filtered, Number(get('page')) || 1, PAGE_SIZE);

  const run = async (id, action, success, fallback) => {
    setBusyIds((prev) => new Set(prev).add(id));
    try {
      await action();
      notify(success, 'success');
      await reload();
    } catch (err) {
      notify(errorText(err, fallback), 'error');
    } finally {
      setBusyIds((prev) => {
        const next = new Set(prev);
        next.delete(id);
        return next;
      });
    }
  };

  const setPublished = (q, on) =>
    run(
      q._id,
      () => (on ? publishQuestion(q._id, classId) : unpublishQuestion(q._id, classId)),
      on ? `"${q.title}" is visible to students` : `"${q.title}" is hidden from students`,
      'Failed to change visibility',
    );

  const setLocked = (q, on) =>
    run(
      q._id,
      () => (on ? disableQuestion(q._id, classId) : enableQuestion(q._id, classId)),
      on ? 'Submissions locked' : 'Submissions unlocked',
      'Failed to update question',
    );

  const clearDeadline = async (q) => {
    const ok = await confirmAction(`Remove the deadline for "${q.title}"? Students can still practise it.`, {
      title: 'Clear deadline',
      confirmLabel: 'Clear deadline',
    });
    if (ok) run(q._id, () => deleteAssignment(classId, q.assignment._id), 'Deadline cleared', 'Failed to clear deadline');
  };

  const remove = async (q) => {
    const ok = await confirmAction(
      `Remove "${q.title}" from this class? Students will no longer see it${q.assignment ? ' and its deadline is cleared' : ''}. ` +
        `Past submissions are kept and the question stays in the bank.`,
      { title: 'Remove question', confirmLabel: 'Remove', danger: true },
    );
    if (ok) run(q._id, () => removeQuestionFromClass(classId, q._id), `"${q.title}" removed from the class`, 'Failed to remove question');
  };

  const copyId = async (q) => {
    try {
      await navigator.clipboard.writeText(String(q._id));
      notify('Question ID copied', 'success');
    } catch {
      notify('Could not copy to clipboard', 'error');
    }
  };

  const previewLink = (q) => ({
    pathname: `${base}/questions/${q._id}/preview`,
    state: { classId, returnTo: `${base}/classes/${classId}?tab=questions` },
  });

  const columns = [
    { label: 'Question' },
    { label: 'Type', className: HIDE_MD },
    { label: 'Points', className: `text-right ${HIDE_MD}` },
    { label: 'Visible' },
    { label: 'Deadline', className: HIDE_SM },
    { label: 'Solved', className: 'text-right' },
    { label: 'Solve rate', className: HIDE_SM },
    { key: 'actions', label: '' },
  ];

  const attachButton = (
    <Button icon={BookPlus} className="h-9" onClick={() => setAttachOpen(true)}>
      Attach questions
    </Button>
  );

  return (
    <>
      {data.questions.length === 0 ? (
        <EmptyState
          icon={BookOpen}
          title="No questions in this class"
          message="Attach questions from the bank so students can start practising."
          action={attachButton}
        />
      ) : (
        <>
          <div className="shrink-0 flex flex-wrap items-center gap-2">
            <SearchBox value={query} onChange={(v) => update({ q: v })} placeholder="Search title or tag" label="Search questions" />
            <Segmented
              label="Filter questions"
              value={filter.id}
              onChange={(v) => update({ filter: v })}
              options={FILTERS.map((f) => ({ id: f.id, label: f.label, count: counts[f.id] }))}
            />
            <select value={typeFilter} onChange={(e) => update({ type: e.target.value })} className={`ml-auto ${selectClass}`} aria-label="Filter by type">
              <option value="">All types</option>
              {typesPresent.map((t) => (
                <option key={t} value={t}>
                  {QUESTION_TYPES[t] || t}
                </option>
              ))}
            </select>
            <select value={sort} onChange={(e) => update({ sort: e.target.value })} className={selectClass} aria-label="Sort questions">
              {Object.entries(SORTS).map(([id, s]) => (
                <option key={id} value={id}>
                  {s.label}
                </option>
              ))}
            </select>
            {attachButton}
          </div>

          {filtered.length === 0 ? (
            <EmptyState
              icon={BookOpen}
              title="No questions match"
              message="Try a different search, filter or type."
              action={<Button variant="secondary" onClick={() => update({ q: '', filter: 'all', type: '' })}>Clear filters</Button>}
            />
          ) : (
            <>
              <Table columns={columns} fill>
                {rows.map((q) => {
                  const busy = busyIds.has(q._id);
                  return (
                    <tr key={q._id} className={`${tableClass.row} ${busy ? 'opacity-50 pointer-events-none' : ''}`}>
                      <td className={`${tableClass.td} max-w-sm`}>
                        <Link to={previewLink(q)} className="text-sm font-semibold text-fg truncate block hover:underline" title={q.title}>
                          {q.title}
                        </Link>
                        <p className={`${type.meta} truncate`}>
                          {q.difficulty && <span className={`capitalize ${DIFFICULTY_TONE[q.difficulty] || ''}`}>{q.difficulty}</span>}
                          {q.difficulty && q.tags.length > 0 && ' · '}
                          {q.tags.slice(0, 3).join(', ')}
                          {q.isDisabled && <span className="text-warn"> · submissions locked</span>}
                        </p>
                      </td>
                      <td className={`${tableClass.td} whitespace-nowrap ${HIDE_MD}`}>{QUESTION_TYPES[q.type] || q.type}</td>
                      <td className={`${tableClass.td} text-right tabular-nums ${HIDE_MD}`}>{q.points ?? '—'}</td>
                      <td className={tableClass.td}>
                        <div className="flex items-center gap-2">
                          <Switch checked={q.isPublished} disabled={busy} onChange={(on) => setPublished(q, on)} label={`${q.title} visible to students`} />
                          <span className={`text-[11px] font-semibold ${q.isPublished ? 'text-ok' : 'text-muted'}`}>{q.isPublished ? 'Published' : 'Hidden'}</span>
                        </div>
                      </td>
                      <td className={`${tableClass.td} ${HIDE_SM}`}>
                        <Deadline assignment={q.assignment} />
                      </td>
                      <td className={`${tableClass.td} text-right tabular-nums whitespace-nowrap`}>
                        <span className="text-fg font-semibold">{q.solved}</span>
                        <span className="text-subtle">/{enrolled}</span>
                        {q.attempted > 0 && <p className={type.meta}>{q.attempted} tried</p>}
                      </td>
                      <td className={`${tableClass.td} ${HIDE_SM}`}>
                        <RateBar value={q.solveRate} />
                      </td>
                      <td className={`${tableClass.td} whitespace-nowrap`}>
                        <div className="flex items-center justify-end gap-1">
                          <Link
                            to={previewLink(q)}
                            className="hidden sm:flex p-1.5 rounded-lg text-muted hover:text-fg hover:bg-hover"
                            aria-label={`Preview ${q.title}`}
                            title="Preview & test"
                          >
                            <Eye className="w-4 h-4" />
                          </Link>
                          <ActionMenu
                            label={`Actions for ${q.title}`}
                            items={[
                              {
                                label: q.assignment ? 'Change deadline' : 'Set deadline',
                                icon: CalendarClock,
                                onClick: () => setDeadlineFor(q),
                              },
                              ...(q.assignment ? [{ label: 'Clear deadline', icon: CalendarX, onClick: () => clearDeadline(q) }] : []),
                              ...(isTeacher
                                ? [
                                    {
                                      label: 'Live statistics',
                                      icon: BarChart3,
                                      onClick: () =>
                                        navigate(`/teacher/take-class/${classId}/questions/${q._id}/statistics`, {
                                          state: { fromTakeClass: false },
                                        }),
                                    },
                                    {
                                      label: 'Present in class',
                                      icon: Play,
                                      onClick: () =>
                                        navigate('/teacher/take-class', { state: { classId, questionId: q._id } }),
                                    },
                                  ]
                                : []),
                              q.isDisabled
                                ? { label: 'Unlock submissions', icon: Unlock, onClick: () => setLocked(q, false) }
                                : { label: 'Lock submissions', icon: Lock, onClick: () => setLocked(q, true) },
                              { label: 'Edit question', icon: Pencil, onClick: () => navigate(`${base}/questions/${q._id}/edit`) },
                              { label: 'Copy ID', icon: Copy, onClick: () => copyId(q) },
                              { divider: true },
                              { label: 'Remove from class', icon: Trash2, tone: 'danger', onClick: () => remove(q) },
                            ]}
                          />
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </Table>
              <Pagination page={current} pageSize={PAGE_SIZE} total={filtered.length} onChange={(p) => update({ page: p }, { resetPage: false })} />
            </>
          )}
        </>
      )}

      <AttachQuestionsModal
        open={attachOpen}
        classId={classId}
        existingIds={data.questions.map((q) => q._id)}
        onClose={() => setAttachOpen(false)}
        onAttached={async (message) => {
          setAttachOpen(false);
          notify(message, 'success');
          await reload();
        }}
      />
      <DeadlineModal
        classId={classId}
        question={deadlineFor}
        onClose={() => setDeadlineFor(null)}
        onSaved={async (message) => {
          setDeadlineFor(null);
          notify(message, 'success');
          await reload();
        }}
      />
      {filtered.length > 0 && data.questions.length > 0 && (
        <p className={`shrink-0 ${type.meta}`}>
          {plural(data.counts.publishedQuestions, 'question')} visible to students. Solved counts are out of {plural(enrolled, 'enrolled student')}.
        </p>
      )}
    </>
  );
}
