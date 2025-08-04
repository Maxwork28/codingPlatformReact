import React, { useEffect, useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import { useSelector } from 'react-redux';
import { getClassDetails, getQuestionsByClass, getAllQuestions, assignQuestionToClass, searchQuestions, adminSearchQuestionsById, createAssignment, getAssignments, deleteAssignment } from '../../../common/services/api'; // Updated import path
import TeacherQuestionCard from '../components/TeacherQuestionCard';

const TeacherClassView = () => {
  const { classId } = useParams();
  const { user } = useSelector((state) => state.auth);
  const [classData, setClassData] = useState(null);
  const [questions, setQuestions] = useState([]);
  const [availableQuestions, setAvailableQuestions] = useState([]);
  const [filteredQuestions, setFilteredQuestions] = useState([]);
  const [questionSearchKeyword, setQuestionSearchKeyword] = useState('');
  const [selectedQuestionId, setSelectedQuestionId] = useState('');
  const [loading, setLoading] = useState(true);
  const [assignmentLoading, setAssignmentLoading] = useState(false);
  const [error, setError] = useState('');
  const [assignmentError, setAssignmentError] = useState('');
  const [assignmentMessage, setAssignmentMessage] = useState('');
  const [assignments, setAssignments] = useState([]);
  const [assignmentForm, setAssignmentForm] = useState({
    questionId: '',
    maxPoints: '',
    dueDate: '',
  });

  useEffect(() => {
    const fetchClassData = async () => {
      try {
        setLoading(true);
        console.log('[TeacherClassView] Fetching class:', { classId });
        const classResponse = await getClassDetails(classId);
        const cls = classResponse.data.class;
        if (cls && (cls.teachers.some((t) => t._id === user.id) || cls.createdBy._id === user.id)) {
          console.log('[TeacherClassView] Class found and user authorized', cls);
          setClassData(cls);
          const questionsResponse = await getQuestionsByClass(classId);
          console.log('[TeacherClassView] Questions for class:', questionsResponse.data.questions);
          setQuestions(questionsResponse.data.questions);
          const allQuestionsResponse = await getAllQuestions();
          const userQuestions = allQuestionsResponse.data.questions.filter((q) => q.createdBy._id === user.id);
          console.log('[TeacherClassView] User questions:', userQuestions.length);
          console.log('[TeacherClassView] All questions:', allQuestionsResponse.data.questions.length);
          console.log('[TeacherClassView] User ID:', user.id);
          console.log('[TeacherClassView] User questions details:', userQuestions.map(q => ({ id: q._id, title: q.title, createdBy: q.createdBy._id })));
          
          const unassignedQuestions = userQuestions.filter(
            (q) => !q.classes.some((c) => String(c.classId) === String(classId))
          );
          console.log('[TeacherClassView] Unassigned questions:', unassignedQuestions.length);
          console.log('[TeacherClassView] Class ID:', classId);
          console.log('[TeacherClassView] Question classes details:', userQuestions.map(q => ({ 
            id: q._id, 
            title: q.title, 
            classes: q.classes.map(c => ({ classId: c.classId, className: c.className }))
          })));
          setAvailableQuestions(unassignedQuestions);
          setFilteredQuestions(unassignedQuestions);
          
          // Fetch assignments
          const assignmentsResponse = await getAssignments(classId);
          console.log('[TeacherClassView] Assignments for class:', assignmentsResponse.data.assignments);
          setAssignments(assignmentsResponse.data.assignments);
        } else {
          console.log('[TeacherClassView] Class not found or user not authorized');
          setError('Class not found or you are not authorized');
        }
      } catch (err) {
        console.error('[TeacherClassView] Fetch error:', err.message || err.error, err);
        setError(err.error || 'Error fetching class data');
      } finally {
        setLoading(false);
      }
    };
    if (user) {
      fetchClassData();
    }
  }, [classId, user]);

  useEffect(() => {
    console.log('[TeacherClassView] State:', {
      assignmentLoading,
      selectedQuestionId,
      availableQuestionsLength: availableQuestions.length,
      filteredQuestionsLength: filteredQuestions.length,
      buttonDisabled: assignmentLoading || !selectedQuestionId || availableQuestions.length === 0,
    });
  }, [assignmentLoading, selectedQuestionId, availableQuestions, filteredQuestions]);

  const handleQuestionUpdate = (updatedQuestion) => {
    console.log('[TeacherClassView] Updating question:', {
      id: updatedQuestion._id,
      isPublished: updatedQuestion.isPublished,
      isDisabled: updatedQuestion.isDisabled,
    });
    setQuestions((prev) =>
      prev.map((q) =>
        q._id === updatedQuestion._id
          ? {
              ...q,
              classes: q.classes.map((cls) =>
                String(cls.classId) === String(classId) ? { ...cls, ...updatedQuestion } : cls
              ),
            }
          : q
      )
    );
  };

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
      const result = tmp.textContent || tmp.innerText || '';
      console.log('stripHtml result:', { original: html, stripped: result });
      return result;
    } catch (error) {
      console.error('stripHtml error:', error);
      return html; // Return original if stripping fails
    }
  };

  const handleQuestionSearch = async () => {
    console.log('[TeacherClassView] handleQuestionSearch called', { keyword: questionSearchKeyword });
    try {
      if (!questionSearchKeyword.trim()) {
        setFilteredQuestions(availableQuestions);
        return;
      }

      // Check if the search keyword is a valid ObjectId
      if (isValidObjectId(questionSearchKeyword.trim())) {
        console.log('[TeacherClassView] handleQuestionSearch: Searching by ID', { questionId: questionSearchKeyword.trim() });
        const response = await adminSearchQuestionsById(questionSearchKeyword.trim());
        console.log('[TeacherClassView] handleQuestionSearch success (ID search)', { question: response.data.question });
        const questions = response.data.question ? [response.data.question] : [];
        // Filter to only show user's questions
        const userQuestions = questions.filter(q => q.createdBy._id === user.id);
        console.log('[TeacherClassView] handleQuestionSearch: Setting filteredQuestions to', userQuestions);
        setFilteredQuestions(userQuestions);
      } else {
        console.log('[TeacherClassView] handleQuestionSearch: Searching by title', { title: questionSearchKeyword });
        const response = await searchQuestions({ title: questionSearchKeyword });
        console.log('[TeacherClassView] handleQuestionSearch success (title search)', { questions: response.data.questions });
        // Filter to only show user's questions
        const userQuestions = response.data.questions.filter(q => q.createdBy._id === user.id);
        setFilteredQuestions(userQuestions);
      }
    } catch (err) {
      console.error('[TeacherClassView] handleQuestionSearch error', err);
      setError(err.message || 'Failed to search questions');
    }
  };

  const handleAssignQuestion = async () => {
    console.log('[TeacherClassView] handleAssignQuestion called', { classId, selectedQuestionId });
    if (!selectedQuestionId) {
      setAssignmentError('Please select a question to assign');
      return;
    }
    setAssignmentLoading(true);
    try {
      console.log('[TeacherClassView] Assigning question:', selectedQuestionId, 'to class:', classId);
      await assignQuestionToClass(selectedQuestionId, classId);
      setAssignmentMessage('Question assigned successfully!');
      setAssignmentError('');
      const questionsResponse = await getQuestionsByClass(classId);
      setQuestions(questionsResponse.data.questions);
      const allQuestionsResponse = await getAllQuestions();
      const userQuestions = allQuestionsResponse.data.questions.filter((q) => q.createdBy._id === user.id);
      const unassignedQuestions = userQuestions.filter(
        (q) => !q.classes.some((c) => String(c.classId) === String(classId))
      );
      console.log('[TeacherClassView] Refreshed unassigned questions:', unassignedQuestions.length);
      setAvailableQuestions(unassignedQuestions);
      setFilteredQuestions(unassignedQuestions);
      setSelectedQuestionId('');
      setQuestionSearchKeyword('');
      setTimeout(() => setAssignmentMessage(''), 3000);
    } catch (err) {
      console.error('[TeacherClassView] Assign error:', err.message || err.error, err);
      setAssignmentError(err.error || 'Failed to assign question');
      setAssignmentMessage('');
    } finally {
      setAssignmentLoading(false);
    }
  };

  const handleCreateAssignment = async (e) => {
    e.preventDefault();
    console.log('[TeacherClassView] handleCreateAssignment called', { classId, assignmentForm });
    try {
      await createAssignment(classId, assignmentForm);
      const assignmentsResponse = await getAssignments(classId);
      setAssignments(assignmentsResponse.data.assignments);
      setAssignmentForm({ questionId: '', maxPoints: '', dueDate: '' });
      setAssignmentMessage('Assignment created successfully');
      setAssignmentError('');
      setTimeout(() => setAssignmentMessage(''), 3000);
    } catch (err) {
      console.error('[TeacherClassView] Create assignment error:', err.message || err.error, err);
      setAssignmentError(err.error || 'Failed to create assignment');
      setAssignmentMessage('');
    }
  };

  const handleDeleteAssignment = async (assignmentId) => {
    console.log('[TeacherClassView] handleDeleteAssignment called', { classId, assignmentId });
    try {
      await deleteAssignment(classId, assignmentId);
      const assignmentsResponse = await getAssignments(classId);
      setAssignments(assignmentsResponse.data.assignments);
      setAssignmentMessage('Assignment deleted successfully');
      setAssignmentError('');
      setTimeout(() => setAssignmentMessage(''), 3000);
    } catch (err) {
      console.error('[TeacherClassView] Delete assignment error:', err.message || err.error, err);
      setAssignmentError(err.error || 'Failed to delete assignment');
      setAssignmentMessage('');
    }
  };

  if (!user) {
    return (
      <div className="p-6">
        <p className="text-red-700 font-semibold text-center">You must be logged in to view this page.</p>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="flex justify-center items-center h-64">
        <div className="w-12 h-12 border-4 border-indigo-500 border-t-transparent rounded-full animate-spin"></div>
      </div>
    );
  }

  if (error || !classData) {
    return (
      <div className="max-w-4xl mx-auto p-6">
        <div className="flex items-center p-4 bg-red-50/80 backdrop-blur-sm rounded-xl shadow-sm border border-red-200">
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
          <p className="text-sm text-red-700 font-semibold">{error || 'Class not found or you are not authorized'}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      <div className="mb-10">
        <div className="flex justify-between items-start">
          <div>
            <h2 className="text-3xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-indigo-600 to-indigo-400 tracking-tight">
              {classData.name}
            </h2>
            <p className="mt-2 text-lg text-gray-600 font-medium">{classData.description}</p>
          </div>
          <div className="flex space-x-4">
            <Link
              to={`/teacher/classes/${classId}/details`}
              className="inline-flex items-center px-4 py-2 rounded-lg text-sm font-semibold text-gray-700 bg-white border border-gray-200 shadow-sm hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2 transition-all duration-300"
            >
              Details
            </Link>
            {/* <Link
              to={`/teacher/classes/${classId}/edit`}
              className="inline-flex items-center px-4 py-2 rounded-lg text-sm font-semibold text-gray-700 bg-white border border-gray-200 shadow-sm hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2 transition-all duration-300"
            >
              Edit Class
            </Link> */}
            <Link
              to="/teacher/questions/new"
              className="inline-flex items-center px-4 py-2 rounded-lg text-sm font-semibold text-white bg-indigo-600 hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2 transition-all duration-300"
            >
              Add New Question
            </Link>
          </div>
        </div>
        <div className="mt-4 flex flex-wrap gap-3">
          <span className="inline-flex items-center px-3 py-1 rounded-full text-xs font-semibold bg-indigo-100 text-indigo-700 shadow-sm">
            {classData.students.length} Students
          </span>
          <span className="inline-flex items-center px-3 py-1 rounded-full text-xs font-semibold bg-green-100 text-green-700 shadow-sm">
            {questions.length} Questions
          </span>
        </div>
      </div>

      <div className="mt-10">
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
        {assignmentError && (
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
              <p className="text-sm font-semibold text-red-800">{assignmentError}</p>
            </div>
          </div>
        )}

        {/* Create Assignment Form */}
        <div className="bg-white/90 backdrop-blur-sm rounded-2xl shadow-lg border border-gray-100 p-6 mb-8">
          <h3 className="text-lg font-semibold text-gray-800 mb-4">Create Assignment</h3>
          <form onSubmit={handleCreateAssignment} className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Question</label>
                <select
                  value={assignmentForm.questionId}
                  onChange={(e) =>
                    setAssignmentForm({ ...assignmentForm, questionId: e.target.value })
                  }
                  className="w-full rounded-lg border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm"
                  required
                >
                  <option value="">Select Question</option>
                  {questions?.length > 0 ? (
                    questions.map((question) => (
                      <option key={question._id} value={question._id}>
                        {stripHtml(question.title)}
                      </option>
                    ))
                  ) : (
                    <option value="" disabled>No questions available for this class</option>
                  )}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Max Points</label>
                <input
                  type="number"
                  value={assignmentForm.maxPoints}
                  onChange={(e) =>
                    setAssignmentForm({ ...assignmentForm, maxPoints: e.target.value })
                  }
                  className="w-full rounded-lg border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm"
                  required
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Due Date</label>
                <input
                  type="datetime-local"
                  value={assignmentForm.dueDate}
                  onChange={(e) =>
                    setAssignmentForm({ ...assignmentForm, dueDate: e.target.value })
                  }
                  className="w-full rounded-lg border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm"
                  required
                />
              </div>
            </div>
            <div className="flex justify-end">
              <button
                type="submit"
                className="inline-flex items-center px-4 py-2 rounded-lg text-sm font-semibold text-white bg-indigo-600 hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2 transition-all duration-300"
              >
                Create Assignment
              </button>
            </div>
          </form>
        </div>

        {/* Assignments List */}
        <div className="bg-white/90 backdrop-blur-sm rounded-2xl shadow-lg border border-gray-100 p-6 mb-8">
          <h3 className="text-lg font-semibold text-gray-800 mb-4">Assignments ({assignments.length})</h3>
          {assignments.length === 0 ? (
            <p className="text-sm text-gray-500">No assignments available</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gray-50">
                  <tr>
                    <th
                      scope="col"
                      className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider"
                    >
                      Question Title
                    </th>
                    <th
                      scope="col"
                      className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider"
                    >
                      Max Points
                    </th>
                    <th
                      scope="col"
                      className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider"
                    >
                      Assigned At
                    </th>
                    <th
                      scope="col"
                      className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider"
                    >
                      Due Date
                    </th>
                    <th
                      scope="col"
                      className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider"
                    >
                      Actions
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-200">
                  {assignments.map((assignment) => (
                    <tr key={assignment._id}>
                      <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                        {assignment.questionId?.title ? stripHtml(assignment.questionId.title) : 'N/A'}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                        {assignment.maxPoints}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                        {new Date(assignment.assignedAt).toLocaleString()}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                        {new Date(assignment.dueDate).toLocaleString()}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                        <button
                          onClick={() => handleDeleteAssignment(assignment._id)}
                          className="text-red-600 hover:text-red-900"
                        >
                          Delete
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* Attach Question to Class */}
        <div className="bg-white/90 backdrop-blur-sm rounded-2xl shadow-lg p-6 border border-gray-100 mb-10">
          <h3 className="text-xl font-semibold text-gray-800 mb-4">Attach Question to Class</h3>
          
          {availableQuestions.length === 0 ? (
            <div className="p-4 bg-gray-50 rounded-lg border border-gray-200">
              <div className="flex items-start">
                <svg
                  className="h-5 w-5 text-gray-400 mt-0.5 mr-3"
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
                  <p className="text-sm text-gray-600 mb-2">
                    {questions.length === 0 
                      ? "You haven't created any questions yet. Create your first question to attach to this class."
                      : "All your questions are already attached to this class."
                    }
                  </p>
                  <div className="flex space-x-3">
                    <Link
                      to="/teacher/questions/new"
                      className="inline-flex items-center px-3 py-1.5 text-xs font-medium text-indigo-600 bg-indigo-50 border border-indigo-200 rounded-md hover:bg-indigo-100 transition-colors"
                    >
                      <svg className="h-4 w-4 mr-1" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor">
                        <path fillRule="evenodd" d="M10 3a1 1 0 011 1v5h5a1 1 0 110 2h-5v5a1 1 0 11-2 0v-5H4a1 1 0 110-2h5V4a1 1 0 011-1z" clipRule="evenodd" />
                      </svg>
                      Create New Question
                    </Link>
                    <Link
                      to="/teacher/questions"
                      className="inline-flex items-center px-3 py-1.5 text-xs font-medium text-gray-600 bg-gray-50 border border-gray-200 rounded-md hover:bg-gray-100 transition-colors"
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
                  <label className="block text-sm font-medium text-gray-700 mb-2">Search Questions</label>
                  <div className="flex gap-2">
                    <input
                      type="text"
                      value={questionSearchKeyword}
                      onChange={(e) => setQuestionSearchKeyword(e.target.value)}
                      placeholder="Search questions by title or ID..."
                      className="flex-1 rounded-lg border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm"
                    />
                    <button
                      onClick={handleQuestionSearch}
                      className="inline-flex items-center px-4 py-2 rounded-lg text-sm font-semibold text-white bg-indigo-600 hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2 transition-all duration-300"
                    >
                      Search
                    </button>
                  </div>
                </div>
              </div>

              {/* Available Questions */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Select Question to Attach</label>
                <select
                  value={selectedQuestionId}
                  onChange={(e) => setSelectedQuestionId(e.target.value)}
                  className="w-full rounded-lg border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm"
                >
                  <option value="">Select a question</option>
                  {filteredQuestions?.length > 0 ? (
                    filteredQuestions.map((question) => {
                      // Ensure question has required properties
                      if (!question._id || !question.title) {
                        console.warn('Question missing required properties:', question);
                        return null;
                      }
                      
                      return (
                        <option key={question._id} value={question._id}>
                          {stripHtml(question.title)} - {question.type || 'Unknown'} ({question.points || 0} points)
                        </option>
                      );
                    }).filter(Boolean) // Remove null options
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
                  className="inline-flex items-center px-4 py-2 rounded-lg text-sm font-semibold text-white bg-green-600 hover:bg-green-700 focus:outline-none focus:ring-2 focus:ring-green-500 focus:ring-offset-2 transition-all duration-300 disabled:opacity-50 disabled:cursor-not-allowed"
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

        <div>
          <div className="flex justify-between items-center mb-6">
            <h3 className="text-xl font-semibold text-gray-800">Assigned Questions</h3>
          </div>

          {questions.length === 0 ? (
            <div className="bg-white/90 backdrop-blur-sm rounded-2xl shadow-lg p-8 text-center border border-gray-100">
              <svg
                className="mx-auto h-14 w-14 text-gray-400"
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
              <h4 className="mt-3 text-base font-semibold text-gray-800">No questions yet</h4>
              <p className="mt-1 text-sm text-gray-500">Get started by creating or assigning a question</p>
            </div>
          ) : (
            <div className="space-y-6">
              {questions.map((question) => {
                const classEntry = question.classes.find((c) => String(c.classId) === String(classId)) || {};
                return (
                  <div
                    key={question._id}
                    className="bg-white/90 backdrop-blur-sm rounded-2xl shadow-lg overflow-hidden border border-gray-100 transition-all duration-300 hover:shadow-xl"
                  >
                    <div className="p-6">
                      <TeacherQuestionCard
                        question={{
                          ...question,
                          classId,
                          isPublished: classEntry.isPublished,
                          isDisabled: classEntry.isDisabled,
                        }}
                        onQuestionUpdate={handleQuestionUpdate}
                      />
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default TeacherClassView;