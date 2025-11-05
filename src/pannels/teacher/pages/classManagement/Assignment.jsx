import React, { useEffect, useState } from 'react';
import { useSelector, useDispatch } from 'react-redux';
import { fetchClasses } from '../../../../common/components/redux/classSlice';
import { createAssignment, getAssignments, deleteAssignment, getQuestionsByClass } from '../../../../common/services/api';

const Assignment = () => {
  const { user } = useSelector((state) => state.auth);
  const { classes } = useSelector((state) => state.classes);
  const dispatch = useDispatch();
  
  const [selectedClassId, setSelectedClassId] = useState('');
  const [classQuestions, setClassQuestions] = useState([]);
  const [assignments, setAssignments] = useState([]);
  const [loading, setLoading] = useState(false);
  const [assignmentError, setAssignmentError] = useState('');
  const [assignmentMessage, setAssignmentMessage] = useState('');
  const [assignmentForm, setAssignmentForm] = useState({
    questionId: '',
    maxPoints: '',
    dueDate: '',
  });

  // Fetch classes on mount
  useEffect(() => {
    dispatch(fetchClasses(''));
  }, [dispatch]);

  // Fetch questions and assignments when class is selected
  useEffect(() => {
    const fetchClassData = async () => {
      if (!selectedClassId) {
        setClassQuestions([]);
        setAssignments([]);
        return;
      }

      try {
        setLoading(true);
        
        // Fetch questions for the selected class
        const questionsResponse = await getQuestionsByClass(selectedClassId);
        setClassQuestions(questionsResponse.data.questions);
        
        // Fetch assignments for the selected class
        const assignmentsResponse = await getAssignments(selectedClassId);
        setAssignments(assignmentsResponse.data.assignments);
      } catch (err) {
        console.error('[Assignment] Fetch error:', err);
        setAssignmentError(err.error || 'Failed to fetch class data');
      } finally {
        setLoading(false);
      }
    };

    fetchClassData();
  }, [selectedClassId]);

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

  const handleCreateAssignment = async (e) => {
    e.preventDefault();
    if (!selectedClassId) {
      setAssignmentError('Please select a class');
      return;
    }

    console.log('[Assignment] handleCreateAssignment called', { selectedClassId, assignmentForm });
    try {
      await createAssignment(selectedClassId, assignmentForm);
      const assignmentsResponse = await getAssignments(selectedClassId);
      setAssignments(assignmentsResponse.data.assignments);
      setAssignmentForm({ questionId: '', maxPoints: '', dueDate: '' });
      setAssignmentMessage('Assignment created successfully');
      setAssignmentError('');
      setTimeout(() => setAssignmentMessage(''), 3000);
    } catch (err) {
      console.error('[Assignment] Create assignment error:', err.message || err.error, err);
      setAssignmentError(err.error || 'Failed to create assignment');
      setAssignmentMessage('');
    }
  };

  const handleDeleteAssignment = async (assignmentId) => {
    if (!selectedClassId) return;

    console.log('[Assignment] handleDeleteAssignment called', { selectedClassId, assignmentId });
    try {
      await deleteAssignment(selectedClassId, assignmentId);
      const assignmentsResponse = await getAssignments(selectedClassId);
      setAssignments(assignmentsResponse.data.assignments);
      setAssignmentMessage('Assignment deleted successfully');
      setAssignmentError('');
      setTimeout(() => setAssignmentMessage(''), 3000);
    } catch (err) {
      console.error('[Assignment] Delete assignment error:', err.message || err.error, err);
      setAssignmentError(err.error || 'Failed to delete assignment');
      setAssignmentMessage('');
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
          Assignments Management
        </h2>
        <p className="mt-1 text-sm" style={{ color: 'var(--text-secondary)' }}>
          Create and manage assignments across all your classes
        </p>
      </div>

      {/* Class Selection */}
      <div className="backdrop-blur-sm rounded-2xl shadow-lg p-6 border mb-8" style={{ backgroundColor: 'var(--background-light)', borderColor: 'var(--card-border)' }}>
        <h3 className="text-lg font-semibold mb-4" style={{ color: 'var(--text-primary)' }}>Select Class</h3>
        <select
          value={selectedClassId}
          onChange={(e) => {
            setSelectedClassId(e.target.value);
            setAssignmentForm({ questionId: '', maxPoints: '', dueDate: '' });
            setAssignmentError('');
            setAssignmentMessage('');
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
          <div className="backdrop-blur-sm rounded-2xl shadow-lg border p-6 mb-8" style={{ backgroundColor: 'var(--background-light)', borderColor: 'var(--card-border)' }}>
            <h3 className="text-lg font-semibold mb-4" style={{ color: 'var(--text-primary)' }}>Create New Assignment</h3>
            <form onSubmit={handleCreateAssignment} className="space-y-6">
              <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                <div>
                  <label className="block text-sm font-medium mb-2" style={{ color: 'var(--text-primary)' }}>Question</label>
                  <select
                    value={assignmentForm.questionId}
                    onChange={(e) =>
                      setAssignmentForm({ ...assignmentForm, questionId: e.target.value })
                    }
                    className="w-full rounded-lg border shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm"
                    style={{ 
                      borderColor: 'var(--card-border)', 
                      backgroundColor: 'var(--background-light)', 
                      color: 'var(--text-primary)',
                      padding: '8px 12px'
                    }}
                    required
                  >
                    <option value="">Select Question</option>
                    {classQuestions?.length > 0 ? (
                      classQuestions.map((question) => (
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
                  <label className="block text-sm font-medium mb-2" style={{ color: 'var(--text-primary)' }}>Max Points</label>
                  <input
                    type="number"
                    value={assignmentForm.maxPoints}
                    onChange={(e) =>
                      setAssignmentForm({ ...assignmentForm, maxPoints: e.target.value })
                    }
                    className="w-full rounded-lg border shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm"
                    style={{ 
                      borderColor: 'var(--card-border)', 
                      backgroundColor: 'var(--background-light)', 
                      color: 'var(--text-primary)',
                      padding: '8px 12px'
                    }}
                    required
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium mb-2" style={{ color: 'var(--text-primary)' }}>Due Date</label>
                  <input
                    type="datetime-local"
                    value={assignmentForm.dueDate}
                    onChange={(e) =>
                      setAssignmentForm({ ...assignmentForm, dueDate: e.target.value })
                    }
                    className="w-full rounded-lg border shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm"
                    style={{ 
                      borderColor: 'var(--card-border)', 
                      backgroundColor: 'var(--background-light)', 
                      color: 'var(--text-primary)',
                      padding: '8px 12px'
                    }}
                    required
                  />
                </div>
              </div>
              <div className="flex justify-end">
                <button
                  type="submit"
                  className="inline-flex items-center px-4 py-2 rounded-lg text-sm font-semibold text-white focus:outline-none focus:ring-2 focus:ring-offset-2 transition-all duration-300"
                  style={{ backgroundColor: 'var(--primary-navy)' }}
                  disabled={loading}
                >
                  Create Assignment
                </button>
              </div>
            </form>
          </div>

          {/* Assignments List */}
          <div className="backdrop-blur-sm rounded-2xl shadow-lg border p-6 mb-8" style={{ backgroundColor: 'var(--background-light)', borderColor: 'var(--card-border)' }}>
            <h3 className="text-lg font-semibold mb-4" style={{ color: 'var(--text-primary)' }}>
              Assignments ({assignments.length})
            </h3>
            {loading ? (
              <div className="flex justify-center py-8">
                <div className="w-12 h-12 border-4 border-indigo-500 border-t-transparent rounded-full animate-spin"></div>
              </div>
            ) : assignments.length === 0 ? (
              <p className="text-sm" style={{ color: 'var(--text-secondary)' }}>No assignments available</p>
            ) : (
              <div className="overflow-x-auto">
                <table className="min-w-full divide-y" style={{ borderColor: 'var(--card-border)' }}>
                  <thead style={{ backgroundColor: 'var(--background-content)' }}>
                    <tr>
                      <th
                        scope="col"
                        className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider"
                        style={{ color: 'var(--text-secondary)' }}
                      >
                        Question Title
                      </th>
                      <th
                        scope="col"
                        className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider"
                        style={{ color: 'var(--text-secondary)' }}
                      >
                        Max Points
                      </th>
                      <th
                        scope="col"
                        className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider"
                        style={{ color: 'var(--text-secondary)' }}
                      >
                        Assigned At
                      </th>
                      <th
                        scope="col"
                        className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider"
                        style={{ color: 'var(--text-secondary)' }}
                      >
                        Due Date
                      </th>
                      <th
                        scope="col"
                        className="px-6 py-3 text-right text-xs font-medium uppercase tracking-wider"
                        style={{ color: 'var(--text-secondary)' }}
                      >
                        Actions
                      </th>
                    </tr>
                  </thead>
                  <tbody className="divide-y" style={{ borderColor: 'var(--card-border)' }}>
                    {assignments.map((assignment) => (
                      <tr key={assignment._id}>
                        <td className="px-6 py-4 whitespace-nowrap text-sm font-medium" style={{ color: 'var(--text-primary)' }}>
                          {assignment.questionId?.title ? stripHtml(assignment.questionId.title) : 'N/A'}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm" style={{ color: 'var(--text-secondary)' }}>
                          {assignment.maxPoints}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm" style={{ color: 'var(--text-secondary)' }}>
                          {new Date(assignment.assignedAt).toLocaleString()}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm" style={{ color: 'var(--text-secondary)' }}>
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
                d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
              />
            </svg>
            <h3 className="text-lg font-semibold" style={{ color: 'var(--text-primary)' }}>
              Select a Class
            </h3>
            <p className="mt-2 text-sm" style={{ color: 'var(--text-secondary)' }}>
              Choose a class from the dropdown above to manage its assignments
            </p>
          </div>
        </div>
      )}
    </div>
  );
};

export default Assignment;
