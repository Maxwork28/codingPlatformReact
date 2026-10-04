import React from 'react';
import { Link } from 'react-router-dom';
import { formatDistanceToNowStrict } from 'date-fns';
import {
  AlertTriangle,
  Ban,
  BookOpen,
  CalendarClock,
  CheckCircle2,
  ChevronRight,
  Clock,
  Flag,
  GraduationCap,
  Target,
  Trophy,
  UserX,
  Users,
} from 'lucide-react';
import { Card } from '../../../../common/ui/primitives';
import { type } from '../../../../common/ui/format';
import { RateBar } from './shared';
import { formatDate, initials, plural, useStaffBase } from './helpers';

const tones = {
  accent: 'bg-accent-soft text-accent-ink border-accent-line',
  ok: 'bg-ok-soft text-ok border-ok-line',
  warn: 'bg-warn-soft text-warn border-warn-line',
  bad: 'bg-bad-soft text-bad border-bad-line',
  info: 'bg-info-soft text-info border-info-line',
  quiet: 'bg-quiet-soft text-quiet border-quiet-line',
};

function Tile({ icon, tone, label, value, hint, onClick }) {
  const Icon = icon;
  return (
    <button
      type="button"
      onClick={onClick}
      className="text-left bg-surface border border-line rounded-2xl p-4 flex items-start gap-3 hover:border-line-strong transition"
    >
      <span className={`w-8 h-8 rounded-lg border flex items-center justify-center shrink-0 ${tones[tone]}`}>
        <Icon className="w-4 h-4" />
      </span>
      <span className="min-w-0">
        <span className="block text-[10px] font-bold uppercase tracking-wider text-muted">{label}</span>
        <span className="block text-2xl font-bold text-fg leading-tight tabular-nums">{value}</span>
        <span className={`block ${type.meta} truncate`}>{hint}</span>
      </span>
    </button>
  );
}

function PanelHeader({ title, action }) {
  return (
    <div className="flex items-center justify-between gap-2 mb-3">
      <h2 className={type.section}>{title}</h2>
      {action}
    </div>
  );
}

function MoreLink({ onClick, children = 'View all' }) {
  return (
    <button type="button" onClick={onClick} className="flex items-center gap-0.5 text-[11px] font-semibold text-accent-ink hover:underline">
      {children}
      <ChevronRight className="w-3 h-3" />
    </button>
  );
}

function ActivityBars({ days }) {
  const max = Math.max(1, ...days.map((d) => d.total));
  const total = days.reduce((s, d) => s + d.total, 0);
  const correct = days.reduce((s, d) => s + d.correct, 0);
  const label = (date, opts) => new Date(`${date}T00:00:00`).toLocaleDateString(undefined, opts);
  return (
    <Card className="lg:col-span-2 flex flex-col">
      <PanelHeader
        title="Practice activity · last 14 days"
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
      <p className="mb-4">
        <span className="text-2xl font-bold text-fg tabular-nums">{total}</span> <span className={type.body}>submissions</span>
        <span className="mx-2 text-subtle">·</span>
        <span className="text-2xl font-bold text-fg tabular-nums">{total ? Math.round((correct / total) * 100) : 0}%</span>{' '}
        <span className={type.body}>correct</span>
      </p>
      <div className="flex-1 min-h-36 flex items-end gap-1 sm:gap-1.5" role="img" aria-label={`${total} submissions in the last 14 days`}>
        {days.map((d, i) => {
          const isToday = i === days.length - 1;
          return (
            <div key={d.date} className="flex-1 h-full flex flex-col justify-end items-center gap-1.5 group">
              <div
                className="w-full max-w-8 h-full flex flex-col justify-end rounded-md overflow-hidden bg-hover/60"
                title={`${label(d.date, { weekday: 'short', day: 'numeric', month: 'short' })}: ${d.total} submissions, ${d.correct} correct, ${plural(d.students, 'student')}`}
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

function Attention({ data, openTab }) {
  const { aggregates: a, students, questions, counts } = data;
  const soon = Date.now() + 7 * 24 * 60 * 60 * 1000;
  const dueSoon = questions.filter((q) => q.assignment?.dueDate && new Date(q.assignment.dueDate) > Date.now() && new Date(q.assignment.dueDate) < soon).length;
  const idle = students.filter((s) => s.submissions > 0 && !s.activeThisWeek).length;
  const unpublished = counts.questions - counts.publishedQuestions;

  const items = [
    counts.teachers === 0 && { icon: AlertTriangle, tone: 'bad', text: 'No teacher assigned', go: () => openTab('teachers') },
    a.needsFocus > 0 && { icon: Flag, tone: 'warn', text: `${plural(a.needsFocus, 'student')} flagged for focus`, go: () => openTab('students', { filter: 'focus' }) },
    a.neverActive > 0 && { icon: UserX, tone: 'warn', text: `${plural(a.neverActive, 'student')} never submitted`, go: () => openTab('students', { filter: 'never' }) },
    idle > 0 && { icon: Clock, tone: 'quiet', text: `${plural(idle, 'student')} idle this week`, go: () => openTab('students', { filter: 'idle' }) },
    a.blocked > 0 && { icon: Ban, tone: 'bad', text: `${plural(a.blocked, 'student')} blocked`, go: () => openTab('students', { filter: 'blocked' }) },
    dueSoon > 0 && { icon: CalendarClock, tone: 'info', text: `${plural(dueSoon, 'deadline')} in the next 7 days`, go: () => openTab('questions', { filter: 'deadline' }) },
    unpublished > 0 && { icon: BookOpen, tone: 'quiet', text: `${plural(unpublished, 'question')} hidden from students`, go: () => openTab('questions', { filter: 'hidden' }) },
  ].filter(Boolean);

  return (
    <Card className="flex flex-col">
      <PanelHeader title="Needs attention" />
      {items.length === 0 ? (
        <div className="flex-1 flex flex-col items-center justify-center gap-2 py-8 text-center">
          <CheckCircle2 className="w-8 h-8 text-ok" />
          <p className={type.cardTitle}>All clear</p>
          <p className={type.body}>Every student is active and nothing is pending.</p>
        </div>
      ) : (
        <ul className="-mx-2 space-y-0.5">
          {items.map((item) => {
            const Icon = item.icon;
            return (
              <li key={item.text}>
                <button type="button" onClick={item.go} className="w-full text-left flex items-center gap-3 rounded-xl px-2 py-2 hover:bg-hover transition group">
                  <span className={`w-7 h-7 rounded-lg border flex items-center justify-center shrink-0 ${tones[item.tone]}`}>
                    <Icon className="w-3.5 h-3.5" />
                  </span>
                  <span className="flex-1 text-xs text-body">{item.text}</span>
                  <ChevronRight className="w-3.5 h-3.5 text-subtle group-hover:text-fg" />
                </button>
              </li>
            );
          })}
        </ul>
      )}
    </Card>
  );
}

function TopStudents({ students, total, openTab }) {
  const top = students.filter((s) => s.rank).slice(0, 5);
  return (
    <Card>
      <PanelHeader title="Top performers" action={<MoreLink onClick={() => openTab('students', { sort: 'rank' })}>Leaderboard</MoreLink>} />
      {top.length === 0 ? (
        <p className={`${type.body} py-6 text-center`}>No submissions yet.</p>
      ) : (
        <ol className="space-y-2.5">
          {top.map((s) => (
            <li key={s._id} className="flex items-center gap-2.5">
              <span className={`w-5 text-center text-xs font-bold tabular-nums ${s.rank <= 3 ? 'text-warn' : 'text-subtle'}`}>{s.rank}</span>
              <span className="w-7 h-7 rounded-full bg-accent-soft text-accent-ink border border-accent-line text-[10px] font-bold flex items-center justify-center shrink-0">
                {initials(s.name)}
              </span>
              <span className="flex-1 min-w-0">
                <span className="block text-xs font-semibold text-fg truncate">{s.name}</span>
                <span className={`block ${type.meta}`}>
                  {s.solved}/{total} solved · {s.accuracy ?? 0}% correct
                </span>
              </span>
              <span className="text-xs font-bold text-fg tabular-nums">{s.score}</span>
            </li>
          ))}
        </ol>
      )}
    </Card>
  );
}

function HardestQuestions({ questions, openTab, questionBase }) {
  const hardest = questions
    .filter((q) => q.attempted > 0)
    .sort((a, b) => a.solveRate - b.solveRate || b.attempted - a.attempted)
    .slice(0, 5);
  return (
    <Card>
      <PanelHeader title="Hardest questions" action={<MoreLink onClick={() => openTab('questions', { sort: 'solve' })} />} />
      {hardest.length === 0 ? (
        <p className={`${type.body} py-6 text-center`}>No attempts yet.</p>
      ) : (
        <ul className="space-y-3">
          {hardest.map((q) => (
            <li key={q._id}>
              <Link to={`${questionBase}/questions/${q._id}/preview`} className="block group">
                <span className="block text-xs font-semibold text-fg truncate group-hover:underline">{q.title}</span>
                <span className="flex items-center justify-between gap-2 mt-1">
                  <span className={type.meta}>
                    {q.solved}/{q.attempted} students solved
                  </span>
                  <RateBar value={q.solveRate} />
                </span>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </Card>
  );
}

function ExamsPreview({ exams, enrolled, openTab }) {
  const shown = exams.filter((e) => e.phase !== 'archived').slice(0, 4);
  const phaseTone = {
    live: 'bg-ok-soft text-ok border-ok-line',
    scheduled: 'bg-info-soft text-info border-info-line',
    draft: 'bg-warn-soft text-warn border-warn-line',
    completed: 'bg-quiet-soft text-muted border-quiet-line',
  };
  return (
    <Card>
      <PanelHeader title="Exams" action={<MoreLink onClick={() => openTab('exams')} />} />
      {shown.length === 0 ? (
        <p className={`${type.body} py-6 text-center`}>No exams yet.</p>
      ) : (
        <ul className="divide-y divide-line">
          {shown.map((e) => (
            <li key={e._id} className="py-2.5 first:pt-0 last:pb-0">
              <div className="flex items-center justify-between gap-3">
                <span className="min-w-0 text-xs font-semibold text-fg truncate">{e.title}</span>
                <span
                  className={`shrink-0 px-2 py-0.5 rounded-full border text-[10px] font-semibold capitalize ${phaseTone[e.phase] || phaseTone.completed}`}
                >
                  {e.phase}
                </span>
              </div>
              <span className={`block mt-0.5 ${type.meta}`}>
                  {e.phase === 'scheduled' && e.startTime
                    ? `starts in ${formatDistanceToNowStrict(new Date(e.startTime))}`
                    : e.phase === 'live'
                      ? `${e.started}/${enrolled} started · ${e.submitted} submitted`
                      : e.phase === 'completed'
                        ? `${e.submitted} submitted${e.averagePercent != null ? ` · avg ${e.averagePercent}%` : ''}`
                        : 'Not scheduled'}
              </span>
            </li>
          ))}
        </ul>
      )}
    </Card>
  );
}

export default function OverviewTab({ data, openTab }) {
  const { base } = useStaffBase();
  const { aggregates: a, counts, class: cls } = data;
  const withDeadline = data.questions.filter((q) => q.assignment?.dueDate).length;

  return (
    <div className="space-y-4 pb-2">
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <Tile
          icon={Users}
          tone="accent"
          label="Students"
          value={counts.students}
          hint={`${a.activeStudents7d} active this week · ${a.neverActive} never active`}
          onClick={() => openTab('students')}
        />
        <Tile
          icon={Target}
          tone="ok"
          label="Accuracy"
          value={a.accuracy == null ? '—' : `${a.accuracy}%`}
          hint={`across ${plural(a.submissions, 'submission')}`}
          onClick={() => openTab('students', { sort: 'accuracy' })}
        />
        <Tile
          icon={Trophy}
          tone="warn"
          label="Avg. solved"
          value={a.avgSolved}
          hint={`of ${plural(counts.publishedQuestions, 'published question')} per student`}
          onClick={() => openTab('students', { sort: 'solved' })}
        />
        <Tile
          icon={BookOpen}
          tone="info"
          label="Questions"
          value={counts.questions}
          hint={`${counts.publishedQuestions} published · ${withDeadline} with deadline`}
          onClick={() => openTab('questions')}
        />
      </div>

      <div className="grid lg:grid-cols-3 gap-4">
        <ActivityBars days={data.activity} />
        <Attention data={data} openTab={openTab} />
      </div>

      <div className="grid md:grid-cols-2 xl:grid-cols-3 gap-4">
        <TopStudents students={data.students} total={counts.publishedQuestions} openTab={openTab} />
        <HardestQuestions questions={data.questions} openTab={openTab} questionBase={base} />
        <ExamsPreview exams={data.exams} enrolled={counts.students} openTab={openTab} />
      </div>

      <Card className="grid sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="sm:col-span-2">
          <p className="text-[10px] font-bold uppercase tracking-wider text-muted mb-1">Description</p>
          <p className={`text-xs ${cls.description ? 'text-body' : 'text-subtle'} whitespace-pre-line`}>
            {cls.description || 'No description. Use Edit to add one.'}
          </p>
        </div>
        <div>
          <p className="text-[10px] font-bold uppercase tracking-wider text-muted mb-1">Created</p>
          <p className="text-xs text-body">{formatDate(cls.createdAt)}</p>
          <p className={type.meta}>by {cls.createdBy?.name || 'Unknown'}</p>
        </div>
        <div>
          <p className="text-[10px] font-bold uppercase tracking-wider text-muted mb-1">Teachers</p>
          {data.teachers.length ? (
            <p className="text-xs text-body">{data.teachers.map((t) => t.name).join(', ')}</p>
          ) : base === '/admin' ? (
            <button type="button" onClick={() => openTab('teachers')} className="flex items-center gap-1 text-xs font-semibold text-bad hover:underline">
              <GraduationCap className="w-3.5 h-3.5" /> Assign a teacher
            </button>
          ) : (
            <p className="text-xs text-subtle">No teacher listed</p>
          )}
        </div>
      </Card>
    </div>
  );
}
