import React, { useEffect, useState } from 'react';
import { useSelector, useDispatch } from 'react-redux';
import { Link } from 'react-router-dom';
import { fetchClasses } from '../../../../common/components/redux/classSlice';
import { getQuestionsByClass, getAllQuestions, assignQuestionToClass, searchQuestions, adminSearchQuestionsById } from '../../../../common/services/api';

const Questions = () => {
  const { user } = useSelector((state) => state.auth);
  const { classes } = useSelector((state) => state.classes);
  const dispatch = useDispatch();
  
  const [selectedClassId, setSelectedClassId] = useState('');
  const [availableQuestions, setAvailableQuestions] = useState([]);
  const [filteredQuestions, setFilteredQuestions] = useState([]);
  const [assignedQuestions, setAssignedQuestions] = useState([]);
  const [questionSearchKeyword, setQuestionSearchKeyword] = useState('');
  const [selectedQuestionId, setSelectedQuestionId] = useState('');
  const [loading, setLoading] = useState(false);
  const [assignmentLoading, setAssignmentLoading] = useState(false);
  const [error, setError] = useState('');
  const [assignmentError, setAssignmentError] = useState('');
  const [assignmentMessage, setAssignmentMessage] = useState('');

  // Fetch classes on mount
  useEffect(() => {
    dispatch(fetchClasses(''));
  }, [dispatch]);

  // Fetch questions when class is selected
  useEffect(() => {
    const fetchClassQuestions = async () => {
      if (!selectedClassId) {
        setAvailableQuestions([]);
        setFilteredQuestions([]);
        setAssignedQuestions([]);
        return;
      }

      try {
        setLoading(true);
        
        // Fetch questions assigned to the class
        const questionsResponse = await getQuestionsByClass(selectedClassId);
        setAssignedQuestions(questionsResponse.data.questions);
        
        // Fetch all user's questions
        const allQuestionsResponse = await getAllQuestions();
        const userQuestions = allQuestionsResponse.data.questions.filter((q) => q.createdBy._id === user.id);
        
        // Filter out questions already assigned to this class
        const unassignedQuestions = userQuestions.filter(
          (q) => !q.classes.some((c) => String(c.classId) === String(selectedClassId))
        );
        
        setAvailableQuestions(unassignedQuestions);
        setFilteredQuestions(unassignedQuestions);
      } catch (err) {
        console.error('[Questions] Fetch error:', err);
        setError(err.error || 'Failed to fetch questions');
      } finally {
        setLoading(false);
      }
    };

    fetchClassQuestions();
  }, [selectedClassId, user]);

  // Helper function to check if a string is a valid MongoDB ObjectId
  const isValidObjectId = (str) => {
    const objectIdPattern = /^[0-9a-fA-F]{24}$/;
    return objectIdPattern.test(str);
  };

  // Helper function to strip HTML tags from text
  const stripHtml = (html) => {
    if (!html) return '';
    try {
      const tmp = document.createElement('div');
      tmp.innerHTML = html;
      return tmp.textContent || tmp.innerText || '';
    } catch (error) {
      console.error('stripHtml error:', error);
      return html;
    }
  };

  const handleQuestionSearch = async () => {
    console.log('[Questions] handleQuestionSearch called', { keyword: questionSearchKeyword });
    try {
      if (!questionSearchKeyword.trim()) {
        setFilteredQuestions(availableQuestions);
        return;
      }

      // Check if the search keyword is a valid ObjectId
      if (isValidObjectId(questionSearchKeyword.trim())) {
        console.log('[Questions] Searching by ID', { questionId: questionSearchKeyword.trim() });
        const response = await adminSearchQuestionsById(questionSearchKeyword.trim());
        const questions = response.data.question ? [response.data.question] : [];
        const userQuestions = questions.filter(q => q.createdBy._id === user.id);
        setFilteredQuestions(userQuestions);
      } else {
        console.log('[Questions] Searching by title', { title: questionSearchKeyword });
        const response = await searchQuestions({ title: questionSearchKeyword });
        const userQuestions = response.data.questions.filter(q => q.createdBy._id === user.id);
        setFilteredQuestions(userQuestions);
      }
    } catch (err) {
      console.error('[Questions] Search error', err);
      setError(err.message || 'Failed to search questions');
    }
  };

  const handleAssignQuestion = async () => {
    console.log('[Questions] handleAssignQuestion called', { selectedClassId, selectedQuestionId });
    if (!selectedQuestionId) {
      setAssignmentError('Please select a question to assign');
      return;
    }
    if (!selectedClassId) {
      setAssignmentError('Please select a class');
      return;
    }
    
    setAssignmentLoading(true);
    try {
      console.log('[Questions] Assigning question:', selectedQuestionId, 'to class:', selectedClassId);
      await assignQuestionToClass(selectedQuestionId, selectedClassId);
      setAssignmentMessage('Question assigned successfully!');
      setAssignmentError('');
      
      // Refresh questions
      const questionsResponse = await getQuestionsByClass(selectedClassId);
      setAssignedQuestions(questionsResponse.data.questions);
      
      const allQuestionsResponse = await getAllQuestions();
      const userQuestions = allQuestionsResponse.data.questions.filter((q) => q.createdBy._id === user.id);
      const unassignedQuestions = userQuestions.filter(
        (q) => !q.classes.some((c) => String(c.classId) === String(selectedClassId))
      );
      
      setAvailableQuestions(unassignedQuestions);
      setFilteredQuestions(unassignedQuestions);
      setSelectedQuestionId('');
      setQuestionSearchKeyword('');
      setTimeout(() => setAssignmentMessage(''), 3000);
    } catch (err) {
      console.error('[Questions] Assign error:', err.message || err.error, err);
      setAssignmentError(err.error || 'Failed to assign question');
      setAssignmentMessage('');
    } finally {
      setAssignmentLoading(false);
    }
  };

  // Filter classes that the teacher owns or is assigned to
  const myClasses = classes.filter(
    (cls) => cls.teachers?.some((t) => t._id === user?.id) || cls.createdBy?._id === user?.id
  );

  if (!user) {
    return (
      <div className="p-6">
        <p className="text-red-700 font-semibold text-center">You must be logged in to view this page.</p>
      </div>
    );
  }

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      <div className="mb-10">
        <h2 className="text-3xl font-bold tracking-tight" style={{ color: 'var(--text-heading)' }}>
          Questions Management
        </h2>
        <p className="mt-1 text-sm" style={{ color: 'var(--text-secondary)' }}>
          Attach questions to your classes and manage question assignments
        </p>
      </div>

      {/* Class Selection */}
      <div className="backdrop-blur-sm rounded-2xl shadow-lg p-6 border mb-8" style={{ backgroundColor: 'var(--background-light)', borderColor: 'var(--card-border)' }}>
        <h3 className="text-lg font-semibold mb-4" style={{ color: 'var(--text-primary)' }}>Select Class</h3>
        <select
          value={selectedClassId}
          onChange={(e) => {
            setSelectedClassId(e.target.value);
            setSelectedQuestionId('');
            setQuestionSearchKeyword('');
            setAssignmentError('');
            setAssignmentMessage('');
            setError('');
          }}
          className="w-full rounded-lg border shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm"
          style={{ 
            borderColor: 'var(--card-border)', 
            backgroundColor: 'var(--background-light)', 
            color: 'var(--text-primary)',
            padding: '12px'
          }}
        >
          <option value="">Select a class</option>
          {myClasses.map((cls) => (
            <option key={cls._id} value={cls._id}>
              {cls.name} ({cls.students?.length || 0} students)
            </option>
          ))}
        </select>
      </div>

      {selectedClassId ? (
        <>
          {/* Messages */}
          {assignmentMessage && (
            <div className="mb-6 p-4 rounded-xl bg-green-50/80 backdrop-blur-sm border border-green-200 shadow-sm">
              <div className="flex items-center">
                <svg
                  className="h-6 w-6 text-green-500 mr-3"
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
                <p className="text-sm font-semibold text-green-800">{assignmentMessage}</p>
              </div>
            </div>
          )}
          {(assignmentError || error) && (
            <div className="mb-6 p-4 rounded-xl bg-red-50/80 backdrop-blur-sm border border-red-200 shadow-sm">
              <div className="flex items-center">
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
                <p className="text-sm font-semibold text-red-800">{assignmentError || error}</p>
              </div>
            </div>
          )}

          {/* Attach Question to Class */}
          <div className="backdrop-blur-sm rounded-2xl shadow-lg p-6 border mb-10" style={{ backgroundColor: 'var(--background-light)', borderColor: 'var(--card-border)' }}>
            <h3 className="text-xl font-semibold mb-4" style={{ color: 'var(--text-primary)' }}>Attach Question to Class</h3>
            
            {availableQuestions.length === 0 ? (
              <div className="p-4 rounded-lg border" style={{ backgroundColor: 'var(--background-content)', borderColor: 'var(--card-border)' }}>
                <div className="flex items-start">
                  <svg
                    className="h-5 w-5 mt-0.5 mr-3"
                    style={{ color: 'var(--text-secondary)' }}
                    xmlns="http://www.w3.org/2000/svg"
                    viewBox="0 0 20 20"
                    fill="currentColor"
                  >
                    <path
                      fillRule="evenodd"
                      d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z"
                      clipRule="evenodd"
                    />
                  </svg>
                  <div className="flex-1">
                    <p className="text-sm mb-2" style={{ color: 'var(--text-secondary)' }}>
                      {assignedQuestions.length === 0 
                        ? "You haven't created any questions yet. Create your first question to attach to this class."
                        : "All your questions are already attached to this class."
                      }
                    </p>
                    <div className="flex space-x-3">
                      <Link
                        to="/teacher/questions/new"
                        className="inline-flex items-center px-3 py-1.5 text-xs font-medium rounded-md transition-colors"
                        style={{ color: 'var(--primary-navy)', backgroundColor: 'var(--background-light)', border: '1px solid var(--card-border)' }}
                      >
                        <svg className="h-4 w-4 mr-1" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor">
                          <path fillRule="evenodd" d="M10 3a1 1 0 011 1v5h5a1 1 0 110 2h-5v5a1 1 0 11-2 0v-5H4a1 1 0 110-2h5V4a1 1 0 011-1z" clipRule="evenodd" />
                        </svg>
                        Create New Question
                      </Link>
                      <Link
                        to="/teacher/questions"
                        className="inline-flex items-center px-3 py-1.5 text-xs font-medium rounded-md transition-colors"
                        style={{ color: 'var(--text-primary)', backgroundColor: 'var(--background-content)', border: '1px solid var(--card-border)' }}
                      >
                        View All Questions
                      </Link>
                    </div>
                  </div>
                </div>
              </div>
            ) : (
              <div className="space-y-6">
                {/* Search Questions */}
                <div className="flex gap-4">
                  <div className="flex-1">
                    <label className="block text-sm font-medium mb-2" style={{ color: 'var(--text-primary)' }}>Search Questions</label>
                    <div className="flex gap-2">
                      <input
                        type="text"
                        value={questionSearchKeyword}
                        onChange={(e) => setQuestionSearchKeyword(e.target.value)}
                        placeholder="Search questions by title or ID..."
                        className="flex-1 rounded-lg border shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm"
                        style={{ 
                          borderColor: 'var(--card-border)', 
                          backgroundColor: 'var(--background-light)', 
                          color: 'var(--text-primary)',
                          padding: '8px 12px'
                        }}
                      />
                      <button
                        onClick={handleQuestionSearch}
                        className="inline-flex items-center px-4 py-2 rounded-lg text-sm font-semibold text-white focus:outline-none focus:ring-2 focus:ring-offset-2 transition-all duration-300"
                        style={{ backgroundColor: 'var(--primary-navy)' }}
                      >
                        Search
                      </button>
                    </div>
                  </div>
                </div>

                {/* Available Questions */}
                <div>
                  <label className="block text-sm font-medium mb-2" style={{ color: 'var(--text-primary)' }}>Select Question to Attach</label>
                  <select
                    value={selectedQuestionId}
                    onChange={(e) => setSelectedQuestionId(e.target.value)}
                    className="w-full rounded-lg border shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm"
                    style={{ 
                      borderColor: 'var(--card-border)', 
                      backgroundColor: 'var(--background-light)', 
                      color: 'var(--text-primary)',
                      padding: '8px 12px'
                    }}
                  >
                    <option value="">Select a question</option>
                    {filteredQuestions?.length > 0 ? (
                      filteredQuestions.map((question) => {
                        if (!question._id || !question.title) {
                          console.warn('Question missing required properties:', question);
                          return null;
                        }
                        
                        return (
                          <option key={question._id} value={question._id}>
                            {stripHtml(question.title)} - {question.type || 'Unknown'} ({question.points || 0} points)
                          </option>
                        );
                      }).filter(Boolean)
                    ) : (
                      <option value="" disabled>No questions available</option>
                    )}
                  </select>
                </div>

                {/* Attach Button */}
                <div className="flex justify-end">
                  <button
                    onClick={handleAssignQuestion}
                    disabled={assignmentLoading || !selectedQuestionId || availableQuestions.length === 0}
                    className="inline-flex items-center px-4 py-2 rounded-lg text-sm font-semibold text-white focus:outline-none focus:ring-2 focus:ring-offset-2 transition-all duration-300 disabled:opacity-50 disabled:cursor-not-allowed"
                    style={{ backgroundColor: 'var(--primary-navy)' }}
                    title={
                      availableQuestions.length === 0
                        ? 'No unassigned questions available'
                        : !selectedQuestionId
                        ? 'Select a question to attach'
                        : assignmentLoading
                        ? 'Attaching in progress'
                        : ''
                    }
                  >
                    {assignmentLoading ? (
                      <>
                        <svg className="animate-spin -ml-1 mr-2 h-4 w-4 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                        </svg>
                        Attaching...
                      </>
                    ) : (
                      'Attach Question to Class'
                    )}
                  </button>
                </div>
              </div>
            )}
          </div>

          {/* Assigned Questions Summary */}
          <div className="backdrop-blur-sm rounded-2xl shadow-lg p-6 border" style={{ backgroundColor: 'var(--background-light)', borderColor: 'var(--card-border)' }}>
            <h3 className="text-lg font-semibold mb-4" style={{ color: 'var(--text-primary)' }}>
              Assigned Questions ({assignedQuestions.length})
            </h3>
            {loading ? (
              <div className="flex justify-center py-8">
                <div className="w-12 h-12 border-4 border-indigo-500 border-t-transparent rounded-full animate-spin"></div>
              </div>
            ) : assignedQuestions.length === 0 ? (
              <p className="text-sm" style={{ color: 'var(--text-secondary)' }}>No questions assigned to this class yet.</p>
            ) : (
              <div className="space-y-3">
                {assignedQuestions.map((question) => (
                  <div
                    key={question._id}
                    className="flex justify-between items-center p-4 rounded-lg border"
                    style={{ backgroundColor: 'var(--background-content)', borderColor: 'var(--card-border)' }}
                  >
                    <div className="flex-1">
                      <h4 className="text-sm font-semibold mb-1" style={{ color: 'var(--text-primary)' }}>
                        {stripHtml(question.title)}
                      </h4>
                      <div className="flex items-center space-x-3 text-xs">
                        <span className="inline-flex items-center px-2 py-0.5 rounded-full font-medium" style={{ backgroundColor: 'var(--badge-slate)', color: 'var(--text-primary)' }}>
                          {question.type}
                        </span>
                        <span style={{ color: 'var(--text-secondary)' }}>
                          {question.points || 0} points
                        </span>
                      </div>
                    </div>
                    <Link
                      to={`/teacher/questions/${question._id}/edit`}
                      className="inline-flex items-center px-3 py-1.5 text-xs font-medium rounded-md transition-colors"
                      style={{ color: 'var(--primary-navy)', backgroundColor: 'var(--background-light)', border: '1px solid var(--card-border)' }}
                    >
                      View/Edit
                    </Link>
                  </div>
                ))}
              </div>
            )}
          </div>
        </>
      ) : (
        <div className="backdrop-blur-sm rounded-2xl shadow-lg p-8 border" style={{ backgroundColor: 'var(--background-light)', borderColor: 'var(--card-border)' }}>
          <div className="text-center py-12">
            <svg
              className="mx-auto h-14 w-14 mb-4"
              style={{ color: 'var(--text-secondary)' }}
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={1.5}
                d="M8.228 9c.549-1.165 2.03-2 3.772-2 2.21 0 4 1.343 4 3 0 1.4-1.278 2.575-3.006 2.907-.542.104-.994.54-.994 1.093m0 3h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
              />
            </svg>
            <h3 className="text-lg font-semibold" style={{ color: 'var(--text-primary)' }}>
              Select a Class
            </h3>
            <p className="mt-2 text-sm" style={{ color: 'var(--text-secondary)' }}>
              Choose a class from the dropdown above to attach questions
            </p>
          </div>
        </div>
      )}
    </div>
  );
};

export default Questions;

