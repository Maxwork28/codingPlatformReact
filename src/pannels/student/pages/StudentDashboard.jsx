import React, { useEffect, useState } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { Link } from 'react-router-dom';
import axios from 'axios';
import { fetchClasses } from '../../../common/components/redux/classSlice';

const StudentDashboard = () => {
  const dispatch = useDispatch();
  const { classes, status, error } = useSelector((state) => state.classes);
  const { user } = useSelector((state) => state.auth);
  const [assignments, setAssignments] = useState([]);

  useEffect(() => {
    // Log initial user and status information
    console.log('[StudentDashboard] useEffect triggered', {
      user: user ? { id: user.id, name: user.name } : null,
      status,
      classesLength: classes.length,
    });

    // Check for user ID issues
    if (!user) {
      console.warn('[StudentDashboard] No user data in auth state');
    } else if (!user.id) {
      console.warn('[StudentDashboard] User ID is undefined', { user });
    } else {
      console.log('[StudentDashboard] User data available', {
        userId: user.id,
        userName: user.name,
      });
    }

    // Fetch classes if status is idle and user ID exists
    if (user?.id && status === 'idle') {
      console.log('[StudentDashboard] Dispatching fetchClasses', { userId: user.id });
      dispatch(fetchClasses());
    } else {
      console.log('[StudentDashboard] Skipping fetchClasses', {
        hasUserId: !!user?.id,
        status,
      });
    }

    // Fetch assignments for each class
    const fetchAssignments = async () => {
      console.log('[StudentDashboard] Starting fetchAssignments for classes', {
        classIds: classes.map((cls) => cls._id),
      });
      try {
        const allAssignments = [];
        for (const cls of classes) {
          console.log('[StudentDashboard] Fetching assignments for class', {
            classId: cls._id,
            className: cls.name,
          });
          const response = await axios.get(
            `https://api.algosutra.co.in/admin/classes/${cls._id}/assignments`,
            {
              headers: { Authorization: `Bearer ${localStorage.getItem('token')}` },
            }
          );
          // Ensure response.data.assignments is an array, fallback to empty array if not
          const assignmentsArray = Array.isArray(response.data.assignments)
            ? response.data.assignments
            : Array.isArray(response.data)
            ? response.data
            : [];
          console.log('[StudentDashboard] Assignments fetched for class', {
            classId: cls._id,
            assignmentCount: assignmentsArray.length,
            assignments: assignmentsArray,
          });
          allAssignments.push(
            ...assignmentsArray.map((assignment) => ({
              ...assignment,
              classId: cls._id,
            }))
          );
        }
        console.log('[StudentDashboard] All assignments fetched', {
          totalAssignments: allAssignments.length,
          assignments: allAssignments,
        });
        setAssignments(allAssignments);
      } catch (err) {
        console.error('[StudentDashboard] Failed to fetch assignments', {
          error: err.message,
          response: err.response
            ? {
                status: err.response.status,
                data: err.response.data,
              }
            : null,
        });
      }
    };

    // Only fetch assignments if classes are available
    if (classes.length > 0) {
      console.log('[StudentDashboard] Triggering fetchAssignments');
      fetchAssignments();
    } else {
      console.log('[StudentDashboard] No classes available, skipping fetchAssignments');
    }
  }, [dispatch, user, status, classes]);

  // Filter classes for the current user
  const myClasses = user?.id
    ? classes.filter((cls) => {
        const isEnrolled = cls.students.some((s) => s._id === user.id);
        console.log('[StudentDashboard] Checking class enrollment', {
          classId: cls._id,
          className: cls.name,
          userId: user.id,
          isEnrolled,
        });
        return isEnrolled;
      })
    : [];
  console.log('[StudentDashboard] Filtered myClasses', {
    myClassesCount: myClasses.length,
    myClasses: myClasses.map((cls) => ({ id: cls._id, name: cls.name })),
  });

  // Filter upcoming assignments
  const upcomingAssignments = assignments
    .filter((assignment) => {
      const dueDate = new Date(assignment.dueDate);
      const isUpcoming = dueDate > new Date();
      console.log('[StudentDashboard] Checking assignment due date', {
        assignmentId: assignment._id,
        questionId: assignment.questionId,
        dueDate: assignment.dueDate,
        isUpcoming,
      });
      return isUpcoming;
    })
    .slice(0, 5);
  console.log('[StudentDashboard] Filtered upcomingAssignments', {
    upcomingAssignmentsCount: upcomingAssignments.length,
    upcomingAssignments: upcomingAssignments.map((a) => ({
      id: a._id,
      questionId: a.questionId,
      dueDate: a.dueDate,
    })),
  });

  // Log render state
  console.log('[StudentDashboard] Rendering', {
    user: user ? { id: user.id, name: user.name } : null,
    status,
    error,
    classesCount: classes.length,
    myClassesCount: myClasses.length,
    assignmentsCount: assignments.length,
    upcomingAssignmentsCount: upcomingAssignments.length,
  });

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      <header className="mb-10">
        <h2 className="text-3xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-indigo-600 to-indigo-400 tracking-tight">
          Welcome back, {user?.name || 'Student'}!
        </h2>
        <p className="mt-2 text-lg text-gray-600 font-medium">
          Your learning journey at a glance
        </p>
      </header>

      {status === 'loading' && (
        <div className="flex flex-col items-center justify-center py-16 bg-white/50 rounded-xl shadow-lg">
          <div className="w-12 h-12 border-4 border-indigo-500 border-t-transparent rounded-full animate-spin"></div>
          <p className="mt-4 text-gray-700 font-medium">Loading your classes...</p>
        </div>
      )}

      {error && (
        <div className="flex items-center p-4 mb-6 bg-red-50/80 rounded-xl shadow-sm">
          <svg className="w-6 h-6 text-red-500 mr-3" fill="currentColor" viewBox="0 0 20 20">
            <path
              fillRule="evenodd"
              d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7 4a1 1 0 11-2 0 1 1 0 012 0zm-1-9a1 1 0 00-1 1v4a1 1 0 102 0V6a1 1 0 00-1-1z"
              clipRule="evenodd"
            />
          </svg>
          <p className="text-red-700 font-semibold">Error: {error}</p>
        </div>
      )}

      {!user?.id && (
        <div className="flex items-center p-4 mb-6 bg-red-50/80 rounded-xl shadow-sm">
          <svg className="w-6 h-6 text-red-500 mr-3" fill="currentColor" viewBox="0 0 20 20">
            <path
              fillRule="evenodd"
              d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7 4a1 1 0 11-2 0 1 1 0 012 0zm-1-9a1 1 0 00-1 1v4a1 1 0 102 0V6a1 1 0 00-1-1z"
              clipRule="evenodd"
            />
          </svg>
          <p className="text-red-700 font-semibold">User ID is missing. Please log in again.</p>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 bg-white/90 rounded-2xl shadow-lg border border-gray-100 overflow-hidden transition-all duration-300 hover:shadow-xl">
          <div className="px-6 py-5 border-b border-gray-100 flex justify-between items-center bg-gradient-to-r from-gray-50 to-white">
            <h3 className="text-xl font-semibold text-gray-800">My Classes</h3>
            <span className="inline-flex items-center px-3 py-1 rounded-full text-sm font-semibold bg-indigo-100 text-indigo-700 shadow-sm">
              {myClasses.length}
            </span>
          </div>

          {status === 'succeeded' && myClasses.length === 0 ? (
            <div className="p-8 text-center">
              <svg className="mx-auto h-14 w-14 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={1.5}
                  d="M10 2a6 6 0 00-6 6v3.586l-.707.707A1 1 0 004 14h12a1 1 0 00.707-1.707L16 11.586V8a6 6 0 00-6-6zM10 18a3 3 0 01-3-3h6a3 3 0 01-3 3z"
                />
              </svg>
              <h4 className="mt-3 text-base font-semibold text-gray-800">No classes</h4>
              <p className="mt-1 text-sm text-gray-500">You're not enrolled in any classes yet</p>
            </div>
          ) : (
            <div className="divide-y divide-gray-100">
              {myClasses.map((cls) => (
                <Link
                  key={cls._id}
                  to={`/student/classes/${cls._id}`}
                  className="block hover:bg-indigo-50/50 transition-all duration-200"
                  onClick={() =>
                    console.log('[StudentDashboard] Navigating to class', {
                      classId: cls._id,
                      className: cls.name,
                    })
                  }
                >
                  <div className="px-6 py-5 flex items-center">
                    <div className="flex-shrink-0 h-12 w-12 rounded-full bg-indigo-600 flex items-center justify-center text-white text-lg font-semibold shadow-sm">
                      {cls.name.charAt(0)}
                    </div>
                    <div className="ml-4 flex-1">
                      <h4 className="text-base font-semibold text-gray-800">{cls.name}</h4>
                      <p className="text-sm text-gray-500">{cls.students.length} students</p>
                    </div>
                    <svg
                      className="h-6 w-6 text-indigo-400 group-hover:text-indigo-600 transition-colors duration-200"
                      fill="currentColor"
                      viewBox="0 0 20 20"
                    >
                      <path
                        fillRule="evenodd"
                        d="M7.293 14.707a1 1 0 010-1.414L10.586 10 7.293 6.707a1 1 0 011.414-1.414l4 4a1 1 0 010 1.414l-4 4a1 1 0 01-1.414 0z"
                        clipRule="evenodd"
                      />
                    </svg>
                  </div>
                </Link>
              ))}
            </div>
          )}
        </div>

        <div className="bg-white/90 rounded-2xl shadow-lg border border-gray-100 overflow-hidden transition-all duration-300 hover:shadow-xl">
          <div className="px-6 py-5 border-b border-gray-100 bg-gradient-to-r from-gray-50 to-white">
            <h3 className="text-xl font-semibold text-gray-800">Upcoming Assignments</h3>
          </div>
          {upcomingAssignments.length === 0 ? (
            <div className="p-8 text-center">
              <svg className="mx-auto h-14 w-14 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={1.5}
                  d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2"
                />
              </svg>
              <h4 className="mt-3 text-base font-semibold text-gray-800">No upcoming assignments</h4>
              <p className="mt-1 text-sm text-gray-500">You're all caught up!</p>
            </div>
          ) : (
            <div className="divide-y divide-gray-100">
              {upcomingAssignments.map((assignment) => {
                const cls = classes.find((c) => c._id === assignment.classId);
                const question = cls?.questions?.find((q) => q._id === assignment.questionId);
                console.log('[StudentDashboard] Rendering assignment', {
                  assignmentId: assignment._id,
                  questionId: assignment.questionId,
                  classId: assignment.classId,
                  hasQuestion: !!question,
                  className: cls?.name,
                  questionTitle: question?.title,
                });
                if (!question) {
                  console.warn('[StudentDashboard] Question not found for assignment', {
                    assignmentId: assignment._id,
                    questionId: assignment.questionId,
                    classId: assignment.classId,
                  });
                  return null;
                }
                return (
                  <Link
                    key={assignment._id}
                    to={`/student/questions/${assignment.questionId}/submit`}
                    state={{ classId: assignment.classId }}
                    className="block hover:bg-indigo-50/50 transition-all duration-200"
                    onClick={() =>
                      console.log('[StudentDashboard] Navigating to question submission', {
                        questionId: assignment.questionId,
                        classId: assignment.classId,
                      })
                    }
                  >
                    <div className="px-6 py-5">
                      <h4 className="text-base font-semibold text-gray-800">{question.title}</h4>
                      <p className="text-sm text-gray-500">
                        Due: {new Date(assignment.dueDate).toLocaleString()}
                      </p>
                      <p className="text-sm text-gray-500">Class: {cls?.name}</p>
                    </div>
                  </Link>
                );
              })}
            </div>
          )}
        </div>

        <div className="lg:col-span-3 bg-white/90 rounded-2xl shadow-lg border border-gray-100 overflow-hidden transition-all duration-300 hover:shadow-xl">
          <div className="px-6 py-5 border-b border-gray-100 bg-gradient-to-r from-gray-50 to-white">
            <h3 className="text-xl font-semibold text-gray-800">Recent Activity</h3>
          </div>
          <div className="p-8 text-center">
            <svg className="mx-auto h-14 w-14 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={1.5}
                d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"
              />
            </svg>
            <h4 className="mt-3 text-base font-semibold text-gray-800">No recent activity</h4>
            <p className="mt-1 text-sm text-gray-500">Your activity will appear here</p>
          </div>
        </div>
      </div>
    </div>
  );
};

export default StudentDashboard;