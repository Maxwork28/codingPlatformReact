import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useNavigate, useParams, useLocation } from 'react-router-dom';
import { ArrowLeftIcon } from '@heroicons/react/24/outline';
import { format } from 'date-fns';
import { getQuestionPerspectiveReport } from '../../../common/services/api';

const stripHtml = (html) => {
  if (!html) return '';
  const tmp = document.createElement('div');
  tmp.innerHTML = html;
  return (tmp.textContent || tmp.innerText || '').trim();
};

const STATUS_STYLES = {
  correct: {
    bg: 'bg-green-500',
    border: 'border-green-600',
    ring: 'ring-green-300',
    label: 'Correct',
    text: 'text-green-900',
    light: 'bg-green-50',
  },
  incorrect: {
    bg: 'bg-red-500',
    border: 'border-red-600',
    ring: 'ring-red-300',
    label: 'Incorrect',
    text: 'text-red-900',
    light: 'bg-red-50',
  },
  not_attempted: {
    bg: 'bg-gray-400',
    border: 'border-gray-500',
    ring: 'ring-gray-300',
    label: 'Not attempted',
    text: 'text-gray-700',
    light: 'bg-gray-100',
  },
};

const FILTER_OPTIONS = [
  { value: 'all', label: 'All' },
  { value: 'correct', label: 'Correct' },
  { value: 'incorrect', label: 'Incorrect' },
  { value: 'not_attempted', label: 'Not attempted' },
];

const QuestionStatistics = () => {
  const navigate = useNavigate();
  const { classId, questionId } = useParams();
  const location = useLocation();
  const backState = location.state || {};

  const [report, setReport] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [selectedStudentId, setSelectedStudentId] = useState(backState.selectedStudentId || null);
  const [statusFilter, setStatusFilter] = useState('all');

  const loadReport = useCallback(async ({ silent = false } = {}) => {
    if (!classId || !questionId) return;
    if (!silent) setLoading(true);
    setError('');
    try {
      const response = await getQuestionPerspectiveReport(classId, questionId);
      setReport(response.data.report);
    } catch (err) {
      setError(typeof err === 'string' ? err : err?.error || 'Failed to load statistics');
    } finally {
      if (!silent) setLoading(false);
    }
  }, [classId, questionId]);

  useEffect(() => {
    loadReport();
  }, [loadReport]);

  useEffect(() => {
    if (backState.selectedStudentId) {
      setSelectedStudentId(backState.selectedStudentId);
    }
  }, [backState.selectedStudentId]);

  const handleBack = () => {
    if (backState.fromTakeClass) {
      navigate('/teacher/take-class', {
        state: { classId, questionId },
      });
    } else {
      navigate(`/teacher/classes/${classId}`);
    }
  };

  const handleOpenAttempt = (student, attempt) => {
    navigate(
      `/teacher/take-class/${classId}/questions/${questionId}/statistics/attempts/${attempt.submissionId}`,
      {
        state: {
          fromTakeClass: backState.fromTakeClass,
          selectedStudentId: student.studentId,
          studentName: student.studentName,
          studentEmail: student.studentEmail,
          questionType: report?.question?.type,
          questionTitle: stripHtml(report?.question?.title),
          attempt: {
            isRun: attempt.isRun,
            isCorrect: attempt.isCorrect,
            isCustomInput: attempt.isCustomInput,
            submittedAt: attempt.submittedAt,
            score: attempt.score,
            passedTestCases: attempt.passedTestCases,
            totalTestCases: attempt.totalTestCases,
            status: attempt.status,
          },
        },
      }
    );
  };

  const filteredStudents = useMemo(() => {
    const list = report?.studentData ?? [];
    if (statusFilter === 'all') return list;
    return list.filter((s) => s.status === statusFilter);
  }, [report?.studentData, statusFilter]);

  const selectedStudent = filteredStudents.find(
    (s) => String(s.studentId) === String(selectedStudentId)
  );

  useEffect(() => {
    if (!selectedStudentId) return;
    const stillVisible = filteredStudents.some(
      (s) => String(s.studentId) === String(selectedStudentId)
    );
    if (!stillVisible) setSelectedStudentId(null);
  }, [statusFilter, filteredStudents, selectedStudentId]);

  const summary = report
    ? {
        correct: report.totalStudentsCorrect ?? 0,
        incorrect: report.totalStudentsIncorrect ?? 0,
        notAttempted: report.totalStudentsNotAttempted ?? 0,
        enrolled: report.totalStudentsEnrolled ?? report.studentData?.length ?? 0,
      }
    : null;

  if (loading) {
    return (
      <div className="flex justify-center items-center min-h-[50vh]" style={{ backgroundColor: 'var(--background-content)' }}>
        <div className="w-10 h-10 border-4 border-t-transparent rounded-full animate-spin border-indigo-600" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="max-w-4xl mx-auto p-6">
        <p className="text-red-600 mb-4">{error}</p>
        <button type="button" onClick={handleBack} className="text-indigo-600 font-medium hover:underline">
          Go back
        </button>
      </div>
    );
  }

  return (
    <div className="min-h-screen" style={{ backgroundColor: 'var(--background-content)' }}>
      <div className="border-b px-4 py-4 sm:px-6" style={{ backgroundColor: 'var(--card-white)', borderColor: 'var(--card-border)' }}>
        <div className="max-w-6xl mx-auto flex flex-wrap items-center gap-3">
          <button
            type="button"
            onClick={handleBack}
            className="inline-flex items-center gap-2 px-3 py-2 rounded-lg border text-sm font-medium hover:opacity-90"
            style={{ borderColor: 'var(--card-border)', color: 'var(--text-primary)' }}
          >
            <ArrowLeftIcon className="w-4 h-4" />
            Back to Take Class
          </button>
          <div className="flex-1 min-w-0">
            <h1 className="text-lg sm:text-xl font-bold truncate" style={{ color: 'var(--text-heading)' }}>
              Question statistics
            </h1>
            <p className="text-sm truncate" style={{ color: 'var(--text-secondary)' }}>
              {report?.class?.name} · {stripHtml(report?.question?.title) || 'Question'}
            </p>
          </div>
        </div>
      </div>

      <div className="max-w-6xl mx-auto p-4 sm:p-6 space-y-6">
        {summary && (
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <button
              type="button"
              onClick={() => setStatusFilter(statusFilter === 'correct' ? 'all' : 'correct')}
              className={`rounded-xl border p-4 text-left transition-all hover:shadow-md ${
                statusFilter === 'correct' ? 'ring-2 ring-green-500 ring-offset-2' : ''
              } bg-green-50 border-green-200`}
            >
              <p className="text-xs font-semibold uppercase text-green-800">Correct</p>
              <p className="text-2xl font-bold text-green-900">{summary.correct}</p>
            </button>
            <button
              type="button"
              onClick={() => setStatusFilter(statusFilter === 'incorrect' ? 'all' : 'incorrect')}
              className={`rounded-xl border p-4 text-left transition-all hover:shadow-md ${
                statusFilter === 'incorrect' ? 'ring-2 ring-red-500 ring-offset-2' : ''
              } bg-red-50 border-red-200`}
            >
              <p className="text-xs font-semibold uppercase text-red-800">Incorrect</p>
              <p className="text-2xl font-bold text-red-900">{summary.incorrect}</p>
            </button>
            <button
              type="button"
              onClick={() => setStatusFilter(statusFilter === 'not_attempted' ? 'all' : 'not_attempted')}
              className={`rounded-xl border p-4 text-left transition-all hover:shadow-md ${
                statusFilter === 'not_attempted' ? 'ring-2 ring-gray-500 ring-offset-2' : ''
              } bg-gray-100 border-gray-300`}
            >
              <p className="text-xs font-semibold uppercase text-gray-700">Not attempted</p>
              <p className="text-2xl font-bold text-gray-900">{summary.notAttempted}</p>
            </button>
            <button
              type="button"
              onClick={() => setStatusFilter('all')}
              className={`rounded-xl border p-4 text-left transition-all hover:shadow-md ${
                statusFilter === 'all' ? 'ring-2 ring-indigo-500 ring-offset-2' : ''
              }`}
              style={{ backgroundColor: 'var(--card-white)', borderColor: 'var(--card-border)' }}
            >
              <p className="text-xs font-semibold uppercase" style={{ color: 'var(--text-secondary)' }}>Enrolled</p>
              <p className="text-2xl font-bold" style={{ color: 'var(--text-heading)' }}>{summary.enrolled}</p>
            </button>
          </div>
        )}

        <div className="flex flex-wrap items-center gap-2">
          <span className="text-sm font-medium mr-1" style={{ color: 'var(--text-secondary)' }}>
            Filter:
          </span>
          {FILTER_OPTIONS.map((opt) => {
            const isActive = statusFilter === opt.value;
            const style = opt.value !== 'all' ? STATUS_STYLES[opt.value] : null;
            const count =
              opt.value === 'all'
                ? summary?.enrolled
                : opt.value === 'correct'
                  ? summary?.correct
                  : opt.value === 'incorrect'
                    ? summary?.incorrect
                    : summary?.notAttempted;
            return (
              <button
                key={opt.value}
                type="button"
                onClick={() => setStatusFilter(opt.value)}
                className={`inline-flex items-center gap-2 px-3 py-1.5 rounded-full text-sm font-medium border transition-all ${
                  isActive
                    ? style
                      ? `${style.bg} text-white border-transparent shadow-sm`
                      : 'bg-indigo-600 text-white border-indigo-600 shadow-sm'
                    : 'bg-white border-gray-300 hover:bg-gray-50'
                }`}
                style={!isActive && !style ? { color: 'var(--text-primary)' } : undefined}
              >
                {style && (
                  <span
                    className={`w-2.5 h-2.5 rounded-full shrink-0 ${
                      isActive ? 'bg-white/90' : `${style.bg} border ${style.border}`
                    }`}
                  />
                )}
                {opt.label}
                {count != null && (
                  <span className={`text-xs ${isActive ? 'text-white/90' : 'opacity-70'}`}>({count})</span>
                )}
              </button>
            );
          })}
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="lg:col-span-2">
            <h2 className="text-sm font-semibold mb-3" style={{ color: 'var(--text-heading)' }}>
              Students ({filteredStudents.length}
              {statusFilter !== 'all' ? ` of ${report?.studentData?.length ?? 0}` : ''})
            </h2>
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
              {filteredStudents.map((student) => {
                const style = STATUS_STYLES[student.status] || STATUS_STYLES.not_attempted;
                const isSelected = String(student.studentId) === String(selectedStudentId);
                return (
                  <button
                    key={student.studentId}
                    type="button"
                    onClick={() => setSelectedStudentId(student.studentId)}
                    className={`min-h-[88px] rounded-lg border-2 p-3 text-left transition-all hover:scale-[1.02] focus:outline-none focus:ring-2 ${style.bg} ${style.border} ${
                      isSelected ? `ring-2 ring-offset-2 ${style.ring}` : ''
                    }`}
                  >
                    <p className="text-sm font-semibold text-white line-clamp-2 drop-shadow-sm">
                      {student.studentName}
                    </p>
                    <p className="text-xs text-white/90 mt-1 truncate">{style.label}</p>
                    {student.totalSubmits > 0 && (
                      <p className="text-xs text-white/80 mt-0.5">
                        {student.correctAttempts}/{student.totalSubmits} correct submits
                      </p>
                    )}
                  </button>
                );
              })}
            </div>
            {filteredStudents.length === 0 && (
              <p className="text-sm" style={{ color: 'var(--text-secondary)' }}>
                {report?.studentData?.length === 0
                  ? 'No students enrolled in this class.'
                  : 'No students match this filter.'}
              </p>
            )}
          </div>

          <div
            className="rounded-xl border p-4 lg:sticky lg:top-4 max-h-[calc(100vh-8rem)] overflow-y-auto"
            style={{ backgroundColor: 'var(--card-white)', borderColor: 'var(--card-border)' }}
          >
            <h2 className="text-sm font-semibold mb-3" style={{ color: 'var(--text-heading)' }}>
              Attempt history
            </h2>
            {!selectedStudent && (
              <p className="text-sm" style={{ color: 'var(--text-secondary)' }}>
                Click a student to view attempts. Click an attempt to open it in a new page.
              </p>
            )}
            {selectedStudent && (
              <div className="space-y-3">
                <div className={`rounded-lg p-3 ${STATUS_STYLES[selectedStudent.status]?.light || 'bg-gray-50'}`}>
                  <p className="font-semibold" style={{ color: 'var(--text-heading)' }}>
                    {selectedStudent.studentName}
                  </p>
                  <p className="text-xs mt-1" style={{ color: 'var(--text-secondary)' }}>
                    {selectedStudent.studentEmail}
                  </p>
                  <p className={`text-sm font-medium mt-2 ${STATUS_STYLES[selectedStudent.status]?.text}`}>
                    {STATUS_STYLES[selectedStudent.status]?.label}
                  </p>
                </div>

                {selectedStudent.attempts?.length === 0 ? (
                  <p className="text-sm text-gray-500">No attempts recorded.</p>
                ) : (
                  <ul className="space-y-2">
                    {selectedStudent.attempts.map((attempt, idx) => (
                      <li key={attempt.submissionId || idx}>
                        <button
                          type="button"
                          onClick={() => handleOpenAttempt(selectedStudent, attempt)}
                          className={`w-full rounded-lg border p-3 text-sm text-left transition-all hover:shadow-md hover:ring-2 hover:ring-indigo-300 ${
                            attempt.isRun
                              ? 'bg-blue-50 border-blue-200'
                              : attempt.isCorrect
                                ? 'bg-green-50 border-green-200'
                                : 'bg-red-50 border-red-200'
                          }`}
                        >
                          <div className="flex flex-wrap items-center justify-between gap-2 mb-1">
                            <span className="font-semibold">
                              {attempt.isRun ? 'Run' : 'Submit'}
                              {attempt.isCustomInput ? ' (custom)' : ''}
                            </span>
                            <span
                              className={`text-xs font-bold px-2 py-0.5 rounded ${
                                attempt.isRun
                                  ? 'bg-blue-200 text-blue-900'
                                  : attempt.isCorrect
                                    ? 'bg-green-200 text-green-900'
                                    : 'bg-red-200 text-red-900'
                              }`}
                            >
                              {attempt.isRun ? 'Test run' : attempt.isCorrect ? 'Correct' : 'Incorrect'}
                            </span>
                          </div>
                          <p className="text-xs text-gray-600">
                            {attempt.submittedAt
                              ? format(new Date(attempt.submittedAt), 'MMM d, yyyy h:mm a')
                              : '—'}
                          </p>
                          {!attempt.isRun && (
                            <p className="text-xs text-gray-600 mt-1">
                              Score: {attempt.score}
                              {attempt.totalTestCases > 0 &&
                                ` · Tests: ${attempt.passedTestCases}/${attempt.totalTestCases}`}
                            </p>
                          )}
                          <p className="text-xs text-indigo-600 mt-2 font-medium">Open attempt →</p>
                        </button>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default QuestionStatistics;
