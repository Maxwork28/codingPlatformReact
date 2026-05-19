import React, { useState, Fragment } from 'react';
import { Link } from 'react-router-dom';
import { Menu, Transition, Portal } from '@headlessui/react';
import { publishQuestion, unpublishQuestion, disableQuestion, enableQuestion } from '../../../common/services/api';
import parse from 'html-react-parser';

/** API helpers throw the message string; axios errors have response.data.error */
const getApiErrorMessage = (err, fallback) =>
  (typeof err === 'string' && err) || err?.response?.data?.error || fallback;

const TeacherQuestionCard = ({ question, classId, onQuestionUpdate, summary }) => {
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
      setError(getApiErrorMessage(err, 'Failed to toggle publish status'));
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
      setError(getApiErrorMessage(err, 'Failed to toggle disable status'));
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="relative backdrop-blur-sm rounded-xl shadow-md border transition-all duration-300 hover:shadow-lg hover:-translate-y-1 z-10 hover:z-20" 
         style={{ backgroundColor: 'var(--card-white)', borderColor: 'var(--card-border)' }}>
      {/* Three-dot menu in top-right corner */}
      <div className="absolute top-3 right-3 z-50">
        <Menu as="div" className="relative inline-block text-left" style={{ position: 'relative', zIndex: 10000 }}>
          {({ open }) => (
            <>
              <Menu.Button 
                className="inline-flex items-center p-2 rounded-lg hover:bg-gray-100 transition-colors focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2" 
                style={{ backgroundColor: 'var(--background-light)', pointerEvents: 'auto' }}
                onClick={(e) => {
                  e.stopPropagation();
                }}
              >
                <svg className="h-5 w-5" style={{ color: 'var(--text-secondary)' }} viewBox="0 0 20 20" fill="currentColor">
                  <path d="M10 6a2 2 0 110-4 2 2 0 010 4zM10 12a2 2 0 110-4 2 2 0 010 4zM10 18a2 2 0 110-4 2 2 0 010 4z" />
                </svg>
              </Menu.Button>
              <Transition
                show={open}
                as={Fragment}
                enter="transition ease-out duration-100"
                enterFrom="transform opacity-0 scale-95"
                enterTo="transform opacity-100 scale-100"
                leave="transition ease-in duration-75"
                leaveFrom="transform opacity-100 scale-100"
                leaveTo="transform opacity-0 scale-95"
              >
                <Portal>
                  <Menu.Items 
                    anchor="bottom end"
                    className="w-56 origin-top-right rounded-lg shadow-2xl ring-1 ring-black ring-opacity-5 focus:outline-none divide-y backdrop-blur-sm mt-2" 
                    style={{ 
                      backgroundColor: 'var(--card-white)', 
                      borderColor: 'var(--card-border)', 
                      border: '1px solid',
                      zIndex: 99999
                    }}
                  >
              <div className="py-1">
                <Menu.Item>
                  {({ active, close }) => (
                    <Link
                      to={classId ? `/teacher/classes/${classId}/questions/${question._id}` : `/teacher/questions/${question._id}/view`}
                      state={linkState}
                      onClick={close}
                      className={`${active ? 'bg-indigo-50' : ''} group flex items-center px-4 py-2 text-sm`}
                      style={{ color: 'var(--text-primary)' }}
                    >
                      <svg className="mr-3 h-5 w-5" style={{ color: 'var(--text-secondary)' }} fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                      </svg>
                      View & Attempt Question
                    </Link>
                  )}
                </Menu.Item>
                <Menu.Item>
                  {({ active, close }) => (
                    <Link
                      to={`/teacher/questions/${question._id}/statement`}
                      state={linkState}
                      onClick={close}
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
                  {({ active, close }) => (
                    <Link
                      to={`/teacher/questions/${question._id}/solution`}
                      state={linkState}
                      onClick={close}
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
                {(question.type === 'coding' || question.type === 'codingWithDriver') && (
                  <Menu.Item>
                    {({ active, close }) => (
                      <Link
                        to={`/teacher/questions/${question._id}/test-cases`}
                        state={linkState}
                        onClick={close}
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
                  {({ active, close }) => (
                    <Link
                      to={`/teacher/questions/${question._id}/edit`}
                      state={linkState}
                      onClick={close}
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
                  {({ active, close }) => (
                    <Link
                      to={`/teacher/questions/${question._id}/preview`}
                      state={linkState}
                      onClick={close}
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
                  {({ active, close }) => (
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        handlePublishToggle();
                        close();
                      }}
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
                  {({ active, close }) => (
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        handleDisableToggle();
                        close();
                      }}
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
                </Portal>
              </Transition>
            </>
          )}
        </Menu>
      </div>

      {/* Card Content - clickable to open question summary + attempt (menu has stopPropagation) */}
      <div className="p-4">
        {classId ? (
          <Link
            to={`/teacher/classes/${classId}/questions/${question._id}`}
            state={linkState}
            className="block focus:outline-none focus:ring-0 cursor-pointer rounded-lg -m-1 p-1 hover:bg-gray-50/80 transition-colors"
          >
            <h3 className="text-lg font-semibold pr-8 mb-2 line-clamp-2" 
                style={{ color: 'var(--text-heading)' }}
                dangerouslySetInnerHTML={{ __html: question.title || 'No Title' }} />
            <p className="text-xs mb-2 font-mono" style={{ color: 'var(--text-secondary)' }}>ID: {question._id}</p>
            <p className="text-sm mb-3 line-clamp-3" style={{ color: 'var(--text-secondary)' }} dangerouslySetInnerHTML={{ __html: question.description || 'No Description' }} />
            {summary && (
              <div className="flex gap-3 mb-3 text-xs">
                <span title="Attempted">📝 {summary.attempted || 0}</span>
                <span className="text-green-600" title="Successful">✓ {summary.successful || 0}</span>
                <span className="text-red-600" title="Unsuccessful">✗ {summary.unsuccessful || 0}</span>
              </div>
            )}
          </Link>
        ) : (
          <>
            <h3 className="text-lg font-semibold pr-8 mb-2 line-clamp-2" style={{ color: 'var(--text-heading)' }} dangerouslySetInnerHTML={{ __html: question.title || 'No Title' }} />
            <p className="text-xs mb-2 font-mono" style={{ color: 'var(--text-secondary)' }}>ID: {question._id}</p>
            <p className="text-sm mb-3 line-clamp-3" style={{ color: 'var(--text-secondary)' }} dangerouslySetInnerHTML={{ __html: question.description || 'No Description' }} />
            {summary && (
              <div className="flex gap-3 mb-3 text-xs">
                <span title="Attempted">📝 {summary.attempted || 0}</span>
                <span className="text-green-600" title="Successful">✓ {summary.successful || 0}</span>
                <span className="text-red-600" title="Unsuccessful">✗ {summary.unsuccessful || 0}</span>
              </div>
            )}
          </>
        )}
        
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