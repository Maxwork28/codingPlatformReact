import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useLocation, useNavigate, useParams } from 'react-router-dom';
import {
  AlarmClockPlus,
  ArrowLeft,
  BarChart3,
  Download,
  Eye,
  EyeOff,
  Lock,
  Pencil,
  RefreshCw,
  RotateCcw,
  Send,
  Unlock,
  UserRound,
  WifiOff,
} from 'lucide-react';
import {
  extendExamAttempt,
  forceSubmitExamAttempt,
  getExamReport,
  releaseExamScores,
  resetExamAttempt,
  setExamStatus,
} from '../../../common/services/api';
import { Button, EmptyState, StatusChip, Table } from '../../../common/ui/primitives';
import ActionMenu from '../../../common/ui/ActionMenu';
import Modal from '../../../common/ui/Modal';
import { inputClass, table as tableClass, type } from '../../../common/ui/format';
import { confirmAction, notify } from '../../../common/ui/Toast';
import { RateBar, SearchBox, Segmented } from '../components/classDetails/shared';
import { HIDE_MD, HIDE_SM, errorText, plural, selectClass } from '../components/classDetails/helpers';
import AttemptDetailModal from '../components/examReport/AttemptDetailModal';
import {
  ATTEMPT_STATUS,
  answerKey,
  answeredCount,
  downloadCsv,
  formatCountdown,
  formatTime,
  isOpen,
  percentOf,
  violationTotal,
} from '../components/examReport/reportUtils';

const POLL_MS = 15000;
const STALE_MS = 90000;

const PHASES = {
  live: { label: 'Live', dot: 'bg-ok animate-pulse', text: 'text-ok' },
  scheduled: { label: 'Scheduled', dot: 'bg-info', text: 'text-info' },
  draft: { label: 'Draft', dot: 'bg-warn', text: 'text-warn' },
  completed: { label: 'Closed', dot: 'bg-subtle', text: 'text-muted' },
  archived: { label: 'Archived', dot: 'bg-subtle', text: 'text-subtle' },
};

const TYPE_SHORT = {
  singleCorrectMcq: 'Single choice',
  multipleCorrectMcq: 'Multiple choice',
  fillInTheBlanks: 'Fill in',
  fillInTheBlanksCoding: 'Code completion',
  coding: 'Coding',
  codingWithDriver: 'Coding',
};

const STUDENT_FILTERS = [
  { id: 'all', label: 'All' },
  { id: 'writing', label: 'Writing' },
  { id: 'done', label: 'Finished' },
  { id: 'flagged', label: 'Flagged' },
];

const SORTS = {
  status: { label: 'Writing first', compare: (a, b) => Number(isOpen(b)) - Number(isOpen(a)) || nameOf(a).localeCompare(nameOf(b)) },
  name: { label: 'Name A–Z', compare: (a, b) => nameOf(a).localeCompare(nameOf(b)) },
  scoreDesc: { label: 'Highest score', compare: (a, b) => (percentOf(b) ?? -1) - (percentOf(a) ?? -1) },
  scoreAsc: { label: 'Lowest score', compare: (a, b) => (percentOf(a) ?? 101) - (percentOf(b) ?? 101) },
  flags: { label: 'Most flags', compare: (a, b) => violationTotal(b) - violationTotal(a) },
};

function nameOf(a) {
  return a.student?.name || '';
}

function ExtendModal({ target, onClose, onConfirm, busy }) {
  const [minutes, setMinutes] = useState(10);
  const many = Array.isArray(target);
  return (
    <Modal
      open
      onClose={onClose}
      title="Add time"
      icon={AlarmClockPlus}
      width="max-w-sm"
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>
            Cancel
          </Button>
          <Button onClick={() => onConfirm(Number(minutes))} disabled={busy || !(Number(minutes) >= 1 && Number(minutes) <= 240)}>
            {busy ? 'Adding…' : `Add ${minutes || 0} min`}
          </Button>
        </>
      }
    >
      <p className="text-xs text-body -mt-2">
        {many ? `Extends the clock for ${plural(target.length, 'student')} who ${target.length === 1 ? 'is' : 'are'} writing now.` : `Extends the clock for ${target.student?.name || 'this student'}.`}{' '}
        Extra time applies even past the exam’s closing time.
      </p>
      <div className="flex flex-wrap gap-2">
        {[5, 10, 15, 30].map((m) => (
          <button
            key={m}
            type="button"
            onClick={() => setMinutes(m)}
            className={`h-8 px-3 rounded-lg border text-xs font-semibold ${Number(minutes) === m ? 'border-accent-line bg-accent-soft text-accent-ink' : 'border-line text-muted hover:text-fg hover:bg-hover'}`}
          >
            +{m} min
          </button>
        ))}
        <input
          type="number"
          min="1"
          max="240"
          value={minutes}
          onChange={(e) => setMinutes(e.target.value)}
          aria-label="Minutes to add"
          className={`${inputClass} w-24! h-8 py-0 tabular-nums`}
        />
      </div>
    </Modal>
  );
}

function SummaryItem({ label, value, tone = 'text-fg' }) {
  return (
    <div className="min-w-0">
      <dt className="text-[10px] font-bold uppercase tracking-wider text-muted">{label}</dt>
      <dd className={`text-base font-bold tabular-nums ${tone}`}>{value}</dd>
    </div>
  );
}

export default function ExamReport() {
  const { examId, classId } = useParams();
  const navigate = useNavigate();
  const { pathname } = useLocation();
  const base = pathname.startsWith('/teacher') ? '/teacher' : '/admin';
  const listPath = `${base}/classes/${classId}/exams`;

  const [report, setReport] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [offset, setOffset] = useState(0);
  const [now, setNow] = useState(() => Date.now());
  const [tab, setTab] = useState('students');
  const [query, setQuery] = useState('');
  const [filter, setFilter] = useState('all');
  const [sort, setSort] = useState('status');
  const [detailId, setDetailId] = useState(null);
  const [extendTarget, setExtendTarget] = useState(null);
  const [busy, setBusy] = useState('');

  const load = useCallback(
    async ({ quiet = false } = {}) => {
      if (!quiet) setLoading(true);
      try {
        const { data } = await getExamReport(examId);
        setReport(data);
        if (data.serverTime) setOffset(new Date(data.serverTime).getTime() - Date.now());
        setError('');
      } catch (err) {
        if (!quiet) setError(errorText(err, 'Failed to load the report'));
      } finally {
        if (!quiet) setLoading(false);
      }
    },
    [examId],
  );

  useEffect(() => {
    load();
  }, [load]);

  const exam = report?.exam;
  const attempts = useMemo(() => report?.attempts || [], [report]);
  const writing = useMemo(() => attempts.filter((a) => a.status === 'in_progress'), [attempts]);
  const isLive = exam?.phase === 'live' || writing.length > 0;

  useEffect(() => {
    if (!isLive) return undefined;
    const poll = setInterval(() => document.visibilityState === 'visible' && load({ quiet: true }), POLL_MS);
    const tick = setInterval(() => setNow(Date.now()), 1000);
    return () => {
      clearInterval(poll);
      clearInterval(tick);
    };
  }, [isLive, load]);

  const serverNow = now + offset;

  const summary = useMemo(() => {
    const closed = attempts.filter((a) => !isOpen(a));
    const pcts = closed.map(percentOf).filter((p) => p != null);
    return {
      enrolled: attempts.length + (report?.notStarted?.length || 0),
      finished: closed.length,
      writing: writing.length,
      notStarted: report?.notStarted?.length || 0,
      average: pcts.length ? Math.round(pcts.reduce((s, p) => s + p, 0) / pcts.length) : null,
      highest: pcts.length ? Math.max(...pcts) : null,
      flagged: attempts.filter((a) => violationTotal(a) > 0).length,
    };
  }, [attempts, writing.length, report]);

  const questionStats = useMemo(() => {
    if (!exam) return [];
    const closed = attempts.filter((a) => !isOpen(a));
    return exam.questions.map((q) => {
      const key = answerKey(q.questionId);
      const answers = closed.map((a) => (a.answers || []).find((x) => answerKey(x.questionId) === key)).filter((x) => x && x.answer != null && x.answer !== '');
      const correct = answers.filter((x) => x.isCorrect).length;
      const scored = answers.reduce((s, x) => s + (x.score || 0), 0);
      return {
        ...q,
        key,
        answered: answers.length,
        skipped: closed.length - answers.length,
        correct,
        avgPercent: closed.length && q.points ? Math.round((scored / (closed.length * q.points)) * 100) : null,
      };
    });
  }, [exam, attempts]);

  const rows = useMemo(() => {
    const q = query.trim().toLowerCase();
    return attempts
      .filter((a) => filter === 'all' || (filter === 'writing' ? isOpen(a) : filter === 'done' ? !isOpen(a) : violationTotal(a) > 0))
      .filter((a) => !q || [a.student?.name, a.student?.email].filter(Boolean).some((t) => t.toLowerCase().includes(q)))
      .sort(SORTS[sort].compare);
  }, [attempts, filter, query, sort]);

  const pending = useMemo(() => {
    const q = query.trim().toLowerCase();
    return (report?.notStarted || []).filter((s) => !q || [s.name, s.email].filter(Boolean).some((t) => t.toLowerCase().includes(q)));
  }, [report, query]);

  // ---- actions --------------------------------------------------------------
  const act = async (key, task, success) => {
    setBusy(key);
    try {
      const result = await task();
      if (success) notify(typeof success === 'function' ? success(result) : success, 'success');
      await load({ quiet: true });
      return true;
    } catch (err) {
      notify(errorText(err, 'Something went wrong'), 'error');
      return false;
    } finally {
      setBusy('');
    }
  };

  const forceSubmit = async (a) => {
    const ok = await confirmAction(`${a.student?.name || 'This student'}’s saved answers will be graded as they are. They cannot continue.`, {
      title: 'Submit this attempt now?',
      confirmLabel: 'Submit now',
      danger: true,
    });
    if (ok) act(`submit-${a._id}`, () => forceSubmitExamAttempt(examId, a._id), 'Attempt submitted');
  };

  const reset = async (a) => {
    const ok = await confirmAction(`This deletes ${a.student?.name || 'the student'}’s attempt and answers so they can start again from the beginning.`, {
      title: 'Reset attempt?',
      confirmLabel: 'Reset attempt',
      danger: true,
    });
    if (ok) act(`reset-${a._id}`, () => resetExamAttempt(examId, a._id), 'Attempt reset');
  };

  const extend = async (minutes) => {
    const targets = Array.isArray(extendTarget) ? extendTarget : [extendTarget];
    const ok = await act(
      'extend',
      async () => {
        const results = await Promise.allSettled(targets.map((a) => extendExamAttempt(examId, a._id, minutes)));
        const failed = results.filter((r) => r.status === 'rejected');
        if (failed.length === targets.length) throw failed[0].reason;
        return failed.length;
      },
      (failed) => (failed ? `Added ${minutes} min, ${plural(failed, 'attempt')} could not be extended` : `Added ${minutes} min`),
    );
    if (ok) setExtendTarget(null);
  };

  const toggleRelease = () =>
    act('release', () => releaseExamScores(examId, !exam.released), exam.released ? 'Scores hidden from students' : 'Scores released to students');

  const changeStatus = async (status) => {
    if (status === 'completed') {
      const note = writing.length ? ` ${plural(writing.length, 'student is', 'students are')} still writing; their answers will be submitted as they are.` : '';
      const ok = await confirmAction(`Students will no longer be able to start this exam.${note}`, { title: 'Close exam now?', confirmLabel: 'Close exam', danger: writing.length > 0 });
      if (!ok) return;
    }
    if (status === 'scheduled' && exam.status === 'draft') {
      const ok = await confirmAction('Students in the class will be able to see and take this exam.', { title: 'Publish exam?', confirmLabel: 'Publish' });
      if (!ok) return;
    }
    act('status', () => setExamStatus(examId, status), { completed: 'Exam closed', scheduled: exam.status === 'draft' ? 'Exam published' : 'Exam reopened' }[status]);
  };

  // ---- render ---------------------------------------------------------------
  if (error) {
    return (
      <div className="px-4 sm:px-5 py-10 max-w-xl mx-auto">
        <EmptyState
          icon={BarChart3}
          title="Couldn't load the report"
          message={error}
          action={
            <div className="flex gap-2 justify-center">
              <Button variant="secondary" onClick={() => navigate(listPath)}>
                Back to exams
              </Button>
              <Button onClick={() => load()}>Try again</Button>
            </div>
          }
        />
      </div>
    );
  }

  const phase = PHASES[exam?.phase] || PHASES.draft;
  const detail = detailId ? attempts.find((a) => a._id === detailId) : null;
  const canRelease = exam && !exam.scoring?.immediateScoreRelease && summary.finished > 0;

  const headerMenu = exam
    ? [
        { label: summary.finished || writing.length ? 'Edit settings' : 'Edit exam', icon: Pencil, onClick: () => navigate(`${base}/classes/${classId}/exams/${examId}/edit`) },
        ...(writing.length ? [{ label: 'Add time for everyone writing', icon: AlarmClockPlus, onClick: () => setExtendTarget(writing) }] : []),
        { divider: true },
        ...(exam.phase === 'draft' ? [{ label: 'Publish', icon: Send, onClick: () => changeStatus('scheduled') }] : []),
        ...(exam.phase === 'live' || exam.phase === 'scheduled' ? [{ label: 'Close exam now', icon: Lock, onClick: () => changeStatus('completed') }] : []),
        ...(exam.phase === 'completed' ? [{ label: 'Reopen exam', icon: Unlock, onClick: () => changeStatus('scheduled') }] : []),
      ]
    : [];

  const studentColumns = [
    { label: 'Student' },
    { label: 'Status' },
    { label: 'Answered', className: `text-right ${HIDE_SM}` },
    { label: 'Score', className: 'text-right' },
    { label: 'Flags', className: `text-right ${HIDE_SM}` },
    { label: 'Submitted', className: HIDE_MD },
    { key: 'actions', label: '' },
  ];
  const questionColumns = [
    { label: '#' },
    { label: 'Question' },
    { label: 'Type', className: HIDE_SM },
    { label: 'Points', className: 'text-right' },
    { label: 'Answered', className: 'text-right' },
    { label: 'Fully correct', className: `text-right ${HIDE_SM}` },
    { label: 'Avg. score' },
  ];
  const pendingColumns = [{ label: 'Student' }, { label: 'Email', className: HIDE_SM }];

  return (
    <div className="h-full flex flex-col px-4 sm:px-5 py-5">
      <section className="flex-1 min-h-0 flex flex-col gap-3">
        <header className="shrink-0 flex flex-wrap items-center gap-2">
          <Button variant="ghost" icon={ArrowLeft} className="h-9 w-9 justify-center p-0!" onClick={() => navigate(listPath)} aria-label="Back to exams" title="Back to exams" />
          <h1 className={`${type.pageTitle} truncate max-w-full`}>{exam?.title || 'Exam report'}</h1>
          {exam && (
            <span className={`flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-wider ${phase.text}`}>
              <span className={`w-1.5 h-1.5 rounded-full ${phase.dot}`} />
              {phase.label}
            </span>
          )}
          {report?.className && <span className="hidden md:inline text-xs text-muted">· {report.className}</span>}
          {isLive && <span className="hidden lg:inline text-[11px] text-subtle">Updates every 15 s</span>}
          <div className="ml-auto flex items-center gap-2">
            <Button
              variant="secondary"
              icon={RefreshCw}
              onClick={() => load({ quiet: !!report })}
              disabled={loading}
              aria-label="Refresh"
              title="Refresh"
              className={`h-9 w-9 justify-center p-0! ${loading ? '[&>svg]:animate-spin' : ''}`}
            />
            {canRelease && (
              <Button variant={exam.released ? 'secondary' : 'publish'} icon={exam.released ? EyeOff : Eye} className="h-9" onClick={toggleRelease} disabled={busy === 'release'}>
                {exam.released ? 'Hide scores' : 'Release scores'}
              </Button>
            )}
            <Button variant="secondary" icon={Download} className="h-9" onClick={() => downloadCsv(report)} disabled={!report || (!attempts.length && !summary.notStarted)}>
              Export CSV
            </Button>
            {exam && <ActionMenu label="Exam actions" items={headerMenu} />}
          </div>
        </header>

        {loading && !report ? (
          <div className="space-y-3">
            <div className="h-16 rounded-2xl bg-hover animate-pulse" />
            <div className="h-72 rounded-2xl bg-hover animate-pulse" />
          </div>
        ) : (
          <>
            <dl className="shrink-0 grid grid-cols-3 sm:grid-cols-6 gap-4 rounded-2xl border border-line bg-surface px-4 py-3 shadow-card">
              <SummaryItem label="Finished" value={`${summary.finished}/${summary.enrolled}`} />
              <SummaryItem label="Writing now" value={summary.writing} tone={summary.writing ? 'text-info' : 'text-fg'} />
              <SummaryItem label="Not started" value={summary.notStarted} />
              <SummaryItem label="Average" value={summary.average == null ? '—' : `${summary.average}%`} />
              <SummaryItem label="Highest" value={summary.highest == null ? '—' : `${summary.highest}%`} />
              <SummaryItem label="Flagged" value={summary.flagged} tone={summary.flagged ? 'text-warn' : 'text-fg'} />
            </dl>

            <div className="shrink-0 flex flex-wrap items-center gap-2">
              <Segmented
                label="Report view"
                value={tab}
                onChange={setTab}
                options={[
                  { id: 'students', label: 'Students', count: attempts.length },
                  { id: 'questions', label: 'Questions', count: exam.questions.length },
                  { id: 'pending', label: 'Not started', count: summary.notStarted },
                ]}
              />
              {tab !== 'questions' && <SearchBox value={query} onChange={setQuery} placeholder="Search students" label="Search students" />}
              {tab === 'students' && (
                <>
                  <Segmented
                    label="Filter attempts"
                    value={filter}
                    onChange={setFilter}
                    options={STUDENT_FILTERS.map((f) => ({ id: f.id, label: f.label }))}
                  />
                  <select value={sort} onChange={(e) => setSort(e.target.value)} className={`ml-auto ${selectClass}`} aria-label="Sort students">
                    {Object.entries(SORTS).map(([id, s]) => (
                      <option key={id} value={id}>
                        {s.label}
                      </option>
                    ))}
                  </select>
                </>
              )}
            </div>

            {tab === 'students' &&
              (rows.length === 0 ? (
                <EmptyState
                  icon={UserRound}
                  title={attempts.length ? 'No students match' : 'Nobody has started yet'}
                  message={attempts.length ? 'Try a different search or filter.' : exam.phase === 'draft' ? 'Publish the exam so students can take it.' : 'Attempts appear here as soon as students begin.'}
                />
              ) : (
                <Table columns={studentColumns} fill>
                  {rows.map((a) => {
                    const st = ATTEMPT_STATUS[a.status] || ATTEMPT_STATUS.in_progress;
                    const open = isOpen(a);
                    const left = a.endsAt ? new Date(a.endsAt).getTime() - serverNow : null;
                    const stale = open && a.lastHeartbeatAt && serverNow - new Date(a.lastHeartbeatAt).getTime() > STALE_MS;
                    const pct = percentOf(a);
                    const flags = violationTotal(a);
                    return (
                      <tr key={a._id} onClick={() => setDetailId(a._id)} className={`${tableClass.row} cursor-pointer ${busy.endsWith(a._id) ? 'opacity-50 pointer-events-none' : ''}`}>
                        <td className={`${tableClass.td} max-w-xs`}>
                          <p className="text-sm font-semibold text-fg truncate">{a.student?.name || 'Unknown student'}</p>
                          <p className={`${type.meta} truncate`}>{a.student?.email}</p>
                        </td>
                        <td className={`${tableClass.td} whitespace-nowrap`}>
                          <StatusChip kind={st.kind}>{st.label}</StatusChip>
                          {open && left != null && <p className={`${type.meta} mt-1 tabular-nums`}>{formatCountdown(left)} left</p>}
                          {stale && (
                            <p className="flex items-center gap-1 text-[11px] text-warn mt-0.5">
                              <WifiOff className="w-3 h-3" /> No signal since {formatTime(a.lastHeartbeatAt, true)}
                            </p>
                          )}
                        </td>
                        <td className={`${tableClass.td} text-right tabular-nums ${HIDE_SM}`}>
                          {answeredCount(a)}
                          <span className="text-subtle">/{exam.questions.length}</span>
                        </td>
                        <td className={`${tableClass.td} text-right whitespace-nowrap`}>
                          {open ? (
                            <span className="text-subtle">—</span>
                          ) : (
                            <>
                              <p className="tabular-nums text-fg font-semibold">
                                {a.totalScore ?? 0}
                                <span className="text-subtle font-normal">/{a.maxScore ?? 0}</span>
                              </p>
                              {pct != null && <p className={type.meta}>{pct}%</p>}
                            </>
                          )}
                        </td>
                        <td className={`${tableClass.td} text-right tabular-nums ${HIDE_SM}`}>
                          <span className={flags ? 'text-warn font-semibold' : 'text-subtle'} title={`${a.tabSwitchCount || 0} tab switches · ${a.fullscreenExitCount || 0} fullscreen exits · ${a.copyPasteCount || 0} copy/paste`}>
                            {flags}
                          </span>
                        </td>
                        <td className={`${tableClass.td} whitespace-nowrap ${HIDE_MD}`}>
                          {a.submittedAt ? formatTime(a.submittedAt) : <span className="text-subtle">—</span>}
                        </td>
                        <td className={`${tableClass.td} whitespace-nowrap`}>
                          <div className="flex justify-end">
                            <ActionMenu
                              label={`Actions for ${a.student?.name || 'student'}`}
                              items={[
                                { label: 'View answers', icon: UserRound, onClick: () => setDetailId(a._id) },
                                ...(open
                                  ? [
                                      { label: 'Add time', icon: AlarmClockPlus, onClick: () => setExtendTarget(a) },
                                      { label: 'Submit now', icon: Send, onClick: () => forceSubmit(a) },
                                    ]
                                  : []),
                                { divider: true },
                                { label: 'Reset attempt', icon: RotateCcw, tone: 'danger', onClick: () => reset(a) },
                              ]}
                            />
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </Table>
              ))}

            {tab === 'questions' && (
              <Table columns={questionColumns} fill>
                {questionStats.map((q, i) => (
                  <tr key={q.key} className={tableClass.row}>
                    <td className={`${tableClass.td} text-muted tabular-nums`}>{i + 1}</td>
                    <td className={`${tableClass.td} max-w-sm`}>
                      <p className="text-sm font-medium text-fg truncate">{q.title}</p>
                      {q.difficulty && <p className={`${type.meta} capitalize`}>{q.difficulty}</p>}
                    </td>
                    <td className={`${tableClass.td} whitespace-nowrap ${HIDE_SM}`}>{TYPE_SHORT[q.type] || '—'}</td>
                    <td className={`${tableClass.td} text-right tabular-nums`}>{q.points}</td>
                    <td className={`${tableClass.td} text-right tabular-nums whitespace-nowrap`}>
                      {q.answered}
                      {q.skipped > 0 && <span className={type.meta}> · {q.skipped} skipped</span>}
                    </td>
                    <td className={`${tableClass.td} text-right tabular-nums ${HIDE_SM}`}>{q.correct}</td>
                    <td className={tableClass.td}>
                      <RateBar value={q.avgPercent} />
                    </td>
                  </tr>
                ))}
              </Table>
            )}

            {tab === 'pending' &&
              (pending.length === 0 ? (
                <EmptyState icon={UserRound} title={summary.notStarted ? 'No students match' : 'Everyone has started'} message={summary.notStarted ? 'Try a different search.' : 'Every enrolled student has an attempt.'} />
              ) : (
                <Table columns={pendingColumns} fill>
                  {pending.map((s) => (
                    <tr key={s._id} className={tableClass.row}>
                      <td className={`${tableClass.td} text-sm font-medium text-fg`}>{s.name}</td>
                      <td className={`${tableClass.td} ${HIDE_SM}`}>{s.email}</td>
                    </tr>
                  ))}
                </Table>
              ))}
          </>
        )}
      </section>

      {detail && <AttemptDetailModal attempt={detail} questions={exam.questions} released={exam.released} onClose={() => setDetailId(null)} />}
      {extendTarget && <ExtendModal target={extendTarget} busy={busy === 'extend'} onClose={() => setExtendTarget(null)} onConfirm={extend} />}
    </div>
  );
}
