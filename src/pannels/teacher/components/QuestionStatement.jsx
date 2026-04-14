import React, { useState, useEffect, useCallback } from 'react';
import { useParams, useLocation } from 'react-router-dom';
import { getQuestion, submitAnswer } from '../../../common/services/api';
import CodeEditor from '../../student/components/CodeEditor';
import parse from 'html-react-parser';

const QUESTION_TYPE_LABELS = {
  singleCorrectMcq: 'Single choice',
  multipleCorrectMcq: 'Multiple choice',
  fillInTheBlanks: 'Fill in the blanks',
  fillInTheBlanksCoding: 'Fill in the blanks (code)',
  coding: 'Coding',
  codingWithDriver: 'Coding (LeetCode-style)',
};

/** Used for test results / public sample tests */
const RUNNABLE_CODING_TYPES = ['coding', 'fillInTheBlanksCoding', 'codingWithDriver'];
/** Full-IDE style: starter is the whole submission */
const FULL_CODE_EDITOR_TYPES = ['coding', 'codingWithDriver'];

function getCodeTemplateForLanguage(question, lang) {
  if (!question || !lang) return '';
  const fromTemplate = question.templateCode?.find((tc) => tc.language === lang);
  if (fromTemplate?.code) return fromTemplate.code;
  const fromStarter = question.starterCode?.find((sc) => sc.language === lang);
  if (fromStarter?.code) return fromStarter.code;
  return '';
}

const QuestionStatement = ({ isPreview = false, question: propQuestion }) => {
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

  const stripHtml = (html) => {
    if (!html) return '';
    const doc = new DOMParser().parseFromString(html, 'text/html');
    return doc.body.textContent || '';
  };

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
    console.log('[QuestionStatement] Fetching question:', { questionId, isPreview });
    const fetchQuestion = async () => {
      try {
        const response = await getQuestion(questionId);
        console.log('[QuestionStatement] Question fetched:', response.data);
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
    if (isSubmitting || isPreview) {
      console.log('[QuestionStatement] Submission blocked:', { isSubmitting, isPreview });
      return;
    }
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
      console.log('[QuestionStatement] Submission response:', response.data);
      setSubmissionFeedback({
        isCorrect: response.data.submission.isCorrect,
        score: response.data.submission.score,
        output: response.data.submission.output,
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
      <div className="fixed inset-0 bg-gray-600 bg-opacity-60 flex items-center justify-center z-50">
        <div className="bg-white/90 backdrop-blur-sm p-8 rounded-2xl shadow-xl max-w-sm w-full">
          <div className="flex items-center justify-center">
            <svg
              className="animate-spin h-10 w-10 text-indigo-600"
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
            <span className="ml-4 text-lg font-semibold text-gray-800">Loading...</span>
          </div>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="mb-6 p-4 rounded-xl bg-red-50/80 backdrop-blur-sm border border-red-200 shadow-sm">
          <div className="flex items-center">
            <svg className="h-6 w-6 text-red-500" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor">
              <path
                fillRule="evenodd"
                d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z"
                clipRule="evenodd"
              />
            </svg>
            <p className="ml-3 text-sm font-semibold text-red-800">{error}</p>
          </div>
        </div>
      </div>
    );
  }

  if (!question) {
    return (
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="bg-white/90 backdrop-blur-sm rounded-2xl shadow-lg p-6 border border-gray-100">
          <p className="text-center text-gray-800 font-semibold">Question not found</p>
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

  const publicTests = question.testCases?.filter((tc) => tc.isPublic) || [];

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
                  ? 'border-indigo-500 bg-indigo-50/80'
                  : 'border-gray-200 bg-white hover:border-gray-300'
              } ${disabled ? 'opacity-70 cursor-not-allowed' : ''}`}
            >
              <input
                type="radio"
                name="answer"
                value={index}
                checked={String(answer) === String(index)}
                onChange={(e) => setAnswer(e.target.value)}
                className="mt-1 h-4 w-4 text-indigo-600 focus:ring-indigo-500 border-gray-300"
                disabled={disabled}
              />
              <span className="text-sm font-semibold text-indigo-700 shrink-0">{(index + 10).toString(36).toUpperCase()}.</span>
              <span className="text-sm text-gray-800 prose prose-sm max-w-none flex-1">{parse(option || '')}</span>
            </label>
          ))}
        </div>
      );
    }

    if (question.type === 'multipleCorrectMcq') {
      return (
        <div className="space-y-3">
          <p className="text-xs text-gray-500">Select all that apply.</p>
          {question.options?.map((option, index) => (
            <label
              key={index}
              className={`flex items-start gap-3 p-4 rounded-xl border transition-colors cursor-pointer ${
                multiAnswer.includes(index)
                  ? 'border-indigo-500 bg-indigo-50/80'
                  : 'border-gray-200 bg-white hover:border-gray-300'
              } ${disabled ? 'opacity-70 cursor-not-allowed' : ''}`}
            >
              <input
                type="checkbox"
                checked={multiAnswer.includes(index)}
                onChange={() => toggleMulti(index)}
                className="mt-1 h-4 w-4 text-indigo-600 focus:ring-indigo-500 border-gray-300 rounded"
                disabled={disabled}
              />
              <span className="text-sm font-semibold text-indigo-700 shrink-0">{(index + 10).toString(36).toUpperCase()}.</span>
              <span className="text-sm text-gray-800 prose prose-sm max-w-none flex-1">{parse(option || '')}</span>
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
          className="w-full px-4 py-3 rounded-xl border border-gray-200 shadow-sm focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 text-sm transition-all"
          placeholder="Type your answer..."
          disabled={disabled}
        />
      );
    }

    if (question.type === 'fillInTheBlanksCoding') {
      return (
        <div className="space-y-4">
          <div>
            <h4 className="text-sm font-semibold text-gray-700 mb-2">Template (your line replaces // FILL_IN_THE_BLANK)</h4>
            <pre className="text-sm bg-slate-900 text-slate-100 p-4 rounded-xl overflow-x-auto font-mono leading-relaxed border border-slate-700">
              {stripHtml(question.codeSnippet || '') || '(No snippet)'}
            </pre>
          </div>
          <div>
            <label className="block text-xs font-semibold text-gray-600 mb-1">Line to insert at the blank</label>
            <textarea
              value={answer}
              onChange={(e) => setAnswer(e.target.value)}
              rows={3}
              className="w-full px-4 py-3 rounded-xl border border-gray-200 font-mono text-sm focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
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
            <p className="text-sm text-gray-600 bg-violet-50 border border-violet-100 rounded-lg px-3 py-2">
              <strong className="text-violet-900">LeetCode-style:</strong> Complete the stub below. The platform wraps your code with the hidden driver and runs the test cases.
            </p>
          )}
          {question.languages && question.languages.length > 1 && (
            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-2">Language</label>
              <select
                value={selectedLanguage}
                onChange={(e) => setSelectedLanguage(e.target.value)}
                disabled={disabled}
                className="w-full max-w-xs px-4 py-2 rounded-lg border border-gray-200 focus:ring-2 focus:ring-indigo-500 text-sm"
              >
                {question.languages.map((lang) => (
                  <option key={lang} value={lang}>
                    {lang.charAt(0).toUpperCase() + lang.slice(1)}
                  </option>
                ))}
              </select>
            </div>
          )}
          <div className="border border-gray-200 rounded-xl overflow-hidden shadow-sm">
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
        className="w-full px-4 py-3 rounded-xl border border-gray-200 shadow-sm focus:ring-indigo-500 focus:border-indigo-500 text-sm transition-all"
        placeholder="Enter your answer..."
        disabled={disabled}
      />
    );
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-3">
        <h2 className="text-3xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-indigo-600 to-indigo-400 tracking-tight">
          {parse(question.title || 'Untitled')}
        </h2>
        {isPreview && (
          <span className="inline-flex items-center px-3 py-1 rounded-full text-xs font-semibold bg-yellow-100 text-yellow-800 shrink-0">
            Preview Mode
          </span>
        )}
      </div>

      <div className="flex flex-wrap gap-2 mb-2">
        <span className="px-3 py-1.5 rounded-full text-xs font-semibold bg-slate-800 text-white">{typeLabel}</span>
        <span className="px-3 py-1.5 rounded-full text-xs font-semibold bg-blue-100 text-blue-800 capitalize">
          {question.difficulty || 'unknown'}
        </span>
        <span className="px-3 py-1.5 rounded-full text-xs font-semibold bg-green-100 text-green-800">
          {question.points || 0} pts
        </span>
        {question.status === 'draft' || question.isDraft ? (
          <span className="px-3 py-1.5 rounded-full text-xs font-semibold bg-amber-100 text-amber-900">Draft</span>
        ) : (
          <span className="px-3 py-1.5 rounded-full text-xs font-semibold bg-purple-100 text-purple-800">
            {question.isPublished !== false ? 'Published' : 'Unpublished'}
          </span>
        )}
      </div>

      <div className="space-y-6 mb-8">
        <div>
          <h3 className="text-lg font-semibold text-gray-800 mb-2">Description</h3>
          <div className="text-sm text-gray-700 prose prose-sm max-w-none rounded-xl border border-gray-100 bg-gray-50/80 p-4">
            {parse(question.description || 'No description available')}
          </div>
        </div>

        {question.constraints && (
          <div>
            <h3 className="text-lg font-semibold text-gray-800 mb-2">Constraints</h3>
            <div className="text-sm text-gray-700 prose prose-sm max-w-none rounded-xl border border-gray-100 p-4">
              {parse(question.constraints)}
            </div>
          </div>
        )}

        {question.examples?.length > 0 && (
          <div>
            <h3 className="text-lg font-semibold text-gray-800 mb-2">Examples</h3>
            <div className="space-y-3">
              {question.examples.map((example, index) => (
                <div key={index} className="bg-gray-50 p-4 rounded-xl border border-gray-100">
                  <div className="text-sm text-gray-700 prose prose-sm max-w-none">{parse(example)}</div>
                </div>
              ))}
            </div>
          </div>
        )}

        {question.functionSignature && (
          <div>
            <h3 className="text-lg font-semibold text-gray-800 mb-2">Function signature</h3>
            <pre className="bg-slate-900 text-slate-100 p-4 rounded-xl text-sm font-mono overflow-x-auto border border-slate-700">
              {stripHtml(question.functionSignature)}
            </pre>
          </div>
        )}

        {publicTests.length > 0 && RUNNABLE_CODING_TYPES.includes(question.type) && (
          <div>
            <h3 className="text-lg font-semibold text-gray-800 mb-2">Public sample tests</h3>
            <div className="space-y-2">
              {publicTests.map((tc, i) => (
                <div key={i} className="text-xs sm:text-sm rounded-xl border border-gray-200 bg-white p-3 font-mono space-y-1">
                  <div>
                    <span className="font-semibold text-gray-600">In:</span>{' '}
                    <code className="text-gray-800 break-all">{tc.input}</code>
                  </div>
                  <div>
                    <span className="font-semibold text-gray-600">Out:</span>{' '}
                    <code className="text-gray-800 break-all">{tc.expectedOutput}</code>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      {(isPreview || !isTeacherView) && (
        <form onSubmit={handleSubmit} className="mt-8 space-y-6">
          {submitError && (
            <div className="p-3 rounded-xl bg-red-50 border border-red-200 text-sm text-red-800 font-medium" role="alert">
              {submitError}
            </div>
          )}
          <h3 className="text-lg font-semibold text-gray-800 border-b border-gray-200 pb-2">{answerSectionTitle}</h3>
          {renderAnswerControl()}

          <div className="mt-6 flex justify-end">
            <button
              type="submit"
              disabled={isSubmitting || isPreview}
              className={`px-5 py-2.5 rounded-xl text-sm font-semibold text-white focus:outline-none transition-all duration-300 ${
                isSubmitting || isPreview
                  ? 'bg-gray-400 cursor-not-allowed'
                  : 'bg-indigo-600 hover:bg-indigo-700 focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2'
              }`}
            >
              {isSubmitting ? 'Submitting...' : isPreview ? 'Preview only' : 'Submit answer'}
            </button>
          </div>
        </form>
      )}

      {submissionFeedback && !isPreview && !isTeacherView && (
        <div className="mt-8 p-4 rounded-xl bg-gray-50/80 backdrop-blur-sm border border-gray-200 shadow-sm">
          <p className={`text-sm font-semibold ${submissionFeedback.isCorrect ? 'text-green-700' : 'text-red-700'}`}>
            {submissionFeedback.isCorrect ? 'Correct!' : 'Incorrect'}
          </p>
          <p className="text-sm text-gray-700">Score: {submissionFeedback.score}/{question.points}</p>
          {submissionFeedback.output && RUNNABLE_CODING_TYPES.includes(question.type) && (
            <div className="mt-3">
              <p className="text-sm font-semibold text-gray-700">Test results</p>
              {(() => {
                try {
                  return JSON.parse(submissionFeedback.output).map((result, index) => (
                    <div key={index} className="mt-2 text-sm text-gray-700 border-t border-gray-200 pt-2">
                      <p>Test {index + 1}: {result.passed ? 'Passed' : 'Failed'}</p>
                      <p>Input: {result.input}</p>
                      <p>Output: {result.output}</p>
                      <p>Expected: {result.expected}</p>
                    </div>
                  ));
                } catch (e) {
                  return <p className="text-sm text-red-700">Could not parse test results</p>;
                }
              })()}
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default QuestionStatement;
