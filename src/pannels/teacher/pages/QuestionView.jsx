import React, { useState, useEffect } from 'react';
import { useParams, useLocation, Link } from 'react-router-dom';
import { getQuestion } from '../../../common/services/api';
import parse from 'html-react-parser';

const QuestionView = () => {
  const { questionId } = useParams();
  const { state } = useLocation();
  const classId = state?.classId;

  const [question, setQuestion] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const linkState = classId ? { classId } : undefined;

  const stripHtml = (html) => {
    if (!html || typeof html !== 'string') return '';
    const div = document.createElement('div');
    div.innerHTML = html;
    return div.textContent || div.innerText || '';
  };

  useEffect(() => {
    const fetchQuestion = async () => {
      try {
        const response = await getQuestion(questionId, classId);
        setQuestion(response.data?.question || response.data);
        setError('');
      } catch (err) {
        setError(err.response?.data?.error || err.message || 'Failed to fetch question');
      } finally {
        setLoading(false);
      }
    };
    if (questionId) fetchQuestion();
  }, [questionId, classId]);

  if (loading) {
    return (
      <div className="flex justify-center items-center py-16">
        <div className="w-12 h-12 border-4 border-t-transparent rounded-full animate-spin border-indigo-600" />
      </div>
    );
  }

  if (error || !question) {
    return (
      <div className="max-w-2xl mx-auto p-6">
        <div className="p-4 bg-red-50 rounded-lg border border-red-200">
          <p className="text-red-700">{error || 'Question not found'}</p>
          <Link to={classId ? `/teacher/classes/${classId}` : '/teacher/questions'} className="text-indigo-600 hover:underline mt-2 inline-block">
            ← Back
          </Link>
        </div>
      </div>
    );
  }

  const isCoding = ['coding', 'fillInTheBlanksCoding', 'codingWithDriver'].includes(question.type);

  return (
    <div className="max-w-4xl mx-auto p-6 space-y-6">
      <div className="flex items-center justify-between">
        <Link to={classId ? `/teacher/classes/${classId}` : '/teacher/questions'} className="text-indigo-600 hover:underline flex items-center gap-2">
          ← Back to {classId ? 'Class' : 'Questions'}
        </Link>
      </div>

      <div className="bg-white rounded-xl shadow-lg border border-gray-200 overflow-hidden">
        <div className="p-6 border-b border-gray-200">
          <h1 className="text-2xl font-bold text-gray-900">{stripHtml(question.title)}</h1>
          <div className="flex flex-wrap gap-2 mt-2">
            <span className="px-2 py-0.5 rounded text-xs font-medium bg-gray-100 text-gray-700">{question.type}</span>
            <span className="px-2 py-0.5 rounded text-xs font-medium bg-indigo-100 text-indigo-700">{question.difficulty}</span>
            <span className="px-2 py-0.5 rounded text-xs font-medium bg-green-100 text-green-700">{question.points} pts</span>
            {question.timeLimit && (
              <span className="px-2 py-0.5 rounded text-xs font-medium bg-amber-100 text-amber-700">{question.timeLimit}s</span>
            )}
            {question.memoryLimit && (
              <span className="px-2 py-0.5 rounded text-xs font-medium bg-amber-100 text-amber-700">{question.memoryLimit} MB</span>
            )}
          </div>
        </div>

        {question.description && (
          <div className="p-6 border-b border-gray-100">
            <h2 className="text-sm font-semibold text-gray-600 mb-2">Description</h2>
            <div className="prose max-w-none text-gray-700">{parse(question.description)}</div>
          </div>
        )}

        {isCoding && question.starterCode?.length > 0 && (
          <div className="p-6 border-b border-gray-100">
            <h2 className="text-sm font-semibold text-gray-600 mb-2">Starter Code</h2>
            {question.starterCode.map((sc) => (
              <div key={sc.language} className="mb-4">
                <span className="text-xs font-medium text-gray-500 uppercase">{sc.language}</span>
                <pre className="mt-1 p-4 bg-gray-900 text-gray-100 rounded-lg text-sm overflow-x-auto font-mono">
                  <code>{sc.code || '// No starter code'}</code>
                </pre>
              </div>
            ))}
          </div>
        )}

        <div className="p-6 flex flex-wrap gap-3">
          <Link to={`/teacher/questions/${questionId}/statement`} state={linkState} className="px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 text-sm font-medium">
            View Statement
          </Link>
          <Link to={`/teacher/questions/${questionId}/solution`} state={linkState} className="px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 text-sm font-medium">
            View Solution
          </Link>
          <Link to={`/teacher/questions/${questionId}/preview`} state={linkState} className="px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 text-sm font-medium">
            Preview & Test
          </Link>
          {(question.type === 'coding' || question.type === 'codingWithDriver') && (
            <Link to={`/teacher/questions/${questionId}/test-cases`} state={linkState} className="px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 text-sm font-medium">
              View Test Cases
            </Link>
          )}
          <Link to={`/teacher/questions/${questionId}/edit`} state={linkState} className="px-4 py-2 bg-gray-200 text-gray-800 rounded-lg hover:bg-gray-300 text-sm font-medium">
            Edit
          </Link>
          {classId && (
            <Link to={`/teacher/classes/${classId}/questions/${questionId}`} state={linkState} className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 text-sm font-medium">
              Attempt Question
            </Link>
          )}
        </div>
      </div>
    </div>
  );
};

export default QuestionView;
