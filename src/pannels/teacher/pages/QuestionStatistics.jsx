import React, { useCallback, useEffect, useMemo, useState, Fragment } from 'react';
import { useNavigate, useParams, useLocation } from 'react-router-dom';
import { ArrowLeftIcon } from '@heroicons/react/24/outline';
import { Menu, Transition } from '@headlessui/react';
import { Chart as ChartJS, ArcElement, Tooltip, Legend, CategoryScale, LinearScale, BarElement } from 'chart.js';
import { Doughnut, Bar } from 'react-chartjs-2';
import { format } from 'date-fns';
import { getQuestionPerspectiveReport, blockUser, blockAllUsers } from '../../../common/services/api';

ChartJS.register(ArcElement, Tooltip, Legend, CategoryScale, LinearScale, BarElement);

const stripHtml = (html) => {
  if (!html) return '';
  const tmp = document.createElement('div');
  tmp.innerHTML = html;
  return (tmp.textContent || tmp.innerText || '').trim();
};

const STATUS_STYLES = {
  correct: {
    bg: 'bg-emerald-500',
    border: 'border-emerald-600',
    ring: 'ring-emerald-300',
    label: 'Correct',
    text: 'text-emerald-900',
    light: 'bg-emerald-50',
    color: '#10b981',
  },
  incorrect: {
    bg: 'bg-rose-500',
    border: 'border-rose-600',
    ring: 'ring-rose-300',
    label: 'Incorrect',
    text: 'text-rose-900',
    light: 'bg-rose-50',
    color: '#f43f5e',
  },
  not_attempted: {
    bg: 'bg-slate-400',
    border: 'border-slate-500',
    ring: 'ring-slate-300',
    label: 'Not attempted',
    text: 'text-slate-700',
    light: 'bg-slate-100',
    color: '#94a3b8',
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
  const [actionMsg, setActionMsg] = useState('');
  const [selectedStudentId, setSelectedStudentId] = useState(backState.selectedStudentId || null);
  const [statusFilter, setStatusFilter] = useState('all');
  const [blocking, setBlocking] = useState(false);

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

  const filteredStudents = useMemo(() => {
    const list = report?.studentData ?? [];
    if (statusFilter === 'all') return list;
    return list.filter((s) => s.status === statusFilter);
  }, [report?.studentData, statusFilter]);

  const selectedStudent = useMemo(
    () =>
      (report?.studentData ?? []).find(
        (s) => String(s.studentId) === String(selectedStudentId)
      ),
    [report?.studentData, selectedStudentId]
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

  const chartData = useMemo(() => {
    if (!summary) return null;
    return {
      labels: ['Correct', 'Incorrect', 'Not attempted'],
      datasets: [
        {
          data: [summary.correct, summary.incorrect, summary.notAttempted],
          backgroundColor: ['#10b981', '#f43f5e', '#94a3b8'],
          borderWidth: 0,
        },
      ],
    };
  }, [summary]);

  const barData = useMemo(() => {
    if (!summary) return null;
    return {
      labels: ['Correct', 'Incorrect', 'Not attempted'],
      datasets: [
        {
          label: 'Students',
          data: [summary.correct, summary.incorrect, summary.notAttempted],
          backgroundColor: ['#10b981', '#f43f5e', '#94a3b8'],
          borderRadius: 6,
        },
      ],
    };
  }, [summary]);

  const handleBlockStudent = async (student, shouldBlock) => {
    if (!student?.studentId) return;
    setBlocking(true);
    setActionMsg('');
    try {
      await blockUser(classId, student.studentId, shouldBlock);
      setActionMsg(`${student.studentName} ${shouldBlock ? 'blocked' : 'unblocked'}`);
      await loadReport({ silent: true });
    } catch (err) {
      setError(typeof err === 'string' ? err : err?.error || 'Failed to update block status');
    } finally {
      setBlocking(false);
    }
  };

  const handleBlockNotAttempted = async () => {
    const ids = (report?.studentData ?? [])
      .filter((s) => s.status === 'not_attempted')
      .map((s) => s.studentId);
    if (ids.length === 0) {
      setActionMsg('No not-attempted students to block');
      return;
    }
    if (!confirm(`Block ${ids.length} not-attempted student(s)?`)) return;
    setBlocking(true);
    setActionMsg('');
    try {
      const response = await blockAllUsers(classId, true, { studentIds: ids });
      setActionMsg(response?.data?.message || `${ids.length} student(s) blocked`);
      setStatusFilter('not_attempted');
      await loadReport({ silent: true });
    } catch (err) {
      setError(typeof err === 'string' ? err : err?.error || 'Failed to block not-attempted students');
    } finally {
      setBlocking(false);
    }
  };

  if (loading) {
    return (
      <div className="flex justify-center items-center min-h-[50vh]" style={{ backgroundColor: 'var(--background-content)' }}>
        <div className="w-10 h-10 border-4 border-t-transparent rounded-full animate-spin border-indigo-600" />
      </div>
    );
  }

  if (error && !report) {
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
        {(actionMsg || error) && (
          <div
            className={`rounded-lg border px-4 py-2 text-sm ${
              error ? 'bg-red-50 border-red-200 text-red-800' : 'bg-emerald-50 border-emerald-200 text-emerald-800'
            }`}
          >
            {error || actionMsg}
          </div>
        )}

        {summary && chartData && barData && (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div
              className="rounded-xl border p-4 flex flex-col items-center justify-center"
              style={{ backgroundColor: 'var(--card-white)', borderColor: 'var(--card-border)' }}
            >
              <h2 className="text-sm font-semibold mb-3 self-start" style={{ color: 'var(--text-heading)' }}>
                Status distribution
              </h2>
              <div className="w-full max-w-[240px]">
                <Doughnut
                  data={chartData}
                  options={{
                    plugins: {
                      legend: { position: 'bottom' },
                    },
                    cutout: '58%',
                    onClick: (_evt, elements) => {
                      if (!elements?.length) return;
                      const idx = elements[0].index;
                      const map = ['correct', 'incorrect', 'not_attempted'];
                      setStatusFilter(map[idx] || 'all');
                    },
                  }}
                />
              </div>
              <p className="text-xs mt-2" style={{ color: 'var(--text-secondary)' }}>
                Enrolled: {summary.enrolled} · click a segment to filter
              </p>
            </div>
            <div
              className="rounded-xl border p-4"
              style={{ backgroundColor: 'var(--card-white)', borderColor: 'var(--card-border)' }}
            >
              <h2 className="text-sm font-semibold mb-3" style={{ color: 'var(--text-heading)' }}>
                Students by status
              </h2>
              <div className="h-56">
                <Bar
                  data={barData}
                  options={{
                    responsive: true,
                    maintainAspectRatio: false,
                    plugins: { legend: { display: false } },
                    scales: {
                      y: { beginAtZero: true, ticks: { precision: 0 } },
                    },
                    onClick: (_evt, elements) => {
                      if (!elements?.length) return;
                      const idx = elements[0].index;
                      const map = ['correct', 'incorrect', 'not_attempted'];
                      setStatusFilter(map[idx] || 'all');
                    },
                  }}
                />
              </div>
            </div>
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
                {opt.label}
                {count != null && (
                  <span className={`text-xs ${isActive ? 'text-white/90' : 'opacity-70'}`}>({count})</span>
                )}
              </button>
            );
          })}
          {(statusFilter === 'not_attempted' || statusFilter === 'all') && (
            <button
              type="button"
              disabled={blocking || (summary?.notAttempted ?? 0) === 0}
              onClick={handleBlockNotAttempted}
              className="ml-auto inline-flex items-center px-3 py-1.5 rounded-lg text-sm font-semibold text-white bg-red-600 hover:bg-red-700 disabled:opacity-50"
            >
              Block all not attempted
            </button>
          )}
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
                const isBlocked = Boolean(student.isBlocked);
                return (
                  <div
                    key={student.studentId}
                    className={`relative min-h-[88px] rounded-lg border-2 transition-all hover:scale-[1.02] ${style.bg} ${style.border} ${
                      isSelected ? `ring-2 ring-offset-2 ${style.ring}` : ''
                    } ${isBlocked ? 'opacity-75' : ''}`}
                  >
                    <button
                      type="button"
                      onClick={() => setSelectedStudentId(student.studentId)}
                      className="w-full h-full p-3 pr-8 text-left focus:outline-none"
                    >
                      <p className="text-sm font-semibold text-white line-clamp-2 drop-shadow-sm">
                        {student.studentName}
                      </p>
                      <p className="text-xs text-white/90 mt-1 truncate">
                        {isBlocked ? 'Blocked · ' : ''}
                        {style.label}
                      </p>
                      {student.totalSubmits > 0 && (
                        <p className="text-xs text-white/80 mt-0.5">
                          {student.correctAttempts}/{student.totalSubmits} correct submits
                        </p>
                      )}
                    </button>
                    <Menu as="div" className="absolute top-1 right-1">
                      <Menu.Button
                        className="p-1 rounded text-white/90 hover:bg-black/20 focus:outline-none"
                        onClick={(e) => e.stopPropagation()}
                      >
                        <svg className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
                          <path d="M10 6a2 2 0 110-4 2 2 0 010 4zM10 12a2 2 0 110-4 2 2 0 010 4zM10 18a2 2 0 110-4 2 2 0 010 4z" />
                        </svg>
                      </Menu.Button>
                      <Transition
                        as={Fragment}
                        enter="transition ease-out duration-100"
                        enterFrom="transform opacity-0 scale-95"
                        enterTo="transform opacity-100 scale-100"
                        leave="transition ease-in duration-75"
                        leaveFrom="transform opacity-100 scale-100"
                        leaveTo="transform opacity-0 scale-95"
                      >
                        <Menu.Items className="absolute right-0 mt-1 w-36 origin-top-right rounded-md bg-white shadow-lg ring-1 ring-black ring-opacity-5 focus:outline-none z-20">
                          <div className="py-1">
                            <Menu.Item>
                              {({ active }) => (
                                <button
                                  type="button"
                                  disabled={blocking}
                                  onClick={() => handleBlockStudent(student, !isBlocked)}
                                  className={`${
                                    active ? 'bg-gray-100 text-gray-900' : 'text-gray-700'
                                  } block w-full px-4 py-2 text-sm text-left disabled:opacity-50`}
                                >
                                  {isBlocked ? 'Unblock' : 'Block'}
                                </button>
                              )}
                            </Menu.Item>
                          </div>
                        </Menu.Items>
                      </Transition>
                    </Menu>
                  </div>
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
                Click a student name card to see their attempt history.
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

                {(!selectedStudent.attempts || selectedStudent.attempts.length === 0) ? (
                  <p className="text-sm text-gray-500">No attempts recorded.</p>
                ) : (
                  <ul className="space-y-2">
                    {selectedStudent.attempts.map((attempt, idx) => (
                      <li
                        key={attempt.submissionId || idx}
                        className={`w-full rounded-lg border p-3 text-sm ${
                          attempt.isRun
                            ? 'bg-blue-50 border-blue-200'
                            : attempt.isCorrect
                              ? 'bg-emerald-50 border-emerald-200'
                              : 'bg-rose-50 border-rose-200'
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
                                  ? 'bg-emerald-200 text-emerald-900'
                                  : 'bg-rose-200 text-rose-900'
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
