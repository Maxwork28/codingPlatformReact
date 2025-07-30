import React, { useEffect, useState } from 'react';
import { useSelector, useDispatch } from 'react-redux';
import { Link } from 'react-router-dom';
import { fetchClasses } from '../../../common/components/redux/classSlice';
import { getAllQuestions, assignQuestionToClass, searchQuestions } from '../../../common/services/api';

const QuestionManagement = () => {
  const dispatch = useDispatch();
  const { classes, status: classStatus, error: classError } = useSelector((state) => state.classes);
  const { user } = useSelector((state) => state.auth);
  const [questions, setQuestions] = useState([]);
  const [filteredQuestions, setFilteredQuestions] = useState([]);
  const [selectedQuestion, setSelectedQuestion] = useState(null);
  const [selectedClassIds, setSelectedClassIds] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');
  const [searchKeyword, setSearchKeyword] = useState('');

  // Strip HTML tags for safe display
  const stripHtml = (html) => {
    if (!html || typeof html !== 'string') return '';
    const div = document.createElement('div');
    div.innerHTML = html;
    return div.textContent || div.innerText || '';
  };

  useEffect(() => {
    if (classStatus === 'idle' && user) {
      console.log('%c[QuestionManagement] Dispatching fetchClasses for user:', 'color: orange;', user.id);
      dispatch(fetchClasses());
    }
  }, [classStatus, dispatch, user]);

  useEffect(() => {
    const fetchQuestions = async () => {
      try {
        console.log('[QuestionManagement] Fetching all questions for teacher:', user.id);
        const response = await getAllQuestions();
        console.log('[QuestionManagement] All questions response:', response.data);
        // Show all questions, not just user's questions
        const allQuestions = response.data.questions;
        console.log('[QuestionManagement] All questions fetched:', allQuestions.length);
        console.log('[QuestionManagement] Questions details:', allQuestions.map(q => ({
          id: q._id,
          title: q.title,
          type: q.type,
          createdBy: q.createdBy._id,
          createdByName: q.createdBy.name,
          classes: q.classes?.length || 0
        })));
        setQuestions(allQuestions);
        setFilteredQuestions(allQuestions);
      } catch (err) {
        console.error('[QuestionManagement] Fetch error:', err.message, err.response?.data);
        setError(err.response?.data?.error || 'Failed to fetch questions');
      } finally {
        setLoading(false);
      }
    };
    if (user) {
      fetchQuestions();
    }
  }, [user]);

  useEffect(() => {
    const searchQuestionsAsync = async () => {
      if (!searchKeyword.trim()) {
        setFilteredQuestions(questions);
        return;
      }
      try {
        console.log('[QuestionManagement] Searching questions with keyword:', searchKeyword);
        const response = await searchQuestions({ title: searchKeyword });
        console.log('[QuestionManagement] Search response:', response);
        // Use all questions from search, not just user's questions
        const allQuestions = response.data.questions;
        console.log('[QuestionManagement] Filtered questions:', allQuestions.length);
        setFilteredQuestions(allQuestions);
      } catch (err) {
        console.error('[QuestionManagement] Search error:', err.message, err.response?.data);
        // Fallback to client-side filtering if search fails
        const filtered = questions.filter(q => 
          stripHtml(q.title).toLowerCase().includes(searchKeyword.toLowerCase()) ||
          (q.tags && q.tags.some(tag => tag.toLowerCase().includes(searchKeyword.toLowerCase())))
        );
        setFilteredQuestions(filtered);
        setError(err.response?.data?.error || 'Search failed, showing filtered results');
      }
    };
    
    // Add debounce to prevent too many API calls
    const timeoutId = setTimeout(() => {
      searchQuestionsAsync();
    }, 300);
    
    return () => clearTimeout(timeoutId);
  }, [searchKeyword, questions, user]);

  const handleAssignQuestion = async () => {
    if (!selectedQuestion || selectedClassIds.length === 0) {
      setError('Please select a question and at least one class');
      return;
    }
    setLoading(true);
    try {
      for (const classId of selectedClassIds) {
        console.log('[QuestionManagement] Assigning question', selectedQuestion._id, 'to class', classId);
        await assignQuestionToClass(selectedQuestion._id, { classId });
      }
      setMessage('Question assigned to classes successfully!');
      setError('');
      const response = await getAllQuestions();
      const userQuestions = response.data.questions.filter((q) => q.createdBy._id === user.id);
      console.log('[QuestionManagement] Refreshed questions:', userQuestions);
      setQuestions(userQuestions);
      setFilteredQuestions(userQuestions);
      setSelectedQuestion(null);
      setSelectedClassIds([]);
      setTimeout(() => setMessage(''), 3000);
    } catch (err) {
      console.error('[QuestionManagement] Assign error:', err.message, err.response?.data);
      setError(err.response?.data?.error || 'Failed to assign question');
      setMessage('');
    } finally {
      setLoading(false);
    }
  };

  const handleClassToggle = (classId) => {
    setSelectedClassIds((prev) =>
      prev.includes(classId) ? prev.filter((id) => id !== classId) : [...prev, classId]
    );
  };

  if (!user) {
    return (
      <div className="p-6 bg-white/90 backdrop-blur-sm rounded-2xl shadow-lg border border-gray-100">
        <p className="text-red-700 font-semibold text-center">You must be logged in to view this page.</p>
      </div>
    );
  }

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      <div className="flex justify-between items-center mb-10">
        <h2 className="text-3xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-indigo-600 to-indigo-400 tracking-tight">
          Question Management
        </h2>
        <Link
          to="/teacher/questions/new"
          className="inline-flex items-center px-4 py-2 rounded-lg text-sm font-semibold text-white bg-indigo-600 hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2 transition-all duration-300"
        >
          Create New Question
        </Link>
      </div>

      {loading || classStatus === 'loading' ? (
        <div className="flex justify-center items-center py-16 bg-white/90 backdrop-blur-sm rounded-2xl shadow-lg border border-gray-100">
          <div className="w-12 h-12 border-4 border-indigo-500 border-t-transparent rounded-full animate-spin"></div>
        </div>
      ) : (
        <>
          {(error || classError) && (
            <div className="flex items-center p-4 mb-6 bg-red-50/80 backdrop-blur-sm rounded-xl shadow-sm border border-red-200">
              <svg
                className="h-6 w-6 text-red-500 mr-3"
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
              <div>
                <h3 className="text-sm font-semibold text-red-800">Error</h3>
                <p className="mt-1 text-sm text-red-700">{error || classError}</p>
              </div>
            </div>
          )}

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

          <div className="bg-white/90 backdrop-blur-sm rounded-2xl shadow-lg p-6 border border-gray-100 mb-6">
            <h3 className="text-xl font-semibold text-gray-800 mb-4">Search Questions</h3>
            <div className="mb-4">
              <input
                type="text"
                value={searchKeyword}
                onChange={(e) => setSearchKeyword(e.target.value)}
                placeholder="Search by question title or tags..."
                className="block w-full rounded-lg border border-gray-200 shadow-sm focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm transition-all duration-200 p-2"
              />
            </div>
          </div>

          <div className="bg-white/90 backdrop-blur-sm rounded-2xl shadow-lg p-6 border border-gray-100">
            <h3 className="text-xl font-semibold text-gray-800 mb-4">Assign Question to Classes</h3>
            <div className="mb-4 p-3 bg-blue-50 rounded-lg border border-blue-200">
              <p className="text-sm text-blue-800">
                <strong>Note:</strong> Teachers can assign any question to their classes, regardless of who created it.
              </p>
            </div>
            <div className="mb-4">
              <label className="block text-sm font-semibold text-gray-800 mb-2">Select Question</label>
              {filteredQuestions.length === 0 ? (
                <div className="p-3 bg-gray-50 rounded-lg border border-gray-200">
                  <p className="text-sm text-gray-600">
                    {searchKeyword.trim() 
                      ? `No questions found matching "${searchKeyword}"`
                      : 'No questions available. Create your first question to get started.'
                    }
                  </p>
                  {searchKeyword.trim() && (
                    <Link
                      to="/teacher/questions/new"
                      className="text-indigo-600 hover:text-indigo-800 text-sm font-medium mt-2 inline-block"
                    >
                      Create a new question
                    </Link>
                  )}
                </div>
              ) : (
                <select
                  value={selectedQuestion?._id || ''}
                  onChange={(e) => {
                    const question = filteredQuestions.find((q) => q._id === e.target.value);
                    console.log('[QuestionManagement] Selected question:', question);
                    setSelectedQuestion(question || null);
                  }}
                  className="block w-full rounded-lg border border-gray-200 shadow-sm focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm transition-all duration-200"
                >
                  <option value="">Select a question</option>
                  {filteredQuestions.map((q) => (
                    <option key={q._id} value={q._id}>
                      {stripHtml(q.title)} - {q.createdBy?.name || 'Unknown'} ({q.type === 'coding' ? 'Coding' : q.type})
                    </option>
                  ))}
                </select>
              )}
            </div>
            <div className="mb-4">
              <label className="block text-sm font-semibold text-gray-800 mb-2">Select Classes</label>
              <div className="space-y-2">
                {classes
                  .filter((cls) => cls.teachers.some((t) => t._id === user.id) || cls.createdBy._id === user.id)
                  .map((cls) => (
                    <div key={cls._id} className="flex items-center">
                      <input
                        type="checkbox"
                        checked={selectedClassIds.includes(cls._id)}
                        onChange={() => handleClassToggle(cls._id)}
                        className="h-4 w-4 text-indigo-600 focus:ring-indigo-500 border-gray-200 rounded"
                      />
                      <label className="ml-2 text-sm text-gray-800">{cls.name}</label>
                    </div>
                  ))}
              </div>
            </div>
            <button
              onClick={handleAssignQuestion}
              disabled={loading || !selectedQuestion || selectedClassIds.length === 0}
              className="inline-flex items-center px-4 py-2 rounded-lg text-sm font-semibold text-white bg-indigo-600 hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2 transition-all duration-300 disabled:bg-gray-400 disabled:cursor-not-allowed"
            >
              {loading ? 'Assigning...' : 'Assign Question'}
            </button>
          </div>

          <div className="mt-6 bg-white/90 backdrop-blur-sm rounded-2xl shadow-lg p-6 border border-gray-100">
            <h3 className="text-xl font-semibold text-gray-800 mb-4">Question Bank</h3>
            {filteredQuestions.length === 0 ? (
              <div className="text-center py-8">
                <svg
                  className="mx-auto h-12 w-12 text-gray-400"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={1.5}
                    d="M9.879 7.519c1.171-1.025 3.071-1.025 4.242 0 1.172 1.025 1.172 2.687 0 3.712-.203.179-.43.326-.67.442-.745.361-1.45.999-1.45 1.827v.75M21 12a9 9 0 11-18 0 9 9 0 0118 0zm-9 5.25h.008v.008H12v-.008z"
                  />
                </svg>
                <h4 className="mt-3 text-base font-semibold text-gray-800">
                  {searchKeyword.trim() ? 'No questions found' : 'No questions yet'}
                </h4>
                <p className="mt-1 text-sm text-gray-500">
                  {searchKeyword.trim() 
                    ? `No questions match "${searchKeyword}"`
                    : 'Get started by creating your first question'
                  }
                </p>
                <Link
                  to="/teacher/questions/new"
                  className="mt-4 inline-flex items-center px-4 py-2 rounded-lg text-sm font-semibold text-white bg-indigo-600 hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2 transition-all duration-300"
                >
                  Create New Question
                </Link>
              </div>
            ) : (
              <div className="space-y-4">
                {filteredQuestions.map((q) => (
                  <div
                    key={q._id}
                    className="flex justify-between items-center p-4 bg-gray-50 rounded-lg shadow-sm hover:bg-gray-100 transition-colors"
                  >
                    <div className="flex-1">
                      <h4 className="text-sm font-semibold text-gray-800 mb-1">{stripHtml(q.title)}</h4>
                      <div className="flex items-center space-x-4 text-xs text-gray-500">
                        <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-blue-100 text-blue-800">
                          {q.type === 'coding' ? 'Coding' : 
                           q.type === 'singleCorrectMcq' ? 'Single Choice' :
                           q.type === 'multipleCorrectMcq' ? 'Multiple Choice' :
                           q.type === 'fillInTheBlanks' ? 'Fill in Blanks' :
                           q.type === 'fillInTheBlanksCoding' ? 'Coding Fill' : q.type}
                        </span>
                        <span>Created by: {q.createdBy?.name || 'Unknown'}</span>
                        <span>Assigned to {q.classes?.length || 0} class{q.classes?.length !== 1 ? 'es' : ''}</span>
                        {q.type === 'coding' && q.languages && (
                          <span>Languages: {q.languages.join(', ')}</span>
                        )}
                      </div>
                    </div>
                    <div className="flex space-x-2">
                      <Link
                        to={`/teacher/questions/${q._id}/edit`}
                        className="text-sm text-indigo-600 hover:text-indigo-800 font-medium"
                      >
                        Edit
                      </Link>
                      <Link
                        to={`/teacher/questions/${q._id}/statement`}
                        className="text-sm text-indigo-600 hover:text-indigo-800 font-medium"
                      >
                        View
                      </Link>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </>
      )}
    </div>
  );
};

export default QuestionManagement;