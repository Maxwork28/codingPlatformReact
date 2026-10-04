import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { formatDistanceToNowStrict } from 'date-fns';
import {
  AlertTriangle,
  ArrowDownRight,
  ArrowUpRight,
  Ban,
  CheckCircle2,
  ChevronRight,
  ClipboardList,
  FilePen,
  FileQuestion,
  GraduationCap,
  LayoutDashboard,
  Play,
  Plus,
  RefreshCw,
  School,
  Send,
  Upload,
  UserX,
  Users,
  XCircle,
} from 'lucide-react';
import { getAdminDashboard } from '../../../common/services/api';
import { Button, Card, EmptyState, Table } from '../../../common/ui/primitives';
import { table as tableClass, type } from '../../../common/ui/format';
import { useStaffBase } from '../components/classDetails/helpers';

const tones = {
  accent: 'bg-accent-soft text-accent-ink border-accent-line',
  ok: 'bg-ok-soft text-ok border-ok-line',
  warn: 'bg-warn-soft text-warn border-warn-line',
  bad: 'bg-bad-soft text-bad border-bad-line',
  info: 'bg-info-soft text-info border-info-line',
  quiet: 'bg-quiet-soft text-quiet border-quiet-line',
};

const plural = (n, word, many = `${word}s`) => `${n} ${n === 1 ? word : many}`;

const timeAgo = (value) => (value ? `${formatDistanceToNowStrict(new Date(value))} ago` : '');

const formatTime = (value) =>
  new Date(value).toLocaleString(undefined, { weekday: 'short', day: 'numeric', month: 'short', hour: 'numeric', minute: '2-digit' });

const initials = (name = '') =>
  name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0].toUpperCase())
    .join('') || '?';

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

function KpiCard({ icon, tone, label, value, hint, trend, to }) {
  const Icon = icon;
  return (
    <Link
      to={to}
      className="group bg-surface border border-line rounded-2xl p-4 flex flex-col gap-3 hover:border-line-strong transition"
    >
      <div className="flex items-center justify-between">
        <span className={`w-8 h-8 rounded-lg border flex items-center justify-center ${tones[tone]}`}>
          <Icon className="w-4 h-4" />
        </span>
        {trend}
      </div>
      <div className="min-w-0">
        <p className="text-[10px] font-bold uppercase tracking-wider text-muted">{label}</p>
        <p className="text-2xl font-bold text-fg leading-tight tabular-nums">{value}</p>
        <p className={`${type.meta} truncate`}>{hint}</p>
      </div>
    </Link>
  );
}

function Trend({ current, previous }) {
  if (!previous) return null;
  const change = Math.round(((current - previous) / previous) * 100);
  if (change === 0) return <span className="text-[11px] text-muted">No change</span>;
  const up = change > 0;
  const Icon = up ? ArrowUpRight : ArrowDownRight;
  return (
    <span
      className={`flex items-center gap-0.5 text-[11px] font-semibold ${up ? 'text-ok' : 'text-bad'}`}
      title="Compared with the previous 7 days"
    >
      <Icon className="w-3 h-3" />
      {Math.abs(change)}%
    </span>
  );
}

function ActivityChart({ days }) {
  const max = Math.max(1, ...days.map((d) => d.total));
  const total = days.reduce((sum, d) => sum + d.total, 0);
  const correct = days.reduce((sum, d) => sum + d.correct, 0);
  const label = (date, opts) => new Date(`${date}T00:00:00`).toLocaleDateString(undefined, opts);

  return (
    <Card className="lg:col-span-2 flex flex-col">
      <SectionHeader
        title="Submissions · last 14 days"
        action={
          <div className="flex items-center gap-3 text-[11px] text-muted">
            <span className="flex items-center gap-1">
              <span className="w-2 h-2 rounded-sm bg-ok" /> Correct
            </span>
            <span className="flex items-center gap-1">
              <span className="w-2 h-2 rounded-sm bg-bad/60" /> Incorrect
            </span>
          </div>
        }
      />
      <div className="flex items-baseline gap-4 mb-4">
        <p>
          <span className="text-2xl font-bold text-fg tabular-nums">{total}</span>{' '}
          <span className={type.body}>submissions</span>
        </p>
        <p>
          <span className="text-2xl font-bold text-fg tabular-nums">{total ? Math.round((correct / total) * 100) : 0}%</span>{' '}
          <span className={type.body}>correct</span>
        </p>
      </div>
      <div className="flex-1 min-h-40 flex items-end gap-1 sm:gap-1.5" role="img" aria-label={`${total} submissions in the last 14 days`}>
        {days.map((d, i) => {
          const isToday = i === days.length - 1;
          return (
            <div key={d.date} className="flex-1 h-full flex flex-col justify-end items-center gap-1.5 group">
              <div
                className="w-full max-w-8 flex flex-col justify-end rounded-md overflow-hidden bg-hover/60 h-full"
                title={`${label(d.date, { weekday: 'short', day: 'numeric', month: 'short' })}: ${d.total} submissions, ${d.correct} correct`}
              >
                <div className="bg-bad/60 group-hover:bg-bad/80 transition" style={{ height: `${((d.total - d.correct) / max) * 100}%` }} />
                <div className="bg-ok group-hover:brightness-110 transition" style={{ height: `${(d.correct / max) * 100}%` }} />
              </div>
              <span className={`text-[10px] tabular-nums ${isToday ? 'text-fg font-semibold' : 'text-subtle'}`}>
                {isToday ? 'Today' : i % 2 === days.length % 2 ? label(d.date, { day: 'numeric' }) : '\u00a0'}
              </span>
            </div>
          );
        })}
      </div>
    </Card>
  );
}

function AttentionList({ attention, base, isTeacher }) {
  const items = [
    attention.drafts > 0 && {
      icon: FilePen,
      tone: 'warn',
      text: `${plural(attention.drafts, 'question draft')} waiting to be published`,
      to: `${base}/questions/drafts`,
    },
    attention.scoresAwaitingRelease > 0 && {
      icon: Send,
      tone: 'info',
      text: `${plural(attention.scoresAwaitingRelease, 'finished exam')} with unreleased scores`,
      to: attention.firstAwaitingRelease
        ? `${base}/classes/${attention.firstAwaitingRelease.classId}/exams/${attention.firstAwaitingRelease._id}/report`
        : `${base}/exams`,
    },
    !isTeacher && attention.classesWithoutTeacher > 0 && {
      icon: AlertTriangle,
      tone: 'bad',
      text: `${plural(attention.classesWithoutTeacher, 'active class', 'active classes')} without a teacher`,
      to: `${base}/classes?status=active`,
    },
    !isTeacher && attention.unenrolledStudents > 0 && {
      icon: UserX,
      tone: 'warn',
      text: `${plural(attention.unenrolledStudents, 'student')} not in any class`,
      to: '/admin/students?filter=unenrolled',
    },
    attention.blockedStudents > 0 && {
      icon: Ban,
      tone: 'bad',
      text: `${plural(attention.blockedStudents, 'student')} blocked from a class`,
      to: isTeacher ? `${base}/classes` : '/admin/students?filter=blocked',
    },
    attention.inactiveClasses > 0 && {
      icon: School,
      tone: 'quiet',
      text: `${plural(attention.inactiveClasses, 'inactive class', 'inactive classes')}`,
      to: `${base}/classes?status=inactive`,
    },
  ].filter(Boolean);

  return (
    <Card className="flex flex-col">
      <SectionHeader title="Needs attention" />
      {items.length === 0 ? (
        <div className="flex-1 flex flex-col items-center justify-center gap-2 py-8 text-center">
          <CheckCircle2 className="w-8 h-8 text-ok" />
          <p className={type.cardTitle}>All clear</p>
          <p className={type.body}>Nothing needs your attention right now.</p>
        </div>
      ) : (
        <ul className="-mx-2 space-y-0.5">
          {items.map((item) => {
            const Icon = item.icon;
            return (
              <li key={item.text}>
                <Link to={item.to} className="flex items-center gap-3 rounded-xl px-2 py-2 hover:bg-hover transition group">
                  <span className={`w-7 h-7 rounded-lg border flex items-center justify-center shrink-0 ${tones[item.tone]}`}>
                    <Icon className="w-3.5 h-3.5" />
                  </span>
                  <span className="flex-1 text-xs text-body">{item.text}</span>
                  <ChevronRight className="w-3.5 h-3.5 text-subtle group-hover:text-fg" />
                </Link>
              </li>
            );
          })}
        </ul>
      )}
    </Card>
  );
}

const PHASES = [
  { id: 'live', label: 'Live', tone: 'text-ok' },
  { id: 'scheduled', label: 'Scheduled', tone: 'text-info' },
  { id: 'draft', label: 'Draft', tone: 'text-warn' },
  { id: 'completed', label: 'Completed', tone: 'text-muted' },
];

function ExamsPanel({ exams, upcoming, base }) {
  const navigate = useNavigate();
  return (
    <Card className="lg:col-span-2 flex flex-col">
      <SectionHeader title="Live & upcoming exams" action={<ViewAll to={`${base}/exams`}>All exams</ViewAll>} />
      <div className="grid grid-cols-4 gap-2 mb-4">
        {PHASES.map((p) => (
          <div key={p.id} className="rounded-xl border border-line bg-inset px-3 py-2">
            <p className="text-[10px] font-bold uppercase tracking-wider text-muted">{p.label}</p>
            <p className={`text-lg font-bold tabular-nums ${exams[p.id] ? p.tone : 'text-subtle'}`}>{exams[p.id] || 0}</p>
          </div>
        ))}
      </div>
      {upcoming.length === 0 ? (
        <div className="flex-1 flex flex-col items-center justify-center gap-1 py-6 text-center">
          <ClipboardList className="w-6 h-6 text-muted" />
          <p className={type.cardTitle}>No live or upcoming exams</p>
          <p className={type.body}>Schedule an exam from a class or start one from a template.</p>
        </div>
      ) : (
        <ul className="divide-y divide-line -mx-1">
          {upcoming.map((exam) => {
            const live = exam.phase === 'live';
            const progress = exam.enrolled ? Math.min(100, Math.round((exam.started / exam.enrolled) * 100)) : 0;
            return (
              <li key={exam._id}>
                <button
                  type="button"
                  onClick={() => navigate(`${base}/classes/${exam.classId}/exams/${exam._id}/report`)}
                  className="w-full text-left flex items-center gap-3 px-1 py-2.5 rounded-lg hover:bg-hover transition"
                >
                  <span
                    className={`shrink-0 w-20 flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-wider ${live ? 'text-ok' : 'text-info'}`}
                  >
                    <span className={`w-1.5 h-1.5 rounded-full ${live ? 'bg-ok animate-pulse' : 'bg-info'}`} />
                    {live ? 'Live' : 'Scheduled'}
                  </span>
                  <span className="flex-1 min-w-0">
                    <span className="block text-xs font-semibold text-fg truncate">{exam.title}</span>
                    <span className={`block ${type.meta} truncate`}>
                      {exam.className || 'Unknown class'}
                      {live
                        ? exam.endTime && ` · ends ${formatTime(exam.endTime)}`
                        : exam.startTime && ` · starts ${formatTime(exam.startTime)}`}
                    </span>
                  </span>
                  {live ? (
                    <span className="hidden sm:flex flex-col items-end gap-1 w-32 shrink-0">
                      <span className="text-[11px] text-body tabular-nums">
                        {exam.started}/{exam.enrolled} started · {exam.submitted} done
                      </span>
                      <span className="w-full h-1.5 rounded-full bg-hover overflow-hidden">
                        <span className="block h-full bg-ok rounded-full" style={{ width: `${progress}%` }} />
                      </span>
                    </span>
                  ) : (
                    <span className="hidden sm:block text-[11px] text-muted whitespace-nowrap">
                      {exam.startTime ? `in ${formatDistanceToNowStrict(new Date(exam.startTime))}` : 'No start time'}
                    </span>
                  )}
                  <ChevronRight className="w-3.5 h-3.5 text-subtle shrink-0" />
                </button>
              </li>
            );
          })}
        </ul>
      )}
    </Card>
  );
}

function RecentSubmissions({ items, base, isTeacher }) {
  return (
    <Card className="flex flex-col">
      <SectionHeader title="Recent submissions" action={<ViewAll to={isTeacher ? `${base}/classes` : '/admin/students?sort=recent'}>{isTeacher ? 'Classes' : 'Students'}</ViewAll>} />
      {items.length === 0 ? (
        <p className={`${type.body} py-6 text-center`}>No submissions yet.</p>
      ) : (
        <ul className="space-y-3">
          {items.map((s) => (
            <li key={s._id} className="flex items-start gap-2.5">
              <span className="w-7 h-7 rounded-full bg-accent-soft text-accent-ink border border-accent-line text-[10px] font-bold flex items-center justify-center shrink-0">
                {initials(s.studentName)}
              </span>
              <div className="flex-1 min-w-0">
                <p className="text-xs text-body truncate">
                  <span className="font-semibold text-fg">{s.studentName}</span>
                  {s.inExam && <span className="text-subtle"> · exam</span>}
                </p>
                <p className={`${type.meta} truncate`} title={s.questionTitle}>
                  {s.questionTitle}
                </p>
              </div>
              <div className="flex flex-col items-end shrink-0">
                {s.isCorrect ? (
                  <CheckCircle2 className="w-3.5 h-3.5 text-ok" aria-label="Correct" />
                ) : (
                  <XCircle className="w-3.5 h-3.5 text-bad" aria-label="Incorrect" />
                )}
                <span className="text-[10px] text-subtle whitespace-nowrap mt-0.5">{timeAgo(s.submittedAt)}</span>
              </div>
            </li>
          ))}
        </ul>
      )}
    </Card>
  );
}

const CLASS_COLUMNS = [
  { label: 'Class' },
  { label: 'Students', className: 'text-right' },
  { label: 'Teachers', className: 'text-right hidden md:table-cell' },
  { label: 'Exams', className: 'text-right hidden md:table-cell' },
  { label: 'Submissions (7d)', className: 'text-right' },
  { label: 'Correct (7d)', className: 'hidden sm:table-cell' },
];

function ClassActivity({ classes, base }) {
  const navigate = useNavigate();
  return (
    <section>
      <SectionHeader title="Most active classes this week" action={<ViewAll to={`${base}/classes`}>All classes</ViewAll>} />
      <Table columns={CLASS_COLUMNS}>
        {classes.map((c) => (
          <tr key={c._id} onClick={() => navigate(`${base}/classes/${c._id}`)} className={`${tableClass.row} cursor-pointer`}>
            <td className={tableClass.td}>
              <span className="text-sm font-semibold text-fg">{c.name}</span>
              {c.status !== 'active' && <span className={`${type.meta} ml-1.5`}>inactive</span>}
              {c.status === 'active' && c.teachers === 0 && <span className="text-[11px] text-bad ml-1.5">no teacher</span>}
            </td>
            <td className={`${tableClass.td} text-right tabular-nums`}>{c.students}</td>
            <td className={`${tableClass.td} text-right tabular-nums hidden md:table-cell`}>{c.teachers}</td>
            <td className={`${tableClass.td} text-right tabular-nums hidden md:table-cell`}>{c.exams}</td>
            <td className={`${tableClass.td} text-right tabular-nums`}>{c.submissions7d}</td>
            <td className={`${tableClass.td} hidden sm:table-cell`}>
              {c.accuracy7d == null ? (
                <span className="text-subtle">—</span>
              ) : (
                <div className="flex items-center gap-2 w-40">
                  <div className="flex-1 h-1.5 rounded-full bg-hover overflow-hidden">
                    <div
                      className={`h-full rounded-full ${c.accuracy7d >= 70 ? 'bg-ok' : c.accuracy7d >= 40 ? 'bg-warn' : 'bg-bad'}`}
                      style={{ width: `${c.accuracy7d}%` }}
                    />
                  </div>
                  <span className="text-[11px] text-body tabular-nums w-8 text-right">{c.accuracy7d}%</span>
                </div>
              )}
            </td>
          </tr>
        ))}
      </Table>
    </section>
  );
}

function DashboardSkeleton() {
  const block = 'rounded-2xl bg-surface border border-line animate-pulse';
  return (
    <div className="space-y-4" aria-busy="true">
      <div className="grid grid-cols-2 lg:grid-cols-5 gap-3">
        {Array.from({ length: 5 }, (_, i) => (
          <div key={i} className={`${block} h-32`} />
        ))}
      </div>
      <div className="grid lg:grid-cols-3 gap-4">
        <div className={`${block} h-72 lg:col-span-2`} />
        <div className={`${block} h-72`} />
      </div>
    </div>
  );
}

const AdminDashboard = () => {
  const navigate = useNavigate();
  const { base, isTeacher } = useStaffBase();
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const response = await getAdminDashboard();
      setData(response.data);
    } catch (err) {
      setError(typeof err === 'string' ? err : 'Failed to load dashboard');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const updatedAt = useMemo(
    () => (data?.generatedAt ? new Date(data.generatedAt).toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' }) : ''),
    [data],
  );

  const k = data?.kpis;

  return (
    <div className="px-4 sm:px-5 py-5 space-y-4">
      <header className="flex flex-wrap items-center gap-2">
        <h1 className={`${type.pageTitle} mr-2`}>Dashboard</h1>
        {updatedAt && <span className={type.meta}>Updated {updatedAt}</span>}
        <div className="ml-auto flex items-center gap-2">
          <Button
            variant="secondary"
            icon={RefreshCw}
            onClick={load}
            disabled={loading}
            aria-label="Refresh"
            title="Refresh"
            className={`h-9 w-9 justify-center p-0! ${loading ? '[&>svg]:animate-spin' : ''}`}
          />
          {isTeacher ? (
            <Button variant="secondary" icon={Play} className="h-9" onClick={() => navigate('/teacher/take-class')}>
              Take class
            </Button>
          ) : (
            <Button variant="secondary" icon={Upload} className="h-9" onClick={() => navigate('/admin/upload')}>
              Import users
            </Button>
          )}
          <Button icon={Plus} className="h-9" onClick={() => navigate(`${base}/questions/create`)}>
            New question
          </Button>
        </div>
      </header>

      {error && !data ? (
        <EmptyState
          icon={LayoutDashboard}
          title="Couldn't load the dashboard"
          message={error}
          action={<Button variant="secondary" onClick={load}>Try again</Button>}
        />
      ) : !data ? (
        <DashboardSkeleton />
      ) : (
        <>
          {error && (
            <p className="rounded-xl border border-bad-line bg-bad-soft px-3 py-2 text-xs text-bad">
              Refresh failed: {error}. Showing data from {updatedAt}.
            </p>
          )}

          <div className={`grid grid-cols-2 ${isTeacher ? 'lg:grid-cols-4' : 'lg:grid-cols-5'} gap-3`}>
            <KpiCard
              icon={Users}
              tone="accent"
              label="Students"
              value={k.students}
              hint={`${k.activeStudents7d} active this week · ${k.newStudents7d} new`}
              to={isTeacher ? `${base}/classes` : '/admin/students'}
            />
            {!isTeacher && (
              <KpiCard
                icon={GraduationCap}
                tone="info"
                label="Teachers"
                value={k.teachers}
                hint={`${k.teacherCreators} can create questions`}
                to="/admin/teachers"
              />
            )}
            <KpiCard
              icon={School}
              tone="ok"
              label="Active classes"
              value={k.activeClasses}
              hint={`of ${plural(k.classes, 'class', 'classes')}`}
              to={`${base}/classes`}
            />
            <KpiCard
              icon={FileQuestion}
              tone="warn"
              label="Question bank"
              value={k.questions}
              hint={`${plural(k.templates, 'exam template')}`}
              to={`${base}/questions`}
            />
            <KpiCard
              icon={Send}
              tone="quiet"
              label="Submissions (7 days)"
              value={k.submissions7d}
              hint={`${k.submissionsPrev7d} the week before`}
              trend={<Trend current={k.submissions7d} previous={k.submissionsPrev7d} />}
              to={isTeacher ? `${base}/classes` : '/admin/students?sort=recent'}
            />
          </div>

          <div className="grid lg:grid-cols-3 gap-4">
            <ActivityChart days={data.activity} />
            <AttentionList attention={data.attention} base={base} isTeacher={isTeacher} />
          </div>

          <div className="grid lg:grid-cols-3 gap-4">
            <ExamsPanel exams={data.exams} upcoming={data.upcomingExams} base={base} />
            <RecentSubmissions items={data.recentSubmissions} base={base} isTeacher={isTeacher} />
          </div>

          {data.topClasses.length > 0 && <ClassActivity classes={data.topClasses} base={base} />}
        </>
      )}
    </div>
  );
};

export default AdminDashboard;
