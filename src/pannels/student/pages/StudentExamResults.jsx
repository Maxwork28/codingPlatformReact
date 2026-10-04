import React, { useEffect, useMemo, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { ArrowLeft, Check, CheckCircle2, Clock, Hourglass, Minus, Trophy, X } from 'lucide-react';
import { getStudentExamResults } from '../../../common/services/api';
import { Button, Card, EmptyState, StatusChip } from '../../../common/ui/primitives';
import { type } from '../../../common/ui/format';
import QuestionHtml from '../../../common/components/QuestionHtml';
import { ATTEMPT_LABELS, formatDateTime, isCoding, LANGUAGE_LABELS, TYPE_LABELS } from '../components/exam/examUtils';

const FILTERS = [
  { id: 'all', label: 'All' },
  { id: 'correct', label: 'Correct' },
  { id: 'wrong', label: 'Incorrect' },
  { id: 'skipped', label: 'Skipped' },
];

const outcomeOf = (q) => {
  if (!q.response) return 'skipped';
  if (q.response.isCorrect) return 'correct';
  return q.response.score > 0 ? 'partial' : 'wrong';
};

const OUTCOME = {
  correct: { icon: Check, tone: 'bg-ok-soft text-ok border-ok-line', label: 'Correct' },
  partial: { icon: Minus, tone: 'bg-warn-soft text-warn border-warn-line', label: 'Partly correct' },
  wrong: { icon: X, tone: 'bg-bad-soft text-bad border-bad-line', label: 'Incorrect' },
  skipped: { icon: Minus, tone: 'bg-inset text-muted border-line', label: 'Not answered' },
};

const durationText = (start, end) => {
  if (!start || !end) return '—';
  const minutes = Math.max(1, Math.round((new Date(end) - new Date(start)) / 60000));
  return minutes >= 60 ? `${Math.floor(minutes / 60)} h ${minutes % 60} min` : `${minutes} min`;
};

function OptionList({ q }) {
  const picked = new Set((Array.isArray(q.response?.answer) ? q.response.answer : [q.response?.answer]).filter((v) => v !== undefined && v !== null).map(Number));
  const correct = new Set(q.type === 'multipleCorrectMcq' ? q.correctOptions || [] : [q.correctOption]);
  return (
    <div className="space-y-1.5">
      {q.options.map((option, idx) => {
        const isPicked = picked.has(idx);
        const isRight = correct.has(idx);
        const tone = isRight ? 'border-ok-line bg-ok-soft' : isPicked ? 'border-bad-line bg-bad-soft' : 'border-line bg-surface';
        return (
          <div key={idx} className={`flex items-start gap-2.5 rounded-xl border px-3 py-2 ${tone}`}>
            <span className="text-[11px] font-bold text-muted mt-0.5 w-4">{String.fromCharCode(65 + idx)}</span>
            <QuestionHtml html={option} className="text-xs text-fg flex-1 min-w-0" />
            {isPicked && <span className="text-[10px] font-bold uppercase text-muted shrink-0">Your answer</span>}
            {isRight && <Check className="w-3.5 h-3.5 text-ok shrink-0" />}
          </div>
        );
      })}
    </div>
  );
}

function QuestionResult({ q, number }) {
  const [open, setOpen] = useState(false);
  const outcome = OUTCOME[outcomeOf(q)];
  const Icon = outcome.icon;
  const coding = isCoding(q);
  return (
    <div className="border-b border-line last:border-b-0">
      <button type="button" onClick={() => setOpen((v) => !v)} className="w-full flex items-center gap-3 px-4 py-3 text-left hover:bg-hover" aria-expanded={open}>
        <span className={`h-7 w-7 rounded-lg border flex items-center justify-center shrink-0 ${outcome.tone}`}>
          <Icon className="w-3.5 h-3.5" />
        </span>
        <div className="min-w-0 flex-1">
          <p className="text-sm font-semibold text-fg truncate">
            {number}. <span dangerouslySetInnerHTML={{ __html: q.title }} />
          </p>
          <p className={type.meta}>
            {TYPE_LABELS[q.type] || q.type}
            {q.section ? ` · ${q.section}` : ''}
            {coding && q.response ? ` · ${q.response.passedTestCases}/${q.response.totalTestCases} tests` : ''}
          </p>
        </div>
        <span className="text-sm font-bold tabular-nums text-fg shrink-0">
          {q.response?.score ?? 0}
          <span className="text-muted font-normal">/{q.points}</span>
        </span>
      </button>
      {open && (
        <div className="px-4 pb-4 pl-14 space-y-3">
          <QuestionHtml html={q.description} className="text-xs text-body prose prose-sm max-w-none" />
          {(q.type === 'singleCorrectMcq' || q.type === 'multipleCorrectMcq') && <OptionList q={q} />}
          {q.type === 'fillInTheBlanks' && (
            <div className="grid sm:grid-cols-2 gap-2 text-xs">
              <div className="rounded-xl border border-line bg-inset p-3">
                <p className="text-[10px] font-bold uppercase text-muted mb-1">Your answer</p>
                <p className="text-fg whitespace-pre-wrap">{q.response?.answer || '—'}</p>
              </div>
              <div className="rounded-xl border border-ok-line bg-ok-soft p-3">
                <p className="text-[10px] font-bold uppercase text-muted mb-1">Correct answer</p>
                <p className="text-fg whitespace-pre-wrap">{q.correctAnswer || '—'}</p>
              </div>
            </div>
          )}
          {coding && (
            <div className="rounded-xl border border-line bg-inset overflow-hidden">
              <p className="px-3 py-1.5 border-b border-line text-[10px] font-bold uppercase text-muted">
                Your code {q.response?.language ? `· ${LANGUAGE_LABELS[q.response.language] || q.response.language}` : ''}
              </p>
              <pre className="p-3 text-xs font-mono text-fg whitespace-pre-wrap break-words max-h-80 overflow-auto">{q.response?.answer || 'No code submitted.'}</pre>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

const StudentExamResults = () => {
  const { examId } = useParams();
  const navigate = useNavigate();
  const [data, setData] = useState(null);
  const [error, setError] = useState('');
  const [filter, setFilter] = useState('all');

  useEffect(() => {
    let cancelled = false;
    getStudentExamResults(examId)
      .then((res) => !cancelled && setData(res.data))
      .catch((err) => !cancelled && setError(typeof err === 'string' ? err : 'Failed to load results'));
    return () => {
      cancelled = true;
    };
  }, [examId]);

  const questions = useMemo(() => data?.questions || [], [data]);
  const counts = useMemo(() => {
    const c = { all: questions.length, correct: 0, wrong: 0, skipped: 0 };
    questions.forEach((q) => {
      const o = outcomeOf(q);
      if (o === 'correct') c.correct += 1;
      else if (o === 'skipped') c.skipped += 1;
      else c.wrong += 1;
    });
    return c;
  }, [questions]);
  const shown = questions
    .map((q, i) => ({ q, number: i + 1 }))
    .filter(({ q }) => {
      const o = outcomeOf(q);
      if (filter === 'all') return true;
      if (filter === 'wrong') return o === 'wrong' || o === 'partial';
      return o === filter;
    });

  const back = () => navigate('/student/exams');

  if (error) {
    return (
      <div className="px-4 sm:px-5 py-6">
        <EmptyState icon={Trophy} title="Results unavailable" message={error} action={<Button variant="secondary" onClick={back}>Back to exams</Button>} />
      </div>
    );
  }

  if (!data) {
    return (
      <div className="px-4 sm:px-5 py-6 max-w-3xl mx-auto space-y-3">
        {[0, 1, 2].map((i) => (
          <div key={i} className="h-24 rounded-2xl bg-hover animate-pulse" />
        ))}
      </div>
    );
  }

  const { exam, attempt, released } = data;
  const percent = released && attempt.maxScore ? Math.round((attempt.totalScore / attempt.maxScore) * 100) : null;

  return (
    <div className="px-4 sm:px-5 py-6">
      <div className="max-w-3xl mx-auto space-y-4">
        <div className="flex items-center gap-2">
          <Button variant="ghost" icon={ArrowLeft} className="h-9 w-9 justify-center p-0!" onClick={back} aria-label="Back to exams" title="Back to exams" />
          <div className="min-w-0">
            <h1 className={`${type.pageTitle} truncate`}>{exam.title}</h1>
            {exam.className && <p className={type.meta}>{exam.className}</p>}
          </div>
          <StatusChip kind={attempt.status === 'terminated' ? 'fail' : 'pass'} className="ml-auto">
            {ATTEMPT_LABELS[attempt.status] || attempt.status}
          </StatusChip>
        </div>

        <Card className="flex flex-wrap items-center gap-5">
          {released ? (
            <div className="flex items-center gap-4">
              <div
                className="h-20 w-20 rounded-full grid place-items-center"
                style={{ background: `conic-gradient(var(--accent) ${percent * 3.6}deg, var(--border) 0deg)` }}
              >
                <div className="h-16 w-16 rounded-full bg-surface grid place-items-center">
                  <span className="text-lg font-bold text-fg tabular-nums">{percent}%</span>
                </div>
              </div>
              <div>
                <p className="text-2xl font-bold text-fg tabular-nums">
                  {attempt.totalScore}
                  <span className="text-base text-muted font-semibold">/{attempt.maxScore}</span>
                </p>
                <p className={type.body}>points scored</p>
              </div>
            </div>
          ) : (
            <div className="flex items-center gap-3">
              <span className="h-12 w-12 rounded-xl border border-info-line bg-info-soft grid place-items-center">
                <Hourglass className="w-5 h-5 text-info" />
              </span>
              <div>
                <p className={type.cardTitle}>Your exam is submitted</p>
                <p className={type.body}>Scores appear here once your instructor releases them.</p>
              </div>
            </div>
          )}
          <div className="sm:ml-auto grid grid-cols-2 gap-x-6 gap-y-1 text-xs">
            <span className="text-muted flex items-center gap-1.5">
              <CheckCircle2 className="w-3.5 h-3.5" /> Submitted
            </span>
            <span className="text-fg">{formatDateTime(attempt.submittedAt)}</span>
            <span className="text-muted flex items-center gap-1.5">
              <Clock className="w-3.5 h-3.5" /> Time taken
            </span>
            <span className="text-fg">{durationText(attempt.startedAt, attempt.submittedAt)}</span>
            <span className="text-muted">Answered</span>
            <span className="text-fg">
              {attempt.answeredCount}/{exam.questionCount}
            </span>
          </div>
          {attempt.remark && <p className="w-full text-xs text-muted">{attempt.remark}</p>}
        </Card>

        {released && (
          <Card className="p-0! overflow-hidden">
            <div className="flex flex-wrap items-center gap-2 px-4 py-3 border-b border-line bg-inset">
              <h2 className={type.section}>Question breakdown</h2>
              <div className="ml-auto flex h-8 rounded-xl border border-line bg-surface p-0.5" role="tablist">
                {FILTERS.map((f) => (
                  <button
                    key={f.id}
                    type="button"
                    role="tab"
                    aria-selected={filter === f.id}
                    onClick={() => setFilter(f.id)}
                    className={`px-2.5 rounded-lg text-[11px] font-semibold ${filter === f.id ? 'bg-hover text-fg' : 'text-muted hover:text-fg'}`}
                  >
                    {f.label} <span className="text-subtle font-normal">{counts[f.id]}</span>
                  </button>
                ))}
              </div>
            </div>
            {shown.length ? (
              shown.map(({ q, number }) => <QuestionResult key={String(q.questionId)} q={q} number={number} />)
            ) : (
              <p className="px-4 py-6 text-center text-xs text-muted">No questions in this group.</p>
            )}
          </Card>
        )}
      </div>
    </div>
  );
};

export default StudentExamResults;
