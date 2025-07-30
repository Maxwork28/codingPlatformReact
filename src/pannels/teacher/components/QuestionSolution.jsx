import React, { useState, useEffect } from 'react';
import { useParams, Link } from 'react-router-dom';
import { getQuestion } from '../../../common/services/api';
import parse from 'html-react-parser';

const QuestionSolution = () => {
  const { questionId } = useParams();
  const [question, setQuestion] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState('');

  // Strip HTML tags for code fields
  const stripHtml = (html) => {
    if (!html) return '';
    const doc = new DOMParser().parseFromString(html, 'text/html');
    return doc.body.textContent || '';
  };

  useEffect(() => {
    const fetchQuestion = async () => {
      try {
        setIsLoading(true);
        const response = await getQuestion(questionId);
        console.log('[QuestionSolution] Question fetched:', response.data.question);
        setQuestion(response.data.question);
      } catch (err) {
        console.error('[QuestionSolution] Fetch error:', err.message, err.response?.data);
        setError(err.response?.data?.error || 'Failed to load question solution');
      } finally {
        setIsLoading(false);
      }
    };
    fetchQuestion();
  }, [questionId]);

  if (isLoading) {
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

  if (error || !question) {
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
            <p className="ml-3 text-sm font-semibold text-red-800">{error || 'Question not found'}</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      <div className="flex items-center mb-8">
        <button
          onClick={() => window.history.back()}
          className="mr-4 p-2 rounded-full bg-gray-100 hover:bg-gray-200 transition-all duration-200"
        >
          <svg
            xmlns="http://www.w3.org/2000/svg"
            className="h-5 w-5 text-gray-600"
            viewBox="0 0 20 20"
            fill="currentColor"
          >
            <path
              fillRule="evenodd"
              d="M9.707 16.707a1 1 0 01-1.414 0l-6-6a1 1 0 010-1.414l6-6a1 1 0 011.414 1.414L5.414 9H17a1 1 0 110 2H5.414l4.293 4.293a1 1 0 010 1.414z"
              clipRule="evenodd"
            />
          </svg>
        </button>
        <h2 className="text-3xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-indigo-600 to-indigo-400 tracking-tight">
          {parse(question.title || 'Untitled')} - Solution
        </h2>
      </div>

      <div className="bg-white/90 backdrop-blur-sm rounded-2xl shadow-lg p-6 border border-gray-100">
        <div className="space-y-8">
          <div className="flex flex-wrap gap-3">
            <span className="inline-flex items-center px-3 py-1 rounded-full text-xs font-semibold bg-blue-100 text-blue-800">
              Type: {question.type || 'Unknown'}
            </span>
            <span className="inline-flex items-center px-3 py-1 rounded-full text-xs font-semibold bg-green-100 text-green-800">
              Points: {question.points || 0}
            </span>
            <span className="inline-flex items-center px-3 py-1 rounded-full text-xs font-semibold bg-gray-100 text-gray-800">
              Difficulty: {question.difficulty || 'Unknown'}
            </span>
          </div>

          <div>
            <h3 className="text-lg font-semibold text-gray-800 mb-3">Solution</h3>
            {question.type === 'mcq' && question.options?.length > 0 && (
              <div className="mt-2">
                <p className="text-sm text-gray-700">
                  Correct Option: {question.correctOption + 1}. {parse(question.options[question.correctOption] || '')}
                </p>
              </div>
            )}
            {question.type === 'fillInTheBlanks' && question.correctAnswer && (
              <div className="mt-2">
                <p className="text-sm text-gray-700">Correct Answer: {parse(question.correctAnswer)}</p>
                {question.codeSnippet && (
                  <pre className="mt-3 p-4 bg-gray-50 rounded-lg text-sm text-gray-700 font-mono whitespace-pre-wrap">
                    {stripHtml(question.codeSnippet)}
                  </pre>
                )}
              </div>
            )}
            {question.type === 'coding' && question.templateCode?.length > 0 && (
              <div className="mt-2">
                <p className="text-sm text-gray-700 mb-3">Reference Solutions:</p>
                {question.templateCode.map((tc, idx) => (
                  <div key={idx} className="mt-3">
                    <p className="text-sm font-semibold text-gray-700 mb-2">{tc.language}</p>
                    <pre className="mt-1 p-4 bg-gray-50 rounded-lg text-sm text-gray-700 font-mono whitespace-pre-wrap">
                      {tc.code}
                    </pre>
                  </div>
                ))}
                {question.functionSignature && (
                  <div className="mt-3">
                    <p className="text-sm text-gray-700 mb-2">Function Signature:</p>
                    <pre className="mt-1 p-4 bg-gray-50 rounded-lg text-sm text-gray-700 font-mono">
                      {parse(question.functionSignature)}
                    </pre>
                  </div>
                )}
              </div>
            )}
            {!(question.type === 'mcq' || question.type === 'fillInTheBlanks' || question.type === 'coding') && (
              <p className="mt-2 text-sm text-gray-700">No solution available for this question type.</p>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default QuestionSolution;