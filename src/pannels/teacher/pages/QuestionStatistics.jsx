import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useNavigate, useParams, useLocation } from 'react-router-dom';
import { ArrowLeftIcon, MagnifyingGlassIcon, XMarkIcon } from '@heroicons/react/24/outline';
import { Chart as ChartJS, ArcElement, Tooltip, Legend } from 'chart.js';
import { Doughnut } from 'react-chartjs-2';
import { format } from 'date-fns';
import { getQuestionPerspectiveReport, blockUser, blockAllUsers } from '../../../common/services/api';

ChartJS.register(ArcElement, Tooltip, Legend);

const stripHtml = (html) => {
  if (!html) return '';
  const tmp = document.createElement('div');
  tmp.innerHTML = html;
  return (tmp.textContent || tmp.innerText || '').trim();
};

const formatAnswer = (answer) => {
  if (answer == null || answer === '') return '';
  if (typeof answer === 'string') return answer;
  if (Array.isArray(answer)) return answer.join('\n');
  try {
    return JSON.stringify(answer, null, 2);
  } catch {
    return String(answer);
  }
};

const doughnutPercentPlugin = {
  id: 'doughnutPercentLabels',
  afterDatasetsDraw(chart) {
    const { ctx } = chart;
    const meta = chart.getDatasetMeta(0);
    const values = chart.data.datasets[0]?.data || [];
    const total = values.reduce((sum, n) => sum + Number(n || 0), 0);
    if (!total) return;
    meta.data.forEach((arc, i) => {
      const value = Number(values[i] || 0);
      if (!value) return;
      const pct = Math.round((value / total) * 100);
      const pos = arc.tooltipPosition();
      ctx.save();
      ctx.fillStyle = '#ffffff';
      ctx.font = 'bold 13px ui-sans-serif, system-ui, sans-serif';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(`${pct}%`, pos.x, pos.y);
      ctx.restore();
    });
  },
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
    label: 'Wrong',
    text: 'text-rose-900',
    light: 'bg-rose-50',
    color: '#f43f5e',
  },
  not_attempted: {
    bg: 'bg-slate-400',
    border: 'border-slate-500',
    ring: 'ring-slate-300',
    label: 'Inactive',
    text: 'text-slate-700',
    light: 'bg-slate-100',
    color: '#94a3b8',
  },
};

const FILTER_OPTIONS = [
  { value: 'all', label: 'All' },
  { value: 'correct', label: 'Correct' },
  { value: 'incorrect', label: 'Wrong' },
  { value: 'not_attempted', label: 'Inactive' },
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
  const [statusFilter, setStatusFilter] = useState('all');
  const [blocking, setBlocking] = useState(false);
  const [blockedSearch, setBlockedSearch] = useState('');
  const [codeStudent, setCodeStudent] = useState(null);

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

  const blockedOrInactive = useMemo(() => {
    const list = (report?.studentData ?? []).filter(
      (s) => s.isBlocked || s.status === 'not_attempted'
    );
    const q = blockedSearch.trim().toLowerCase();
    if (!q) return list;
    return list.filter(
      (s) =>
        (s.studentName || '').toLowerCase().includes(q) ||
        (s.studentEmail || '').toLowerCase().includes(q)
    );
  }, [report?.studentData, blockedSearch]);

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
    const total = summary.enrolled || 1;
    const pct = (n) => Math.round((n / total) * 100);
    return {
      labels: [
        `Correct ${pct(summary.correct)}%`,
        `Wrong ${pct(summary.incorrect)}%`,
        `Inactive ${pct(summary.notAttempted)}%`,
      ],
      datasets: [
        {
          data: [summary.correct, summary.incorrect, summary.notAttempted],
          backgroundColor: ['#10b981', '#f43f5e', '#94a3b8'],
          borderWidth: 0,
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
      setActionMsg('No inactive students to block');
      return;
    }
    if (!confirm(`Block ${ids.length} inactive student(s)?`)) return;
    setBlocking(true);
    setActionMsg('');
    try {
      const response = await blockAllUsers(classId, true, { studentIds: ids });
      setActionMsg(response?.data?.message || `${ids.length} student(s) blocked`);
      setStatusFilter('not_attempted');
      await loadReport({ silent: true });
    } catch (err) {
      setError(typeof err === 'string' ? err : err?.error || 'Failed to block inactive students');
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

  const lastCodeText = codeStudent ? formatAnswer(codeStudent.lastSubmittedAnswer) : '';

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

        {summary && chartData && (
          <div
            className="rounded-xl border p-4 flex flex-col items-center justify-center max-w-xl mx-auto w-full"
            style={{ backgroundColor: 'var(--card-white)', borderColor: 'var(--card-border)' }}
          >
            <h2 className="text-sm font-semibold mb-3 self-start" style={{ color: 'var(--text-heading)' }}>
              Status distribution
            </h2>
            <div className="w-full max-w-[280px]">
              <Doughnut
                data={chartData}
                plugins={[doughnutPercentPlugin]}
                options={{
                  plugins: {
                    legend: {
                      position: 'bottom',
                      labels: { boxWidth: 12, padding: 16, font: { size: 13, weight: '600' } },
                    },
                    tooltip: {
                      callbacks: {
                        label(ctx) {
                          const value = Number(ctx.raw || 0);
                          const total = summary.enrolled || 1;
                          return ` ${value} students (${Math.round((value / total) * 100)}%)`;
                        },
                      },
                    },
                  },
                  cutout: '52%',
                }}
              />
            </div>
            <p className="text-xs mt-3" style={{ color: 'var(--text-secondary)' }}>
              Enrolled: {summary.enrolled} · Correct {summary.correct} · Wrong {summary.incorrect} · Inactive {summary.notAttempted}
            </p>
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
              Block all inactive
            </button>
          )}
        </div>

        <div>
          <h2 className="text-sm font-semibold mb-3" style={{ color: 'var(--text-heading)' }}>
            Students ({filteredStudents.length}
            {statusFilter !== 'all' ? ` of ${report?.studentData?.length ?? 0}` : ''})
          </h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3">
            {filteredStudents.map((student) => {
              const style = STATUS_STYLES[student.status] || STATUS_STYLES.not_attempted;
              const isBlocked = Boolean(student.isBlocked);
              const hasCode = Boolean(formatAnswer(student.lastSubmittedAnswer));
              return (
                <div
                  key={student.studentId}
                  className={`rounded-lg border-2 p-3 ${style.bg} ${style.border} ${isBlocked ? 'opacity-80' : ''}`}
                >
                  <p className="text-sm font-semibold text-white drop-shadow-sm truncate">{student.studentName}</p>
                  <p className="text-xs text-white/90 mt-0.5 truncate">{student.studentEmail || 'No email'}</p>
                  <p className="text-xs text-white/85 mt-1">
                    {isBlocked ? 'Blocked · ' : ''}
                    {style.label}
                  </p>
                  <div className="mt-3 flex flex-wrap gap-2">
                    <button
                      type="button"
                      disabled={blocking}
                      onClick={() => handleBlockStudent(student, !isBlocked)}
                      className="px-2.5 py-1 rounded-md text-xs font-semibold bg-black/25 text-white hover:bg-black/40 disabled:opacity-50"
                    >
                      {isBlocked ? 'Unblock' : 'Block'}
                    </button>
                    <button
                      type="button"
                      disabled={!hasCode}
                      onClick={() => setCodeStudent(student)}
                      className="px-2.5 py-1 rounded-md text-xs font-semibold bg-white/90 text-slate-800 hover:bg-white disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      Last submitted code
                    </button>
                  </div>
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
          className="rounded-xl border p-4"
          style={{ backgroundColor: 'var(--card-white)', borderColor: 'var(--card-border)' }}
        >
          <h2 className="text-sm font-semibold mb-3" style={{ color: 'var(--text-heading)' }}>
            Blocked / Inactive students
          </h2>
          <div className="relative mb-4 max-w-md">
            <MagnifyingGlassIcon className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4" style={{ color: 'var(--text-secondary)' }} />
            <input
              type="text"
              value={blockedSearch}
              onChange={(e) => setBlockedSearch(e.target.value)}
              placeholder="Search by student name or email..."
              className="w-full pl-9 pr-3 py-2 rounded-lg border text-sm"
              style={{
                borderColor: 'var(--card-border)',
                backgroundColor: 'var(--background-light)',
                color: 'var(--text-primary)',
              }}
            />
          </div>
          <div className="space-y-2">
            {blockedOrInactive.map((student) => {
              const isBlocked = Boolean(student.isBlocked);
              return (
                <div
                  key={`blocked-${student.studentId}`}
                  className="flex flex-wrap items-center justify-between gap-2 rounded-lg border px-3 py-2"
                  style={{ borderColor: 'var(--card-border)' }}
                >
                  <div className="min-w-0">
                    <p className="text-sm font-medium truncate" style={{ color: 'var(--text-heading)' }}>
                      {student.studentName}
                    </p>
                    <p className="text-xs truncate" style={{ color: 'var(--text-secondary)' }}>
                      {student.studentEmail || 'No email'}
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${isBlocked ? 'bg-gray-800 text-white' : 'bg-slate-200 text-slate-700'}`}>
                      {isBlocked ? 'Blocked' : 'Inactive'}
                    </span>
                    {isBlocked && (
                      <button
                        type="button"
                        disabled={blocking}
                        onClick={() => handleBlockStudent(student, false)}
                        className="px-2.5 py-1 rounded-md text-xs font-semibold text-white bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50"
                      >
                        Unblock
                      </button>
                    )}
                  </div>
                </div>
              );
            })}
            {blockedOrInactive.length === 0 && (
              <p className="text-sm" style={{ color: 'var(--text-secondary)' }}>
                {blockedSearch
                  ? `No blocked or inactive students matching “${blockedSearch}”.`
                  : 'No blocked or inactive students.'}
              </p>
            )}
          </div>
        </div>
      </div>

      {codeStudent && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div
            className="w-full max-w-3xl max-h-[90vh] overflow-hidden rounded-xl shadow-xl flex flex-col"
            style={{ backgroundColor: 'var(--card-white)' }}
          >
            <div className="flex items-start justify-between gap-3 px-4 py-3 border-b" style={{ borderColor: 'var(--card-border)' }}>
              <div className="min-w-0">
                <h3 className="text-base font-semibold" style={{ color: 'var(--text-heading)' }}>
                  Last submitted code
                </h3>
                <p className="text-sm truncate" style={{ color: 'var(--text-secondary)' }}>
                  {codeStudent.studentName} · {codeStudent.studentEmail}
                  {codeStudent.lastSubmittedLanguage ? ` · ${codeStudent.lastSubmittedLanguage}` : ''}
                </p>
                {codeStudent.lastSubmittedAt && (
                  <p className="text-xs mt-0.5" style={{ color: 'var(--text-secondary)' }}>
                    {format(new Date(codeStudent.lastSubmittedAt), 'MMM d, yyyy h:mm a')}
                    {codeStudent.lastSubmittedIsCorrect != null
                      ? codeStudent.lastSubmittedIsCorrect
                        ? ' · Correct'
                        : ' · Wrong'
                      : ''}
                  </p>
                )}
              </div>
              <button
                type="button"
                onClick={() => setCodeStudent(null)}
                className="p-1 rounded hover:bg-black/5"
                aria-label="Close"
              >
                <XMarkIcon className="h-5 w-5" style={{ color: 'var(--text-secondary)' }} />
              </button>
            </div>
            <pre
              className="flex-1 overflow-auto p-4 text-sm font-mono whitespace-pre-wrap break-words"
              style={{ color: 'var(--text-primary)', backgroundColor: 'var(--background-light)' }}
            >
              {lastCodeText || 'No submitted code for this student.'}
            </pre>
          </div>
        </div>
      )}
    </div>
  );
};

export default QuestionStatistics;
