import React, { useState, useEffect } from 'react';
import { useParams, useLocation } from 'react-router-dom';
import { getQuestion, submitAnswer } from '../../../common/services/api';
import CodeEditor from '../../student/components/CodeEditor';
import parse from 'html-react-parser';

const QuestionStatement = ({ isPreview = false, question: propQuestion }) => {
  const { questionId } = useParams();
  const { state } = useLocation();
  const classId = state?.classId;

  const [question, setQuestion] = useState(propQuestion || null);
  const [loading, setLoading] = useState(!propQuestion);
  const [error, setError] = useState('');
  const [answer, setAnswer] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submissionFeedback, setSubmissionFeedback] = useState(null);

  // Strip HTML tags for code fields
  const stripHtml = (html) => {
    if (!html) return '';
    const doc = new DOMParser().parseFromString(html, 'text/html');
    return doc.body.textContent || '';
  };

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

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (isSubmitting || isPreview) {
      console.log('[QuestionStatement] Submission blocked:', { isSubmitting, isPreview });
      return;
    }
    setIsSubmitting(true);
    setSubmissionFeedback(null);
    try {
      const response = await submitAnswer(questionId, answer);
      console.log('[QuestionStatement] Submission response:', response.data);
      setSubmissionFeedback({
        isCorrect: response.data.submission.isCorrect,
        score: response.data.submission.score,
        output: response.data.submission.output,
      });
      setAnswer('');
    } catch (err) {
      console.error('[QuestionStatement] Submission error:', err.message, err.response?.data);
      setError(err.response?.data?.error || 'Failed to submit answer');
    } finally {
      setIsSubmitting(false);
    }
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
              <circle
                className="opacity-25"
                cx="12"
                cy="12"
                r="10"
                stroke="currentColor"
                strokeWidth="4"
              ></circle>
              <path
                className="opacity-75"
                fill="currentColor"
                d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
              ></path>
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
            <svg
              className="h-6 w-6 text-red-500"
              xmlns="http://www.w3.org/2000/svg"
              viewBox="0 0 20 20"
              fill="currentColor"
            >
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
  const defaultCode = question.type === 'coding' && question.templateCode?.length > 0 ? question.templateCode[0].code : '';

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-3xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-indigo-600 to-indigo-400 tracking-tight">
          {parse(question.title || 'Untitled')}
        </h2>
        {isPreview && (
          <span className="inline-flex items-center px-3 py-1 rounded-full text-xs font-semibold bg-yellow-100 text-yellow-800">
            Preview Mode
          </span>
        )}
      </div>
      
      <div className="flex flex-wrap gap-3 mb-6">
        <span className="px-3 py-1 rounded-full text-xs font-semibold bg-blue-100 text-blue-800">
          {question.difficulty || 'Unknown'}
        </span>
        <span className="px-3 py-1 rounded-full text-xs font-semibold bg-green-100 text-green-800">
          {question.points || 0} points
        </span>
        <span className="px-3 py-1 rounded-full text-xs font-semibold bg-purple-100 text-purple-800">
          {question.isPublished ? 'Published' : 'Unpublished'}
        </span>
        <span className="px-3 py-1 rounded-full text-xs font-semibold bg-yellow-100 text-yellow-800">
          {question.isDisabled ? 'Disabled' : 'Enabled'}
        </span>
      </div>

      <div className="space-y-6 mb-8">
        <div>
          <h3 className="text-lg font-semibold text-gray-800 mb-2">Description</h3>
          <div className="text-sm text-gray-700 prose max-w-none">{parse(question.description || 'No description available')}</div>
        </div>

        {question.constraints && (
          <div>
            <h3 className="text-lg font-semibold text-gray-800 mb-2">Constraints</h3>
            <div className="text-sm text-gray-700 prose max-w-none">{parse(question.constraints)}</div>
          </div>
        )}

        {question.examples?.length > 0 && (
          <div>
            <h3 className="text-lg font-semibold text-gray-800 mb-2">Examples</h3>
            <div className="space-y-3">
              {question.examples.map((example, index) => (
                <div key={index} className="bg-gray-50 p-4 rounded-lg">
                  <div className="text-sm text-gray-700 prose max-w-none">{parse(example)}</div>
                </div>
              ))}
            </div>
          </div>
        )}

        {question.functionSignature && (
          <div>
            <h3 className="text-lg font-semibold text-gray-800 mb-2">Function Signature</h3>
            <pre className="bg-gray-50 p-4 rounded-lg text-sm text-gray-700 font-mono overflow-x-auto">{parse(question.functionSignature)}</pre>
          </div>
        )}
      </div>

      {(isPreview || !isTeacherView) && (
        <form onSubmit={handleSubmit} className="mt-8 space-y-6">
          <h3 className="text-lg font-semibold text-gray-800 mb-3">
            {question.type === 'coding' ? 'Your Solution' : 'Your Answer'}
          </h3>

          {question.type === 'coding' ? (
            <CodeEditor
              value={answer}
              onChange={setAnswer}
              defaultValue={defaultCode}
              language={question.languages?.[0] || 'javascript'}
              disabled={isSubmitting || isPreview}
            />
          ) : question.type === 'mcq' ? (
            <div className="space-y-3">
              {question.options?.map((option, index) => (
                <div key={index} className="flex items-center">
                  <input
                    type="radio"
                    name="answer"
                    value={index}
                    onChange={(e) => setAnswer(e.target.value)}
                    className="h-4 w-4 text-indigo-600 focus:ring-indigo-500 border-gray-300"
                    disabled={isSubmitting || isPreview}
                  />
                  <label className="ml-2 text-sm text-gray-700 prose max-w-none">{parse(option)}</label>
                </div>
              ))}
            </div>
          ) : (
            <textarea
              value={answer}
              onChange={(e) => setAnswer(e.target.value)}
              rows={4}
              className="w-full px-3 py-2 rounded-lg border border-gray-200 shadow-sm focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm transition-all duration-200"
              placeholder="Enter your answer..."
              disabled={isSubmitting || isPreview}
            />
          )}

          <div className="mt-6 flex justify-end">
            <button
              type="submit"
              disabled={isSubmitting || isPreview}
              className={`px-4 py-2 rounded-lg text-sm font-semibold text-white focus:outline-none transition-all duration-300 ${
                isSubmitting || isPreview
                  ? 'bg-gray-400 cursor-not-allowed'
                  : 'bg-indigo-600 hover:bg-indigo-700 focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2'
              }`}
            >
              {isSubmitting ? 'Submitting...' : isPreview ? 'Preview Mode' : 'Submit Answer'}
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
          {submissionFeedback.output && question.type === 'coding' && (
            <div className="mt-3">
              <p className="text-sm font-semibold text-gray-700">Test Results:</p>
              {(() => {
                try {
                  return JSON.parse(submissionFeedback.output).map((result, index) => (
                    <div key={index} className="mt-2 text-sm text-gray-700">
                      <p>Test {index + 1}: {result.passed ? 'Passed' : 'Failed'}</p>
                      <p>Input: {result.input}</p>
                      <p>Output: {result.output}</p>
                      <p>Expected: {result.expected}</p>
                    </div>
                  ));
                } catch (e) {
                  return <p className="text-sm text-red-700">Error parsing test results</p>;
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