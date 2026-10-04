import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useLocation, useNavigate, useParams } from 'react-router-dom';
import {
  Archive,
  ArchiveRestore,
  ArrowLeft,
  Award,
  BarChart3,
  ClipboardList,
  Copy,
  Eye,
  EyeOff,
  Lock,
  Pencil,
  Plus,
  RefreshCw,
  Save,
  Send,
  Trash2,
  Unlock,
} from 'lucide-react';
import {
  deleteExam,
  duplicateExam,
  listClassExams,
  listStaffExams,
  releaseExamScores,
  setExamStatus,
} from '../../../common/services/api';
import { Button, EmptyState, Pagination, Table } from '../../../common/ui/primitives';
import ActionMenu from '../../../common/ui/ActionMenu';
import Modal from '../../../common/ui/Modal';
import { labelClass, table as tableClass, type } from '../../../common/ui/format';
import { confirmAction, notify } from '../../../common/ui/Toast';
import ClassPicker from '../components/ClassPicker';
import { RateBar, SearchBox, Segmented } from '../components/classDetails/shared';
import { HIDE_MD, HIDE_SM, errorText, formatDate, paginate, plural, selectClass, useUrlState } from '../components/classDetails/helpers';

const PAGE_SIZE = 12;
const POLL_MS = 30000;

const PHASES = {
  live: { label: 'Live', dot: 'bg-ok animate-pulse', text: 'text-ok' },
  scheduled: { label: 'Scheduled', dot: 'bg-info', text: 'text-info' },
  draft: { label: 'Draft', dot: 'bg-warn', text: 'text-warn' },
  completed: { label: 'Closed', dot: 'bg-subtle', text: 'text-muted' },
  archived: { label: 'Archived', dot: 'bg-subtle', text: 'text-subtle' },
};
const FILTERS = ['all', 'live', 'scheduled', 'draft', 'completed', 'archived'];
const DEFAULTS = { q: '', phase: 'all', class: '', page: '1' };

function PhaseLabel({ phase }) {
  const p = PHASES[phase] || PHASES.draft;
  return (
    <span className={`flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-wider ${p.text}`}>
      <span className={`w-1.5 h-1.5 rounded-full ${p.dot}`} />
      {p.label}
    </span>
  );
}

function SkeletonRows({ columns }) {
  return Array.from({ length: 6 }, (_, i) => (
    <tr key={i}>
      {columns.map((c, j) => (
        <td key={j} className={`${tableClass.td} ${c.className || ''}`}>
          <div className="h-3 rounded bg-hover animate-pulse" style={{ width: j === 0 ? '70%' : '50%' }} />
        </td>
      ))}
    </tr>
  ));
}

function NewExamModal({ open, onClose, onPick, onTemplates }) {
  const [cls, setCls] = useState(null);
  return (
    <Modal
      open={open}
      onClose={onClose}
      title="New exam"
      icon={Plus}
      width="max-w-md"
      footer={
        <>
          <Button variant="secondary" icon={Award} onClick={onTemplates} className="mr-auto">
            From a template
          </Button>
          <Button variant="secondary" onClick={onClose}>
            Cancel
          </Button>
          <Button onClick={() => cls && onPick(cls._id)} disabled={!cls}>
            Continue
          </Button>
        </>
      }
    >
      <div className="space-y-1.5">
        <label htmlFor="new-exam-class" className={labelClass}>
          Class
        </label>
        <ClassPicker id="new-exam-class" value={cls} onChange={setCls} autoFocus />
        <p className={type.meta}>The exam is only visible to students enrolled in this class.</p>
      </div>
    </Modal>
  );
}

export default function ExamManagement() {
  const { classId } = useParams();
  const navigate = useNavigate();
  const { pathname } = useLocation();
  const base = pathname.startsWith('/teacher') ? '/teacher' : '/admin';
  const scoped = Boolean(classId);

  const [exams, setExams] = useState([]);
  const [className, setClassName] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [busyId, setBusyId] = useState(null);
  const [newOpen, setNewOpen] = useState(false);
  const [get, update] = useUrlState(DEFAULTS);

  const query = get('q');
  const phase = FILTERS.includes(get('phase')) ? get('phase') : 'all';
  const classFilter = scoped ? '' : get('class');
  const page = Number(get('page')) || 1;

  const load = useCallback(
    async ({ quiet = false } = {}) => {
      if (!quiet) setLoading(true);
      try {
        const { data } = scoped ? await listClassExams(classId) : await listStaffExams();
        setExams(data.exams || []);
        if (scoped) setClassName(data.className || '');
        setError('');
      } catch (err) {
        if (!quiet) setError(errorText(err, 'Failed to fetch exams'));
      } finally {
        if (!quiet) setLoading(false);
      }
    },
    [classId, scoped],
  );

  useEffect(() => {
    load();
  }, [load]);

  const hasLive = exams.some((e) => e.phase === 'live');
  useEffect(() => {
    if (!hasLive) return undefined;
    const id = setInterval(() => document.visibilityState === 'visible' && load({ quiet: true }), POLL_MS);
    return () => clearInterval(id);
  }, [hasLive, load]);

  const classOptions = useMemo(() => {
    const map = new Map();
    exams.forEach((e) => map.set(String(e.classId), e.className || 'Unknown class'));
    return [...map.entries()].sort((a, b) => a[1].localeCompare(b[1]));
  }, [exams]);

  const inClass = useMemo(() => (classFilter ? exams.filter((e) => String(e.classId) === classFilter) : exams), [exams, classFilter]);

  const counts = useMemo(() => {
    const c = { all: inClass.length };
    inClass.forEach((e) => {
      c[e.phase] = (c[e.phase] || 0) + 1;
    });
    return c;
  }, [inClass]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    const order = { live: 0, scheduled: 1, draft: 2, completed: 3, archived: 4 };
    return inClass
      .filter((e) => (phase === 'all' ? e.phase !== 'archived' : e.phase === phase))
      .filter((e) => !q || [e.title, e.description, e.className].filter(Boolean).some((t) => t.toLowerCase().includes(q)))
      .sort((a, b) => (order[a.phase] ?? 9) - (order[b.phase] ?? 9) || new Date(b.createdAt) - new Date(a.createdAt));
  }, [inClass, phase, query]);

  const { current, rows } = paginate(filtered, page, PAGE_SIZE);
  const hasFilters = Boolean(query) || phase !== 'all' || Boolean(classFilter);

  // ---- actions --------------------------------------------------------------
  const examPath = (e, suffix) => `${base}/classes/${e.classId}/exams/${e._id}/${suffix}`;
  const openRow = (e) => navigate(examPath(e, e.phase === 'draft' ? 'edit' : 'report'));

  const run = async (e, task, success) => {
    setBusyId(e._id);
    try {
      const result = await task();
      if (success) notify(typeof success === 'function' ? success(result) : success, 'success');
      await load({ quiet: true });
      return result;
    } catch (err) {
      notify(errorText(err, 'Something went wrong'), 'error');
      return null;
    } finally {
      setBusyId(null);
    }
  };

  const publish = async (e) => {
    const opens = e.proctoring?.startTime ? `on ${formatDate(e.proctoring.startTime, true)}` : 'right away';
    if (!(await confirmAction(`Students in ${e.className || 'the class'} can take "${e.title}" ${opens}.`, { title: 'Publish exam?', confirmLabel: 'Publish' }))) return;
    run(e, () => setExamStatus(e._id, 'scheduled'), 'Exam published');
  };

  const close = async (e) => {
    const open = e.stats?.inProgress || 0;
    const note = open ? ` ${plural(open, 'student is', 'students are')} still writing; their answers will be submitted as they are.` : '';
    if (!(await confirmAction(`Students will no longer be able to start "${e.title}".${note}`, { title: 'Close exam now?', confirmLabel: 'Close exam', danger: open > 0 }))) return;
    run(e, () => setExamStatus(e._id, 'completed'), (r) => (r.data.closedAttempts ? `Exam closed, ${plural(r.data.closedAttempts, 'attempt')} submitted` : 'Exam closed'));
  };

  const setStatus = (e, status, message) => run(e, () => setExamStatus(e._id, status), message);

  const toggleRelease = (e) =>
    run(e, () => releaseExamScores(e._id, !e.released), e.released ? 'Scores hidden from students' : 'Scores released to students');

  const duplicate = async (e) => {
    const result = await run(e, () => duplicateExam(e._id), 'Copy created as a draft');
    const copy = result?.data?.exam;
    if (copy) navigate(`${base}/classes/${copy.classId}/exams/${copy._id}/edit`);
  };

  const saveAsTemplate = (e) => run(e, () => duplicateExam(e._id, { asTemplate: true, title: e.title }), `"${e.title}" saved as a template`);

  const remove = async (e) => {
    const started = e.stats?.started || 0;
    const note = started ? ` This also deletes ${plural(started, 'student attempt')} and their answers.` : '';
    if (!(await confirmAction(`Delete "${e.title}"?${note} This cannot be undone.`, { title: 'Delete exam', confirmLabel: 'Delete exam', danger: true }))) return;
    setBusyId(e._id);
    try {
      await deleteExam(e._id);
      setExams((prev) => prev.filter((x) => x._id !== e._id));
      notify('Exam deleted', 'success');
    } catch (err) {
      notify(errorText(err, 'Failed to delete exam'), 'error');
    } finally {
      setBusyId(null);
    }
  };

  const rowActions = (e) => {
    const items = [
      { label: e.phase === 'live' ? 'Monitor' : 'View report', icon: BarChart3, onClick: () => navigate(examPath(e, 'report')) },
      { label: e.stats?.started ? 'Edit settings' : 'Edit exam', icon: Pencil, onClick: () => navigate(examPath(e, 'edit')) },
      { divider: true },
    ];
    if (e.phase === 'draft') items.push({ label: 'Publish', icon: Send, onClick: () => publish(e) });
    if (e.phase === 'live' || e.phase === 'scheduled') items.push({ label: 'Close now', icon: Lock, onClick: () => close(e) });
    if (e.phase === 'completed') items.push({ label: 'Reopen', icon: Unlock, onClick: () => setStatus(e, 'scheduled', 'Exam reopened') });
    if (e.phase === 'scheduled' && !e.stats?.started) items.push({ label: 'Move back to draft', icon: EyeOff, onClick: () => setStatus(e, 'draft', 'Exam moved to drafts') });
    if (e.phase !== 'archived' && e.phase !== 'live') items.push({ label: 'Archive', icon: Archive, onClick: () => setStatus(e, 'archived', 'Exam archived') });
    if (e.phase === 'archived') items.push({ label: 'Restore', icon: ArchiveRestore, onClick: () => setStatus(e, 'completed', 'Exam restored') });
    if (e.stats?.submitted && !e.scoring?.immediateScoreRelease) {
      items.push({ label: e.released ? 'Hide scores' : 'Release scores', icon: e.released ? EyeOff : Eye, onClick: () => toggleRelease(e) });
    }
    items.push(
      { divider: true },
      { label: 'Duplicate', icon: Copy, onClick: () => duplicate(e) },
      { label: 'Save as template', icon: Save, onClick: () => saveAsTemplate(e) },
      { divider: true },
      { label: 'Delete', icon: Trash2, tone: 'danger', onClick: () => remove(e) },
    );
    return items;
  };

  const startNew = () => (scoped ? navigate(`${base}/classes/${classId}/exams/create`) : setNewOpen(true));

  const columns = [
    { label: 'Exam' },
    { label: 'Status' },
    { label: 'Window', className: HIDE_SM },
    { label: 'Submitted', className: 'text-right' },
    { label: 'Avg. score', className: HIDE_SM },
    { label: 'Scores', className: HIDE_MD },
    { key: 'actions', label: '' },
  ];

  return (
    <div className="h-full flex flex-col px-4 sm:px-5 py-5">
      <section className="flex-1 min-h-0 flex flex-col gap-3">
        <header className="shrink-0 flex flex-wrap items-center gap-2">
          {scoped && (
            <Button
              variant="ghost"
              icon={ArrowLeft}
              className="h-9 w-9 justify-center p-0!"
              onClick={() => navigate(`${base}/classes/${classId}`)}
              aria-label="Back to class"
              title="Back to class"
            />
          )}
          <h1 className={`${type.pageTitle} mr-1 truncate max-w-full`}>
            {scoped ? (className ? `${className} exams` : 'Class exams') : 'Exams'}
          </h1>
          <SearchBox value={query} onChange={(v) => update({ q: v })} placeholder={scoped ? 'Search exams' : 'Search exams or classes'} label="Search exams" />
          <Segmented
            label="Filter by status"
            value={phase}
            onChange={(v) => update({ phase: v })}
            options={FILTERS.map((id) => ({
              id,
              label: id === 'all' ? 'All' : PHASES[id].label,
              count: id === 'all' ? (counts.all || 0) - (counts.archived || 0) : counts[id] || 0,
            }))}
          />
          {!scoped && classOptions.length > 1 && (
            <select value={classFilter} onChange={(e) => update({ class: e.target.value })} className={`max-w-48 ${selectClass}`} aria-label="Filter by class">
              <option value="">All classes</option>
              {classOptions.map(([id, name]) => (
                <option key={id} value={id}>
                  {name}
                </option>
              ))}
            </select>
          )}
          <div className="ml-auto flex items-center gap-2">
            <Button
              variant="secondary"
              icon={RefreshCw}
              onClick={() => load()}
              disabled={loading}
              aria-label="Refresh"
              title="Refresh"
              className={`h-9 w-9 justify-center p-0! ${loading ? '[&>svg]:animate-spin' : ''}`}
            />
            <Button variant="secondary" icon={Award} className="h-9" onClick={() => navigate(`${base}/exams/templates`)}>
              Templates
            </Button>
            <Button icon={Plus} className="h-9" onClick={startNew}>
              New exam
            </Button>
          </div>
        </header>

        {error ? (
          <EmptyState icon={ClipboardList} title="Couldn't load exams" message={error} action={<Button variant="secondary" onClick={() => load()}>Try again</Button>} />
        ) : !loading && filtered.length === 0 ? (
          <EmptyState
            icon={ClipboardList}
            title={hasFilters ? 'No exams match your filters' : 'No exams yet'}
            message={
              hasFilters
                ? 'Try a different search or status.'
                : 'Create a proctored exam from your question bank, or start from a saved template.'
            }
            action={
              hasFilters ? (
                <Button variant="secondary" onClick={() => update({ q: '', phase: 'all', class: '' })}>
                  Clear filters
                </Button>
              ) : (
                <div className="flex gap-2 justify-center">
                  <Button variant="secondary" icon={Award} onClick={() => navigate(`${base}/exams/templates`)}>
                    From a template
                  </Button>
                  <Button icon={Plus} onClick={startNew}>
                    New exam
                  </Button>
                </div>
              )
            }
          />
        ) : (
          <>
            <Table columns={columns} fill>
              {loading && exams.length === 0 ? (
                <SkeletonRows columns={columns} />
              ) : (
                rows.map((e) => {
                  const s = e.stats || {};
                  const start = e.proctoring?.startTime;
                  const end = e.proctoring?.endTime;
                  return (
                    <tr
                      key={e._id}
                      onClick={() => openRow(e)}
                      className={`${tableClass.row} cursor-pointer ${busyId === e._id ? 'opacity-50 pointer-events-none' : ''}`}
                    >
                      <td className={`${tableClass.td} max-w-xs`}>
                        <p className="text-sm font-semibold text-fg truncate">{e.title}</p>
                        <p className={`${type.meta} truncate`}>
                          {!scoped && e.className ? `${e.className} · ` : ''}
                          {plural(e.questionCount || 0, 'question')} · {e.totalPoints || 0} pts · {e.proctoring?.durationMinutes || 0} min
                        </p>
                      </td>
                      <td className={`${tableClass.td} whitespace-nowrap`}>
                        <PhaseLabel phase={e.phase} />
                        {e.phase === 'live' && s.inProgress > 0 && <p className={`${type.meta} mt-0.5`}>{s.inProgress} writing now</p>}
                      </td>
                      <td className={`${tableClass.td} whitespace-nowrap ${HIDE_SM}`}>
                        {start || end ? (
                          <>
                            <p className="text-body">{start ? formatDate(start, true) : 'When published'}</p>
                            <p className={type.meta}>{end ? `until ${formatDate(end, true)}` : 'no end time'}</p>
                          </>
                        ) : (
                          <span className="text-subtle">{e.phase === 'draft' ? 'Not scheduled' : 'Open until closed'}</span>
                        )}
                      </td>
                      <td className={`${tableClass.td} text-right whitespace-nowrap`}>
                        <p className="tabular-nums">
                          <span className="text-fg font-semibold">{s.submitted || 0}</span>
                          <span className="text-subtle">/{e.studentCount || 0}</span>
                        </p>
                        {s.inProgress > 0 && e.phase !== 'live' && <p className={type.meta}>{s.inProgress} in progress</p>}
                      </td>
                      <td className={`${tableClass.td} ${HIDE_SM}`}>
                        <RateBar value={s.avgPercent} />
                      </td>
                      <td className={`${tableClass.td} whitespace-nowrap ${HIDE_MD}`}>
                        {!s.submitted ? (
                          <span className="text-subtle">—</span>
                        ) : e.scoring?.immediateScoreRelease ? (
                          <span className="text-[11px] font-semibold text-ok">On submit</span>
                        ) : (
                          <span className={`text-[11px] font-semibold ${e.released ? 'text-ok' : 'text-warn'}`}>{e.released ? 'Released' : 'Not released'}</span>
                        )}
                      </td>
                      <td className={`${tableClass.td} whitespace-nowrap`}>
                        <div className="flex items-center justify-end gap-1">
                          <Button
                            variant="soft"
                            icon={e.phase === 'draft' ? Pencil : BarChart3}
                            className="hidden sm:flex"
                            onClick={(ev) => {
                              ev.stopPropagation();
                              openRow(e);
                            }}
                          >
                            {e.phase === 'draft' ? 'Edit' : e.phase === 'live' ? 'Monitor' : 'Report'}
                          </Button>
                          <ActionMenu label={`Actions for ${e.title}`} items={rowActions(e)} />
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </Table>
            <Pagination page={current} pageSize={PAGE_SIZE} total={filtered.length} onChange={(p) => update({ page: p }, { resetPage: false })} />
          </>
        )}
      </section>

      {newOpen && (
        <NewExamModal
          open
          onClose={() => setNewOpen(false)}
          onPick={(id) => navigate(`${base}/classes/${id}/exams/create`)}
          onTemplates={() => navigate(`${base}/exams/templates`)}
        />
      )}
    </div>
  );
}
