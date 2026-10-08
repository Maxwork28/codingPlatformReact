import React, { useState, useEffect, useCallback } from 'react';
import { useParams, useLocation } from 'react-router-dom';
import { getQuestion, submitAnswer } from '../../../common/services/api';
import CodeEditor from '../../student/components/CodeEditor';
import TestCaseResultsList from '../../student/components/TestCaseResultsList';
import parse from 'html-react-parser';
import QuestionHtml from '../../../common/components/QuestionHtml';
import CodingQuestionDetails from '../../../common/components/CodingQuestionDetails';
import { CODING_TYPES as RUNNABLE_CODING_TYPES, FULL_CODE_EDITOR_TYPES, QUESTION_TYPE_LABELS } from '../../../common/domain/questions';
import { sanitizeHtml, stripHtml } from '../../../common/utils/sanitizeHtml';

/** Author HTML (options, explanation, constraints) is sanitized before html-react-parser touches it. */
const safeParse = (html) => parse(sanitizeHtml(html || ''));

function getCodeTemplateForLanguage(question, lang) {
  if (!question || !lang) return '';
  const fromTemplate = question.templateCode?.find((tc) => tc.language === lang);
  if (fromTemplate?.code) return fromTemplate.code;
  const fromStarter = question.starterCode?.find((sc) => sc.language === lang);
  if (fromStarter?.code) return fromStarter.code;
  return '';
}

const QuestionStatement = ({ isPreview = false, question: propQuestion, hideHeader = false }) => {
  const { questionId } = useParams();
  const { state } = useLocation();
  const classId = state?.classId;

  const [question, setQuestion] = useState(propQuestion || null);
  const [loading, setLoading] = useState(!propQuestion);
  const [error, setError] = useState('');
  const [answer, setAnswer] = useState('');
  const [multiAnswer, setMultiAnswer] = useState([]);
  const [selectedLanguage, setSelectedLanguage] = useState('javascript');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submissionFeedback, setSubmissionFeedback] = useState(null);
  const [submitError, setSubmitError] = useState('');

  const resetAnswerStateForQuestion = useCallback((q) => {
    if (!q) return;
    const lang = q.languages?.[0] || 'javascript';
    setSelectedLanguage(lang);
    setMultiAnswer([]);
    if (q.type === 'multipleCorrectMcq') {
      setAnswer('');
      setMultiAnswer([]);
    } else if (FULL_CODE_EDITOR_TYPES.includes(q.type)) {
      setAnswer(getCodeTemplateForLanguage(q, lang));
    } else {
      setAnswer('');
    }
  }, []);

  useEffect(() => {
    if (propQuestion) return;
    const fetchQuestion = async () => {
      try {
        const response = await getQuestion(questionId);
        setQuestion(response.data.question || response.data);
      } catch (err) {
        console.error('[QuestionStatement] Fetch error:', err.message, err.response?.data);
        setError(err.response?.data?.error || 'Failed to fetch question');
      } finally {
        setLoading(false);
      }
    };
    fetchQuestion();
  }, [questionId, propQuestion]);

  useEffect(() => {
    if (propQuestion) {
      setQuestion(propQuestion);
      setLoading(false);
    }
  }, [propQuestion]);

  useEffect(() => {
    resetAnswerStateForQuestion(question);
  }, [question, resetAnswerStateForQuestion]);

  useEffect(() => {
    if (!question || !FULL_CODE_EDITOR_TYPES.includes(question.type)) return;
    setAnswer(getCodeTemplateForLanguage(question, selectedLanguage));
  }, [selectedLanguage, question]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (isSubmitting || isPreview) return;
    setIsSubmitting(true);
    setSubmissionFeedback(null);
    setSubmitError('');
    try {
      let payload = answer;
      if (question.type === 'multipleCorrectMcq') {
        payload = multiAnswer.map(Number).sort((a, b) => a - b);
      }
      const language =
        question.type === 'coding' ||
        question.type === 'fillInTheBlanksCoding' ||
        question.type === 'codingWithDriver'
          ? selectedLanguage
          : undefined;

      const response = await submitAnswer(questionId, payload, classId, language);
      setSubmissionFeedback({
        isCorrect: response.data.submission.isCorrect,
        score: response.data.submission.score,
        output: response.data.submission.output,
        testResults: response.data.testResults,
      });
      resetAnswerStateForQuestion(question);
    } catch (err) {
      console.error('[QuestionStatement] Submission error:', err.message, err.response?.data);
      const msg =
        typeof err === 'string' ? err : err.response?.data?.error || err.message || 'Failed to submit answer';
      setSubmitError(msg);
    } finally {
      setIsSubmitting(false);
    }
  };

  const toggleMulti = (index) => {
    if (isPreview) return;
    setMultiAnswer((prev) =>
      prev.includes(index) ? prev.filter((i) => i !== index) : [...prev, index].sort((a, b) => a - b)
    );
  };

  if (loading) {
    return (
      <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50">
        <div className="bg-surface backdrop-blur-sm p-8 rounded-2xl shadow-xl max-w-sm w-full">
          <div className="flex items-center justify-center">
            <svg
              className="animate-spin h-10 w-10 text-accent-ink"
              xmlns="http://www.w3.org/2000/svg"
              fill="none"
              viewBox="0 0 24 24"
            >
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
              <path
                className="opacity-75"
                fill="currentColor"
                d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
              />
            </svg>
            <span className="ml-4 text-lg font-semibold text-fg">Loading...</span>
          </div>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="w-full px-4 sm:px-5 py-8">
        <div className="mb-6 p-4 rounded-xl bg-bad-soft backdrop-blur-sm border border-bad-line shadow-sm">
          <div className="flex items-center">
            <svg className="h-6 w-6 text-bad" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor">
              <path
                fillRule="evenodd"
                d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z"
                clipRule="evenodd"
              />
            </svg>
            <p className="ml-3 text-sm font-semibold text-bad">{error}</p>
          </div>
        </div>
      </div>
    );
  }

  if (!question) {
    return (
      <div className="w-full px-4 sm:px-5 py-8">
        <div className="bg-surface backdrop-blur-sm rounded-2xl shadow-lg p-6 border border-line">
          <p className="text-center text-fg font-semibold">Question not found</p>
        </div>
      </div>
    );
  }

  const isTeacherView = !isPreview && !state?.isStudent;
  const typeLabel = QUESTION_TYPE_LABELS[question.type] || question.type || 'Question';

  const answerSectionTitle =
    question.type === 'coding' || question.type === 'codingWithDriver'
      ? 'Your solution'
      : question.type === 'fillInTheBlanksCoding'
        ? 'Your code for the blank'
        : question.type === 'fillInTheBlanks'
          ? 'Your answer'
          : question.type === 'singleCorrectMcq' || question.type === 'multipleCorrectMcq'
            ? 'Select your answer'
            : 'Your answer';

  const publicTests = question.testCases?.filter((tc) => tc && tc.isPublic !== false) || [];

  const renderAnswerControl = () => {
    const disabled = isSubmitting || isPreview;

    if (question.type === 'singleCorrectMcq') {
      return (
        <div className="space-y-3">
          {question.options?.map((option, index) => (
            <label
              key={index}
              className={`flex items-start gap-3 p-4 rounded-xl border transition-colors cursor-pointer ${
                String(answer) === String(index)
                  ? 'border-accent bg-accent-soft'
                  : 'border-line bg-surface hover:border-line-strong'
              } ${disabled ? 'opacity-70 cursor-not-allowed' : ''}`}
            >
              <input
                type="radio"
                name="answer"
                value={index}
                checked={String(answer) === String(index)}
                onChange={(e) => setAnswer(e.target.value)}
                className="mt-1 h-4 w-4 text-accent-ink focus:ring-accent border-line-strong"
                disabled={disabled}
              />
              <span className="text-sm font-semibold text-accent-ink shrink-0">{(index + 10).toString(36).toUpperCase()}.</span>
              <span className="text-sm text-fg prose prose-sm max-w-none flex-1">{safeParse(option)}</span>
            </label>
          ))}
        </div>
      );
    }

    if (question.type === 'multipleCorrectMcq') {
      return (
        <div className="space-y-3">
          <p className="text-xs text-muted">Select all that apply.</p>
          {question.options?.map((option, index) => (
            <label
              key={index}
              className={`flex items-start gap-3 p-4 rounded-xl border transition-colors cursor-pointer ${
                multiAnswer.includes(index)
                  ? 'border-accent bg-accent-soft'
                  : 'border-line bg-surface hover:border-line-strong'
              } ${disabled ? 'opacity-70 cursor-not-allowed' : ''}`}
            >
              <input
                type="checkbox"
                checked={multiAnswer.includes(index)}
                onChange={() => toggleMulti(index)}
                className="mt-1 h-4 w-4 text-accent-ink focus:ring-accent border-line-strong rounded"
                disabled={disabled}
              />
              <span className="text-sm font-semibold text-accent-ink shrink-0">{(index + 10).toString(36).toUpperCase()}.</span>
              <span className="text-sm text-fg prose prose-sm max-w-none flex-1">{safeParse(option)}</span>
            </label>
          ))}
        </div>
      );
    }

    if (question.type === 'fillInTheBlanks') {
      return (
        <textarea
          value={answer}
          onChange={(e) => setAnswer(e.target.value)}
          rows={4}
          className="w-full px-4 py-3 rounded-xl border border-line shadow-sm focus:ring-2 focus:ring-accent focus:border-accent text-sm transition-all"
          placeholder="Type your answer..."
          disabled={disabled}
        />
      );
    }

    if (question.type === 'fillInTheBlanksCoding') {
      return (
        <div className="space-y-4">
          <div>
            <h4 className="text-sm font-semibold text-body mb-2">Template (your line replaces // FILL_IN_THE_BLANK)</h4>
            <pre className="text-sm bg-inset text-fg p-4 rounded-xl overflow-x-auto font-mono leading-relaxed border border-line">
              {stripHtml(question.codeSnippet || '') || '(No snippet)'}
            </pre>
          </div>
          <div>
            <label className="block text-xs font-semibold text-muted mb-1">Line to insert at the blank</label>
            <textarea
              value={answer}
              onChange={(e) => setAnswer(e.target.value)}
              rows={3}
              className="w-full px-4 py-3 rounded-xl border border-line font-mono text-sm focus:ring-2 focus:ring-accent focus:border-accent"
              placeholder="e.g. y = x * 2"
              disabled={disabled}
            />
          </div>
        </div>
      );
    }

    if (question.type === 'coding' || question.type === 'codingWithDriver') {
      return (
        <div className="space-y-4">
          {question.type === 'codingWithDriver' && (
            <p className="text-sm text-muted bg-accent-soft border border-accent-line rounded-lg px-3 py-2">
              <strong className="text-accent-ink">LeetCode-style:</strong> Complete the stub below. The platform wraps your code with the hidden driver and runs the test cases.
            </p>
          )}
          {question.languages && question.languages.length > 1 && (
            <div>
              <label className="block text-sm font-semibold text-body mb-2">Language</label>
              <select
                value={selectedLanguage}
                onChange={(e) => setSelectedLanguage(e.target.value)}
                disabled={disabled}
                className="w-full max-w-xs px-4 py-2 rounded-lg border border-line focus:ring-2 focus:ring-accent text-sm"
              >
                {question.languages.map((lang) => (
                  <option key={lang} value={lang}>
                    {lang.charAt(0).toUpperCase() + lang.slice(1)}
                  </option>
                ))}
              </select>
            </div>
          )}
          <div className="border border-line rounded-xl overflow-hidden shadow-sm">
            <CodeEditor
              value={answer}
              onChange={setAnswer}
              defaultValue={getCodeTemplateForLanguage(question, selectedLanguage)}
              language={selectedLanguage}
              disabled={disabled}
              height="420px"
            />
          </div>
        </div>
      );
    }

    return (
      <textarea
        value={answer}
        onChange={(e) => setAnswer(e.target.value)}
        rows={4}
        className="w-full px-4 py-3 rounded-xl border border-line shadow-sm focus:ring-accent focus:border-accent text-sm transition-all"
        placeholder="Enter your answer..."
        disabled={disabled}
      />
    );
  };

  return (
    <div className="space-y-6">
      {!hideHeader && (
      <>
      <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-3">
        <h2 className="text-3xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-accent to-accent-hover tracking-tight">
          {stripHtml(question.title) || 'Untitled'}
        </h2>
        {isPreview && (
          <span className="inline-flex items-center px-3 py-1 rounded-full text-xs font-semibold bg-warn-soft text-warn shrink-0">
            Preview Mode
          </span>
        )}
      </div>

      <div className="flex flex-wrap gap-2 mb-2">
        <span className="px-3 py-1.5 rounded-full text-xs font-semibold bg-quiet-soft text-quiet border border-quiet-line">{typeLabel}</span>
        <span className="px-3 py-1.5 rounded-full text-xs font-semibold bg-info-soft text-info capitalize">
          {question.difficulty || 'unknown'}
        </span>
        {question.points != null && question.points !== '' && (
          <span className="px-3 py-1.5 rounded-full text-xs font-semibold bg-ok-soft text-ok">
            {question.points} pts
          </span>
        )}
        {question.status === 'draft' || question.isDraft ? (
          <span className="px-3 py-1.5 rounded-full text-xs font-semibold bg-warn-soft text-warn">Draft</span>
        ) : (
          <span className="px-3 py-1.5 rounded-full text-xs font-semibold bg-accent-soft text-accent-ink">
            {question.isPublished !== false ? 'Published' : 'Unpublished'}
          </span>
        )}
      </div>
      </>
      )}

      <div className="space-y-6 mb-8">
        <div>
          <h3 className="text-lg font-semibold text-fg mb-2">Description</h3>
          <QuestionHtml
            html={question.description}
            className="text-sm text-body rounded-xl border border-line bg-inset p-4"
            empty={<div className="text-sm text-body">No description available</div>}
          />
        </div>

        {RUNNABLE_CODING_TYPES.includes(question.type) ? (
          <CodingQuestionDetails question={question} tone="statement" publicTests={publicTests} />
        ) : (
          <>
            {question.explanation && !isPreview && (
              <div>
                <h3 className="text-lg font-semibold text-fg mb-2">Explanation</h3>
                <div className="text-sm text-body prose prose-sm max-w-none rounded-xl border border-line bg-inset p-4">
                  {safeParse(question.explanation)}
                </div>
              </div>
            )}
            {question.constraints && (
              <div>
                <h3 className="text-lg font-semibold text-fg mb-2">Constraints</h3>
                <div className="text-sm text-body prose prose-sm max-w-none rounded-xl border border-line p-4">
                  {safeParse(question.constraints)}
                </div>
              </div>
            )}
          </>
        )}

        {question.functionSignature && (
          <div>
            <h3 className="text-lg font-semibold text-fg mb-2">Function signature</h3>
            <pre className="bg-inset text-fg p-4 rounded-xl text-sm font-mono overflow-x-auto border border-line">
              {stripHtml(question.functionSignature)}
            </pre>
          </div>
        )}

      </div>

      {(isPreview || !isTeacherView) && (
        <form onSubmit={handleSubmit} className="mt-8 space-y-6">
          {submitError && (
            <div className="p-3 rounded-xl bg-bad-soft border border-bad-line text-sm text-bad font-medium" role="alert">
              {submitError}
            </div>
          )}
          <h3 className="text-lg font-semibold text-fg border-b border-line pb-2">{answerSectionTitle}</h3>
          {renderAnswerControl()}

          <div className="mt-6 flex justify-end">
            <button
              type="submit"
              disabled={isSubmitting || isPreview}
              className={`px-5 py-2.5 rounded-xl text-sm font-semibold text-on-accent focus:outline-none transition-all duration-300 ${
                isSubmitting || isPreview
                  ? 'bg-subtle cursor-not-allowed'
                  : 'bg-accent hover:bg-accent-hover focus:ring-2 focus:ring-accent focus:ring-offset-2'
              }`}
            >
              {isSubmitting ? 'Submitting...' : isPreview ? 'Preview only' : 'Submit answer'}
            </button>
          </div>
        </form>
      )}

      {submissionFeedback && !isPreview && !isTeacherView && (
        <div className="mt-8 p-4 rounded-xl bg-inset backdrop-blur-sm border border-line shadow-sm">
          <p className={`text-sm font-semibold ${submissionFeedback.isCorrect ? 'text-ok' : 'text-bad'}`}>
            {submissionFeedback.isCorrect ? 'Correct!' : 'Incorrect'}
          </p>
          <p className="text-sm text-body">Score: {submissionFeedback.score}/{question.points ?? 0}</p>
          {submissionFeedback.output && RUNNABLE_CODING_TYPES.includes(question.type) && (
            <div className="mt-3">
              <p className="text-sm font-semibold text-body">Test results</p>
              <div className="mt-2">
                <TestCaseResultsList results={submissionFeedback.testResults ?? submissionFeedback.output} />
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default QuestionStatement;
