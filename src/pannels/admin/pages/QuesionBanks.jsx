import React, { useState, useEffect } from 'react';

import { Link, useNavigate } from 'react-router-dom';
import { useSelector } from 'react-redux';
import {
  getAllQuestionsPaginated,
  adminEditQuestion,
  adminDeleteQuestion,
  adminSearchQuestionsById
} from '../../../common/services/api';
import parse from 'html-react-parser';
import { TrashIcon, MagnifyingGlassIcon } from '@heroicons/react/24/outline';
const QuestionBank = () => {
  const navigate = useNavigate();
  const { user } = useSelector((state) => state.auth);
  console.log('[QuestionBank] Component mounted, user state:', { user, role: user?.role });
  const [questions, setQuestions] = useState([]);
  const [filteredQuestions, setFilteredQuestions] = useState([]);
  const [searchId, setSearchId] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');
  const [currentPage, setCurrentPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  console.log('[QuestionBank] Initial state:', { questions, filteredQuestions, searchId, isLoading, error, message, currentPage, totalPages });
  // Strip HTML tags for safe display
  const stripHtml = (html) => {
    if (!html || typeof html !== 'string') {
      console.log('[QuestionBank] stripHtml: Invalid HTML input:', html);
      return '';
    }
    const div = document.createElement('div');
    div.innerHTML = html;
    const result = div.textContent || div.innerText || '';
    console.log('[QuestionBank] stripHtml result:', result);
    return result;
  };
  // Fetch paginated questions
  useEffect(() => {
    console.log('[QuestionBank] useEffect triggered with dependencies:', { user, currentPage });
    const fetchQuestions = async () => {
      setIsLoading(true);
      console.log('[QuestionBank] Fetching questions for page:', currentPage);
      try {
        const response = await getAllQuestionsPaginated({ page: currentPage, limit: 10 });
        console.log('[QuestionBank] Questions fetched:', response.data);
        console.log('[QuestionBank] Pagination data:', {
          totalPages: response.data.totalPages,
          questionCount: response.data.questions?.length,
          response: response.data
        });
        setQuestions(response.data.questions);
        setFilteredQuestions(response.data.questions);
        setTotalPages(response.data.totalPages || 1);
        console.log('[QuestionBank] Updated state after fetch:', {
          questions: response.data.questions,
          totalPages: response.data.totalPages
        });
      } catch (err) {
        console.error('[QuestionBank] Fetch error:', err);
        setError(err.message || 'Failed to fetch questions');
        console.log('[QuestionBank] Error state updated:', err.message);
      } finally {
        setIsLoading(false);
        console.log('[QuestionBank] Loading state set to false');
      }
    };
    console.log('[QuestionBank] Initiating fetchQuestions');
    fetchQuestions();
  }, [user, currentPage]);
  // Handle search by question ID
  const handleSearch = async () => {
    console.log('[QuestionBank] Search button clicked with searchId:', searchId);
    if (!searchId.trim()) {
      console.log('[QuestionBank] Search ID is empty, resetting to all questions');
      setFilteredQuestions(questions);
      setError('');
      setMessage('');
      return;
    }
    setIsLoading(true);
    setError('');
    setMessage('');
    console.log('[QuestionBank] Searching questions with ID:', searchId);
    try {
      const response = await adminSearchQuestionsById(searchId);
      console.log('[QuestionBank] Search response:', response.data);
      setFilteredQuestions([response.data.question].filter(q => q));
      console.log('[QuestionBank] Filtered questions after search:', [response.data.question].filter(q => q));
      setMessage(response.data.question ? 'Question found!' : 'No question found for this ID.');
      setTimeout(() => {
        setMessage('');
        console.log('[QuestionBank] Cleared search message');
      }, 3000);
    } catch (err) {
      console.error('[QuestionBank] Search error:', err);
      setError(err.message || 'Failed to search question');
      setFilteredQuestions([]);
      console.log('[QuestionBank] Search error state:', { error: err.message, filteredQuestions: [] });
    } finally {
      setIsLoading(false);
      console.log('[QuestionBank] Search loading state set to false');
    }
  };
  // Handle question deletion
  const handleDeleteQuestion = async (questionId) => {
    console.log('[QuestionBank] Attempting to delete question:', questionId);
    setIsLoading(true);
    setError('');
    setMessage('');
    console.log('[QuestionBank] Pre-delete state:', { isLoading, error, message });
    try {
      await adminDeleteQuestion(questionId);
      setMessage('Question deleted successfully!');
      setQuestions(questions.filter(q => q._id !== questionId));
      setFilteredQuestions(filteredQuestions.filter(q => q._id !== questionId));
      console.log('[QuestionBank] Question deleted, updated state:', {
        questions: questions.filter(q => q._id !== questionId),
        filteredQuestions: filteredQuestions.filter(q => q._id !== questionId)
      });
      setTimeout(() => {
        setMessage('');
        console.log('[QuestionBank] Cleared success message');
      }, 3000);
    } catch (err) {
      console.error('[QuestionBank] Delete error:', err);
      setError(err.message || 'Failed to delete question');
      console.log('[QuestionBank] Delete error state:', err.message);
    } finally {
      setIsLoading(false);
      console.log('[QuestionBank] Delete loading state set to false');
    }
  };
  // Handle page change
  const handlePageChange = (newPage) => {
    console.log('[QuestionBank] Attempting to change page to:', newPage);
    if (newPage >= 1 && newPage <= totalPages) {
      setCurrentPage(newPage);
      console.log('[QuestionBank] Page changed to:', newPage);
    } else {
      console.log('[QuestionBank] Page change rejected, out of bounds:', { newPage, totalPages });
    }
  };
  console.log('[QuestionBank] Rendering component with state:', {
    user,
    questions,
    filteredQuestions,
    searchId,
    isLoading,
    error,
    message,
    currentPage,
    totalPages
  });
  console.log('[QuestionBank] Pagination visibility check:', { totalPages, shouldShowPagination: totalPages > 1 });
  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      {/* Header */}
      <div className="flex justify-between items-center mb-10">
        <h2 className="text-3xl font-bold tracking-tight" style={{ color: 'var(--text-heading)' }}>
          Admin Question Management
        </h2>
        <Link
          to="/admin/questions/create"
          className="inline-flex items-center px-4 py-2 rounded-lg text-sm font-semibold text-white bg-gray-600 hover:bg-gray-700 focus:outline-none focus:ring-2 focus:ring-gray-500 focus:ring-offset-2 transition-all duration-300"
        >
          Create New Question
        </Link>
      </div>
      {/* Loading Overlay */}
      {isLoading && (
        <div className="fixed inset-0 bg-gray-600 bg-opacity-60 flex items-center justify-center z-50">
          <div className="p-8 rounded-2xl shadow-xl max-w-sm w-full" style={{ backgroundColor: 'var(--card-white)', backdropFilter: 'blur(8px)' }}>
            <div className="flex items-center justify-center">
              <svg
                className="animate-spin h-10 w-10 text-indigo-600"
                xmlns="http://www.w3.org/2000/svg"
                fill="none"
                viewBox="0 0 24 24"
              >
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                <path
                  className="opacity-75"
                  fill="currentColor"
                  d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                ></path>
              </svg>
              <span className="ml-4 text-lg font-semibold" style={{ color: 'var(--text-primary)' }}>Loading...</span>
            </div>
          </div>
        </div>
      )}
      {/* Error Message */}
      {error && (
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
      )}
      {/* Success Message */}
      {message && (
        <div className="mb-6 p-4 rounded-xl bg-green-50/80 backdrop-blur-sm border border-green-200 shadow-sm">
          <div className="flex items-center">
            <svg
              className="h-6 w-6 text-green-500"
              xmlns="http://www.w3.org/2000/svg"
              viewBox="0 0 20 20"
              fill="currentColor"
            >
              <path
                fillRule="evenodd"
                d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z"
                clipRule="evenodd"
              />
            </svg>
            <p className="ml-3 text-sm font-semibold text-green-800">{message}</p>
          </div>
        </div>
      )}
      {/* Search Bar */}
      <div className="rounded-2xl shadow-lg p-6 border mb-6" style={{ backgroundColor: 'var(--card-white)', borderColor: 'var(--card-border)' }}>
        <h3 className="text-xl font-semibold mb-4" style={{ color: 'var(--text-primary)' }}>Search Questions</h3>
        <div className="relative flex items-center mb-4">
          <div className="relative flex-grow">
            <input
              type="text"
              value={searchId}
              onChange={(e) => {
                console.log('[QuestionBank] Search ID changed:', e.target.value);
                setSearchId(e.target.value);
              }}
              placeholder="Search by question ID..."
              className="block w-full rounded-lg border shadow-sm sm:text-sm transition-all duration-200 p-2 pl-10"
              style={{ borderColor: 'var(--card-border)', backgroundColor: 'var(--background-content)' }}
            />
            <MagnifyingGlassIcon className="h-5 w-5 text-gray-400 absolute left-3 top-1/2 transform -translate-y-1/2" />
          </div>
          <button
            onClick={() => {
              console.log('[QuestionBank] Search button clicked');
              handleSearch();
            }}
            disabled={isLoading}
            className="ml-2 inline-flex items-center px-4 py-2 rounded-lg text-sm font-semibold text-white bg-gray-600 hover:bg-gray-700 focus:outline-none focus:ring-2 focus:ring-gray-500 focus:ring-offset-2 disabled:bg-gray-400 disabled:cursor-not-allowed"
          >
            Search
          </button>
        </div>
      </div>
      {/* Question List */}
      <div className="rounded-2xl shadow-lg p-6 border" style={{ backgroundColor: 'var(--card-white)', borderColor: 'var(--card-border)' }}>
        <h3 className="text-xl font-semibold mb-4" style={{ color: 'var(--text-primary)' }}>Question Bank</h3>
        {filteredQuestions.length === 0 ? (
          <p className="text-sm" style={{ color: 'var(--text-secondary)' }}>No questions found.</p>
        ) : (
          <div className="space-y-4">
            {filteredQuestions.map((question) => {
              console.log('[QuestionBank] Rendering question:', question);
              return (
                <div
                  key={question._id}
                  className="flex justify-between items-center p-4 rounded-lg shadow-sm"
                  style={{ backgroundColor: 'var(--background-light)' }}
                >
                  <div>
                    <h4 className="text-sm font-semibold" style={{ color: 'var(--text-primary)' }}>{stripHtml(question.title)}</h4>
                    <div className="mt-2 flex flex-wrap gap-2">
                      <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-800">
                        Type: {question.type || 'Unknown'}
                      </span>
                      <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-800">
                        Points: {question.points || 0}
                      </span>
                      <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium" style={{ backgroundColor: 'var(--background-light)', color: 'var(--text-primary)' }}>
                        Difficulty: {question.difficulty || 'Unknown'}
                      </span>
                      <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-purple-100 text-purple-800">
                        ID: {question._id}
                      </span>
                    </div>
                  </div>
                  <div className="flex space-x-2">
                    <Link
                      to={`/admin/questions/${question._id}/edit`}
                      className="inline-flex items-center px-3 py-1 border text-sm font-medium rounded-md bg-gray-600 hover:bg-gray-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-gray-500"
                      style={{ borderColor: 'var(--card-border)', color: 'white' }}
                      onClick={() => console.log('[QuestionBank] Navigating to edit question:', question._id)}
                    >
                      Edit
                    </Link>
                    <button
                      onClick={() => {
                        console.log('[QuestionBank] Delete button clicked for question:', question._id);
                        handleDeleteQuestion(question._id);
                      }}
                      disabled={isLoading}
                      className="inline-flex items-center px-3 py-1 border border-transparent text-sm font-medium rounded-md text-white bg-gray-600 hover:bg-gray-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-gray-500 disabled:bg-gray-400 disabled:cursor-not-allowed"
                    >
                      <TrashIcon className="h-4 w-4 mr-1" />
                      Delete
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
      {/* Pagination */}
      {totalPages > 1 ? (
        <div className="mt-6 flex justify-center space-x-2">
          <button
            onClick={() => {
              console.log('[QuestionBank] Previous page button clicked');
              handlePageChange(currentPage - 1);
            }}
            disabled={currentPage === 1}
            className="px-4 py-2 rounded-lg text-sm font-semibold border hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
            style={{ color: 'var(--text-primary)', backgroundColor: 'var(--card-white)', borderColor: 'var(--card-border)' }}
          >
            Previous
          </button>
          <span className="px-4 py-2 text-sm font-semibold" style={{ color: 'var(--text-primary)' }}>
            Page {currentPage} of {totalPages}
          </span>
          <button
            onClick={() => {
              console.log('[QuestionBank] Next page button clicked');
              handlePageChange(currentPage + 1);
            }}
            disabled={currentPage === totalPages}
            className="px-4 py-2 rounded-lg text-sm font-semibold border hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
            style={{ color: 'var(--text-primary)', backgroundColor: 'var(--card-white)', borderColor: 'var(--card-border)' }}
          >
            Next
          </button>
        </div>
      ) : (
        <div className="mt-6 text-center">
          <p className="text-sm" style={{ color: 'var(--text-secondary)' }}>No pagination available (Total Pages: {totalPages})</p>
        </div>
      )}
    </div>
  );
};

export default QuestionBank;