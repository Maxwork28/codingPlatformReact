import React, { useEffect, useMemo, useState } from 'react';
import { useSelector } from 'react-redux';
import { Link, useNavigate } from 'react-router-dom';
import { getClassExams } from '../../../common/services/api';

const statusColors = {
  active: 'bg-green-100 text-green-800',
  scheduled: 'bg-yellow-100 text-yellow-800',
  completed: 'bg-gray-100 text-gray-600',
  template: 'bg-blue-100 text-blue-800',
};

// Batch size for concurrent requests
const BATCH_SIZE = 10;

const StudentExamList = () => {
  const navigate = useNavigate();
  const { classes } = useSelector((state) => state.classes);
  const { user } = useSelector((state) => state.auth);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [examMap, setExamMap] = useState({});
  const [processedClasses, setProcessedClasses] = useState(0);
  const [activeTab, setActiveTab] = useState('scheduled'); // 'scheduled' or 'completed'
  const [expandedClasses, setExpandedClasses] = useState(new Set()); // Track which classes are expanded

  // Filter to only show classes where the student is enrolled
  const enrolledClasses = useMemo(() => {
    if (!user?.id) return [];
    return classes.filter((cls) => {
      // Check if student ID is in the students array
      const studentIds = cls.students?.map((s) => (typeof s === 'object' ? s._id : s)) || [];
      return studentIds.includes(user.id);
    });
  }, [classes, user?.id]);

  const classIds = useMemo(() => enrolledClasses.map((cls) => cls._id), [enrolledClasses]);

  // Toggle class expansion
  const toggleClass = (classId) => {
    setExpandedClasses((prev) => {
      const next = new Set(prev);
      if (next.has(classId)) {
        next.delete(classId);
      } else {
        next.add(classId);
      }
      return next;
    });
  };

  // Helper function to batch requests
  const batchRequests = async (items, batchSize, processor) => {
    const results = [];
    for (let i = 0; i < items.length; i += batchSize) {
      const batch = items.slice(i, i + batchSize);
      const batchResults = await Promise.allSettled(
        batch.map((item) => processor(item))
      );
      results.push(...batchResults);
    }
    return results;
  };

  useEffect(() => {
    let isMounted = true;
    const fetchExams = async () => {
      setLoading(true);
      setError(null);
      
      // Process all enrolled classes (no limit since we're only showing enrolled classes)
      try {
        const results = await batchRequests(
          classIds,
          BATCH_SIZE,
          (classId) => getClassExams(classId)
        );

        if (!isMounted) return;
        
        const nextMap = {};
        
        results.forEach((result, idx) => {
          const classId = classIds[idx];
          if (result.status === 'fulfilled') {
            const exams = result.value.data.exams || [];
            nextMap[classId] = exams;
          } else {
            nextMap[classId] = [];
            console.error('[StudentExamList] Failed to load exams', {
              classId,
              error: result.reason?.message,
            });
          }
        });
        
        setExamMap(nextMap);
        setProcessedClasses(classIds.length);
      } catch (err) {
        if (!isMounted) return;
        console.error('[StudentExamList] fetchExams error', err);
        setError('Failed to load exams');
      } finally {
        if (isMounted) setLoading(false);
      }
    };

    if (classIds.length && user?.id) {
      fetchExams();
    } else if (!user?.id) {
      // Wait for user to load
      setLoading(true);
    } else {
      setLoading(false);
    }

    return () => {
      isMounted = false;
    };
  }, [classIds, enrolledClasses]);

  // Filter exams by status based on active tab
  const getFilteredExams = useMemo(() => {
    const allExams = [];
    classIds.forEach((classId) => {
      const exams = examMap[classId] || [];
      exams.forEach((exam) => {
        allExams.push({
          ...exam,
          classId,
          className: enrolledClasses.find((c) => c._id === classId)?.name || 'Unknown Class',
        });
      });
    });

    if (activeTab === 'scheduled') {
      return allExams.filter((exam) => {
        const status = exam.status || 'scheduled';
        return status === 'scheduled' || status === 'active';
      });
    } else if (activeTab === 'completed') {
      return allExams.filter((exam) => {
        const status = exam.status || 'scheduled';
        return status === 'completed' || exam.studentAttemptStatus === 'submitted' || exam.studentAttemptStatus === 'auto_submitted';
      });
    }
    return allExams;
  }, [examMap, classIds, processedClasses, classes, activeTab]);

  // Group exams by class for better organization
  const examsByClass = useMemo(() => {
    const grouped = {};
    getFilteredExams.forEach((exam) => {
      if (!grouped[exam.classId]) {
        grouped[exam.classId] = {
          class: enrolledClasses.find((c) => c._id === exam.classId),
          exams: [],
        };
      }
      grouped[exam.classId].exams.push(exam);
    });
    return grouped;
  }, [getFilteredExams, enrolledClasses]);

  const renderExamCard = (exam, className) => {
    const status = exam.status || 'scheduled';
    const badgeClass = statusColors[status] || 'bg-gray-100 text-gray-600';
    const duration = exam.proctoring?.durationMinutes;
    const startTime = exam.proctoring?.startTime ? new Date(exam.proctoring.startTime) : null;
    const endTime = exam.proctoring?.endTime ? new Date(exam.proctoring.endTime) : null;
    const questionsCount = exam.questions?.length || 0;

    return (
      <div
        key={exam._id}
        className="group flex flex-col gap-4 rounded-xl border border-gray-200 bg-white p-6 shadow-sm transition-all duration-200 hover:shadow-lg hover:border-blue-300"
      >
        <div className="flex items-start justify-between gap-3">
          <div className="flex-1 min-w-0">
            <h3 className="text-lg font-semibold text-gray-900 mb-1 line-clamp-2 group-hover:text-blue-600 transition-colors">
              {exam.title}
            </h3>
            <div className="flex items-center gap-2 text-sm text-gray-500">
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" />
              </svg>
              <span className="truncate">{className}</span>
            </div>
          </div>
          <span className={`rounded-full px-3 py-1 text-xs font-semibold whitespace-nowrap ${badgeClass}`}>
            {status.replace('_', ' ').toUpperCase()}
          </span>
        </div>

        {exam.description && (
          <p className="text-sm text-gray-600 line-clamp-2">{exam.description}</p>
        )}

        <div className="grid gap-3 text-sm">
          <div className="flex items-center gap-4 flex-wrap">
            {duration && (
              <div className="flex items-center gap-1.5 text-gray-600">
                <svg className="w-4 h-4 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                <span className="font-medium">{duration} min</span>
              </div>
            )}
            {questionsCount > 0 && (
              <div className="flex items-center gap-1.5 text-gray-600">
                <svg className="w-4 h-4 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
                </svg>
                <span className="font-medium">{questionsCount} questions</span>
              </div>
            )}
          </div>
          {startTime && (
            <div className="flex items-center gap-1.5 text-gray-600">
              <svg className="w-4 h-4 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
              </svg>
              <span className="text-xs">
                {startTime.toLocaleDateString()} {startTime.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                {endTime && ` - ${endTime.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`}
              </span>
            </div>
          )}
        </div>

        <div className="flex flex-wrap items-center justify-between gap-3 pt-3 border-t border-gray-100">
          <div className="flex gap-2 flex-wrap">
            {exam.proctoring?.fullscreenRequired && (
              <span className="inline-flex items-center gap-1 rounded-md bg-blue-50 px-2 py-1 text-xs font-medium text-blue-700">
                <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 8V4m0 0h4M4 4l5 5m11-1V4m0 0h-4m4 0l-5 5M4 16v4m0 0h4m-4 0l5-5m11 5l-5-5m5 5v-4m0 4h-4" />
                </svg>
                Fullscreen
              </span>
            )}
            {exam.proctoring?.copyPasteDisabled && (
              <span className="inline-flex items-center gap-1 rounded-md bg-orange-50 px-2 py-1 text-xs font-medium text-orange-700">
                <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
                </svg>
                Copy/Paste Off
              </span>
            )}
            {exam.proctoring?.tabSwitchLimit && (
              <span className="inline-flex items-center gap-1 rounded-md bg-purple-50 px-2 py-1 text-xs font-medium text-purple-700">
                <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 17V7m0 10a2 2 0 01-2 2H5a2 2 0 01-2-2V7a2 2 0 012-2h2a2 2 0 012 2m0 10a2 2 0 002 2h2a2 2 0 002-2M9 7a2 2 0 012-2h2a2 2 0 012 2m0 10V7m0 10a2 2 0 002 2h2a2 2 0 002-2V7a2 2 0 00-2-2h-2a2 2 0 00-2 2" />
                </svg>
                Tab limit: {exam.proctoring.tabSwitchLimit}
              </span>
            )}
          </div>

          <div className="flex-shrink-0">
            {exam.studentAttemptStatus === 'terminated' ? (
              <div className="flex items-center gap-2 rounded-md bg-red-100 px-4 py-2 text-sm font-semibold text-red-800">
                <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
                Terminated
              </div>
            ) : (exam.studentAttemptStatus === 'submitted' || exam.studentAttemptStatus === 'auto_submitted') ? (
              <button
                onClick={() => navigate(`/student/exams/${exam._id}/results`, { state: { classId: exam.classId } })}
                className="flex items-center gap-2 rounded-md bg-green-600 px-4 py-2 text-sm font-semibold text-white hover:bg-green-700 transition-colors shadow-sm hover:shadow"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                View Results
              </button>
            ) : status === 'active' ? (
              <button
                onClick={() => navigate(`/student/exams/${exam._id}`, { state: { classId: exam.classId } })}
                className="flex items-center gap-2 rounded-md bg-blue-600 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-700 transition-colors shadow-sm hover:shadow"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14.752 11.168l-3.197-2.132A1 1 0 0010 9.87v4.263a1 1 0 001.555.832l3.197-2.132a1 1 0 000-1.664z" />
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                Start Exam
              </button>
            ) : status === 'scheduled' ? (
              <div className="flex items-center gap-2 text-xs text-gray-500">
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                Not started yet
              </div>
            ) : (
              <Link
                to={`/student/exams/${exam._id}`}
                state={{ classId: exam.classId }}
                className="flex items-center gap-2 text-sm font-medium text-blue-600 hover:text-blue-700 hover:underline"
              >
                View Details
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                </svg>
              </Link>
            )}
          </div>
        </div>
      </div>
    );
  };

  // Calculate counts for all exams (not filtered)
  const { scheduledCount, completedCount } = useMemo(() => {
    const allExams = [];
    classIds.forEach((classId) => {
      const exams = examMap[classId] || [];
      exams.forEach((exam) => {
        allExams.push(exam);
      });
    });

    const scheduled = allExams.filter((exam) => {
      const status = exam.status || 'scheduled';
      return status === 'scheduled' || status === 'active';
    }).length;

    const completed = allExams.filter((exam) => {
      const status = exam.status || 'scheduled';
      return status === 'completed' || exam.studentAttemptStatus === 'submitted' || exam.studentAttemptStatus === 'auto_submitted';
    }).length;

    return { scheduledCount: scheduled, completedCount: completed };
  }, [examMap, classIds]);

  return (
    <div className="space-y-6">
      <header className="rounded-xl border border-gray-200 bg-white p-6 shadow-sm">
        <h1 className="text-2xl font-bold text-gray-900">Exams & Assessments</h1>
        <p className="mt-2 text-sm text-gray-600">
          Review upcoming assessments, start active exams, and revisit completed sessions.
        </p>
      </header>

      {loading ? (
        <div className="rounded-xl border border-gray-200 bg-white p-6 text-center">
          <div className="flex items-center justify-center">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
            <span className="ml-3 text-sm text-gray-500">Loading exams...</span>
          </div>
        </div>
      ) : error ? (
        <div className="rounded-xl border border-red-200 bg-red-50 p-6 text-sm text-red-700">
          {error}
        </div>
      ) : classIds.length === 0 ? (
        <div className="rounded-xl border border-gray-200 bg-white p-6 text-center">
          <div className="flex flex-col items-center justify-center py-8">
            <svg className="w-16 h-16 text-gray-400 mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
            </svg>
            <p className="text-sm font-medium text-gray-900 mb-1">No enrolled classes</p>
            <p className="text-sm text-gray-500">You need to be enrolled in a class to view exams.</p>
          </div>
        </div>
      ) : (
        <div className="space-y-6">
          {/* Tabs */}
          <div className="rounded-xl border border-gray-200 bg-white shadow-sm">
            <div className="flex border-b border-gray-200">
              <button
                onClick={() => setActiveTab('scheduled')}
                className={`flex-1 px-6 py-4 text-sm font-semibold transition-all duration-200 ${
                  activeTab === 'scheduled'
                    ? 'text-blue-600 border-b-2 border-blue-600 bg-blue-50'
                    : 'text-gray-600 hover:text-gray-900 hover:bg-gray-50'
                }`}
              >
                <div className="flex items-center justify-center gap-2">
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                  </svg>
                  Scheduled
                  {scheduledCount > 0 && (
                    <span className={`ml-2 px-2 py-0.5 rounded-full text-xs ${
                      activeTab === 'scheduled' ? 'bg-blue-100 text-blue-700' : 'bg-gray-100 text-gray-600'
                    }`}>
                      {scheduledCount}
                    </span>
                  )}
                </div>
              </button>
              <button
                onClick={() => setActiveTab('completed')}
                className={`flex-1 px-6 py-4 text-sm font-semibold transition-all duration-200 ${
                  activeTab === 'completed'
                    ? 'text-blue-600 border-b-2 border-blue-600 bg-blue-50'
                    : 'text-gray-600 hover:text-gray-900 hover:bg-gray-50'
                }`}
              >
                <div className="flex items-center justify-center gap-2">
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                  Completed
                  {completedCount > 0 && (
                    <span className={`ml-2 px-2 py-0.5 rounded-full text-xs ${
                      activeTab === 'completed' ? 'bg-blue-100 text-blue-700' : 'bg-gray-100 text-gray-600'
                    }`}>
                      {completedCount}
                    </span>
                  )}
                </div>
              </button>
            </div>

            {/* Tab Content */}
            <div className="p-6">
              {Object.keys(examsByClass).length > 0 && (
                <div className="mb-4 flex justify-end">
                  <button
                    onClick={() => {
                      const allClassIds = Object.keys(examsByClass);
                      const allExpanded = allClassIds.every((id) => expandedClasses.has(id));
                      if (allExpanded) {
                        setExpandedClasses(new Set());
                      } else {
                        setExpandedClasses(new Set(allClassIds));
                      }
                    }}
                    className="flex items-center gap-2 px-4 py-2 text-sm font-medium text-gray-700 hover:text-gray-900 hover:bg-gray-100 rounded-md transition-colors"
                  >
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 8V4m0 0h4M4 4l5 5m11-1V4m0 0h-4m4 0l-5 5M4 16v4m0 0h4m-4 0l5-5m11 5l-5-5m5 5v-4m0 4h-4" />
                    </svg>
                    {Object.keys(examsByClass).every((id) => expandedClasses.has(id)) ? 'Collapse All' : 'Expand All'}
                  </button>
                </div>
              )}
              {Object.keys(examsByClass).length === 0 ? (
                <div className="text-center py-12">
                  <div className="flex flex-col items-center justify-center">
                    <svg className="w-16 h-16 text-gray-400 mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                    </svg>
                    <p className="text-sm font-medium text-gray-900 mb-1">
                      No {activeTab === 'scheduled' ? 'scheduled' : 'completed'} exams found
                    </p>
                    <p className="text-sm text-gray-500">
                      {activeTab === 'scheduled' 
                        ? 'You don\'t have any upcoming or active exams at the moment.'
                        : 'You haven\'t completed any exams yet.'}
                    </p>
                  </div>
                </div>
              ) : (
                <div className="space-y-3">
                  {Object.entries(examsByClass).map(([classId, { class: cls, exams }]) => {
                    const isExpanded = expandedClasses.has(classId);
                    return (
                      <section key={classId} className="border border-gray-200 rounded-lg bg-white overflow-hidden">
                        <button
                          onClick={() => toggleClass(classId)}
                          className="w-full flex items-center justify-between p-4 hover:bg-gray-50 transition-colors"
                        >
                          <div className="flex items-center gap-3 flex-1">
                            <div className="w-10 h-10 rounded-lg bg-gradient-to-br from-blue-500 to-blue-600 flex items-center justify-center flex-shrink-0">
                              <span className="text-white font-bold text-sm">
                                {cls?.name?.charAt(0).toUpperCase() || 'C'}
                              </span>
                            </div>
                            <div className="flex-1 text-left">
                              <h2 className="text-lg font-semibold text-gray-900">{cls?.name || 'Class'}</h2>
                              <p className="text-xs text-gray-500">{exams.length} {exams.length === 1 ? 'exam' : 'exams'}</p>
                            </div>
                          </div>
                          <div className="flex items-center gap-2">
                            <span className="text-xs text-gray-500 font-medium">
                              {isExpanded ? 'Hide' : 'Show'} exams
                            </span>
                            <svg
                              className={`w-5 h-5 text-gray-400 transition-transform duration-200 ${isExpanded ? 'rotate-180' : ''}`}
                              fill="none"
                              stroke="currentColor"
                              viewBox="0 0 24 24"
                            >
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                            </svg>
                          </div>
                        </button>
                        {isExpanded && (
                          <div className="border-t border-gray-100 p-4 bg-gray-50">
                            <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
                              {exams.map((exam) => renderExamCard(exam, cls?.name))}
                            </div>
                          </div>
                        )}
                      </section>
                    );
                  })}
                </div>
              )}
            </div>
          </div>

        </div>
      )}
    </div>
  );
};

export default StudentExamList;

