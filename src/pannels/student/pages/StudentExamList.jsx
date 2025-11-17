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

const StudentExamList = () => {
  const navigate = useNavigate();
  const { classes } = useSelector((state) => state.classes);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [examMap, setExamMap] = useState({});

  const classIds = useMemo(() => classes.map((cls) => cls._id), [classes]);

  useEffect(() => {
    let isMounted = true;
    const fetchExams = async () => {
      setLoading(true);
      setError(null);
      try {
        const results = await Promise.allSettled(
          classIds.map((classId) => getClassExams(classId))
        );

        if (!isMounted) return;
        const nextMap = {};
        results.forEach((result, idx) => {
          const classId = classIds[idx];
          if (result.status === 'fulfilled') {
            nextMap[classId] = result.value.data.exams || [];
          } else {
            nextMap[classId] = [];
            console.error('[StudentExamList] Failed to load exams', {
              classId,
              error: result.reason?.message,
            });
          }
        });
        setExamMap(nextMap);
      } catch (err) {
        if (!isMounted) return;
        console.error('[StudentExamList] fetchExams error', err);
        setError('Failed to load exams');
      } finally {
        if (isMounted) setLoading(false);
      }
    };

    if (classIds.length) {
      fetchExams();
    } else {
      setLoading(false);
    }

    return () => {
      isMounted = false;
    };
  }, [classIds]);

  const renderExamCard = (exam, className) => {
    const status = exam.status || 'scheduled';
    const badgeClass = statusColors[status] || 'bg-gray-100 text-gray-600';
    const duration = exam.proctoring?.durationMinutes;
    const startTime = exam.proctoring?.startTime ? new Date(exam.proctoring.startTime) : null;
    const endTime = exam.proctoring?.endTime ? new Date(exam.proctoring.endTime) : null;

    return (
      <div
        key={exam._id}
        className="flex flex-col gap-3 rounded-xl border border-gray-200 bg-white p-5 shadow-sm transition hover:shadow-md"
      >
        <div className="flex items-start justify-between gap-3">
          <div>
            <h3 className="text-lg font-semibold text-gray-900">{exam.title}</h3>
            <p className="text-sm text-gray-500">{className}</p>
          </div>
          <span className={`rounded-full px-3 py-1 text-xs font-semibold ${badgeClass}`}>
            {status.replace('_', ' ').toUpperCase()}
          </span>
        </div>

        {exam.description && (
          <p className="text-sm text-gray-600">{exam.description}</p>
        )}

        <div className="grid gap-2 text-sm text-gray-600 md:grid-cols-3">
          <div>
            <span className="font-semibold text-gray-700">Duration:</span>{' '}
            {duration ? `${duration} minutes` : 'Flexible'}
          </div>
          {startTime && (
            <div>
              <span className="font-semibold text-gray-700">Starts:</span>{' '}
              {startTime.toLocaleString()}
            </div>
          )}
          {endTime && (
            <div>
              <span className="font-semibold text-gray-700">Ends:</span>{' '}
              {endTime.toLocaleString()}
            </div>
          )}
        </div>

        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex gap-2 text-xs text-gray-500">
            {exam.proctoring?.fullscreenRequired && <span className="rounded bg-gray-100 px-2 py-1">Fullscreen</span>}
            {exam.proctoring?.copyPasteDisabled && <span className="rounded bg-gray-100 px-2 py-1">Copy/Paste Off</span>}
            {exam.proctoring?.tabSwitchLimit && <span className="rounded bg-gray-100 px-2 py-1">Tab limit {exam.proctoring.tabSwitchLimit}</span>}
          </div>

          {exam.studentAttemptStatus === 'terminated' ? (
            <div className="flex items-center gap-2 rounded-md bg-red-100 px-4 py-2 text-sm font-semibold text-red-800">
              <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
              Terminated
            </div>
          ) : status === 'active' ? (
            <button
              onClick={() => navigate(`/student/exams/${exam._id}`, { state: { classId: exam.classId } })}
              className="rounded-md bg-blue-600 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-700"
            >
              Start Exam
            </button>
          ) : status === 'scheduled' ? (
            <div className="text-xs text-gray-500">Exam not yet started</div>
          ) : (
            <Link
              to={`/student/exams/${exam._id}`}
              state={{ classId: exam.classId }}
              className="text-sm font-medium text-blue-600 hover:underline"
            >
              View Details
            </Link>
          )}
        </div>
      </div>
    );
  };

  return (
    <div className="space-y-6">
      <header className="rounded-xl border border-gray-200 bg-white p-6 shadow-sm">
        <h1 className="text-2xl font-bold text-gray-900">Exams & Assessments</h1>
        <p className="mt-2 text-sm text-gray-600">
          Review upcoming assessments, start active exams, and revisit completed sessions.
        </p>
      </header>

      {loading ? (
        <div className="rounded-xl border border-gray-200 bg-white p-6 text-center text-sm text-gray-500">
          Loading exams...
        </div>
      ) : error ? (
        <div className="rounded-xl border border-red-200 bg-red-50 p-6 text-sm text-red-700">
          {error}
        </div>
      ) : classIds.length === 0 ? (
        <div className="rounded-xl border border-gray-200 bg-white p-6 text-center text-sm text-gray-500">
          Join a class to view assigned exams.
        </div>
      ) : (
        <div className="space-y-6">
          {classIds.map((classId) => {
            const cls = classes.find((c) => c._id === classId);
            const exams = examMap[classId] || [];
            return (
              <section key={classId} className="space-y-4">
                <div className="flex items-center justify-between">
                  <h2 className="text-lg font-semibold text-gray-900">{cls?.name || 'Class'}</h2>
                  <span className="text-sm text-gray-500">{exams.length} exam(s)</span>
                </div>
                {exams.length ? (
                  <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
                    {exams.map((exam) => renderExamCard(exam, cls?.name))}
                  </div>
                ) : (
                  <div className="rounded-lg border border-dashed border-gray-300 bg-gray-50 p-6 text-sm text-gray-500">
                    No exams scheduled yet.
                  </div>
                )}
              </section>
            );
          })}
        </div>
      )}
    </div>
  );
};

export default StudentExamList;
