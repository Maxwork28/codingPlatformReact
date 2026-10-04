import React, { useCallback, useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { formatDistanceToNowStrict } from 'date-fns';
import {
  Award,
  CheckCircle2,
  ChevronRight,
  CircleX,
  ClipboardList,
  GraduationCap,
  Play,
  RefreshCw,
  School,
} from 'lucide-react';
import { getStudentDashboard } from '../../../common/services/api';
import { Button, Card, EmptyState, StatusChip, Table } from '../../../common/ui/primitives';
import { table as tableClass, type } from '../../../common/ui/format';

const tones = {
  accent: 'bg-accent-soft text-accent-ink border-accent-line',
  ok: 'bg-ok-soft text-ok border-ok-line',
  warn: 'bg-warn-soft text-warn border-warn-line',
  info: 'bg-info-soft text-info border-info-line',
};

const timeAgo = (value) => (value ? `${formatDistanceToNowStrict(new Date(value))} ago` : '');

const formatWhen = (value) =>
  value
    ? new Date(value).toLocaleString(undefined, {
        weekday: 'short',
        day: 'numeric',
        month: 'short',
        hour: 'numeric',
        minute: '2-digit',
      })
    : '—';

function SectionHeader({ title, action }) {
  return (
    <div className="flex items-center justify-between gap-2 mb-3">
      <h2 className={type.section}>{title}</h2>
      {action}
    </div>
  );
}

function ViewAll({ to, children = 'View all' }) {
  return (
    <Link to={to} className="flex items-center gap-0.5 text-[11px] font-semibold text-accent-ink hover:underline">
      {children}
      <ChevronRight className="w-3 h-3" />
    </Link>
  );
}

function Kpi({ icon: Icon, tone, label, value, hint, to }) {
  return (
    <Link to={to} className="bg-surface border border-line rounded-2xl p-4 flex flex-col gap-3 hover:border-line-strong transition">
      <span className={`w-8 h-8 rounded-lg border flex items-center justify-center ${tones[tone]}`}>
        <Icon className="w-4 h-4" />
      </span>
      <div className="min-w-0">
        <p className="text-[10px] font-bold uppercase tracking-wider text-muted">{label}</p>
        <p className="text-2xl font-bold text-fg leading-tight tabular-nums">{value}</p>
        <p className={`${type.meta} truncate`}>{hint}</p>
      </div>
    </Link>
  );
}

const CLASS_COLS = [{ label: 'Class' }, { label: 'Teacher', className: 'hidden sm:table-cell' }, { label: 'Work', className: 'hidden md:table-cell' }, { label: '', key: 'action' }];
const EXAM_COLS = [{ label: 'Exam' }, { label: 'When', className: 'hidden md:table-cell' }, { label: 'Status' }, { label: '', key: 'action' }];
const ASSIGN_COLS = [{ label: 'Assignment' }, { label: 'Due', className: 'hidden sm:table-cell' }, { label: '', key: 'action' }];

const StudentDashboard = () => {
  const navigate = useNavigate();
  const [data, setData] = useState(null);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await getStudentDashboard();
      setData(res.data);
      setError('');
    } catch (err) {
      setError(typeof err === 'string' ? err : 'Failed to load dashboard');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  if (error && !data) {
    return (
      <div className="px-4 sm:px-5 py-6">
        <EmptyState title="Dashboard unavailable" message={error} action={<Button variant="secondary" onClick={load}>Retry</Button>} />
      </div>
    );
  }

  const stats = data?.stats || { problemsSolved: 0, successRate: 0, totalSubmissions: 0 };
  const classes = data?.classes || [];
  const exams = data?.upcomingExams || [];
  const assignments = data?.assignments || [];
  const activity = data?.recentActivity || [];

  return (
    <div className="h-full flex flex-col px-4 sm:px-5 py-5 gap-5 overflow-y-auto">
      <header className="shrink-0 flex items-center gap-2">
        <h1 className={type.pageTitle}>Dashboard</h1>
        <Button
          variant="secondary"
          icon={RefreshCw}
          onClick={load}
          disabled={loading}
          aria-label="Refresh"
          title="Refresh"
          className={`ml-auto h-9 w-9 justify-center p-0! ${loading ? '[&>svg]:animate-spin' : ''}`}
        />
      </header>

      <div className="grid grid-cols-2 xl:grid-cols-4 gap-3">
        <Kpi icon={CheckCircle2} tone="ok" label="Solved" value={loading ? '—' : stats.problemsSolved} hint="Unique problems" to="/student/take-class" />
        <Kpi icon={Award} tone="accent" label="Success rate" value={loading ? '—' : `${stats.successRate}%`} hint="On submitted answers" to="/student/take-class" />
        <Kpi icon={ClipboardList} tone="info" label="Submissions" value={loading ? '—' : stats.totalSubmissions} hint="Practice + assignments" to="/student/take-class" />
        <Kpi icon={School} tone="warn" label="Classes" value={loading ? '—' : classes.length} hint="Enrolled" to="/student/classes" />
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-3 gap-5">
        <section className="xl:col-span-2 min-w-0">
          <SectionHeader title="My classes" action={<ViewAll to="/student/classes" />} />
          {!loading && classes.length === 0 ? (
            <EmptyState icon={GraduationCap} title="No classes yet" message="When you are enrolled, your classes show up here." />
          ) : (
            <Table columns={CLASS_COLS}>
              {(loading && !classes.length ? Array.from({ length: 3 }, (_, i) => ({ _id: i })) : classes).map((cls) =>
                cls.name ? (
                  <tr key={cls._id} className={`${tableClass.row} cursor-pointer`} onClick={() => navigate(`/student/classes/${cls._id}`)}>
                    <td className={tableClass.td}>
                      <p className="text-sm font-semibold text-fg truncate">{cls.name}</p>
                      <p className={`${type.meta} truncate`}>{cls.description || `${cls.studentCount} students`}</p>
                    </td>
                    <td className={`${tableClass.td} hidden sm:table-cell text-body`}>{cls.teacherName || '—'}</td>
                    <td className={`${tableClass.td} hidden md:table-cell text-body`}>
                      {cls.questionCount} questions · {cls.assignmentCount} assignments
                    </td>
                    <td className={`${tableClass.td} text-right`} onClick={(e) => e.stopPropagation()}>
                      <Button variant="soft" icon={Play} onClick={() => navigate('/student/take-class', { state: { classId: cls._id } })}>
                        Practice
                      </Button>
                    </td>
                  </tr>
                ) : (
                  <tr key={cls._id}>
                    {CLASS_COLS.map((col, i) => (
                      <td key={i} className={`${tableClass.td} ${col.className || ''}`}>
                        <div className="h-3 rounded bg-hover animate-pulse w-2/3" />
                      </td>
                    ))}
                  </tr>
                ),
              )}
            </Table>
          )}
        </section>

        <section className="min-w-0">
          <SectionHeader title="Upcoming exams" action={<ViewAll to="/student/exams" />} />
          {!loading && exams.length === 0 ? (
            <EmptyState icon={Award} title="No exams soon" message="Open exams and upcoming windows appear here." />
          ) : (
            <Table columns={EXAM_COLS}>
              {(loading && !exams.length ? Array.from({ length: 3 }, (_, i) => ({ _id: i })) : exams).map((exam) =>
                exam.title ? (
                  <tr key={exam._id} className={`${tableClass.row} cursor-pointer`} onClick={() => navigate(`/student/exams/${exam._id}`)}>
                    <td className={tableClass.td}>
                      <p className="text-sm font-semibold text-fg truncate">{exam.title}</p>
                      <p className={`${type.meta} truncate`}>{exam.className}</p>
                    </td>
                    <td className={`${tableClass.td} hidden md:table-cell whitespace-nowrap text-body`}>{formatWhen(exam.startTime)}</td>
                    <td className={tableClass.td}>
                      <StatusChip kind={exam.phase === 'live' ? 'ok' : 'info'}>{exam.phase === 'live' ? 'Open' : 'Upcoming'}</StatusChip>
                    </td>
                    <td className={`${tableClass.td} text-right`}>
                      <Button variant="soft" onClick={() => navigate(`/student/exams/${exam._id}`)}>
                        {exam.attemptStatus === 'in_progress' ? 'Resume' : exam.phase === 'live' ? 'Start' : 'Details'}
                      </Button>
                    </td>
                  </tr>
                ) : (
                  <tr key={exam._id}>
                    {EXAM_COLS.map((col, i) => (
                      <td key={i} className={`${tableClass.td} ${col.className || ''}`}>
                        <div className="h-3 rounded bg-hover animate-pulse w-2/3" />
                      </td>
                    ))}
                  </tr>
                ),
              )}
            </Table>
          )}
        </section>
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-3 gap-5">
        <section className="xl:col-span-2 min-w-0">
          <SectionHeader title="Assignments" />
          {!loading && assignments.length === 0 ? (
            <EmptyState icon={ClipboardList} title="No assignments" message="Assigned questions from your classes appear here." />
          ) : (
            <Table columns={ASSIGN_COLS}>
              {(loading && !assignments.length ? Array.from({ length: 3 }, (_, i) => ({ _id: i })) : assignments).map((row) =>
                row.questionTitle ? (
                  <tr
                    key={row._id}
                    className={`${tableClass.row} cursor-pointer`}
                    onClick={() => navigate(`/student/questions/${row.questionId}/submit?classId=${row.classId}`, { state: { classId: row.classId } })}
                  >
                    <td className={tableClass.td}>
                      <p className="text-sm font-semibold text-fg truncate">{row.questionTitle}</p>
                      <p className={`${type.meta} truncate`}>{row.className}</p>
                    </td>
                    <td className={`${tableClass.td} hidden sm:table-cell whitespace-nowrap`}>
                      {row.dueDate ? (
                        <span className={new Date(row.dueDate) < new Date() ? 'text-bad' : 'text-body'}>{formatWhen(row.dueDate)}</span>
                      ) : (
                        <span className="text-muted">No due date</span>
                      )}
                    </td>
                    <td className={`${tableClass.td} text-right`}>
                      <Button variant="soft">Open</Button>
                    </td>
                  </tr>
                ) : (
                  <tr key={row._id}>
                    {ASSIGN_COLS.map((col, i) => (
                      <td key={i} className={`${tableClass.td} ${col.className || ''}`}>
                        <div className="h-3 rounded bg-hover animate-pulse w-2/3" />
                      </td>
                    ))}
                  </tr>
                ),
              )}
            </Table>
          )}
        </section>

        <section className="min-w-0">
          <SectionHeader title="Recent activity" />
          <Card className="p-0! overflow-hidden">
            {loading && !activity.length ? (
              <div className="p-4 space-y-2">
                {[0, 1, 2].map((i) => (
                  <div key={i} className="h-10 rounded-xl bg-hover animate-pulse" />
                ))}
              </div>
            ) : activity.length === 0 ? (
              <p className="px-4 py-8 text-center text-xs text-muted">No recent submissions.</p>
            ) : (
              <ul className="divide-y divide-line">
                {activity.map((item) => (
                  <li key={item.id}>
                    <Link
                      to={`/student/questions/${item.questionId}/submit?classId=${item.classId}`}
                      state={{ classId: item.classId }}
                      className="flex items-start gap-3 px-4 py-3 hover:bg-hover"
                    >
                      {item.isCorrect ? <CheckCircle2 className="w-4 h-4 text-ok mt-0.5 shrink-0" /> : <CircleX className="w-4 h-4 text-bad mt-0.5 shrink-0" />}
                      <div className="min-w-0 flex-1">
                        <p className="text-sm font-medium text-fg truncate">{item.questionTitle}</p>
                        <p className={type.meta}>
                          {item.isCorrect ? 'Solved' : 'Attempted'} · {item.className}
                        </p>
                      </div>
                      <span className="text-[11px] text-muted shrink-0">{timeAgo(item.submittedAt)}</span>
                    </Link>
                  </li>
                ))}
              </ul>
            )}
          </Card>
        </section>
      </div>
    </div>
  );
};

export default StudentDashboard;
