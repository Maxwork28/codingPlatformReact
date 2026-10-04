import React from 'react';
import { CheckCircle2, Circle, MinusCircle, UserRound, XCircle } from 'lucide-react';
import Modal from '../../../../common/ui/Modal';
import { Button, StatusChip } from '../../../../common/ui/primitives';
import { type } from '../../../../common/ui/format';
import { ATTEMPT_STATUS, VIOLATION_LABELS, answerKey, formatDuration, formatTime, percentOf } from './reportUtils';

const CHOICE = new Set(['singleCorrectMcq', 'multipleCorrectMcq']);
const letter = (i) => String.fromCharCode(65 + i);

function ChoiceAnswer({ question, answer }) {
  const picked = new Set((Array.isArray(answer) ? answer : [answer]).map(Number));
  const correct = new Set(question.type === 'singleCorrectMcq' ? [question.correctOption] : question.correctOptions || []);
  return (
    <ul className="space-y-1">
      {question.options.map((text, i) => {
        const isPicked = picked.has(i);
        const isCorrect = correct.has(i);
        if (!isPicked && !isCorrect) return null;
        return (
          <li key={i} className={`flex items-start gap-2 text-xs ${isPicked ? 'text-fg' : 'text-muted'}`}>
            <span className="font-semibold w-4 shrink-0">{letter(i)}.</span>
            <span className="flex-1 min-w-0 break-words">{text}</span>
            {isPicked && <span className={`text-[10px] font-bold uppercase ${isCorrect ? 'text-ok' : 'text-bad'}`}>picked</span>}
            {!isPicked && isCorrect && <span className="text-[10px] font-bold uppercase text-ok">correct</span>}
          </li>
        );
      })}
    </ul>
  );
}

function AnswerBody({ question, answer }) {
  if (!answer || answer.answer == null || answer.answer === '') return <p className="text-xs text-subtle">Not answered</p>;
  if (CHOICE.has(question.type) && question.options?.length) return <ChoiceAnswer question={question} answer={answer.answer} />;
  if (question.type === 'fillInTheBlanks') {
    return (
      <p className="text-xs text-fg">
        {String(answer.answer)}
        {!answer.isCorrect && question.correctAnswer && <span className="text-muted"> · expected “{question.correctAnswer}”</span>}
      </p>
    );
  }
  return (
    <div className="space-y-1.5">
      <p className={type.meta}>
        {answer.language || 'code'}
        {answer.totalTestCases ? ` · ${answer.passedTestCases || 0}/${answer.totalTestCases} tests passed` : ''}
      </p>
      <pre className="max-h-64 overflow-auto rounded-xl bg-inset border border-line p-3 text-[11px] leading-relaxed text-body font-mono whitespace-pre">
        {String(answer.answer)}
      </pre>
    </div>
  );
}

export default function AttemptDetailModal({ attempt, questions, onClose, released }) {
  const byQuestion = new Map((attempt.answers || []).map((a) => [answerKey(a.questionId), a]));
  const st = ATTEMPT_STATUS[attempt.status] || ATTEMPT_STATUS.in_progress;
  const pct = percentOf(attempt);
  const counts = [
    ['Tab switches', attempt.tabSwitchCount],
    ['Fullscreen exits', attempt.fullscreenExitCount],
    ['Copy / paste', attempt.copyPasteCount],
    ['Connection drops', attempt.networkDropCount],
  ];

  return (
    <Modal
      open
      onClose={onClose}
      title={attempt.student?.name || 'Unknown student'}
      icon={UserRound}
      width="max-w-3xl"
      footer={
        <Button variant="secondary" onClick={onClose}>
          Close
        </Button>
      }
    >
      <div className="flex flex-wrap items-center gap-x-4 gap-y-2 -mt-2">
        <StatusChip kind={st.kind}>{st.label}</StatusChip>
        {attempt.student?.email && <span className={type.meta}>{attempt.student.email}</span>}
        <span className={type.meta}>Started {formatTime(attempt.startedAt)}</span>
        {attempt.submittedAt && (
          <span className={type.meta}>
            Submitted {formatTime(attempt.submittedAt)} · took {formatDuration(new Date(attempt.submittedAt) - new Date(attempt.startedAt))}
          </span>
        )}
        <span className="ml-auto text-sm font-bold text-fg tabular-nums">
          {attempt.totalScore ?? 0}/{attempt.maxScore ?? 0}
          {pct != null && <span className="text-muted font-semibold"> · {pct}%</span>}
        </span>
      </div>
      {attempt.remark && <p className="text-xs text-muted -mt-3">{attempt.remark}</p>}
      {!released && attempt.status !== 'in_progress' && <p className={`${type.meta} -mt-3`}>Students cannot see these scores until you release them.</p>}

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
        {counts.map(([label, n]) => (
          <div key={label} className={`rounded-xl border px-3 py-2 ${n ? 'border-warn-line bg-warn-soft' : 'border-line bg-inset'}`}>
            <p className="text-[10px] font-bold uppercase tracking-wider text-muted">{label}</p>
            <p className={`text-sm font-bold tabular-nums ${n ? 'text-warn' : 'text-fg'}`}>{n || 0}</p>
          </div>
        ))}
      </div>

      <section className="space-y-2">
        <h3 className={type.section}>Answers</h3>
        <ol className="rounded-xl border border-line divide-y divide-line">
          {questions.map((q, i) => {
            const answer = byQuestion.get(answerKey(q.questionId));
            const answered = answer && answer.answer != null && answer.answer !== '';
            const Icon = !answered ? Circle : answer.isCorrect ? CheckCircle2 : (answer.score || 0) > 0 ? MinusCircle : XCircle;
            const tone = !answered ? 'text-subtle' : answer.isCorrect ? 'text-ok' : (answer.score || 0) > 0 ? 'text-warn' : 'text-bad';
            return (
              <li key={answerKey(q.questionId)} className="px-3 py-3 space-y-2">
                <div className="flex items-start gap-2">
                  <Icon className={`w-4 h-4 shrink-0 mt-0.5 ${tone}`} />
                  <p className="flex-1 min-w-0 text-sm font-medium text-fg">
                    <span className="text-muted">{i + 1}.</span> {q.title}
                  </p>
                  <span className="text-xs font-semibold tabular-nums text-body shrink-0">
                    {answer?.score ?? 0}/{q.points}
                  </span>
                </div>
                <div className="pl-6">
                  <AnswerBody question={q} answer={answer} />
                  {answer?.savedAt && <p className={`${type.meta} mt-1`}>Saved {formatTime(answer.savedAt)}</p>}
                </div>
              </li>
            );
          })}
        </ol>
      </section>

      {attempt.violations?.length > 0 && (
        <section className="space-y-2">
          <h3 className={type.section}>Proctoring log</h3>
          <ul className="rounded-xl border border-line divide-y divide-line">
            {[...attempt.violations].reverse().map((v, i) => (
              <li key={`${v.timestamp}-${i}`} className="flex items-center gap-3 px-3 py-2 text-xs">
                <span className="text-muted tabular-nums w-20 shrink-0">{formatTime(v.timestamp, true)}</span>
                <span className="text-fg font-medium">{VIOLATION_LABELS[v.type] || v.type}</span>
                {v.details?.reason && <span className="text-muted truncate">{v.details.reason}</span>}
              </li>
            ))}
          </ul>
        </section>
      )}
    </Modal>
  );
}
