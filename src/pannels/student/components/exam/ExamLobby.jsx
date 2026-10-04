import React, { useState } from 'react';
import {
  ArrowLeft,
  CalendarClock,
  CheckCircle2,
  Clock,
  Layers,
  ListChecks,
  Lock,
  Play,
  RotateCcw,
  ShieldCheck,
  Trophy,
} from 'lucide-react';
import { Button, Card, StatusChip } from '../../../../common/ui/primitives';
import { type } from '../../../../common/ui/format';
import { ATTEMPT_LABELS, formatClock, formatDateTime, formatMinutes, isClosedAttempt } from './examUtils';

function Fact({ icon, label, value }) {
  const Icon = icon;
  return (
    <div className="flex items-center gap-2.5 rounded-xl border border-line bg-inset px-3 py-2.5">
      <Icon className="w-4 h-4 text-muted shrink-0" />
      <div className="min-w-0">
        <p className="text-[10px] font-bold uppercase tracking-wider text-muted">{label}</p>
        <p className="text-sm font-semibold text-fg truncate">{value}</p>
      </div>
    </div>
  );
}

const rulesFor = (exam) => {
  const p = exam.proctoring || {};
  return [
    `You have ${formatMinutes(p.durationMinutes)} once you start. The timer keeps running if you leave the page.`,
    p.endTime && `The exam closes at ${formatDateTime(p.endTime)}, even if your own time has not run out.`,
    (exam.sections || []).some((s) => s.durationSeconds) && 'Some sections have their own time limit. When it runs out, those answers are locked.',
    'Choice and text answers save automatically. Coding answers are saved when you press Submit code.',
    'You can change any saved answer until you submit the exam. Your last saved answer is the one that counts.',
    p.fullscreenRequired && 'The exam runs in fullscreen. Leaving fullscreen is recorded.',
    p.tabSwitchLimit > 0
      ? `Switching tabs or windows is recorded. After ${p.tabSwitchLimit} switches the exam is locked and submitted.`
      : 'Switching tabs or windows is recorded.',
    p.copyPasteDisabled && 'Copy and paste are turned off.',
    p.allowRunCode === false && 'Running code is turned off. Your code is only checked when you submit it.',
    p.autoSubmitOnEnd !== false && 'When time runs out, everything you have saved is submitted automatically.',
  ].filter(Boolean);
};

export default function ExamLobby({ exam, attempt, nowMs, starting, error, onStart, onBack, onResults }) {
  const [agreed, setAgreed] = useState(false);
  const p = exam.proctoring || {};
  const closedAttempt = isClosedAttempt(attempt);
  const inProgress = attempt?.status === 'in_progress';
  const opensInMs = exam.phase === 'scheduled' && p.startTime ? new Date(p.startTime).getTime() - nowMs : 0;
  const leftMs = inProgress && attempt.endsAt ? new Date(attempt.endsAt).getTime() - nowMs : 0;
  const sectionCount = exam.sections?.length || 1;

  let action;
  if (closedAttempt) {
    action = (
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <CheckCircle2 className="w-5 h-5 text-ok" />
          <div>
            <p className={type.cardTitle}>{ATTEMPT_LABELS[attempt.status] || 'Submitted'}</p>
            <p className={type.meta}>{formatDateTime(attempt.submittedAt)}</p>
          </div>
        </div>
        <Button icon={Trophy} onClick={onResults}>
          {exam.released ? 'View results' : 'View submission'}
        </Button>
      </div>
    );
  } else if (inProgress) {
    action = (
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className={type.cardTitle}>You have an attempt in progress</p>
          <p className={type.body}>{formatClock(leftMs / 1000)} left on your clock.</p>
        </div>
        <Button icon={RotateCcw} onClick={onStart} disabled={starting}>
          {starting ? 'Opening…' : 'Resume exam'}
        </Button>
      </div>
    );
  } else if (exam.phase === 'scheduled') {
    action = (
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className={type.cardTitle}>Opens {formatDateTime(p.startTime)}</p>
          <p className={type.body}>{opensInMs > 0 ? `in ${formatClock(opensInMs / 1000)}` : 'any moment now'}</p>
        </div>
        <Button icon={Lock} disabled>
          Not open yet
        </Button>
      </div>
    );
  } else if (exam.phase !== 'live') {
    action = (
      <div className="flex items-center gap-2">
        <Lock className="w-4 h-4 text-muted" />
        <p className={type.body}>This exam has closed and you did not take it.</p>
      </div>
    );
  } else {
    action = (
      <div className="space-y-3">
        <label className="flex items-start gap-2.5 cursor-pointer select-none">
          <input
            type="checkbox"
            checked={agreed}
            onChange={(e) => setAgreed(e.target.checked)}
            className="mt-0.5 h-4 w-4 accent-[var(--accent)]"
          />
          <span className="text-xs text-body">I have read the instructions. I understand the timer starts as soon as I begin.</span>
        </label>
        <div className="flex justify-end">
          <Button icon={Play} onClick={onStart} disabled={!agreed || starting}>
            {starting ? 'Starting…' : 'Start exam'}
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-full px-4 sm:px-5 py-6">
      <div className="max-w-3xl mx-auto space-y-4">
        <div className="flex items-center gap-2">
          <Button
            variant="ghost"
            icon={ArrowLeft}
            className="h-9 w-9 justify-center p-0!"
            onClick={onBack}
            aria-label="Back to exams"
            title="Back to exams"
          />
          <div className="min-w-0">
            <h1 className={`${type.pageTitle} truncate`}>{exam.title}</h1>
            {exam.className && <p className={type.meta}>{exam.className}</p>}
          </div>
          <StatusChip kind={exam.phase === 'live' ? 'pass' : exam.phase === 'scheduled' ? 'info' : 'neutral'} className="ml-auto">
            {exam.phase === 'live' ? 'Open' : exam.phase === 'scheduled' ? 'Upcoming' : 'Closed'}
          </StatusChip>
        </div>

        <Card className="space-y-4">
          {exam.description && <p className="text-sm text-body whitespace-pre-line">{exam.description}</p>}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
            <Fact icon={Clock} label="Duration" value={formatMinutes(p.durationMinutes)} />
            <Fact
              icon={ListChecks}
              label="Questions"
              value={`${exam.questionCount}${exam.totalPoints ? ` · ${exam.totalPoints} pts` : ''}`}
            />
            <Fact icon={Layers} label="Sections" value={sectionCount} />
            <Fact
              icon={CalendarClock}
              label="Window"
              value={p.endTime ? `until ${formatDateTime(p.endTime)}` : p.startTime ? `from ${formatDateTime(p.startTime)}` : 'Open'}
            />
          </div>
        </Card>

        <Card className="space-y-3">
          <div className="flex items-center gap-2">
            <ShieldCheck className="w-4 h-4 text-accent-ink" />
            <h2 className={type.section}>Before you begin</h2>
          </div>
          <ul className="space-y-2">
            {rulesFor(exam).map((rule) => (
              <li key={rule} className="flex gap-2 text-xs text-body">
                <span className="mt-1.5 h-1.5 w-1.5 rounded-full bg-accent shrink-0" />
                {rule}
              </li>
            ))}
          </ul>
          {exam.sections?.length > 1 && (
            <div className="rounded-xl border border-line divide-y divide-line">
              {exam.sections.map((s) => (
                <div key={s.sectionId} className="flex items-center justify-between gap-3 px-3 py-2">
                  <span className="text-xs font-semibold text-fg truncate">{s.title}</span>
                  <span className={type.meta}>
                    {exam.questions.filter((q) => q.sectionId === s.sectionId).length} questions
                    {s.durationSeconds ? ` · ${formatMinutes(Math.round(s.durationSeconds / 60))}` : ''}
                  </span>
                </div>
              ))}
            </div>
          )}
        </Card>

        <Card>
          {action}
          {error && <p className="mt-3 text-xs text-bad">{error}</p>}
        </Card>
      </div>
    </div>
  );
}
