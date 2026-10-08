import React from 'react';
import parse from 'html-react-parser';
import { Clock, Copy, Maximize2, RotateCcw, X } from 'lucide-react';
import CodeEditor from '../../components/CodeEditor';
import QuestionHtml from '../../../../common/components/QuestionHtml';
import CodingQuestionDetails from '../../../../common/components/CodingQuestionDetails';
import { isCodingType } from '../../../../common/domain/questions';
import { historyKindLabel } from '../../../../common/utils/runOutputHistory';
import { htmlToPlainText, sanitizeHtml } from '../../../../common/utils/sanitizeHtml';
import { Button, EmptyState, StatusChip } from '../../../../common/ui/primitives';
import { inputClass, type } from '../../../../common/ui/format';
import {
  FULL_CODE_EDITOR_TYPES,
  QUESTION_TYPE_LABELS,
  RUNNABLE_CODING_TYPES,
  availableLanguages,
  difficultyKind,
  getCodeTemplateForLanguage,
  stripHtml,
} from './helpers';

function OptionList({ options, type: questionType, selected, locked, onSingle, onToggle }) {
  return (
    <div className="space-y-2">
      {options?.map((option, index) => {
        const checked = questionType === 'multipleCorrectMcq' ? selected.includes(index) : selected === index;
        return (
          <label
            key={index}
            className={`flex items-start gap-3 p-3 rounded-xl border cursor-pointer ${
              checked ? 'border-accent-line bg-accent-soft' : 'border-line bg-surface'
            } ${locked ? 'opacity-70 cursor-not-allowed' : 'hover:bg-hover'}`}
          >
            <input
              type={questionType === 'multipleCorrectMcq' ? 'checkbox' : 'radio'}
              className="mt-1"
              checked={checked}
              disabled={locked}
              onChange={() => (questionType === 'multipleCorrectMcq' ? onToggle(index) : onSingle(index))}
            />
            <span className="text-xs font-semibold shrink-0 text-fg">{(index + 10).toString(36).toUpperCase()}.</span>
            <div className="text-xs text-body flex-1 min-w-0">{parse(sanitizeHtml(option || ''))}</div>
          </label>
        );
      })}
    </div>
  );
}

export default function PracticeWorkspace({
  selectedQuestion,
  selectedLanguage,
  onLanguageChange,
  code,
  onCodeChange,
  fillInBlankLine,
  onFillChange,
  mcqSingleIndex,
  mcqMultipleIndices,
  onMcqSingle,
  onMcqToggle,
  fillInBlanksAnswer,
  onFillBlanksChange,
  customInput,
  customOutput,
  onCustomInput,
  onCustomOutput,
  leftPanelWidth,
  editorHeight,
  isDragging,
  isDraggingVertical,
  onHorizontalDragStart,
  onVerticalDragStart,
  isFullscreen,
  onToggleFullscreen,
  locked,
  lockBanner,
  runBusy,
  questionRunHistory,
  onRun,
  onRunCustom,
  onSubmit,
  onReset,
  onCopy,
  onOpenHistory,
  submissionFeedback,
}) {
  if (!selectedQuestion) {
    return (
      <div className="flex-1 flex items-center justify-center bg-page p-6">
        <EmptyState title="Select a question" message="Pick a published question from the list to start practicing." />
      </div>
    );
  }

  const questionType = selectedQuestion.type;
  const isRunnable = RUNNABLE_CODING_TYPES.includes(questionType);
  const showFullEditor = FULL_CODE_EDITOR_TYPES.includes(questionType);
  const isFillCoding = questionType === 'fillInTheBlanksCoding';
  const langs = availableLanguages(selectedQuestion);
  const busy = Boolean(runBusy);

  return (
    <div id="student-workspace" className="flex-1 min-h-0 min-w-0 flex flex-col lg:flex-row overflow-hidden">
      <div className="min-h-0 min-w-0 overflow-y-auto p-4 sm:p-5 bg-page w-full lg:h-full" style={{ flex: `0 0 ${isRunnable ? leftPanelWidth : 100}%` }}>
        <div className="max-w-3xl">
          <h2 className="text-lg font-bold text-fg mb-3">{stripHtml(selectedQuestion.title) || 'Untitled question'}</h2>
          <div className="flex flex-wrap items-center gap-2 mb-5">
            <StatusChip kind={difficultyKind(selectedQuestion.difficulty)}>{selectedQuestion.difficulty || '—'}</StatusChip>
            <StatusChip kind="info">
              {selectedQuestion.maxPoints != null && selectedQuestion.maxPoints !== ''
                ? `${selectedQuestion.maxPoints} points`
                : 'No points'}
            </StatusChip>
            <StatusChip kind="neutral">{QUESTION_TYPE_LABELS[questionType] || questionType}</StatusChip>
          </div>
          {lockBanner && (
            <p className="mb-4 rounded-xl border border-warn-line bg-warn-soft px-3 py-2 text-xs text-fg" role="status">
              {lockBanner}
            </p>
          )}
          <h3 className={`${type.section} mb-2`}>Problem statement</h3>
          <QuestionHtml
            html={selectedQuestion.description}
            className="text-xs leading-relaxed text-body"
            empty={<span className="text-xs text-muted">—</span>}
          />
          {isCodingType(selectedQuestion.type) ? (
            <div className="mt-5">
              <CodingQuestionDetails question={selectedQuestion} tone="theme" publicTests={selectedQuestion.testCases} />
            </div>
          ) : selectedQuestion.constraints ? (
            <div className="mt-5">
              <h3 className={`${type.section} mb-2`}>Constraints</h3>
              <div className="text-xs leading-relaxed text-body" dangerouslySetInnerHTML={{ __html: sanitizeHtml(selectedQuestion.constraints) }} />
            </div>
          ) : null}

          {(questionType === 'singleCorrectMcq' || questionType === 'multipleCorrectMcq') && (
            <div className="mt-5 space-y-3">
              <h3 className={type.section}>{questionType === 'multipleCorrectMcq' ? 'Select all that apply' : 'Choose one option'}</h3>
              <OptionList
                options={selectedQuestion.options}
                type={questionType}
                selected={questionType === 'multipleCorrectMcq' ? mcqMultipleIndices : mcqSingleIndex}
                locked={locked || busy}
                onSingle={onMcqSingle}
                onToggle={onMcqToggle}
              />
              <div className="flex justify-end">
                <Button disabled={locked || busy} onClick={onSubmit}>
                  {runBusy === 'submit' ? 'Submitting…' : 'Submit answer'}
                </Button>
              </div>
            </div>
          )}

          {questionType === 'fillInTheBlanks' && (
            <div className="mt-5 space-y-3">
              <h3 className={type.section}>Your answer</h3>
              <textarea
                value={fillInBlanksAnswer}
                onChange={(e) => onFillBlanksChange(e.target.value)}
                disabled={locked || busy}
                rows={5}
                className={inputClass}
                placeholder="Type your answer"
              />
              <div className="flex justify-end">
                <Button disabled={locked || busy} onClick={onSubmit}>
                  {runBusy === 'submit' ? 'Submitting…' : 'Submit answer'}
                </Button>
              </div>
            </div>
          )}

          {submissionFeedback && !isRunnable && (
            <div className={`mt-4 rounded-xl border px-3 py-2 text-xs ${submissionFeedback.isCorrect ? 'border-ok-line bg-ok-soft text-ok' : 'border-bad-line bg-bad-soft text-bad'}`}>
              {submissionFeedback.isCorrect ? 'Correct' : 'Incorrect'}
              {submissionFeedback.explanation ? <p className="mt-1 text-fg whitespace-pre-wrap">{submissionFeedback.explanation}</p> : null}
            </div>
          )}
        </div>
      </div>

      {isRunnable && (
        <>
          <div
            className="hidden lg:block shrink-0 relative group"
            style={{ width: 4, cursor: 'col-resize', backgroundColor: isDragging ? 'var(--accent)' : 'var(--border)' }}
            onMouseDown={onHorizontalDragStart}
          >
            <div className="absolute inset-y-0 -left-1 -right-1" />
          </div>

          <div className="w-full flex-1 min-h-0 min-w-0 border-t lg:border-t-0 border-line flex flex-col bg-page">
            <div className="shrink-0 border-b border-line bg-surface px-3 py-2 flex flex-wrap items-center justify-between gap-2">
              <div className="flex flex-wrap items-center gap-3 min-w-0">
                {langs.length > 0 ? (
                  <label className="inline-flex items-center gap-2 text-xs text-muted">
                    Language
                    <select
                      value={selectedLanguage}
                      onChange={(e) => onLanguageChange(e.target.value)}
                      disabled={locked}
                      className={`${inputClass} h-8 w-auto min-w-[7.5rem]`}
                    >
                      {langs.map((lang) => (
                        <option key={lang} value={lang}>
                          {lang.charAt(0).toUpperCase() + lang.slice(1)}
                        </option>
                      ))}
                    </select>
                  </label>
                ) : null}
                <p className="hidden sm:block text-[11px] text-muted">
                  Time {selectedQuestion.timeLimit ?? 2}s · Memory {selectedQuestion.memoryLimit ?? 256}MB
                </p>
              </div>
              <div className="flex items-center gap-1.5">
                {(showFullEditor || isFillCoding) && (
                  <Button variant="secondary" icon={Maximize2} className="h-8 px-2!" onClick={onToggleFullscreen} title="Fullscreen (F11)" aria-label="Enter fullscreen editor" />
                )}
                {questionRunHistory.length > 0 && (
                  <Button variant="soft" icon={Clock} className="h-8" onClick={onOpenHistory}>
                    History ({questionRunHistory.length})
                  </Button>
                )}
                <Button variant="secondary" icon={RotateCcw} className="h-8" disabled={locked} onClick={onReset}>
                  Reset
                </Button>
                <Button variant="secondary" icon={Copy} className="h-8" onClick={onCopy}>
                  Copy
                </Button>
              </div>
            </div>

            <div className="flex-1 flex flex-col overflow-hidden p-4 min-h-0">
              <div id="student-code-split" className="flex flex-col flex-1 min-h-0 min-w-0 overflow-hidden">
                {showFullEditor && !isFullscreen && (
                  <div className="flex flex-col min-h-0 overflow-hidden" style={{ flex: `${editorHeight} 1 0%`, minHeight: '8rem' }}>
                    {questionType === 'codingWithDriver' && (
                      <p className="mb-3 text-xs rounded-xl px-3 py-2 border border-accent-line bg-accent-soft text-accent-ink">
                        Complete the stub. Your solution is merged with the hidden driver for judging.
                      </p>
                    )}
                    <CodeEditor
                      value={code}
                      onChange={onCodeChange}
                      defaultValue={getCodeTemplateForLanguage(selectedQuestion, selectedLanguage)}
                      language={selectedLanguage}
                      disabled={locked}
                      isFillInTheBlanks={false}
                      height="100%"
                    />
                  </div>
                )}
                {isFillCoding && !isFullscreen && (
                  <div className="flex flex-col min-h-0 overflow-hidden" style={{ flex: `${editorHeight} 1 0%`, minHeight: '8rem' }}>
                    <p className="text-xs font-semibold text-fg mb-2 shrink-0">
                      Template (line below replaces <code className="font-mono">// FILL_IN_THE_BLANK</code>)
                    </p>
                    <pre className="text-xs mb-3 p-3 rounded-xl overflow-auto shrink-0 max-h-[45%] font-mono border border-line bg-inset text-body leading-relaxed">
                      {htmlToPlainText(selectedQuestion.codeSnippet || '') || '(No snippet)'}
                    </pre>
                    <label className="text-xs font-medium text-muted shrink-0">Line for the blank</label>
                    <textarea
                      value={fillInBlankLine}
                      onChange={(e) => onFillChange(e.target.value)}
                      disabled={locked}
                      className={`${inputClass} mt-1 flex-1 min-h-[96px] font-mono`}
                      placeholder="e.g. return a + b;"
                    />
                  </div>
                )}

                {!isFullscreen && (
                  <div
                    className="shrink-0 relative"
                    style={{ height: 4, cursor: 'row-resize', backgroundColor: isDraggingVertical ? 'var(--accent)' : 'var(--border)' }}
                    onMouseDown={onVerticalDragStart}
                  >
                    <div className="absolute inset-x-0 -top-1 -bottom-1" />
                  </div>
                )}

                <div className="overflow-y-auto border-t border-line pt-3 space-y-3 min-h-0" style={{ flex: `${100 - editorHeight} 1 0%` }}>
                  <p className="text-xs font-semibold text-fg">Test & submit</p>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                    <label className="block">
                      <span className="text-[11px] font-semibold text-muted">Custom input</span>
                      <textarea value={customInput} onChange={(e) => onCustomInput(e.target.value)} disabled={locked} rows={2} className={`${inputClass} mt-1 font-mono`} />
                    </label>
                    <label className="block">
                      <span className="text-[11px] font-semibold text-muted">Expected output</span>
                      <textarea value={customOutput} onChange={(e) => onCustomOutput(e.target.value)} disabled={locked} rows={2} className={`${inputClass} mt-1 font-mono`} />
                    </label>
                  </div>
                  {questionRunHistory.length > 0 && (
                    <button
                      type="button"
                      onClick={onOpenHistory}
                      className="w-full flex items-center justify-between gap-2 rounded-xl border border-line bg-inset px-3 py-2 text-left hover:border-accent-line"
                    >
                      <span className="min-w-0">
                        <span className="block text-[11px] font-semibold uppercase tracking-wide text-muted">Last run</span>
                        <span className={`block text-xs font-medium truncate ${questionRunHistory[0].failed ? 'text-bad' : 'text-ok'}`}>
                          {historyKindLabel(questionRunHistory[0].kind)} · {questionRunHistory[0].summary}
                        </span>
                      </span>
                      <span className="shrink-0 text-xs font-semibold text-accent-ink">Open</span>
                    </button>
                  )}
                  <div className="flex flex-wrap justify-end gap-2 border-t border-line pt-3">
                    <Button variant="secondary" disabled={locked || busy || !customInput.trim()} onClick={onRunCustom}>
                      {runBusy === 'custom' ? 'Running…' : 'Run custom'}
                    </Button>
                    <Button disabled={locked || busy} onClick={onRun}>
                      {runBusy === 'run' ? 'Running…' : isFillCoding ? 'Run tests' : 'Run code'}
                    </Button>
                    <Button variant="publish" className="px-4 py-2!" disabled={locked || busy} onClick={onSubmit}>
                      {runBusy === 'submit' ? 'Submitting…' : 'Submit'}
                    </Button>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </>
      )}

      {isFullscreen && isRunnable && (
        <div className="fixed inset-0 z-50 flex flex-col bg-page">
          <div className="shrink-0 border-b border-line bg-surface px-4 py-3 flex items-center justify-between gap-3">
            <p className="text-sm font-semibold text-fg truncate">{isFillCoding ? 'Fill-in code' : 'Code editor'}</p>
            <div className="flex items-center gap-2">
              <Button disabled={locked || busy} onClick={onRun}>
                {runBusy === 'run' ? 'Running…' : 'Run'}
              </Button>
              <Button variant="publish" disabled={locked || busy} onClick={onSubmit}>
                {runBusy === 'submit' ? 'Submitting…' : 'Submit'}
              </Button>
              <Button variant="ghost" icon={X} onClick={onToggleFullscreen} aria-label="Exit fullscreen" />
            </div>
          </div>
          <div className="flex-1 overflow-hidden p-4 min-h-0">
            {showFullEditor && (
              <CodeEditor
                value={code}
                onChange={onCodeChange}
                defaultValue={getCodeTemplateForLanguage(selectedQuestion, selectedLanguage)}
                language={selectedLanguage}
                disabled={locked}
                isFillInTheBlanks={false}
                height="100%"
              />
            )}
            {isFillCoding && (
              <textarea
                value={fillInBlankLine}
                onChange={(e) => onFillChange(e.target.value)}
                disabled={locked}
                className={`${inputClass} h-full font-mono`}
                placeholder="Line for // FILL_IN_THE_BLANK"
              />
            )}
          </div>
        </div>
      )}
    </div>
  );
}
