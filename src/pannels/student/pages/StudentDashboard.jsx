import React, { useEffect, useState } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { Link } from 'react-router-dom';
import axios from 'axios';
import { fetchClasses } from '../../../common/components/redux/classSlice';
import { DiJavascript } from "react-icons/di";
import { FaJava, FaPython, FaCheckCircle, FaChartLine, FaClock, FaProjectDiagram, FaBookOpen } from "react-icons/fa";
import { GiNotebook } from "react-icons/gi";
import { MdOutlineAssignment } from "react-icons/md";
import { VscCode } from "react-icons/vsc";

const StudentDashboard = () => {
  const dispatch = useDispatch();
  const { classes, status, error } = useSelector((state) => state.classes);
  const { user } = useSelector((state) => state.auth);
  const [assignments, setAssignments] = useState([]);

  useEffect(() => {
    // Check if user is authenticated
    if (!user) {
      console.log('[StudentDashboard] No user found, redirecting to login');
      return;
    }

    // Log initial user and status information
    console.log('[StudentDashboard] useEffect triggered', {
      user: user ? { id: user.id, name: user.name } : null,
      status,
      classesLength: classes.length,
    });

    // Check for user ID issues
    if (!user.id) {
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
      dispatch(fetchClasses(''));
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
            `http://localhost:3000/admin/classes/${cls._id}/assignments`,
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

  // Filter upcoming assignments (show all assignments, sorted by due date)
  const upcomingAssignments = assignments
    .map((assignment) => {
      const dueDate = assignment.dueDate ? new Date(assignment.dueDate) : null;
      const isPast = dueDate ? dueDate < new Date() : false;
      console.log('[StudentDashboard] Processing assignment', {
        assignmentId: assignment._id,
        questionId: assignment.questionId?._id || assignment.questionId,
        dueDate: assignment.dueDate,
        isPast,
      });
      return assignment;
    })
    .sort((a, b) => {
      // Sort by due date, with future dates first, then past dates
      const dateA = a.dueDate ? new Date(a.dueDate).getTime() : 0;
      const dateB = b.dueDate ? new Date(b.dueDate).getTime() : 0;
      return dateB - dateA; // Most recent first
    })
    .slice(0, 5);
  
  // Debug logging
  console.log('[StudentDashboard] Debug Info:', {
    totalAssignments: assignments.length,
    upcomingAssignmentsCount: upcomingAssignments.length,
    myClassesCount: myClasses.length,
    assignments: assignments,
    upcomingAssignments: upcomingAssignments,
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

  // Function to get appropriate icon based on class name
  const getClassIcon = (className) => {
    const lowerName = className.toLowerCase();
    
    if (lowerName.includes('javascript') || lowerName.includes('js')) {
      return <DiJavascript className="w-5 h-5" style={{ color: '#EAB308' }} />;
    } else if (lowerName.includes('java') || lowerName.includes('object-oriented programming') || lowerName.includes('oop')) {
      return <FaJava className="w-5 h-5" style={{ color: '#EF4444' }} />;
    } else if (lowerName.includes('python')) {
      return <FaPython className="w-5 h-5" style={{ color: '#3B82F6' }} />;
    } else if (lowerName.includes('software engineering') || lowerName.includes('engineering')) {
      return <GiNotebook className="w-5 h-5" style={{ color: '#059669' }} />;
    } else if (lowerName.includes('competitive programming')) {
      return <VscCode className="w-5 h-5" style={{ color: '#8B5CF6' }} />;
    } else if (lowerName.includes('introduction to programming') || lowerName.includes('introduction to progra')) {
      return <FaBookOpen className="w-5 h-5" style={{ color: '#6B7280' }} />;
    } else if (lowerName.includes('algorithm')) {
      return <FaProjectDiagram className="w-5 h-5" style={{ color: '#F97316' }} />;
    } else {
      // Default book icon for other classes
      return (
        <svg className="w-5 h-5" style={{ color: '#6B7280' }} fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" />
        </svg>
      );
    }
  };

  return (
    <div className="max-w-7xl mx-auto px-6 py-8">
      {/* Professional Header */}
      <header className="mb-8">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-semibold" style={{ color: 'var(--text-primary)' }}>
              Welcome back, {user?.name || 'Student'}
            </h1>
            <p className="mt-1 text-sm" style={{ color: 'var(--text-secondary)' }}>
              {new Date().toLocaleDateString('en-US', { 
                weekday: 'long', 
                year: 'numeric', 
                month: 'long', 
                day: 'numeric' 
              })}
            </p>
          </div>
        </div>
      </header>

      {/* Loading State */}
      {status === 'loading' && (
        <div className="flex justify-center items-center py-16 backdrop-blur-sm rounded-xl shadow-lg" style={{ backgroundColor: 'var(--card-white)' }}>
          <div className="w-12 h-12 border-4 border-t-transparent rounded-full animate-spin" style={{ borderColor: 'var(--text-primary)', borderTopColor: 'transparent' }}></div>
        </div>
      )}

      {/* Error State */}
      {error && (
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
            <p className="mt-1 text-sm text-red-700">{error}</p>
          </div>
        </div>
      )}

      {/* Main Dashboard Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* My Classes Card */}
        <div className="lg:col-span-2 backdrop-blur-sm border rounded-2xl shadow-lg transition-all duration-300 hover:shadow-2xl hover:-translate-y-2 hover:scale-[1.02]" style={{ backgroundColor: 'var(--card-white)', borderColor: 'var(--card-border)' }}>
          <div className="px-6 py-4 border-b border-gray-200" style={{ backgroundColor: 'var(--background-light)' }}>
            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-3">
                <svg className="w-5 h-5" style={{ color: 'var(--primary-blue)' }} fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" />
                </svg>
                <h2 className="text-lg font-medium" style={{ color: 'var(--text-primary)' }}>My Classes</h2>
              </div>
              <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium" style={{ backgroundColor: 'var(--accent-blue)', color: 'white' }}>
                {myClasses.length}
              </span>
            </div>
          </div>

          {status === 'succeeded' && myClasses.length === 0 ? (
            <div className="p-8 text-center">
              <svg className="mx-auto h-12 w-12 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" />
              </svg>
              <h3 className="mt-4 text-sm font-medium" style={{ color: 'var(--text-primary)' }}>No classes enrolled</h3>
              <p className="mt-2 text-sm" style={{ color: 'var(--text-secondary)' }}>You haven't joined any classes yet.</p>
            </div>
          ) : (
            <div className="divide-y divide-gray-200">
              {myClasses.map((cls) => (
                <Link
                  key={cls._id}
                  to={`/student/classes/${cls._id}`}
                  className="block hover:border-blue-400 transition-all duration-200 transform hover:scale-[1.01] hover:shadow-md"
                  style={{ 
                    '--hover-bg': 'var(--background-light)',
                  }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.backgroundColor = 'var(--background-light)';
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.backgroundColor = 'transparent';
                  }}
                  onClick={() =>
                    console.log('[StudentDashboard] Navigating to class', {
                      classId: cls._id,
                      className: cls.name,
                    })
                  }
                >
                  <div className="px-6 py-4 flex items-center">
                    <div className="flex-shrink-0 h-10 w-10 rounded-lg flex items-center justify-center transition-colors duration-200" style={{ backgroundColor: 'var(--background-light)' }}>
                      {getClassIcon(cls.name)}
                    </div>
                    <div className="ml-4 flex-1 min-w-0">
                      <p className="text-sm font-medium" style={{ color: 'var(--text-primary)' }}>{cls.name}</p>
                      <p className="text-sm" style={{ color: 'var(--text-secondary)' }}>{cls.students.length} students</p>
                    </div>
                    <div className="flex-shrink-0">
                      <svg className="h-5 w-5 text-gray-400 hover:text-indigo-500 transition-colors duration-200 transform hover:translate-x-1" fill="currentColor" viewBox="0 0 20 20">
                        <path fillRule="evenodd" d="M7.293 14.707a1 1 0 010-1.414L10.586 10 7.293 6.707a1 1 0 011.414-1.414l4 4a1 1 0 010 1.414l-4 4a1 1 0 01-1.414 0z" clipRule="evenodd" />
                      </svg>
                    </div>
                  </div>
                </Link>
              ))}
            </div>
          )}
        </div>

        {/* Upcoming Assignments Card */}
        <div className="backdrop-blur-sm border rounded-2xl shadow-lg transition-all duration-300 hover:shadow-2xl hover:-translate-y-2 hover:scale-[1.02]" style={{ backgroundColor: 'var(--card-white)', borderColor: 'var(--card-border)' }}>
          <div className="px-6 py-4 border-b border-gray-200" style={{ backgroundColor: 'var(--background-light)' }}>
            <div className="flex items-center space-x-3">
              <MdOutlineAssignment className="w-5 h-5" style={{ color: 'var(--highlight-blue)' }} />
              <h2 className="text-lg font-medium" style={{ color: 'var(--text-primary)' }}>Upcoming Assignments</h2>
            </div>
          </div>
          
          {upcomingAssignments.length === 0 ? (
            <div className="p-6 text-center">
              <svg className="mx-auto h-10 w-10 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
              </svg>
              <h3 className="mt-3 text-sm font-medium" style={{ color: 'var(--text-primary)' }}>No upcoming assignments</h3>
              <p className="mt-1 text-sm" style={{ color: 'var(--text-secondary)' }}>You're all caught up.</p>
            </div>
          ) : (
            <div className="divide-y divide-gray-200">
              {upcomingAssignments.map((assignment) => {
                const cls = classes.find((c) => c._id === assignment.classId);
                // Handle both string questionId and populated questionId object
                const questionId = assignment.questionId?._id || assignment.questionId;
                const question = cls?.questions?.find((q) => q._id === questionId);
                console.log('[StudentDashboard] Rendering assignment', {
                  assignmentId: assignment._id,
                  questionId: questionId,
                  rawQuestionId: assignment.questionId,
                  classId: assignment.classId,
                  hasClass: !!cls,
                  classQuestionsCount: cls?.questions?.length || 0,
                  hasQuestion: !!question,
                  className: cls?.name,
                  questionTitle: question?.title,
                });
                if (!question) {
                  console.warn('[StudentDashboard] Question not found for assignment', {
                    assignmentId: assignment._id,
                    questionId: questionId,
                    rawQuestionId: assignment.questionId,
                    classId: assignment.classId,
                    className: cls?.name,
                    classQuestionsIds: cls?.questions?.map(q => q._id),
                  });
                  return null;
                }
                return (
                  <Link
                    key={assignment._id}
                    to={`/student/questions/${questionId}/submit`}
                    state={{ classId: assignment.classId }}
                    className="block transition-colors duration-150"
                    style={{ 
                      '--hover-bg': 'var(--background-light)',
                    }}
                    onMouseEnter={(e) => {
                      e.currentTarget.style.backgroundColor = 'var(--background-light)';
                    }}
                    onMouseLeave={(e) => {
                      e.currentTarget.style.backgroundColor = 'transparent';
                    }}
                    onClick={() =>
                      console.log('[StudentDashboard] Navigating to question submission', {
                        questionId: questionId,
                        classId: assignment.classId,
                      })
                    }
                  >
                    <div className="px-6 py-4">
                      <h4 className="text-sm font-medium" style={{ color: 'var(--text-primary)' }}>{question.title}</h4>
                      <p className="text-sm" style={{ color: 'var(--text-secondary)' }}>Class: {cls?.name}</p>
                      <p className="text-sm" style={{ color: 'var(--text-secondary)' }}>
                        Due: {new Date(assignment.dueDate).toLocaleDateString()}
                      </p>
                    </div>
                  </Link>
                );
              })}
            </div>
          )}
        </div>

        {/* Recent Activity Card */}
        <div className="lg:col-span-3 backdrop-blur-sm border rounded-2xl shadow-lg transition-all duration-300 hover:shadow-2xl hover:-translate-y-2 hover:scale-[1.02]" style={{ backgroundColor: 'var(--card-white)', borderColor: 'var(--card-border)' }}>
          <div className="px-6 py-4 border-b border-gray-200" style={{ backgroundColor: 'var(--background-light)' }}>
            <h2 className="text-lg font-medium" style={{ color: 'var(--text-primary)' }}>Recent Activity</h2>
          </div>
          
          <div className="p-6">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              {/* Activity Stats */}
              <div className="text-center hover:transform hover:scale-105 transition-all duration-200">
                <div className="flex items-center justify-center mb-2">
                  <FaCheckCircle className="w-6 h-6 text-green-500 mr-2" />
                  <div className="text-2xl font-semibold" style={{ color: 'var(--text-primary)' }}>12</div>
                </div>
                <div className="text-sm" style={{ color: 'var(--text-secondary)' }}>Problems Solved</div>
              </div>
              
              <div className="text-center hover:transform hover:scale-105 transition-all duration-200">
                <div className="flex items-center justify-center mb-2">
                  <FaChartLine className="w-6 h-6 text-blue-500 mr-2" />
                  <div className="text-2xl font-semibold" style={{ color: 'var(--text-primary)' }}>85%</div>
                </div>
                <div className="text-sm" style={{ color: 'var(--text-secondary)' }}>Success Rate</div>
              </div>
              
              <div className="text-center hover:transform hover:scale-105 transition-all duration-200">
                <div className="flex items-center justify-center mb-2">
                  <FaClock className="w-6 h-6 text-orange-500 mr-2" />
                  <div className="text-2xl font-semibold" style={{ color: 'var(--text-primary)' }}>24h</div>
                </div>
                <div className="text-sm" style={{ color: 'var(--text-secondary)' }}>Study Time</div>
              </div>
            </div>
            
            <div className="mt-6 text-center">
              <p className="text-sm" style={{ color: 'var(--text-secondary)' }}>No recent activity to display.</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default StudentDashboard;
