import React, { useState } from 'react';
import {
  AlertTriangle,
  Check,
  ChevronLeft,
  ChevronRight,
  Flag,
  Loader2,
  Lock,
  Play,
  RotateCcw,
  Send,
  Terminal,
  Timer,
} from 'lucide-react';
import CodeEditor from '../CodeEditor';
import TestCaseResultsList from '../TestCaseResultsList';
import QuestionHtml from '../../../../common/components/QuestionHtml';
import CodingQuestionDetails from '../../../../common/components/CodingQuestionDetails';
import { Button, StatusChip } from '../../../../common/ui/primitives';
import { confirmAction } from '../../../../common/ui/Toast';
import { formatClock, isCoding, LANGUAGE_LABELS, starterFor, TYPE_LABELS } from './examUtils';

const DIFFICULTY_KIND = { easy: 'pass', medium: 'warning', hard: 'fail' };
const letter = (i) => String.fromCharCode(65 + i);

function SaveStatus({ coding, dirty, save }) {
  if (save?.saving) {
    return (
      <span className="flex items-center gap-1.5 text-xs text-muted">
        <Loader2 className="w-3.5 h-3.5 animate-spin" />
        {coding ? 'Checking your code…' : 'Saving…'}
      </span>
    );
  }
  if (save?.error) {
    return (
      <span className="flex items-center gap-1.5 text-xs text-bad">
        <AlertTriangle className="w-3.5 h-3.5" />
        {save.error}
      </span>
    );
  }
  if (dirty) {
    return <span className="text-xs text-warn">{coding ? 'Changes not submitted' : 'Not saved yet'}</span>;
  }
  if (save?.savedAt) {
    return (
      <span className="flex items-center gap-1.5 text-xs text-ok">
        <Check className="w-3.5 h-3.5" />
        Saved {new Date(save.savedAt).toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' })}
      </span>
    );
  }
  return null;
}

function Statement({ question, number, total, sectionTitle, remaining, locked, lockReason }) {
  return (
    <div className="space-y-4">
      <div className="space-y-2">
        <div className="flex flex-wrap items-center gap-2 text-[11px] text-muted">
          <span className="font-semibold text-body">
            Question {number} of {total}
          </span>
          {sectionTitle && <span>· {sectionTitle}</span>}
          {remaining != null && (
            <span className={`ml-auto flex items-center gap-1 font-semibold tabular-nums ${remaining < 30 ? 'text-bad' : 'text-muted'}`}>
              <Timer className="w-3.5 h-3.5" />
              {formatClock(remaining)}
            </span>
          )}
        </div>
        <h2 className="text-lg font-bold text-fg leading-snug" dangerouslySetInnerHTML={{ __html: question.title }} />
        <div className="flex flex-wrap items-center gap-1.5">
          <StatusChip kind="neutral">{TYPE_LABELS[question.type] || question.type}</StatusChip>
          {question.difficulty && <StatusChip kind={DIFFICULTY_KIND[question.difficulty] || 'neutral'}>{question.difficulty}</StatusChip>}
          {question.points != null && <StatusChip kind="ai">{question.points} pts</StatusChip>}
        </div>
      </div>
      {locked && (
        <div className="flex items-center gap-2 rounded-xl border border-bad-line bg-bad-soft px-3 py-2 text-xs text-bad">
          <Lock className="w-3.5 h-3.5 shrink-0" />
          {lockReason}
        </div>
      )}
      <QuestionHtml html={question.description} className="text-sm text-body leading-relaxed prose prose-sm max-w-none" />
      {isCoding(question) && <CodingQuestionDetails question={question} tone="statement" publicTests={question.testCases} />}
    </div>
  );
}

function ChoiceAnswer({ question, draft, disabled, onChange }) {
  const multi = question.type === 'multipleCorrectMcq';
  const selected = multi ? draft.answer || [] : draft.answer;
  const toggle = (idx) => {
    if (disabled) return;
    if (!multi) return onChange({ ...draft, answer: idx });
    const next = selected.includes(idx) ? selected.filter((i) => i !== idx) : [...selected, idx].sort((a, b) => a - b);
    return onChange({ ...draft, answer: next });
  };

  return (
    <fieldset className="space-y-2" disabled={disabled}>
      <legend className="mb-2 text-xs font-semibold text-muted">{multi ? 'Select all that apply' : 'Select one answer'}</legend>
      {(question.options || []).map((option, idx) => {
        const on = multi ? selected.includes(idx) : selected === idx;
        return (
          <button
            key={idx}
            type="button"
            role={multi ? 'checkbox' : 'radio'}
            aria-checked={on}
            onClick={() => toggle(idx)}
            disabled={disabled}
            className={`w-full flex items-start gap-3 rounded-xl border px-4 py-3 text-left transition disabled:cursor-not-allowed ${
              on ? 'border-accent bg-accent-soft' : 'border-line bg-surface hover:border-line-strong'
            }`}
          >
            <span
              className={`mt-0.5 h-6 w-6 shrink-0 flex items-center justify-center text-[11px] font-bold border ${
                multi ? 'rounded-md' : 'rounded-full'
              } ${on ? 'bg-accent border-accent text-on-accent' : 'border-line-strong text-muted'}`}
            >
              {on && multi ? <Check className="w-3.5 h-3.5" /> : letter(idx)}
            </span>
            <QuestionHtml html={option} className="text-sm text-fg min-w-0 break-words" />
          </button>
        );
      })}
    </fieldset>
  );
}

function CodingWorkspace({ question, draft, disabled, onChange, copyPasteDisabled, allowRun, onRun, running, runResult, save }) {
  const [tab, setTab] = useState('results');
  const [customInput, setCustomInput] = useState('');
  const [expected, setExpected] = useState('');
  const language = draft.language;
  const tabRun = runResult && Boolean(runResult.custom) === (tab === 'custom') ? runResult : null;
  const showSubmitted = tab === 'results' && !tabRun && Boolean(save?.result);
  const shownTests = tabRun?.testResults || (showSubmitted ? save.result.testResults : null);

  const changeLanguage = (next) => {
    const code = { ...draft.code, [language]: draft.answer };
    onChange({ ...draft, language: next, code, answer: code[next] ?? starterFor(question, next) });
  };
  const resetCode = async () => {
    const ok = await confirmAction('Replace your code with the starter code? Your current code for this language will be lost.', {
      title: 'Reset code',
      confirmLabel: 'Reset',
      danger: true,
    });
    if (ok) onChange({ ...draft, answer: starterFor(question, language), code: { ...draft.code, [language]: starterFor(question, language) } });
  };

  return (
    <div className="h-full min-h-0 flex flex-col">
      <div className="shrink-0 flex items-center gap-2 px-3 h-11 border-b border-line bg-inset">
        <select
          value={language}
          onChange={(e) => changeLanguage(e.target.value)}
          disabled={disabled}
          className="h-8 bg-surface border border-line rounded-lg px-2 text-xs text-fg outline-none focus:border-accent"
          aria-label="Language"
        >
          {(question.languages || []).map((lang) => (
            <option key={lang} value={lang}>
              {LANGUAGE_LABELS[lang] || lang}
            </option>
          ))}
        </select>
        <Button variant="ghost" icon={RotateCcw} onClick={resetCode} disabled={disabled} className="ml-auto">
          Reset
        </Button>
      </div>

      <div className="flex-1 min-h-[220px]">
        <CodeEditor
          key={`${question._id}-${language}`}
          value={draft.answer}
          onChange={(code) => onChange({ ...draft, answer: code })}
          defaultValue={starterFor(question, language)}
          language={language}
          height="100%"
          disabled={disabled}
          isFillInTheBlanks={question.type === 'fillInTheBlanksCoding'}
          copyPasteDisabled={copyPasteDisabled}
        />
      </div>

      <div className="shrink-0 h-[38%] min-h-[160px] flex flex-col border-t border-line bg-surface">
        <div className="shrink-0 flex items-center gap-1 px-2 h-10 border-b border-line">
          {[
            ['results', 'Test results'],
            ['custom', 'Custom input'],
          ].map(([id, label]) => (
            <button
              key={id}
              type="button"
              onClick={() => setTab(id)}
              className={`px-3 h-7 rounded-lg text-xs font-semibold ${tab === id ? 'bg-hover text-fg' : 'text-muted hover:text-fg'}`}
            >
              {label}
            </button>
          ))}
          {allowRun && (
            <Button
              variant="secondary"
              icon={running ? Loader2 : Play}
              className={`ml-auto h-7 ${running ? '[&>svg]:animate-spin' : ''}`}
              disabled={disabled || running}
              onClick={() => onRun(tab === 'custom' ? { customInput, expectedOutput: expected } : {})}
            >
              {tab === 'custom' ? 'Run with input' : 'Run samples'}
            </Button>
          )}
        </div>
        <div className="flex-1 min-h-0 overflow-y-auto p-3 space-y-3">
          {tab === 'custom' && (
            <div className="grid sm:grid-cols-2 gap-2">
              <label className="space-y-1">
                <span className="text-[11px] font-semibold text-muted">Input</span>
                <textarea
                  value={customInput}
                  onChange={(e) => setCustomInput(e.target.value)}
                  rows={3}
                  className="w-full bg-inset border border-line rounded-lg px-2.5 py-2 font-mono text-xs text-fg outline-none focus:border-accent"
                />
              </label>
              <label className="space-y-1">
                <span className="text-[11px] font-semibold text-muted">Expected output (optional)</span>
                <textarea
                  value={expected}
                  onChange={(e) => setExpected(e.target.value)}
                  rows={3}
                  className="w-full bg-inset border border-line rounded-lg px-2.5 py-2 font-mono text-xs text-fg outline-none focus:border-accent"
                />
              </label>
            </div>
          )}
          {tabRun?.error && <p className="text-xs text-bad">{tabRun.error}</p>}
          {showSubmitted && (
            <p className={`text-xs font-semibold ${save.result.passedTestCases === save.result.totalTestCases ? 'text-ok' : 'text-warn'}`}>
              Submitted: {save.result.passedTestCases}/{save.result.totalTestCases} tests passed
            </p>
          )}
          {showSubmitted && save.result.executionError && <p className="text-xs text-bad">{save.result.executionError}</p>}
          {shownTests?.length ? (
            <TestCaseResultsList results={shownTests} />
          ) : (
            !tabRun?.error &&
            !showSubmitted && (
              <p className="flex items-center gap-2 text-xs text-subtle">
                <Terminal className="w-3.5 h-3.5" />
                {tab === 'custom'
                  ? 'Enter input and run your code to see its output.'
                  : allowRun
                    ? 'Run the sample tests to check your code, then submit it.'
                    : 'Running code is off for this exam. Submit your code to have it checked.'}
              </p>
            )
          )}
        </div>
      </div>
    </div>
  );
}

export default function ExamQuestionView({
  question,
  number,
  total,
  sectionTitle,
  remaining,
  draft,
  dirty,
  save,
  locked,
  lockReason,
  flagged,
  onToggleFlag,
  onChange,
  onSave,
  onRun,
  running,
  runResult,
  allowRun,
  copyPasteDisabled,
  onPrev,
  onNext,
  hasPrev,
  hasNext,
}) {
  const coding = isCoding(question);
  const statement = (
    <Statement
      question={question}
      number={number}
      total={total}
      sectionTitle={sectionTitle}
      remaining={remaining}
      locked={locked}
      lockReason={lockReason}
    />
  );

  return (
    <div className="h-full min-h-0 flex flex-col">
      {coding ? (
        <div className="flex-1 min-h-0 grid lg:grid-cols-[minmax(0,5fr)_minmax(0,7fr)]">
          <div className="min-h-0 overflow-y-auto px-5 py-5 border-b lg:border-b-0 lg:border-r border-line">{statement}</div>
          <div className="min-h-[520px] lg:min-h-0">
            <CodingWorkspace
              question={question}
              draft={draft}
              disabled={locked}
              onChange={onChange}
              copyPasteDisabled={copyPasteDisabled}
              allowRun={allowRun}
              onRun={onRun}
              running={running}
              runResult={runResult}
              save={save}
            />
          </div>
        </div>
      ) : (
        <div className="flex-1 min-h-0 overflow-y-auto">
          <div className="max-w-3xl mx-auto px-5 py-6 space-y-6">
            {statement}
            {question.type === 'fillInTheBlanks' ? (
              <label className="block space-y-1.5">
                <span className="text-xs font-semibold text-muted">Your answer</span>
                <textarea
                  value={draft.answer || ''}
                  onChange={(e) => onChange({ ...draft, answer: e.target.value })}
                  disabled={locked}
                  rows={3}
                  placeholder="Type your answer"
                  className="w-full bg-inset border border-line rounded-xl px-3.5 py-2.5 text-sm text-fg outline-none focus:border-accent disabled:opacity-60"
                />
              </label>
            ) : (
              <ChoiceAnswer question={question} draft={draft} disabled={locked} onChange={onChange} />
            )}
          </div>
        </div>
      )}

      <div className="shrink-0 flex flex-wrap items-center gap-2 px-4 py-2.5 border-t border-line bg-inset">
        <Button variant="secondary" icon={ChevronLeft} onClick={onPrev} disabled={!hasPrev}>
          Previous
        </Button>
        <Button
          variant={flagged ? 'soft' : 'ghost'}
          icon={Flag}
          onClick={onToggleFlag}
          aria-pressed={flagged}
          title="Flag this question to come back to it"
        >
          {flagged ? 'Flagged' : 'Flag'}
        </Button>
        <div className="flex-1 min-w-0 flex justify-center">
          <SaveStatus coding={coding} dirty={dirty} save={save} />
        </div>
        {coding && (
          <Button variant="publish" icon={save?.saving ? Loader2 : Send} onClick={onSave} disabled={locked || save?.saving} className={save?.saving ? '[&>svg]:animate-spin' : ''}>
            Submit code
          </Button>
        )}
        <Button icon={ChevronRight} onClick={onNext} disabled={!hasNext} className="flex-row-reverse">
          Next
        </Button>
      </div>
    </div>
  );
}
