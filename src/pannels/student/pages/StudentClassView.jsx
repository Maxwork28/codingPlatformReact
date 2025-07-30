import React, { useEffect, useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import { useSelector } from 'react-redux';
import { io } from 'socket.io-client';
import axios from 'axios';
import StudentQuestionCard from '../components/StudentQuestionCard';

const socket = io('https://api.algosutra.co.in', {
  withCredentials: true,
});

const StudentClassView = () => {
  const { classId } = useParams();
  const { classes } = useSelector((state) => state.classes);
  const { user } = useSelector((state) => state.auth);
  const [classData, setClassData] = useState(null);
  const [assignments, setAssignments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState('');
  const [error, setError] = useState(null);

  // Log initial render state
  console.log('[StudentClassView] Rendered', {
    classId,
    classesCount: classes.length,
    user: user ? { id: user.id, name: user.name, role: user.role } : null,
  });

  useEffect(() => {
    // Log useEffect trigger
    console.log('[StudentClassView] useEffect triggered', {
      classId,
      classes: classes.map((c) => ({ id: c._id, name: c.name })),
      userId: user?.id,
    });

    // Fetch assignments for the class
    const fetchAssignments = async () => {
      console.log('[StudentClassView] Fetching assignments for class', { classId });
      try {
        const response = await axios.get(
          `https://api.algosutra.co.in/admin/classes/${classId}/assignments`,
          {
            headers: { Authorization: `Bearer ${localStorage.getItem('token')}` },
          }
        );
        const assignmentsArray = Array.isArray(response.data.assignments)
          ? response.data.assignments
          : Array.isArray(response.data)
          ? response.data
          : [];
        console.log('[StudentClassView] Assignments fetched', {
          classId,
          assignmentCount: assignmentsArray.length,
          assignments: assignmentsArray,
        });
        setAssignments(assignmentsArray);
      } catch (err) {
        console.error('[StudentClassView] Failed to fetch assignments', {
          classId,
          error: err.message,
          response: err.response
            ? { status: err.response.status, data: err.response.data }
            : null,
        });
        setError(err.response?.data?.message || 'Failed to fetch assignments');
      }
    };

    // Find class and verify user enrollment
    const cls = classes.find((c) => c._id === classId);
    if (cls && cls.students.some((s) => s._id === user?.id)) {
      console.log('[StudentClassView] Class found and user authorized', {
        classId,
        className: cls.name,
        studentCount: cls.students.length,
        questionCount: cls.questions.length,
        userId: user.id,
      });
      const updatedQuestions = cls.questions.map((q) => {
        const classInfo = q.classes.find((c) => c.classId === classId);
        console.log('[StudentClassView] Processing question', {
          questionId: q._id,
          questionTitle: q.title,
          isPublished: classInfo?.isPublished,
          isDisabled: classInfo?.isDisabled,
        });
        return {
          ...q,
          isPublished: classInfo ? classInfo.isPublished : false,
          isDisabled: classInfo ? classInfo.isDisabled : false,
        };
      });
      setClassData({
        ...cls,
        questions: updatedQuestions,
      });
      fetchAssignments();
    } else {
      console.warn('[StudentClassView] Class not found or user not authorized', {
        classId,
        classes: classes.map((c) => c._id),
        userId: user?.id,
        isEnrolled: cls ? cls.students.some((s) => s._id === user?.id) : false,
      });
      setError('Class not found or you are not enrolled.');
    }
    setLoading(false);

    // Join socket room for class
    console.log('[StudentClassView] Emitting joinClass', { classId });
    socket.emit('joinClass', classId);

    // Socket event listeners
    socket.on('questionPublished', ({ questionId, isPublished }) => {
      console.log('[StudentClassView] questionPublished event', { questionId, isPublished });
      setClassData((prev) => {
        if (!prev) {
          console.warn('[StudentClassView] No classData for questionPublished', { questionId });
          return prev;
        }
        const updatedQuestions = prev.questions.map((q) =>
          q._id === questionId
            ? {
                ...q,
                isPublished,
                classes: q.classes.map((c) =>
                  c.classId === classId ? { ...c, isPublished } : c
                ),
              }
            : q
        );
        console.log('[StudentClassView] Updated classData for questionPublished', {
          questionId,
          updatedQuestions: updatedQuestions.map((q) => ({
            id: q._id,
            isPublished: q.isPublished,
          })),
        });
        return { ...prev, questions: updatedQuestions };
      });
      setMessage(`Question ${isPublished ? 'published' : 'unpublished'}`);
      setTimeout(() => setMessage(''), 3000);
    });

    socket.on('questionDisabled', ({ questionId, isDisabled }) => {
      console.log('[StudentClassView] questionDisabled event', { questionId, isDisabled });
      setClassData((prev) => {
        if (!prev) {
          console.warn('[StudentClassView] No classData for questionDisabled', { questionId });
          return prev;
        }
        const updatedQuestions = prev.questions.map((q) =>
          q._id === questionId
            ? {
                ...q,
                isDisabled,
                classes: q.classes.map((c) =>
                  c.classId === classId ? { ...c, isDisabled } : c
                ),
              }
            : q
        );
        console.log('[StudentClassView] Updated classData for questionDisabled', {
          questionId,
          updatedQuestions: updatedQuestions.map((q) => ({
            id: q._id,
            isDisabled: q.isDisabled,
          })),
        });
        return { ...prev, questions: updatedQuestions };
      });
      setMessage(`Question ${isDisabled ? 'disabled' : 'enabled'}`);
      setTimeout(() => setMessage(''), 3000);
    });

    socket.on('questionDeleted', ({ questionId }) => {
      console.log('[StudentClassView] questionDeleted event', { questionId });
      setClassData((prev) => {
        if (!prev) {
          console.warn('[StudentClassView] No classData for questionDeleted', { questionId });
          return prev;
        }
        const updatedQuestions = prev.questions.filter((q) => q._id !== questionId);
        console.log('[StudentClassView] Updated classData for questionDeleted', {
          questionId,
          remainingQuestions: updatedQuestions.length,
        });
        return { ...prev, questions: updatedQuestions };
      });
      setMessage('Question deleted');
      setTimeout(() => setMessage(''), 3000);
    });

    socket.on('questionUpdated', ({ questionId, updatedFields }) => {
      console.log('[StudentClassView] questionUpdated event', { questionId, updatedFields });
      setClassData((prev) => {
        if (!prev) {
          console.warn('[StudentClassView] No classData for questionUpdated', { questionId });
          return prev;
        }
        const updatedQuestions = prev.questions.map((q) =>
          q._id === questionId ? { ...q, ...updatedFields } : q
        );
        console.log('[StudentClassView] Updated classData for questionUpdated', {
          questionId,
          updatedFields,
          updatedQuestions: updatedQuestions.map((q) => ({
            id: q._id,
            title: q.title,
          })),
        });
        return { ...prev, questions: updatedQuestions };
      });
      setMessage('Question updated');
      setTimeout(() => setMessage(''), 3000);
    });

    // Cleanup socket listeners
    return () => {
      console.log('[StudentClassView] Cleaning up socket listeners', { classId });
      socket.off('questionPublished');
      socket.off('questionDisabled');
      socket.off('questionDeleted');
      socket.off('questionUpdated');
      socket.emit('leaveClass', classId);
    };
  }, [classId, classes, user]);

  // Log render state
  console.log('[StudentClassView] Rendering', {
    classId,
    classData: classData
      ? { id: classData._id, name: classData.name, questionCount: classData.questions.length }
      : null,
    assignmentsCount: assignments.length,
    loading,
    error,
    message,
  });

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
          <p className="text-sm text-red-700 font-semibold">
            {error || 'Class not found or you are not enrolled.'}
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      {message && (
        <div className="mb-6 p-4 rounded-xl bg-green-50/80 backdrop-blur-sm border border-green-200 shadow-sm">
          <p className="text-sm font-semibold text-green-800">{message}</p>
        </div>
      )}

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
              to={`/student/classes/${classId}/leaderboard`}
              className="inline-flex items-center px-4 py-2 rounded-lg text-sm font-semibold text-white bg-indigo-600 hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2 transition-all duration-300"
              onClick={() =>
                console.log('[StudentClassView] Navigating to leaderboard', { classId })
              }
            >
              View Leaderboard
            </Link>
          </div>
        </div>
        <div className="mt-4 flex flex-wrap gap-3">
          <span className="inline-flex items-center px-3 py-1 rounded-full text-xs font-semibold bg-indigo-100 text-indigo-700 shadow-sm">
            {classData.students.length} Students
          </span>
          <span className="inline-flex items-center px-3 py-1 rounded-full text-xs font-semibold bg-green-100 text-green-700 shadow-sm">
            {assignments.length} Assignments
          </span>
        </div>
      </div>

      <div className="mt-10">
        <div className="flex justify-between items-center mb-6">
          <h3 className="text-xl font-semibold text-gray-800">Assignments</h3>
        </div>

        {assignments.length === 0 ? (
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
                d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2"
              />
            </svg>
            <h4 className="mt-3 text-base font-semibold text-gray-800">No assignments yet</h4>
            <p className="mt-1 text-sm text-gray-500">
              Check back later for assignments from your teacher
            </p>
          </div>
        ) : (
          <div className="space-y-6">
            {assignments.map((assignment) => {
              const question = classData.questions.find(
                (q) => q._id === (assignment.questionId?._id || assignment.questionId)
              );
              const classInfo = question?.classes.find((c) => c.classId === classId);
              console.log('[StudentClassView] Rendering assignment', {
                assignmentId: assignment._id,
                questionId: assignment.questionId?._id || assignment.questionId,
                classId,
                hasQuestion: !!question,
                isPublished: classInfo?.isPublished,
                isDisabled: classInfo?.isDisabled,
                questionTitle: question?.title,
              });
              if (!question) {
                console.warn('[StudentClassView] Question not found for assignment', {
                  assignmentId: assignment._id,
                  questionId: assignment.questionId?._id || assignment.questionId,
                  classId,
                });
                return null;
              }
              return (
                <div
                  key={assignment._id}
                  className="bg-white/90 backdrop-blur-sm rounded-2xl shadow-lg overflow-hidden border border-gray-100 transition-all duration-300 hover:shadow-xl"
                >
                  <div className="p-6">
                    <div className="flex justify-between items-start">
                      <StudentQuestionCard
                        question={{
                          ...question,
                          isPublished: classInfo?.isPublished,
                          isDisabled: classInfo?.isDisabled,
                        }}
                        assignment={assignment}
                      />
                      <div className="ml-4 flex-shrink-0">
                        <Link
                          to={`/student/questions/${
                            assignment.questionId?._id || assignment.questionId
                          }/submit`}
                          state={{ classId }}
                          className={`inline-flex items-center px-4 py-2 rounded-lg text-sm font-semibold text-white focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 transition-all duration-300 ${
                            classInfo?.isPublished && !classInfo?.isDisabled
                              ? 'bg-indigo-600 hover:bg-indigo-700'
                              : 'bg-gray-400 cursor-not-allowed'
                          }`}
                          disabled={!classInfo?.isPublished || classInfo?.isDisabled}
                          onClick={() =>
                            console.log('[StudentClassView] Navigating to question submission', {
                              questionId: assignment.questionId?._id || assignment.questionId,
                              classId,
                            })
                          }
                        >
                          {classInfo?.isPublished && !classInfo?.isDisabled
                            ? 'Submit Answer'
                            : classInfo?.isDisabled
                            ? 'Disabled'
                            : 'Unpublished'}
                        </Link>
                      </div>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
};

export default StudentClassView;