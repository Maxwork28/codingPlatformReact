import React, { useMemo } from 'react';
import CodeEditor from './CodeEditor';

const QuestionWorkspace = ({
  question,
  answer,
  setAnswer,
  selectedLanguage,
  customInput,
  setCustomInput,
  expectedOutput,
  setExpectedOutput,
  isQuestionActive,
  questionLocked,
  questionTimerLabel,
  sectionTimerLabel,
  totalTimerLabel,
  statusMessage,
  isSubmitting,
  isRunning,
  isRunningCustom,
  onSubmit,
  onRun,
  onRunCustom,
  onLanguageChange,
  onToggleHint,
  showHints,
  onToggleSolution,
  showSolution,
  copyPasteDisabled = false
}) => {
  const isCodingQuestion = useMemo(
    () => ['coding', 'fillInTheBlanksCoding', 'codingWithDriver'].includes(question.type),
    [question.type]
  );

  const renderCodingEditor = () => (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-3">
        <label className="text-sm font-medium text-gray-700">
          Language
          <select
            value={selectedLanguage}
            disabled={!isQuestionActive || questionLocked}
            onChange={(e) => onLanguageChange(e.target.value)}
            className="mt-1 block w-full rounded-md border border-gray-300 bg-white px-3 py-2 text-sm shadow-sm focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
          >
            {question.languages?.map((language) => (
              <option key={language} value={language}>
                {language.toUpperCase()}
              </option>
            ))}
          </select>
        </label>
        <div className="flex items-center gap-4 text-xs text-gray-500">
          <span className="font-semibold text-blue-600">Total: {totalTimerLabel}</span>
          <span className="font-semibold text-purple-600">Section: {sectionTimerLabel}</span>
          <span className={`font-semibold ${questionLocked ? 'text-red-600' : 'text-green-600'}`}>
            Question: {questionTimerLabel}
          </span>
        </div>
      </div>

      <div className="overflow-hidden rounded-xl border border-gray-200 shadow-sm">
        <CodeEditor
          value={answer || ''}
          onChange={setAnswer}
          height={450}
          language={selectedLanguage}
          disabled={!isQuestionActive || questionLocked}
          copyPasteDisabled={copyPasteDisabled}
        />
      </div>

      <div className="grid gap-4 rounded-lg border border-gray-200 bg-gray-50 p-4">
        <div>
          <label className="text-sm font-medium text-gray-700">
            Custom Input
            <textarea
              value={customInput}
              onChange={(e) => setCustomInput(e.target.value)}
              disabled={!isQuestionActive || questionLocked}
              placeholder="Enter custom input to test your solution"
              className="mt-1 block w-full rounded-md border border-gray-300 bg-white px-3 py-2 text-sm shadow-sm focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
              rows={3}
            />
          </label>
        </div>
        <div>
          <label className="text-sm font-medium text-gray-700">
            Expected Output (optional)
            <textarea
              value={expectedOutput}
              onChange={(e) => setExpectedOutput(e.target.value)}
              disabled={!isQuestionActive || questionLocked}
              placeholder="Enter expected output for custom runs"
              className="mt-1 block w-full rounded-md border border-gray-300 bg-white px-3 py-2 text-sm shadow-sm focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
              rows={2}
            />
          </label>
        </div>
      </div>
    </div>
  );

  const renderMcqEditor = () => (
    <div className="space-y-4 px-6 py-5">
      <div className="flex items-center gap-4 text-xs text-gray-500">
        <span className="font-semibold text-blue-600">Total: {totalTimerLabel}</span>
        <span className="font-semibold text-purple-600">Section: {sectionTimerLabel}</span>
        <span className={`font-semibold ${questionLocked ? 'text-red-600' : 'text-green-600'}`}>
          Question: {questionTimerLabel}
        </span>
      </div>
      <div className="space-y-2">
        {question.options?.map((option, idx) => (
          <label
            key={idx}
            className={`flex cursor-pointer items-start gap-3 rounded-lg border px-4 py-3 shadow-sm transition ${
              Array.isArray(answer) ? answer.includes(idx) : answer === idx
                ? 'border-indigo-400 bg-indigo-50'
                : 'border-gray-200 bg-white'
            }`}
          >
            <input
              type={question.type === 'multipleCorrectMcq' ? 'checkbox' : 'radio'}
              name="mcq"
              className="mt-1 h-4 w-4"
              value={idx}
              checked={Array.isArray(answer) ? answer.includes(idx) : answer === idx}
              disabled={!isQuestionActive || questionLocked}
              onChange={(e) => {
                if (question.type === 'multipleCorrectMcq') {
                  setAnswer((prev) => {
                    const current = Array.isArray(prev) ? [...prev] : [];
                    if (e.target.checked) {
                      if (!current.includes(idx)) current.push(idx);
                      return current;
                    }
                    return current.filter((optionIdx) => optionIdx !== idx);
                  });
                } else {
                  setAnswer(idx);
                }
              }}
            />
            <div>
              <div className="text-sm font-medium text-gray-800">Option {idx + 1}</div>
              <div className="text-sm text-gray-600" dangerouslySetInnerHTML={{ __html: option }} />
            </div>
          </label>
        ))}
      </div>
    </div>
  );

  const renderFillBlank = () => (
    <div className="space-y-4 px-6 py-5">
      <div className="flex items-center gap-4 text-xs text-gray-500">
        <span className="font-semibold text-blue-600">Total: {totalTimerLabel}</span>
        <span className="font-semibold text-purple-600">Section: {sectionTimerLabel}</span>
        <span className={`font-semibold ${questionLocked ? 'text-red-600' : 'text-green-600'}`}>
          Question: {questionTimerLabel}
        </span>
      </div>
      <label className="block text-sm font-medium text-gray-700">
        Your Answer
        <textarea
          value={answer || ''}
          disabled={!isQuestionActive || questionLocked}
          onChange={(e) => setAnswer(e.target.value)}
          className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 text-sm shadow-sm focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
          rows={4}
        />
      </label>
    </div>
  );

  return (
    <div className="flex h-full flex-col overflow-hidden">
      {statusMessage && (
        <div className="border-b border-green-200 bg-green-50 px-4 py-2 text-sm text-green-700">
          {statusMessage}
        </div>
      )}

      <div className="flex-1 overflow-y-auto bg-white">
        <div className="border-b border-gray-100 bg-gradient-to-r from-gray-50 to-white px-6 py-5">
          <h2 className="text-2xl font-bold text-gray-900" dangerouslySetInnerHTML={{ __html: question.title }} />
          <div className="mt-2 text-sm text-gray-600" dangerouslySetInnerHTML={{ __html: question.description }} />
          {question.constraints && (
            <div className="mt-3 whitespace-pre-wrap rounded-md bg-gray-100 px-3 py-2 text-xs text-gray-600" dangerouslySetInnerHTML={{ __html: question.constraints }} />
          )}
          <div className="mt-3 flex flex-wrap items-center gap-2 text-xs text-gray-500">
            <span>Difficulty: <strong className="text-indigo-600">{question.difficulty}</strong></span>
            <span>Points: <strong>{question.points}</strong></span>
            {question.tags?.map((tag, idx) => (
              <span key={idx} className="rounded-full bg-gray-200 px-3 py-1 text-xs text-gray-700">{tag}</span>
            ))}
          </div>
        </div>

        {(question.examples && question.examples.length > 0) && (
          <div className="border-b border-gray-100 px-6 py-4">
            <div className="text-sm font-semibold text-gray-900">Examples</div>
            <div className="mt-2 space-y-2">
              {question.examples.map((example, idx) => (
                <pre key={idx} className="overflow-x-auto rounded-md bg-gray-900 px-4 py-3 text-xs text-gray-100" dangerouslySetInnerHTML={{ __html: example }} />
              ))}
            </div>
          </div>
        )}

        {isCodingQuestion
          ? (
            <div className="px-6 py-5">{renderCodingEditor()}</div>
          )
          : question.type === 'fillInTheBlanks'
            ? renderFillBlank()
            : renderMcqEditor()
        }
      </div>

      <div className="border-t border-gray-200 bg-gray-50 px-6 py-4">
        <div className="flex flex-wrap items-center gap-3">
          {isCodingQuestion && (
            <>
              <button
                onClick={onRun}
                disabled={isRunning || !isQuestionActive || questionLocked}
                className={`inline-flex items-center rounded-lg px-4 py-2 text-sm font-semibold text-white focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 ${
                  isRunning || !isQuestionActive || questionLocked
                    ? 'bg-gray-400 cursor-not-allowed'
                    : 'bg-blue-600 hover:bg-blue-700'
                }`}
              >
                {isRunning ? 'Running...' : questionLocked ? 'Time Expired' : 'Run Code'}
              </button>

              <button
                onClick={onRunCustom}
                disabled={isRunningCustom || !isQuestionActive || questionLocked}
                className={`inline-flex items-center rounded-lg px-4 py-2 text-sm font-semibold text-white focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-purple-500 ${
                  isRunningCustom || !isQuestionActive || questionLocked
                    ? 'bg-gray-400 cursor-not-allowed'
                    : 'bg-purple-600 hover:bg-purple-700'
                }`}
              >
                {isRunningCustom ? 'Running Custom...' : questionLocked ? 'Time Expired' : 'Run with Custom Input'}
              </button>
            </>
          )}

          <button
            onClick={onSubmit}
            disabled={isSubmitting || !isQuestionActive || questionLocked}
            className={`inline-flex items-center rounded-lg px-4 py-2 text-sm font-semibold text-white focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-green-500 ${
              isSubmitting || !isQuestionActive || questionLocked
                ? 'bg-gray-400 cursor-not-allowed'
                : 'bg-green-600 hover:bg-green-700'
            }`}
          >
            {isSubmitting ? 'Submitting...' : questionLocked ? 'Time Expired' : 'Submit Answer'}
          </button>

          <div className="ml-auto flex items-center gap-3 text-xs text-gray-500">
            {question.hints?.length ? (
              <button onClick={onToggleHint} className="text-indigo-600 hover:text-indigo-700">
                {showHints ? 'Hide Hints' : 'Show Hints'}
              </button>
            ) : null}
            {question.solution ? (
              <button onClick={onToggleSolution} className="text-indigo-600 hover:text-indigo-700">
                {showSolution ? 'Hide Solution' : 'Show Solution'}
              </button>
            ) : null}
          </div>
        </div>
      </div>

      {(showHints && question.hints?.length) && (
        <div className="border-t border-gray-200 bg-yellow-50 px-6 py-4">
          <h3 className="text-sm font-semibold text-yellow-800">Hints</h3>
          <ul className="mt-2 list-disc space-y-1 pl-5 text-sm text-yellow-700">
            {question.hints.map((hint, idx) => (
              <li key={idx} dangerouslySetInnerHTML={{ __html: hint }} />
            ))}
          </ul>
        </div>
      )}

      {showSolution && question.solution && (
        <div className="border-t border-gray-200 bg-green-50 px-6 py-4">
          <h3 className="text-sm font-semibold text-green-800">Solution</h3>
          <div className="mt-2 whitespace-pre-wrap text-sm text-green-700" dangerouslySetInnerHTML={{ __html: question.solution }} />
        </div>
      )}
    </div>
  );
};

export default QuestionWorkspace;
