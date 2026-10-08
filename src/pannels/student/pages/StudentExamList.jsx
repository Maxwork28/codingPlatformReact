import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useSelector } from 'react-redux';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { ClipboardList, Play, RefreshCw, RotateCcw, Search, Trophy, X } from 'lucide-react';
import { getClassExams } from '../../../common/services/api';
import { Button, EmptyState, StatusChip, Table } from '../../../common/ui/primitives';
import { table as tableClass, type } from '../../../common/ui/format';
import { ATTEMPT_LABELS, formatDateTime, formatMinutes, isClosedAttempt } from '../components/exam/examUtils';

const TABS = [
  { id: 'open', label: 'Open now' },
  { id: 'upcoming', label: 'Upcoming' },
  { id: 'done', label: 'Completed' },
  { id: 'all', label: 'All' },
];

const COLUMNS = [
  { label: 'Exam' },
  { label: 'When', className: 'hidden md:table-cell' },
  { label: 'Length', className: 'hidden sm:table-cell text-right' },
  { label: 'Status' },
  { label: '', key: 'action' },
];

const selectClass = 'h-9 bg-inset border border-line rounded-xl px-3 text-fg text-xs outline-none focus:border-accent cursor-pointer';

const bucketOf = (exam) => {
  if (isClosedAttempt(exam.attempt) || exam.phase === 'completed') return 'done';
  if (exam.phase === 'scheduled') return 'upcoming';
  return 'open';
};

const windowText = (p = {}) => {
  if (p.startTime && p.endTime) return `${formatDateTime(p.startTime)} – ${formatDateTime(p.endTime)}`;
  if (p.startTime) return `Opens ${formatDateTime(p.startTime)}`;
  if (p.endTime) return `Closes ${formatDateTime(p.endTime)}`;
  return 'Any time';
};

function StatusCell({ exam }) {
  const a = exam.attempt;
  if (a && isClosedAttempt(a)) {
    return (
      <div>
        <StatusChip kind={a.status === 'terminated' ? 'fail' : 'pass'}>{ATTEMPT_LABELS[a.status]}</StatusChip>
        <p className={`${type.meta} mt-1`}>
          {a.totalScore !== undefined ? `${a.totalScore}/${a.maxScore} pts` : 'Score not released'}
        </p>
      </div>
    );
  }
  if (a?.status === 'in_progress') return <StatusChip kind="warning">In progress</StatusChip>;
  if (exam.phase === 'scheduled') return <StatusChip kind="info">Upcoming</StatusChip>;
  if (exam.phase === 'live') return <StatusChip kind="pass">Open</StatusChip>;
  return <StatusChip kind="neutral">Missed</StatusChip>;
}

const StudentExamList = () => {
  const navigate = useNavigate();
  const [params, setParams] = useSearchParams();
  const { classes } = useSelector((state) => state.classes);
  const { user } = useSelector((state) => state.auth);
  const [exams, setExams] = useState([]);
  const [loading, setLoading] = useState(true);
  const [failed, setFailed] = useState(0);

  const query = params.get('q') || '';
  const classFilter = params.get('class') || '';
  const tabParam = params.get('tab');

  const enrolled = useMemo(() => {
    if (!user?.id) return [];
    // The API returns only the classes this student is enrolled in; the roster itself is no longer sent.
    return (classes || []).filter((cls) => !Array.isArray(cls.students) || cls.students.some((s) => String(s?._id ?? s) === String(user.id)));
  }, [classes, user?.id]);

  const load = useCallback(async () => {
    if (!enrolled.length) {
      setExams([]);
      setLoading(false);
      return;
    }
    setLoading(true);
    const results = await Promise.allSettled(enrolled.map((cls) => getClassExams(cls._id)));
    const rows = [];
    let failures = 0;
    results.forEach((r, i) => {
      if (r.status !== 'fulfilled') {
        failures += 1;
        return;
      }
      (r.value.data.exams || []).forEach((exam) => rows.push({ ...exam, className: exam.className || enrolled[i].name }));
    });
    setExams(rows);
    setFailed(failures);
    setLoading(false);
  }, [enrolled]);

  useEffect(() => {
    if (user?.id) load();
  }, [load, user?.id]);

  const updateParams = (changes) =>
    setParams(
      (prev) => {
        const next = new URLSearchParams(prev);
        Object.entries(changes).forEach(([key, value]) => (value ? next.set(key, value) : next.delete(key)));
        return next;
      },
      { replace: true },
    );

  const scoped = useMemo(() => {
    const q = query.trim().toLowerCase();
    return exams
      .filter((e) => !classFilter || String(e.classId) === classFilter)
      .filter((e) => !q || [e.title, e.className, e.description].filter(Boolean).some((t) => t.toLowerCase().includes(q)));
  }, [exams, classFilter, query]);

  const counts = useMemo(() => {
    const c = { open: 0, upcoming: 0, done: 0, all: scoped.length };
    scoped.forEach((e) => {
      c[bucketOf(e)] += 1;
    });
    return c;
  }, [scoped]);

  const tab = TABS.some((t) => t.id === tabParam) ? tabParam : counts.open ? 'open' : counts.upcoming ? 'upcoming' : 'all';

  const rows = useMemo(() => {
    const list = scoped.filter((e) => tab === 'all' || bucketOf(e) === tab);
    const time = (e) => new Date(e.proctoring?.startTime || e.proctoring?.endTime || e.createdAt).getTime();
    return list.sort((a, b) => (tab === 'done' ? time(b) - time(a) : time(a) - time(b)));
  }, [scoped, tab]);

  const open = (exam) => navigate(`/student/exams/${exam._id}`);
  const results = (exam) => navigate(`/student/exams/${exam._id}/results`);

  const action = (exam) => {
    const a = exam.attempt;
    if (a && isClosedAttempt(a)) {
      return (
        <Button variant="soft" icon={Trophy} onClick={() => results(exam)}>
          {exam.released ? 'Results' : 'Submission'}
        </Button>
      );
    }
    if (a?.status === 'in_progress' && exam.phase === 'live') {
      return (
        <Button icon={RotateCcw} onClick={() => open(exam)}>
          Resume
        </Button>
      );
    }
    if (exam.phase === 'live') {
      return (
        <Button icon={Play} onClick={() => open(exam)}>
          Start
        </Button>
      );
    }
    return (
      <Button variant="secondary" onClick={() => open(exam)}>
        Details
      </Button>
    );
  };

  return (
    <div className="h-full flex flex-col px-4 sm:px-5 py-5">
      <section className="flex-1 min-h-0 flex flex-col gap-3">
        <header className="shrink-0 flex flex-wrap items-center gap-2">
          <h1 className={`${type.pageTitle} mr-2`}>Exams</h1>
          <div className="relative w-full sm:w-64">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted pointer-events-none" />
            <input
              value={query}
              onChange={(e) => updateParams({ q: e.target.value })}
              placeholder="Search exams"
              className="w-full h-9 bg-inset border border-line rounded-xl pl-9 pr-8 text-fg text-xs outline-none focus:border-accent"
              aria-label="Search exams"
            />
            {query && (
              <button type="button" onClick={() => updateParams({ q: '' })} className="absolute right-2 top-1/2 -translate-y-1/2 p-1 rounded-lg text-muted hover:text-fg" aria-label="Clear search">
                <X className="w-3.5 h-3.5" />
              </button>
            )}
          </div>
          <div className="flex h-9 rounded-xl border border-line bg-inset p-0.5 overflow-x-auto" role="tablist" aria-label="Exam status">
            {TABS.map((t) => (
              <button
                key={t.id}
                type="button"
                role="tab"
                aria-selected={tab === t.id}
                onClick={() => updateParams({ tab: t.id })}
                className={`px-3 rounded-lg text-xs font-semibold whitespace-nowrap transition ${tab === t.id ? 'bg-surface text-fg shadow-sm' : 'text-muted hover:text-fg'}`}
              >
                {t.label} <span className="text-subtle font-normal">{counts[t.id]}</span>
              </button>
            ))}
          </div>
          {enrolled.length > 1 && (
            <select value={classFilter} onChange={(e) => updateParams({ class: e.target.value })} className={`ml-auto max-w-48 ${selectClass}`} aria-label="Filter by class">
              <option value="">All classes</option>
              {enrolled.map((c) => (
                <option key={c._id} value={c._id}>
                  {c.name}
                </option>
              ))}
            </select>
          )}
          <Button
            variant="secondary"
            icon={RefreshCw}
            onClick={load}
            disabled={loading}
            aria-label="Refresh"
            title="Refresh"
            className={`h-9 w-9 justify-center p-0! ${enrolled.length > 1 ? '' : 'ml-auto'} ${loading ? '[&>svg]:animate-spin' : ''}`}
          />
        </header>

        {failed > 0 && !loading && (
          <p className="shrink-0 text-xs text-warn">Exams from {failed} class{failed === 1 ? '' : 'es'} could not be loaded. Try refreshing.</p>
        )}

        {!loading && rows.length === 0 ? (
          <EmptyState
            icon={ClipboardList}
            title={exams.length ? 'Nothing here' : 'No exams yet'}
            message={
              exams.length
                ? 'No exams match this tab or filter.'
                : enrolled.length
                  ? 'When your instructors schedule an exam, it shows up here.'
                  : 'Join a class to see its exams.'
            }
          />
        ) : (
          <Table columns={COLUMNS} fill>
            {loading && rows.length === 0
              ? Array.from({ length: 4 }, (_, i) => (
                  <tr key={i}>
                    {COLUMNS.map((c, j) => (
                      <td key={j} className={`${tableClass.td} ${c.className || ''}`}>
                        <div className="h-3 rounded bg-hover animate-pulse" style={{ width: j === 0 ? '70%' : '50%' }} />
                      </td>
                    ))}
                  </tr>
                ))
              : rows.map((exam) => (
                  <tr key={exam._id} className={`${tableClass.row} cursor-pointer`} onClick={() => open(exam)}>
                    <td className={`${tableClass.td} max-w-xs`}>
                      <p className="text-sm font-semibold text-fg truncate">{exam.title}</p>
                      <p className={`${type.meta} truncate`}>{exam.className}</p>
                    </td>
                    <td className={`${tableClass.td} hidden md:table-cell whitespace-nowrap text-body`}>{windowText(exam.proctoring)}</td>
                    <td className={`${tableClass.td} hidden sm:table-cell text-right whitespace-nowrap`}>
                      <p className="text-body">{formatMinutes(exam.proctoring?.durationMinutes)}</p>
                      <p className={type.meta}>
                        {exam.questionCount} questions{exam.totalPoints ? ` · ${exam.totalPoints} pts` : ''}
                      </p>
                    </td>
                    <td className={tableClass.td}>
                      <StatusCell exam={exam} />
                    </td>
                    <td className={`${tableClass.td} text-right`} onClick={(e) => e.stopPropagation()}>
                      <div className="flex justify-end">{action(exam)}</div>
                    </td>
                  </tr>
                ))}
          </Table>
        )}
      </section>
    </div>
  );
};

export default StudentExamList;
