import React, { useEffect, useState } from 'react';
import { useSelector, useDispatch } from 'react-redux';
import { Link } from 'react-router-dom';
import { Tab } from '@headlessui/react';
import { fetchClasses } from '../../../common/components/redux/classSlice';
import { getAllQuestions, assignQuestionToClass, searchQuestions } from '../../../common/services/api';
import { 
  MagnifyingGlassIcon, 
  DocumentTextIcon, 
  AcademicCapIcon, 
  PencilIcon, 
  EyeIcon,
  PlusIcon,
  CheckCircleIcon,
  ExclamationTriangleIcon
} from '@heroicons/react/24/outline';

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
      dispatch(fetchClasses(''));
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
        await assignQuestionToClass(selectedQuestion._id, classId);
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
      {/* Simple Header */}
      <div className="flex justify-between items-center mb-6">
        <h2 className="text-2xl font-bold text-gray-800">Question Management</h2>
        <Link
          to="/teacher/questions/create"
          className="inline-flex items-center px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition-colors"
        >
          <PlusIcon className="w-5 h-5 mr-2" />
          Create New Question
        </Link>
      </div>

      {loading || classStatus === 'loading' ? (
        <div className="flex justify-center items-center py-16">
          <div className="w-12 h-12 border-4 border-indigo-500 border-t-transparent rounded-full animate-spin"></div>
        </div>
      ) : (
        <>
          {/* Error Message */}
          {(error || classError) && (
            <div className="mb-4 p-4 bg-red-50 border border-red-200 rounded-lg">
              <p className="text-sm text-red-700">{error || classError}</p>
            </div>
          )}

          {/* Success Message */}
          {message && (
            <div className="mb-4 p-4 bg-green-50 border border-green-200 rounded-lg">
              <p className="text-sm text-green-700">{message}</p>
            </div>
          )}

          {/* Tabs */}
          <Tab.Group>
            <Tab.List className="flex space-x-1 rounded-xl bg-blue-900/20 p-1 mb-6">
              <Tab
                className={({ selected }) =>
                  `w-full rounded-lg py-2.5 text-sm font-medium leading-5 text-blue-700 ring-white ring-opacity-60 ring-offset-2 ring-offset-blue-400 focus:outline-none focus:ring-2 ${
                    selected ? 'bg-white shadow' : 'text-blue-700 hover:bg-white/[0.12] hover:text-blue-800'
                  }`
                }
              >
                Questions
              </Tab>
              <Tab
                className={({ selected }) =>
                  `w-full rounded-lg py-2.5 text-sm font-medium leading-5 text-blue-700 ring-white ring-opacity-60 ring-offset-2 ring-offset-blue-400 focus:outline-none focus:ring-2 ${
                    selected ? 'bg-white shadow' : 'text-blue-700 hover:bg-white/[0.12] hover:text-blue-800'
                  }`
                }
              >
                Assign to Classes
              </Tab>
            </Tab.List>

            <Tab.Panels>
              {/* Questions Tab */}
              <Tab.Panel>
                {/* Search */}
                <div className="bg-white rounded-lg shadow p-6 mb-6">
                  <h3 className="text-lg font-semibold text-gray-800 mb-4">Search Questions</h3>
                  <div className="relative">
                    <input
                      type="text"
                      value={searchKeyword}
                      onChange={(e) => setSearchKeyword(e.target.value)}
                      placeholder="Search by title, tags, or content..."
                      className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
                    />
                    <MagnifyingGlassIcon className="h-5 w-5 text-gray-400 absolute left-3 top-2.5" />
                  </div>
                </div>

                {/* Question Bank */}
                <div className="bg-white rounded-lg shadow p-6">
                  <div className="flex items-center justify-between mb-4">
                    <h3 className="text-lg font-semibold text-gray-800">Question Bank</h3>
                    <span className="text-sm text-gray-500">
                      {filteredQuestions.length} question{filteredQuestions.length !== 1 ? 's' : ''}
                    </span>
                  </div>
                  
                  {filteredQuestions.length === 0 ? (
                    <div className="text-center py-12">
                      <p className="text-gray-500">No questions match the search criteria.</p>
                      <p className="text-sm text-gray-400 mt-2">Try adjusting your search terms or create a new question.</p>
                    </div>
                  ) : (
                    <div className="overflow-x-auto">
                      <table className="min-w-full divide-y divide-gray-200">
                        <thead className="bg-gray-50">
                          <tr>
                            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                              Title
                            </th>
                            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                              Type
                            </th>
                            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                              Classes
                            </th>
                            <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                              Actions
                            </th>
                          </tr>
                        </thead>
                        <tbody className="bg-white divide-y divide-gray-200">
                          {filteredQuestions.map((q) => (
                            <tr key={q._id} className="hover:bg-gray-50">
                              <td className="px-6 py-4 text-sm font-medium text-gray-900">
                                {stripHtml(q.title)}
                              </td>
                              <td className="px-6 py-4 whitespace-nowrap">
                                <span className="px-2 py-1 text-xs font-semibold rounded-full bg-indigo-100 text-indigo-800">
                                  {q.type}
                                </span>
                              </td>
                              <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                                {q.classes.length}
                              </td>
                              <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                                <Link
                                  to={`/teacher/questions/${q._id}/edit`}
                                  className="text-indigo-600 hover:text-indigo-900 mr-4"
                                >
                                  Edit
                                </Link>
                                <Link
                                  to={`/teacher/questions/${q._id}/statement`}
                                  className="text-gray-600 hover:text-gray-900"
                                >
                                  View
                                </Link>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}
                </div>
              </Tab.Panel>

              {/* Assign Tab */}
              <Tab.Panel>
                {/* Assign Question */}
                <div className="bg-white rounded-lg shadow p-6 mb-6">
                  <h3 className="text-lg font-semibold text-gray-800 mb-4">Assign Question to Classes</h3>
                  
                  <div className="space-y-4">
                    {/* Question Selection */}
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">Select Question</label>
                      <select
                        value={selectedQuestion?._id || ''}
                        onChange={(e) => {
                          const question = filteredQuestions.find((q) => q._id === e.target.value);
                          setSelectedQuestion(question || null);
                        }}
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
                      >
                        <option value="">Select a question</option>
                        {filteredQuestions.map((q) => (
                          <option key={q._id} value={q._id}>
                            {stripHtml(q.title)}
                          </option>
                        ))}
                      </select>
                    </div>

                    {/* Class Selection */}
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">Select Classes</label>
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                        {classes
                          .filter((cls) => cls.teachers.some((t) => t._id === user.id) || cls.createdBy._id === user.id)
                          .map((cls) => (
                            <label key={cls._id} className="flex items-center p-3 border border-gray-300 rounded-lg cursor-pointer hover:bg-gray-50">
                              <input
                                type="checkbox"
                                checked={selectedClassIds.includes(cls._id)}
                                onChange={() => handleClassToggle(cls._id)}
                                className="h-4 w-4 text-indigo-600 focus:ring-indigo-500 border-gray-300 rounded"
                              />
                              <span className="ml-3 text-sm text-gray-800">{cls.name}</span>
                            </label>
                          ))}
                      </div>
                    </div>

                    {/* Action Button */}
                    <div className="flex justify-end pt-4 border-t border-gray-200">
                      <button
                        onClick={handleAssignQuestion}
                        disabled={loading || !selectedQuestion || selectedClassIds.length === 0}
                        className="px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 disabled:bg-gray-400 disabled:cursor-not-allowed"
                      >
                        {loading ? 'Assigning...' : 'Assign Question'}
                      </button>
                    </div>
                  </div>
                </div>
              </Tab.Panel>
            </Tab.Panels>
          </Tab.Group>
        </>
      )}
    </div>
  );
};

export default QuestionManagement;