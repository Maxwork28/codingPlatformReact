import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useNavigate, useParams, useLocation } from 'react-router-dom';
import { Dialog } from '@headlessui/react';
import { ArrowLeftIcon, PlayIcon, XMarkIcon, ArrowsPointingOutIcon, ArrowsPointingInIcon, ArrowDownTrayIcon } from '@heroicons/react/24/outline';
import { Chart as ChartJS, ArcElement, Tooltip, Legend } from 'chart.js';
import { Doughnut } from 'react-chartjs-2';
import { format } from 'date-fns';
import { io } from 'socket.io-client';
import { API_BASE_URL } from '../../../common/constants';
import { getQuestionPerspectiveReport, blockUser, blockAllUsers, teacherTestQuestion, getClassSheetReport } from '../../../common/services/api';
import { downloadSheetReport, shareSheetReport } from '../../../common/utils/downloadCsv';
import CodeEditor from '../../student/components/CodeEditor';
import TestCaseResultsList from '../../student/components/TestCaseResultsList';

ChartJS.register(ArcElement, Tooltip, Legend);

const CODING_TYPES = ['coding', 'fillInTheBlanksCoding', 'codingWithDriver'];
const LANGUAGES = ['javascript', 'python', 'c', 'cpp', 'java', 'php', 'ruby', 'go'];

const stripHtml = (html) => {
  if (!html) return '';
  const tmp = document.createElement('div');
  tmp.innerHTML = html;
  return (tmp.textContent || tmp.innerText || '').trim();
};

const extractCode = (answer) => {
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

const STATUS = {
  correct: { label: 'Correct', chip: 'bg-emerald-50 text-emerald-800 border-emerald-200', dot: 'bg-emerald-500' },
  incorrect: { label: 'Wrong', chip: 'bg-rose-50 text-rose-800 border-rose-200', dot: 'bg-rose-500' },
  not_attempted: { label: 'Inactive', chip: 'bg-slate-100 text-slate-700 border-slate-200', dot: 'bg-slate-400' },
};

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
  const [search, setSearch] = useState('');
  const [classReport, setClassReport] = useState(null);
  const [shareNote, setShareNote] = useState('');

  const [codeStudent, setCodeStudent] = useState(null);
  const [editorCode, setEditorCode] = useState('');
  const [originalCode, setOriginalCode] = useState('');
  const [editorLanguage, setEditorLanguage] = useState('javascript');
  const [boardMode, setBoardMode] = useState(false);
  const [runLoading, setRunLoading] = useState(false);
  const [runResults, setRunResults] = useState(null);
  const [elapsedSec, setElapsedSec] = useState(0);
  const [timerRunning, setTimerRunning] = useState(true);

  const questionType = report?.question?.type;
  const isCodingQuestion = CODING_TYPES.includes(questionType);

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
    if (!classId) return undefined;
    const socket = io(API_BASE_URL, { transports: ['websocket', 'polling'] });
    socket.emit('joinClass', classId);
    const refresh = ({ classId: updatedClassId } = {}) => {
      if (!updatedClassId || String(updatedClassId) === String(classId)) {
        loadReport({ silent: true });
      }
    };
    socket.on('analyticsUpdated', refresh);
    socket.on('codeRun', () => loadReport({ silent: true }));
    socket.on('submissionUpdate', () => loadReport({ silent: true }));
    socket.on('studentBlockStatusUpdated', () => loadReport({ silent: true }));
    return () => {
      socket.off('analyticsUpdated', refresh);
      socket.off('codeRun');
      socket.off('submissionUpdate');
      socket.off('studentBlockStatusUpdated');
      socket.emit('leaveClass', classId);
      socket.disconnect();
    };
  }, [classId, loadReport]);

  useEffect(() => {
    if (!timerRunning) return undefined;
    const id = setInterval(() => setElapsedSec((s) => s + 1), 1000);
    return () => clearInterval(id);
  }, [timerRunning]);

  const timerLabel = `${String(Math.floor(elapsedSec / 3600)).padStart(2, '0')}:${String(Math.floor((elapsedSec % 3600) / 60)).padStart(2, '0')}:${String(elapsedSec % 60).padStart(2, '0')}`;

  const handleBack = () => {
    if (backState.fromTakeClass) {
      navigate('/teacher/take-class', { state: { classId, questionId } });
    } else {
      navigate(`/teacher/classes/${classId}`);
    }
  };

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
    const attempted = summary.correct + summary.incorrect;
    if (!attempted) return null;
    return {
      labels: ['Correct', 'Wrong'],
      datasets: [
        {
          data: [summary.correct, summary.incorrect],
          backgroundColor: ['#10b981', '#f43f5e'],
          borderWidth: 0,
        },
      ],
    };
  }, [summary]);

  const inactiveStudents = useMemo(
    () => (report?.studentData ?? []).filter((student) => student.status === 'not_attempted'),
    [report?.studentData]
  );
  const unblockedInactive = inactiveStudents.filter((student) => !student.isBlocked);

  const filteredStudents = useMemo(() => {
    let list = report?.studentData ?? [];
    if (statusFilter !== 'all') list = list.filter((s) => s.status === statusFilter);
    const q = search.trim().toLowerCase();
    if (q) {
      list = list.filter(
        (s) =>
          (s.studentName || '').toLowerCase().includes(q) ||
          (s.studentEmail || '').toLowerCase().includes(q)
      );
    }
    return list;
  }, [report?.studentData, statusFilter, search]);

  const openStudentWork = (student) => {
    const code = extractCode(student.lastSubmittedAnswer);
    const language = student.lastSubmittedLanguage || (report?.question?.languages || [])[0] || 'javascript';
    setCodeStudent(student);
    setEditorCode(code);
    setOriginalCode(code);
    setEditorLanguage(language);
    setRunResults(null);
    setBoardMode(false);
    setActionMsg('');
  };

  const closeEditor = () => {
    setCodeStudent(null);
    setBoardMode(false);
    setRunResults(null);
  };

  const handleRunCorrected = async () => {
    if (!questionId || !editorCode.trim()) return;
    setRunLoading(true);
    setRunResults(null);
    try {
      const res = await teacherTestQuestion(questionId, editorCode, classId, editorLanguage);
      setRunResults({
        isCorrect: res.data.isCorrect,
        passedTestCases: res.data.passedTestCases,
        totalTestCases: res.data.totalTestCases,
        testResults: res.data.testResults,
        error: false,
      });
    } catch (err) {
      setRunResults({
        error: true,
        message: err.response?.data?.error || err.message || 'Run failed',
      });
    } finally {
      setRunLoading(false);
    }
  };

  const handleBlockAllInactive = async () => {
    const targets = unblockedInactive.length ? unblockedInactive : inactiveStudents;
    const shouldBlock = unblockedInactive.length > 0;
    const ids = targets.map((student) => String(student.studentId)).filter(Boolean);
    if (!ids.length) return;
    setBlocking(true);
    setActionMsg('');
    setError('');
    try {
      const response = await blockAllUsers(classId, shouldBlock, { studentIds: ids });
      const updated = response?.data?.updated ?? ids.length;
      setActionMsg(
        shouldBlock
          ? `${updated} inactive student(s) blocked`
          : `${updated} inactive student(s) unblocked`
      );
      await loadReport({ silent: true });
    } catch (err) {
      setError(typeof err === 'string' ? err : err?.error || 'Failed to update inactive students');
    } finally {
      setBlocking(false);
    }
  };

  const openClassReport = async () => {
    if (!classId) return;
    setShareNote('');
    setClassReport({ loading: true, error: '', columns: [], rows: [], title: report?.class?.name || 'Class report' });
    try {
      const response = await getClassSheetReport(classId, { scope: 'class' });
      setClassReport({
        loading: false,
        error: '',
        scope: 'class',
        title: `${response.data.className || report?.class?.name || 'Class'} report`,
        className: response.data.className || report?.class?.name || '',
        columns: response.data.columns || [],
        rows: response.data.rows || [],
      });
    } catch (err) {
      setClassReport({
        loading: false,
        error: typeof err === 'string' ? err : err?.error || 'Failed to load class report',
        columns: [],
        rows: [],
        title: 'Class report',
      });
    }
  };

  const handleShareClassReport = async () => {
    if (!classReport || classReport.loading || classReport.error) return;
    setShareNote('');
    try {
      const result = await shareSheetReport(classReport);
      setShareNote(result === 'copied' ? 'Report copied. Paste it to share.' : 'Report shared.');
    } catch (err) {
      if (err?.name === 'AbortError') return;
      setShareNote('Could not share the report.');
    }
  };

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

  const languages = (report?.question?.languages || []).length
    ? report.question.languages
    : LANGUAGES;

  return (
    <div className="min-h-screen" style={{ backgroundColor: 'var(--background-content)' }}>
      <div className="border-b px-4 py-3 sm:px-6" style={{ backgroundColor: 'var(--card-white)', borderColor: 'var(--card-border)' }}>
        <div className="max-w-7xl mx-auto flex flex-wrap items-center gap-3">
          <button
            type="button"
            onClick={handleBack}
            className="inline-flex items-center gap-2 px-3 py-2 rounded-lg border text-sm font-medium hover:bg-gray-50"
            style={{ borderColor: 'var(--card-border)', color: 'var(--text-primary)' }}
          >
            <ArrowLeftIcon className="w-4 h-4" />
            {backState.fromTakeClass ? 'Back to Take Class' : 'Back to class'}
          </button>
          <div className="flex-1 min-w-0">
            <h1 className="text-lg font-bold truncate" style={{ color: 'var(--text-heading)' }}>
              {stripHtml(report?.question?.title) || 'Question statistics'}
            </h1>
            <p className="text-sm truncate" style={{ color: 'var(--text-secondary)' }}>
              {report?.class?.name}
            </p>
          </div>
          <div
            className="flex items-center gap-2 rounded-lg border px-3 py-1.5"
            style={{ borderColor: 'var(--card-border)', backgroundColor: 'var(--background-light)' }}
          >
            <span className="font-mono text-base font-semibold tabular-nums" style={{ color: 'var(--text-heading)' }}>
              {timerLabel}
            </span>
            <button
              type="button"
              onClick={() => setTimerRunning((v) => !v)}
              className="text-xs font-semibold text-indigo-600 hover:text-indigo-800"
            >
              {timerRunning ? 'Pause' : 'Start'}
            </button>
            <button
              type="button"
              onClick={() => {
                setTimerRunning(false);
                setElapsedSec(0);
              }}
              className="text-xs font-semibold text-slate-600 hover:text-slate-800"
            >
              Reset
            </button>
          </div>
          <button
            type="button"
            disabled={!report}
            onClick={openClassReport}
            className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg border text-sm font-medium hover:bg-gray-50 disabled:opacity-50"
            style={{ borderColor: 'var(--card-border)', color: 'var(--text-primary)' }}
          >
            <ArrowDownTrayIcon className="w-4 h-4" />
            Report
          </button>
        </div>
      </div>

      <div className="max-w-7xl mx-auto p-4 sm:p-6 space-y-5">
        {(actionMsg || error) && (
          <div
            className={`rounded-lg border px-4 py-2 text-sm ${
              error ? 'bg-red-50 border-red-200 text-red-800' : 'bg-emerald-50 border-emerald-200 text-emerald-800'
            }`}
          >
            {error || actionMsg}
          </div>
        )}

        {summary && (
          <div
            className="rounded-xl border p-4 grid grid-cols-1 sm:grid-cols-4 gap-4 items-center"
            style={{ backgroundColor: 'var(--card-white)', borderColor: 'var(--card-border)' }}
          >
            <div className="w-36 mx-auto sm:mx-0">
              {chartData ? (
                <Doughnut
                  data={chartData}
                  plugins={[doughnutPercentPlugin]}
                  options={{
                    plugins: { legend: { display: false }, tooltip: { enabled: true } },
                    cutout: '58%',
                  }}
                />
              ) : (
                <div className="aspect-square rounded-full border-[14px] border-slate-200 flex items-center justify-center text-center text-xs font-medium text-slate-500">
                  No attempts
                </div>
              )}
            </div>
            {[
              { label: 'Correct', value: summary.correct, color: 'text-emerald-700' },
              { label: 'Wrong', value: summary.incorrect, color: 'text-rose-700' },
              { label: 'Inactive', value: summary.notAttempted, color: 'text-slate-600' },
            ].map((item) => (
              <div key={item.label} className="text-center sm:text-left">
                <p className="text-xs uppercase tracking-wide" style={{ color: 'var(--text-secondary)' }}>
                  {item.label}
                </p>
                <p className={`text-2xl font-bold ${item.color}`}>{item.value}</p>
                <p className="text-xs" style={{ color: 'var(--text-secondary)' }}>
                  of {summary.enrolled} enrolled
                </p>
              </div>
            ))}
          </div>
        )}

        <div
          className="rounded-xl border overflow-hidden"
          style={{ backgroundColor: 'var(--card-white)', borderColor: 'var(--card-border)' }}
        >
          <div className="px-4 py-3 border-b flex flex-wrap items-center gap-2" style={{ borderColor: 'var(--card-border)' }}>
            <p className="text-sm font-semibold mr-2" style={{ color: 'var(--text-heading)' }}>
              Students
            </p>
            {[
              { value: 'all', label: 'All', count: summary?.enrolled },
              { value: 'correct', label: 'Correct', count: summary?.correct },
              { value: 'incorrect', label: 'Wrong', count: summary?.incorrect },
              { value: 'not_attempted', label: 'Inactive', count: summary?.notAttempted },
            ].map((opt) => (
              <button
                key={opt.value}
                type="button"
                onClick={() => setStatusFilter(opt.value)}
                className={`px-2.5 py-1 rounded-full text-xs font-medium border ${
                  statusFilter === opt.value
                    ? 'bg-slate-800 text-white border-slate-800'
                    : 'bg-white text-slate-700 border-slate-200 hover:bg-slate-50'
                }`}
              >
                {opt.label} {opt.count != null ? `(${opt.count})` : ''}
              </button>
            ))}
            <button
              type="button"
              disabled={blocking || inactiveStudents.length === 0}
              onClick={handleBlockAllInactive}
              className="px-2.5 py-1 rounded-full text-xs font-semibold border border-slate-800 bg-slate-800 text-white hover:bg-slate-700 disabled:opacity-40 disabled:cursor-not-allowed"
            >
              {inactiveStudents.length === 0
                ? 'Block all inactive'
                : unblockedInactive.length > 0
                  ? `Block all inactive (${unblockedInactive.length})`
                  : 'Unblock all inactive'}
            </button>
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search name or email"
              className="ml-auto w-full sm:w-56 px-3 py-1.5 rounded-lg border text-sm"
              style={{ borderColor: 'var(--card-border)', backgroundColor: 'var(--background-light)' }}
            />
          </div>

          <div className="overflow-x-auto">
            <table className="min-w-full text-sm">
              <thead>
                <tr className="text-left text-xs uppercase tracking-wide" style={{ color: 'var(--text-secondary)', backgroundColor: 'var(--background-light)' }}>
                  <th className="px-4 py-2 font-medium">Student</th>
                  <th className="px-4 py-2 font-medium">Status</th>
                  <th className="px-4 py-2 font-medium hidden md:table-cell">Language</th>
                  <th className="px-4 py-2 font-medium text-right">Action</th>
                </tr>
              </thead>
              <tbody>
                {filteredStudents.map((student) => {
                  const style = STATUS[student.status] || STATUS.not_attempted;
                  const hasWork = Boolean(extractCode(student.lastSubmittedAnswer));
                  return (
                    <tr key={student.studentId} className="border-t" style={{ borderColor: 'var(--card-border)' }}>
                      <td className="px-4 py-2.5">
                        <p className="font-medium truncate" style={{ color: 'var(--text-heading)' }}>
                          {student.studentName}
                          {student.isBlocked ? <span className="ml-2 text-xs text-slate-500">Blocked</span> : null}
                        </p>
                        <p className="text-xs truncate" style={{ color: 'var(--text-secondary)' }}>
                          {student.studentEmail || 'No email'}
                        </p>
                      </td>
                      <td className="px-4 py-2.5">
                        <span className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full border text-xs font-medium ${style.chip}`}>
                          <span className={`h-1.5 w-1.5 rounded-full ${style.dot}`} />
                          {style.label}
                        </span>
                      </td>
                      <td className="px-4 py-2.5 hidden md:table-cell" style={{ color: 'var(--text-secondary)' }}>
                        {student.lastSubmittedLanguage || '—'}
                      </td>
                      <td className="px-4 py-2.5">
                        <div className="flex justify-end gap-2">
                          <button
                            type="button"
                            disabled={!hasWork}
                            onClick={() => openStudentWork(student)}
                            className="px-2.5 py-1 rounded-md text-xs font-semibold text-white bg-indigo-600 hover:bg-indigo-700 disabled:opacity-40 disabled:cursor-not-allowed"
                          >
                            {isCodingQuestion ? 'Open in editor' : 'View answer'}
                          </button>
                          <button
                            type="button"
                            disabled={blocking}
                            onClick={() => handleBlockStudent(student, !student.isBlocked)}
                            className="px-2.5 py-1 rounded-md text-xs font-medium border hover:bg-slate-50 disabled:opacity-50"
                            style={{ borderColor: 'var(--card-border)', color: 'var(--text-primary)' }}
                          >
                            {student.isBlocked ? 'Unblock' : 'Block'}
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
            {filteredStudents.length === 0 && (
              <p className="px-4 py-8 text-sm text-center" style={{ color: 'var(--text-secondary)' }}>
                {report?.studentData?.length === 0 ? 'No students enrolled in this class.' : 'No students match this filter.'}
              </p>
            )}
          </div>
        </div>
      </div>

      <Dialog open={Boolean(classReport)} onClose={() => setClassReport(null)} className="relative z-50">
        <div className="fixed inset-0 bg-black/40" aria-hidden="true" />
        <div className="fixed inset-0 flex items-center justify-center p-4">
          <Dialog.Panel className="mx-auto flex max-h-[85vh] w-full max-w-6xl flex-col rounded-2xl bg-white shadow-xl">
            <div className="flex flex-wrap items-center justify-between gap-3 border-b border-gray-200 p-5">
              <Dialog.Title className="text-lg font-semibold text-gray-900">
                {classReport?.title || 'Class report'}
              </Dialog.Title>
              <div className="flex items-center gap-2">
                {classReport && !classReport.loading && !classReport.error && (
                  <>
                    <button
                      type="button"
                      onClick={handleShareClassReport}
                      className="px-3 py-1.5 rounded-lg text-xs font-semibold border border-indigo-200 text-indigo-700 hover:bg-indigo-50"
                    >
                      Share
                    </button>
                    <button
                      type="button"
                      onClick={() => downloadSheetReport(classReport)}
                      className="px-3 py-1.5 rounded-lg text-xs font-semibold text-white bg-indigo-600 hover:bg-indigo-700"
                    >
                      Download
                    </button>
                  </>
                )}
                <button
                  type="button"
                  onClick={() => setClassReport(null)}
                  className="text-gray-500 hover:text-gray-700 p-1 rounded"
                  aria-label="Close"
                >
                  <XMarkIcon className="w-6 h-6" />
                </button>
              </div>
            </div>
            <div className="overflow-auto p-5">
              {shareNote && <p className="mb-3 text-sm text-indigo-700">{shareNote}</p>}
              {classReport?.loading && <p className="text-sm text-gray-600">Loading report…</p>}
              {classReport?.error && <p className="text-sm text-red-600">{classReport.error}</p>}
              {classReport && !classReport.loading && !classReport.error && (
                <div className="overflow-x-auto">
                  <table className="min-w-full divide-y divide-gray-200 text-sm">
                    <thead className="bg-gray-50">
                      <tr>
                        {(classReport.columns || []).map((column) => (
                          <th key={column} className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider whitespace-nowrap">
                            {column}
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-200">
                      {(classReport.rows || []).length === 0 ? (
                        <tr>
                          <td colSpan={classReport.columns?.length || 1} className="px-3 py-4 text-sm text-gray-500">
                            No students in this class.
                          </td>
                        </tr>
                      ) : classReport.rows.map((row, rowIndex) => (
                        <tr key={rowIndex}>
                          {row.map((cell, cellIndex) => (
                            <td key={cellIndex} className="px-3 py-2 whitespace-nowrap text-gray-700">
                              {cell == null || cell === '' ? '—' : String(cell)}
                            </td>
                          ))}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </Dialog.Panel>
        </div>
      </Dialog>

      {codeStudent && (
        <div className="fixed inset-0 z-50 flex flex-col" style={{ backgroundColor: boardMode ? '#0f172a' : 'var(--background-content)' }}>
          <div
            className="flex-shrink-0 border-b px-4 py-3 flex flex-wrap items-center gap-2"
            style={{
              backgroundColor: boardMode ? '#1e293b' : 'var(--card-white)',
              borderColor: boardMode ? '#334155' : 'var(--card-border)',
            }}
          >
            <button
              type="button"
              onClick={closeEditor}
              className={`inline-flex items-center gap-1 px-3 py-1.5 rounded-lg text-sm font-medium ${
                boardMode ? 'text-white hover:bg-white/10' : 'border hover:bg-gray-50'
              }`}
              style={!boardMode ? { borderColor: 'var(--card-border)' } : undefined}
            >
              <XMarkIcon className="w-4 h-4" />
              Close
            </button>
            <div className="min-w-0 flex-1">
              <p className={`text-sm font-semibold truncate ${boardMode ? 'text-white' : ''}`} style={!boardMode ? { color: 'var(--text-heading)' } : undefined}>
                {codeStudent.studentName}
                {codeStudent.lastSubmittedIsCorrect === true
                  ? ' · Correct'
                  : codeStudent.lastSubmittedIsCorrect === false
                    ? ' · Wrong'
                    : ''}
              </p>
              <p className={`text-xs truncate ${boardMode ? 'text-slate-300' : ''}`} style={!boardMode ? { color: 'var(--text-secondary)' } : undefined}>
                Students watch the board and type the fix in their own editor.
                {codeStudent.lastSubmittedAt
                  ? ` · ${format(new Date(codeStudent.lastSubmittedAt), 'MMM d, h:mm a')}`
                  : ''}
              </p>
            </div>
            {isCodingQuestion && (
              <select
                value={editorLanguage}
                onChange={(e) => setEditorLanguage(e.target.value)}
                className={`rounded-lg border text-sm px-2 py-1.5 ${boardMode ? 'bg-slate-800 text-white border-slate-600' : ''}`}
              >
                {languages.map((lang) => (
                  <option key={lang} value={lang}>
                    {lang}
                  </option>
                ))}
              </select>
            )}
            <button
              type="button"
              onClick={() => {
                setEditorCode(originalCode);
                setRunResults(null);
              }}
              className={`px-3 py-1.5 rounded-lg text-sm font-medium ${
                boardMode ? 'text-slate-200 hover:bg-white/10' : 'border hover:bg-gray-50'
              }`}
              style={!boardMode ? { borderColor: 'var(--card-border)' } : undefined}
            >
              Reset
            </button>
            {isCodingQuestion && (
              <button
                type="button"
                onClick={handleRunCorrected}
                disabled={runLoading || !editorCode.trim()}
                className="inline-flex items-center gap-2 px-4 py-1.5 rounded-lg text-sm font-semibold text-white bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50"
              >
                <PlayIcon className="w-4 h-4" />
                {runLoading ? 'Submitting…' : 'Submit corrected code'}
              </button>
            )}
            <button
              type="button"
              onClick={() => setBoardMode((v) => !v)}
              className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium ${
                boardMode ? 'bg-white/10 text-white' : 'border hover:bg-gray-50'
              }`}
              style={!boardMode ? { borderColor: 'var(--card-border)' } : undefined}
            >
              {boardMode ? <ArrowsPointingInIcon className="w-4 h-4" /> : <ArrowsPointingOutIcon className="w-4 h-4" />}
              {boardMode ? 'Exit board' : 'Board / projector'}
            </button>
          </div>

          <div className="flex-1 min-h-0 flex flex-col lg:flex-row">
            <div className="flex-1 min-h-0 min-w-0 p-3 lg:p-4">
              {isCodingQuestion ? (
                <div className="h-full min-h-[320px] rounded-xl overflow-hidden border" style={{ borderColor: boardMode ? '#334155' : 'var(--card-border)' }}>
                  <CodeEditor
                    value={editorCode}
                    onChange={setEditorCode}
                    language={editorLanguage}
                    height={boardMode ? 'calc(100vh - 9rem)' : 'calc(100vh - 14rem)'}
                    copyPasteDisabled={false}
                    fontSize={boardMode ? 20 : 15}
                  />
                </div>
              ) : (
                <div
                  className={`h-full rounded-xl border p-6 overflow-auto ${boardMode ? 'text-2xl leading-relaxed text-white' : 'text-lg'}`}
                  style={{
                    backgroundColor: boardMode ? '#1e293b' : 'var(--card-white)',
                    borderColor: boardMode ? '#334155' : 'var(--card-border)',
                    color: boardMode ? '#fff' : 'var(--text-primary)',
                  }}
                >
                  <p className="text-sm font-semibold mb-3 opacity-70">Student answer — edit on the board if needed</p>
                  <textarea
                    value={editorCode}
                    onChange={(e) => setEditorCode(e.target.value)}
                    className={`w-full min-h-[50vh] rounded-lg p-4 font-mono ${boardMode ? 'bg-slate-900 text-white text-2xl' : 'border text-base'}`}
                  />
                </div>
              )}
            </div>
            {isCodingQuestion && (
              <div
                className={`lg:w-[360px] flex-shrink-0 border-t lg:border-t-0 lg:border-l overflow-y-auto p-4 ${
                  boardMode ? 'bg-slate-900 text-slate-100' : ''
                }`}
                style={!boardMode ? { backgroundColor: 'var(--card-white)', borderColor: 'var(--card-border)' } : { borderColor: '#334155' }}
              >
                <p className={`text-sm font-semibold mb-3 ${boardMode ? 'text-white' : ''}`} style={!boardMode ? { color: 'var(--text-heading)' } : undefined}>
                  Test result
                </p>
                {!runResults && (
                  <p className={`text-sm ${boardMode ? 'text-slate-400' : ''}`} style={!boardMode ? { color: 'var(--text-secondary)' } : undefined}>
                    Correct the code in the editor, then run it. Students copy the working version into their own editor.
                  </p>
                )}
                {runResults?.error && <p className="text-sm text-red-400">{runResults.message}</p>}
                {runResults && !runResults.error && (
                  <div>
                    <p className={`font-semibold mb-3 ${runResults.isCorrect ? 'text-emerald-400' : 'text-amber-400'}`}>
                      {runResults.isCorrect
                        ? `All ${runResults.totalTestCases} tests passed`
                        : `${runResults.passedTestCases}/${runResults.totalTestCases} passed`}
                    </p>
                    <TestCaseResultsList results={runResults.testResults} showHiddenDetails />
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};

export default QuestionStatistics;
