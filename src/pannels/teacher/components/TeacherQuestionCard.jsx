import React, { useState, Fragment } from 'react';
import { Link } from 'react-router-dom';
import { Menu, Transition } from '@headlessui/react';
import { publishQuestion, unpublishQuestion, disableQuestion, enableQuestion } from '../../../common/services/api';
import parse from 'html-react-parser';

const TeacherQuestionCard = ({ question, classId, onQuestionUpdate }) => {
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');
  const linkState = classId ? { classId } : undefined;

  // Get class-specific settings
  const classEntry = question.classes?.find((c) => c.classId?.toString() === classId || c.classId?._id?.toString() === classId);
  const isPublished = classEntry?.isPublished || false;
  const isDisabled = classEntry?.isDisabled || false;

  const handlePublishToggle = async () => {
    if (!classId) {
      setError('Cannot toggle publish status: No class assigned');
      return;
    }
    setIsLoading(true);
    setError('');
    try {
      if (isPublished) {
        await unpublishQuestion(question._id, { classId });
      } else {
        await publishQuestion(question._id, { classId });
      }
      if (onQuestionUpdate) {
        onQuestionUpdate();
      }
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to toggle publish status');
    } finally {
      setIsLoading(false);
    }
  };

  const handleDisableToggle = async () => {
    if (!classId) {
      setError('Cannot toggle disable status: No class assigned');
      return;
    }
    setIsLoading(true);
    setError('');
    try {
      if (isDisabled) {
        await enableQuestion(question._id, { classId });
      } else {
        await disableQuestion(question._id, { classId });
      }
      if (onQuestionUpdate) {
        onQuestionUpdate();
      }
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to toggle disable status');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="relative backdrop-blur-sm rounded-xl shadow-md border transition-all duration-300 hover:shadow-lg hover:-translate-y-1 z-0 hover:z-[100]" 
         style={{ backgroundColor: 'var(--card-white)', borderColor: 'var(--card-border)' }}>
      {/* Three-dot menu in top-right corner */}
      <div className="absolute top-3 right-3 z-[110]">
        <Menu as="div" className="relative inline-block text-left">
          <Menu.Button className="inline-flex items-center p-2 rounded-lg hover:bg-gray-100 transition-colors" 
                       style={{ backgroundColor: 'var(--background-light)' }}>
            <svg className="h-5 w-5" style={{ color: 'var(--text-secondary)' }} viewBox="0 0 20 20" fill="currentColor">
              <path d="M10 6a2 2 0 110-4 2 2 0 010 4zM10 12a2 2 0 110-4 2 2 0 010 4zM10 18a2 2 0 110-4 2 2 0 010 4z" />
            </svg>
          </Menu.Button>
          <Transition
            as={Fragment}
            enter="transition ease-out duration-100"
            enterFrom="transform opacity-0 scale-95"
            enterTo="transform opacity-100 scale-100"
            leave="transition ease-in duration-75"
            leaveFrom="transform opacity-100 scale-100"
            leaveTo="transform opacity-0 scale-95"
          >
            <Menu.Items className="absolute right-0 z-[999] mt-2 w-56 origin-top-right rounded-lg shadow-lg ring-1 ring-black ring-opacity-5 focus:outline-none divide-y backdrop-blur-sm" 
                        style={{ backgroundColor: 'var(--card-white)', borderColor: 'var(--card-border)', border: '1px solid' }}>
              <div className="py-1">
                <Menu.Item>
                  {({ active }) => (
                    <Link
                      to={`/teacher/questions/${question._id}/view`}
                      state={linkState}
                      className={`${active ? 'bg-indigo-50' : ''} group flex items-center px-4 py-2 text-sm`}
                      style={{ color: 'var(--text-primary)' }}
                    >
                      <svg className="mr-3 h-5 w-5" style={{ color: 'var(--text-secondary)' }} fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                      </svg>
                      View Question
                    </Link>
                  )}
                </Menu.Item>
                <Menu.Item>
                  {({ active }) => (
                    <Link
                      to={`/teacher/questions/${question._id}/statement`}
                      state={linkState}
                      className={`${active ? 'bg-indigo-50' : ''} group flex items-center px-4 py-2 text-sm`}
                      style={{ color: 'var(--text-primary)' }}
                    >
                      <svg className="mr-3 h-5 w-5" style={{ color: 'var(--text-secondary)' }} fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                      </svg>
                      View Statement
                    </Link>
                  )}
                </Menu.Item>
                <Menu.Item>
                  {({ active }) => (
                    <Link
                      to={`/teacher/questions/${question._id}/solution`}
                      state={linkState}
                      className={`${active ? 'bg-indigo-50' : ''} group flex items-center px-4 py-2 text-sm`}
                      style={{ color: 'var(--text-primary)' }}
                    >
                      <svg className="mr-3 h-5 w-5" style={{ color: 'var(--text-secondary)' }} fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4" />
                      </svg>
                      View Solution
                    </Link>
                  )}
                </Menu.Item>
                {question.type === 'coding' && (
                  <Menu.Item>
                    {({ active }) => (
                      <Link
                        to={`/teacher/questions/${question._id}/test-cases`}
                      state={linkState}
                        className={`${active ? 'bg-indigo-50' : ''} group flex items-center px-4 py-2 text-sm`}
                        style={{ color: 'var(--text-primary)' }}
                      >
                        <svg className="mr-3 h-5 w-5" style={{ color: 'var(--text-secondary)' }} fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
                        </svg>
                        View Test Cases
                      </Link>
                    )}
                  </Menu.Item>
                )}
              </div>
              <div className="py-1">
                <Menu.Item>
                  {({ active }) => (
                    <Link
                      to={`/teacher/questions/${question._id}/edit`}
                      state={linkState}
                      className={`${active ? 'bg-indigo-50' : ''} group flex items-center px-4 py-2 text-sm`}
                      style={{ color: 'var(--text-primary)' }}
                    >
                      <svg className="mr-3 h-5 w-5" style={{ color: 'var(--text-secondary)' }} fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                      </svg>
                      Edit Question
                    </Link>
                  )}
                </Menu.Item>
                <Menu.Item>
                  {({ active }) => (
                    <Link
                      to={`/teacher/questions/${question._id}/preview`}
                      state={linkState}
                      className={`${active ? 'bg-indigo-50' : ''} group flex items-center px-4 py-2 text-sm`}
                      style={{ color: 'var(--text-primary)' }}
                    >
                      <svg className="mr-3 h-5 w-5" style={{ color: 'var(--text-secondary)' }} fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                      </svg>
                      Preview as Student
                    </Link>
                  )}
                </Menu.Item>
              </div>
              <div className="py-1">
                <Menu.Item>
                  {({ active }) => (
                    <button
                      onClick={handlePublishToggle}
                      disabled={isLoading}
                      className={`${active ? (isPublished ? 'bg-gray-50' : 'bg-green-50') : ''} ${isLoading ? 'opacity-50 cursor-wait' : ''} group flex items-center w-full px-4 py-2 text-sm cursor-pointer`}
                      style={{ color: isPublished ? '#16a34a' : '#16a34a' }}
                    >
                      <svg className="mr-3 h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                      </svg>
                      {isLoading ? 'Processing...' : isPublished ? 'Unpublish Question' : 'Publish Question'}
                    </button>
                  )}
                </Menu.Item>
                <Menu.Item>
                  {({ active }) => (
                    <button
                      onClick={handleDisableToggle}
                      disabled={isLoading}
                      className={`${active ? (isDisabled ? 'bg-gray-50' : 'bg-red-50') : ''} ${isLoading ? 'opacity-50 cursor-wait' : ''} group flex items-center w-full px-4 py-2 text-sm cursor-pointer`}
                      style={{ color: '#dc2626' }}
                    >
                      <svg className="mr-3 h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M18.364 18.364A9 9 0 005.636 5.636m12.728 12.728A9 9 0 015.636 5.636m12.728 12.728L5.636 5.636" />
                      </svg>
                      {isLoading ? 'Processing...' : isDisabled ? 'Enable Question' : 'Disable Question'}
                    </button>
                  )}
                </Menu.Item>
              </div>
            </Menu.Items>
          </Transition>
        </Menu>
      </div>

      {/* Card Content */}
      <div className="p-4">
        <h3 className="text-lg font-semibold pr-8 mb-2 line-clamp-2" 
            style={{ color: 'var(--text-heading)' }}
            dangerouslySetInnerHTML={{ __html: question.title || 'No Title' }} />
        
        <p className="text-xs mb-2 font-mono" 
           style={{ color: 'var(--text-secondary)' }}>
          ID: {question._id}
        </p>
        
        <p className="text-sm mb-3 line-clamp-3" 
           style={{ color: 'var(--text-secondary)' }}
           dangerouslySetInnerHTML={{ __html: question.description || 'No Description' }} />
        
        <div className="flex flex-wrap gap-2">
          <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold ${
            question.difficulty === 'easy' ? 'bg-green-100 text-green-700' :
            question.difficulty === 'medium' ? 'bg-yellow-100 text-yellow-700' :
            'bg-red-100 text-red-700'
          }`}>
            {question.difficulty}
          </span>
          <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold bg-blue-100 text-blue-700">
            {question.type}
          </span>
          <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold bg-purple-100 text-purple-700">
            {question.points || 10} points
          </span>
          <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold ${
            isPublished ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-600'
          }`}>
            {isPublished ? 'Published' : 'Unpublished'}
          </span>
          {isDisabled && (
            <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold bg-red-100 text-red-700">
              Disabled
            </span>
          )}
        </div>
      </div>

      {error && (
        <div className="mx-4 mb-4 p-2 bg-red-50/80 backdrop-blur-sm border-l-4 border-red-500 rounded-lg">
          <p className="text-sm text-red-700">{error}</p>
        </div>
      )}
    </div>
  );
};

export default TeacherQuestionCard;