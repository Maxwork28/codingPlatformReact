import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { publishQuestion, unpublishQuestion, disableQuestion, enableQuestion } from '../../../common/services/api';
import parse from 'html-react-parser';

const TeacherQuestionCard = ({ question, onQuestionUpdate }) => {
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');

  // Use question.classId directly
  const effectiveClassId = question.classId;

  console.log('[TeacherQuestionCard] Rendered:', {
    id: question._id,
    title: question.title,
    classId: effectiveClassId,
    isPublished: question.isPublished,
    isDisabled: question.isDisabled,
  });

  const handlePublishToggle = async () => {
    if (!effectiveClassId) {
      console.error('[TeacherQuestionCard] No classId provided for question:', question._id);
      setError('Cannot toggle publish status: No class assigned');
      return;
    }
    console.log('[TeacherQuestionCard] Toggling publish:', {
      questionId: question._id,
      classId: effectiveClassId,
      current: question.isPublished,
    });
    setIsLoading(true);
    setError('');
    try {
      if (question.isPublished) {
        await unpublishQuestion(question._id, { classId: effectiveClassId });
        if (onQuestionUpdate) {
          onQuestionUpdate({ ...question, isPublished: false });
        }
      } else {
        await publishQuestion(question._id, { classId: effectiveClassId });
        if (onQuestionUpdate) {
          onQuestionUpdate({ ...question, isPublished: true });
        }
      }
    } catch (err) {
      console.error('[TeacherQuestionCard] Publish toggle error:', err.message, err.response?.data);
      setError(err.response?.data?.error || 'Failed to toggle publish status');
    } finally {
      setIsLoading(false);
    }
  };

  const handleDisableToggle = async () => {
    if (!effectiveClassId) {
      console.error('[TeacherQuestionCard] No classId provided for question:', question._id);
      setError('Cannot toggle disable status: No class assigned');
      return;
    }
    console.log('[TeacherQuestionCard] Toggling disable:', {
      questionId: question._id,
      classId: effectiveClassId,
      current: question.isDisabled,
    });
    setIsLoading(true);
    setError('');
    try {
      if (question.isDisabled) {
        await enableQuestion(question._id, { classId: effectiveClassId });
        if (onQuestionUpdate) {
          onQuestionUpdate({ ...question, isDisabled: false });
        }
      } else {
        await disableQuestion(question._id, { classId: effectiveClassId });
        if (onQuestionUpdate) {
          onQuestionUpdate({ ...question, isDisabled: true });
        }
      }
    } catch (err) {
      console.error('[TeacherQuestionCard] Disable toggle error:', err.message, err.response?.data);
      setError(err.response?.data?.error || 'Failed to toggle disable status');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="flex-1 p-4 bg-white/90 backdrop-blur-sm rounded-2xl shadow-lg border border-gray-100">
      <div className="flex justify-between items-start">
        <div>
          <h3 className="text-lg font-semibold text-gray-900 prose">{parse(question.title || 'No Title')}</h3>
          <p className="mt-2 text-gray-600 prose">{parse(question.description || 'No Description')}</p>
          <div className="mt-2 flex flex-wrap gap-2">
            <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-800">
              Type: {question.type || 'Unknown'}
            </span>
            <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-800">
              Points: {question.points || 0}
            </span>
            <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-purple-100 text-purple-800">
              {question.isPublished ? 'Published' : 'Unpublished'}
            </span>
            <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-yellow-100 text-yellow-800">
              {question.isDisabled ? 'Disabled' : 'Enabled'}
            </span>
          </div>
        </div>
      </div>
      <div className="mt-4 flex flex-wrap gap-2">
        <Link
          to={`/teacher/questions/${question._id}/statement`}
          className="inline-flex items-center px-3 py-1 border border-gray-300 text-sm font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500"
        >
          View Statement
        </Link>
        <Link
          to={`/teacher/questions/${question._id}/solution`}
          className="inline-flex items-center px-3 py-1 border border-gray-300 text-sm font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500"
        >
          View Solution
        </Link>
        {question.type === 'coding' && (
          <Link
            to={`/teacher/questions/${question._id}/test-cases`}
            className="inline-flex items-center px-3 py-1 border border-gray-300 text-sm font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500"
          >
            View Test Cases
          </Link>
        )}
        <Link
          to={`/teacher/questions/${question._id}/edit`}
          className="inline-flex items-center px-3 py-1 border border-gray-300 text-sm font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500"
        >
          Edit Question
        </Link>
        <Link
          to={`/teacher/questions/${question._id}/preview`}
          className="inline-flex items-center px-3 py-1 border border-gray-300 text-sm font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500"
        >
          Preview as Student
        </Link>
        <button
          onClick={handlePublishToggle}
          disabled={isLoading || !effectiveClassId}
          className={`inline-flex items-center px-3 py-1 border border-transparent text-sm font-medium rounded-md text-white focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 ${
            isLoading || !effectiveClassId
              ? 'bg-gray-400 cursor-not-allowed'
              : question.isPublished
              ? 'bg-red-600 hover:bg-red-700'
              : 'bg-green-600 hover:bg-green-700'
          }`}
        >
          {isLoading ? 'Processing...' : question.isPublished ? 'Unpublish' : 'Publish'}
        </button>
        <button
          onClick={handleDisableToggle}
          disabled={isLoading || !effectiveClassId}
          className={`inline-flex items-center px-3 py-1 border border-transparent text-sm font-medium rounded-md text-white focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 ${
            isLoading || !effectiveClassId
              ? 'bg-gray-400 cursor-not-allowed'
              : question.isDisabled
              ? 'bg-green-600 hover:bg-green-700'
              : 'bg-yellow-600 hover:bg-yellow-700'
          }`}
        >
          {isLoading ? 'Processing...' : question.isDisabled ? 'Enable' : 'Disable'}
        </button>
      </div>
      {error && (
        <div className="mt-2 p-2 bg-red-50/80 backdrop-blur-sm border-l-4 border-red-500 rounded-lg">
          <p className="text-sm text-red-700">{error}</p>
        </div>
      )}
    </div>
  );
};

export default TeacherQuestionCard;