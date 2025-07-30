import React, { useEffect, useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import { useSelector } from 'react-redux';
import { getClassDetails, getQuestionsByClass, getAllQuestions, assignQuestionToClass } from '../../../common/services/api'; // Updated import path
import TeacherQuestionCard from '../components/TeacherQuestionCard';

const TeacherClassView = () => {
  const { classId } = useParams();
  const { user } = useSelector((state) => state.auth);
  const [classData, setClassData] = useState(null);
  const [questions, setQuestions] = useState([]);
  const [availableQuestions, setAvailableQuestions] = useState([]);
  const [selectedQuestionIds, setSelectedQuestionIds] = useState([]);
  const [loading, setLoading] = useState(true);
  const [assignmentLoading, setAssignmentLoading] = useState(false);
  const [error, setError] = useState('');
  const [assignmentError, setAssignmentError] = useState('');
  const [assignmentMessage, setAssignmentMessage] = useState('');

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
      selectedQuestionIds,
      availableQuestionsLength: availableQuestions.length,
      buttonDisabled: assignmentLoading || selectedQuestionIds.length === 0 || availableQuestions.length === 0,
    });
  }, [assignmentLoading, selectedQuestionIds, availableQuestions]);

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

  const handleQuestionToggle = (questionId) => {
    setSelectedQuestionIds((prev) => {
      const newSelection = prev.includes(questionId)
        ? prev.filter((id) => id !== questionId)
        : [...prev, questionId];
      console.log('[TeacherClassView] Updated selectedQuestionIds:', newSelection);
      return newSelection;
    });
  };

  const handleAssignQuestions = async () => {
    if (selectedQuestionIds.length === 0) {
      setAssignmentError('Please select at least one question to assign');
      return;
    }
    setAssignmentLoading(true);
    try {
      for (const questionId of selectedQuestionIds) {
        console.log('[TeacherClassView] Assigning question:', questionId, 'to class:', classId);
        await assignQuestionToClass(questionId, classId); // Updated to match api.js signature
      }
      setAssignmentMessage('Questions assigned successfully!');
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
      setSelectedQuestionIds([]);
      setTimeout(() => setAssignmentMessage(''), 3000);
    } catch (err) {
      console.error('[TeacherClassView] Assign error:', err.message || err.error, err);
      setAssignmentError(err.error || 'Failed to assign questions');
      setAssignmentMessage('');
    } finally {
      setAssignmentLoading(false);
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
            <Link
              to={`/teacher/classes/${classId}/edit`}
              className="inline-flex items-center px-4 py-2 rounded-lg text-sm font-semibold text-gray-700 bg-white border border-gray-200 shadow-sm hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2 transition-all duration-300"
            >
              Edit Class
            </Link>
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
        <div className="bg-white/90 backdrop-blur-sm rounded-2xl shadow-lg p-6 border border-gray-100 mb-10">
          <h3 className="text-xl font-semibold text-gray-800 mb-4">Assign Questions to Class</h3>
          {assignmentMessage && (
            <div className="mb-4 p-4 rounded-xl bg-green-50/80 backdrop-blur-sm border border-green-200 shadow-sm">
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
                <p className="ml-3 text-sm font-semibold text-green-800">{assignmentMessage}</p>
              </div>
            </div>
          )}
          {assignmentError && (
            <div className="mb-4 p-4 rounded-xl bg-red-50/80 backdrop-blur-sm border border-red-200 shadow-sm">
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
                <p className="ml-3 text-sm font-semibold text-red-800">{assignmentError}</p>
              </div>
            </div>
          )}
          <div className="mb-4">
            <label className="block text-sm font-semibold text-gray-800 mb-2">Select Questions</label>
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
                        ? "You haven't created any questions yet. Create your first question to assign to this class."
                        : "All your questions are already assigned to this class."
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
              <div className="space-y-2">
                <p className="text-sm text-gray-600 mb-3">
                  Select questions to assign to this class:
                </p>
                {availableQuestions.map((q) => (
                  <div key={q._id} className="flex items-center p-2 rounded-lg hover:bg-gray-50">
                    <input
                      type="checkbox"
                      checked={selectedQuestionIds.includes(q._id)}
                      onChange={() => handleQuestionToggle(q._id)}
                      className="h-4 w-4 text-indigo-600 focus:ring-indigo-500 border-gray-200 rounded"
                    />
                    <label className="ml-3 text-sm text-gray-800 flex-1 cursor-pointer">
                      <span className="font-medium">{q.title}</span>
                      {q.type === 'coding' && (
                        <span className="ml-2 text-xs text-gray-500">
                          ({q.languages?.join(', ') || 'No languages'})
                        </span>
                      )}
                    </label>
                  </div>
                ))}
              </div>
            )}
          </div>
          <button
            onClick={handleAssignQuestions}
            disabled={assignmentLoading || selectedQuestionIds.length === 0 || availableQuestions.length === 0}
            className="inline-flex items-center px-4 py-2 rounded-lg text-sm font-semibold text-white bg-indigo-600 hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2 transition-all duration-300 disabled:bg-gray-400 disabled:cursor-not-allowed"
            title={
              availableQuestions.length === 0
                ? 'No unassigned questions available'
                : selectedQuestionIds.length === 0
                ? 'Select at least one question'
                : assignmentLoading
                ? 'Assigning in progress'
                : ''
            }
          >
            {assignmentLoading ? (
              <>
                <svg className="animate-spin -ml-1 mr-2 h-4 w-4 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                </svg>
                Assigning...
              </>
            ) : (
              'Assign Questions'
            )}
          </button>
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