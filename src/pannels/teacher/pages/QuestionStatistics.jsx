import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useLocation, useNavigate, useParams } from 'react-router-dom';
import { Chart as ChartJS, ArcElement, Tooltip, Legend } from 'chart.js';
import { Doughnut } from 'react-chartjs-2';
import { format } from 'date-fns';
import {
  ArrowLeft,
  Download,
  Maximize2,
  Minimize2,
  Play,
  RotateCcw,
  X,
} from 'lucide-react';
import { getSocket, joinClassRoom, leaveClassRoom } from '../../../common/services/socket';
import {
  blockAllUsers,
  blockUser,
  getClassSheetReport,
  getQuestionPerspectiveReport,
  teacherTestQuestion,
} from '../../../common/services/api';
import { downloadSheetReport, shareSheetReport } from '../../../common/utils/downloadCsv';
import CodeEditor from '../../student/components/CodeEditor';
import TestCaseResultsList from '../../student/components/TestCaseResultsList';
import { Button, EmptyState, StatusChip, Table } from '../../../common/ui/primitives';
import Modal from '../../../common/ui/Modal';
import { confirmAction, notify } from '../../../common/ui/Toast';
import { inputClass, table as tableClass, type } from '../../../common/ui/format';
import { extractAnswerText, stripHtml, tokenColor } from './takeClass/helpers';
import { CODING_TYPES } from '../../../common/domain/questions';

ChartJS.register(ArcElement, Tooltip, Legend);

const LANGUAGES = ['javascript', 'python', 'c', 'cpp', 'java', 'php', 'ruby', 'go'];

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
      const pos = arc.tooltipPosition();
      ctx.save();
      ctx.fillStyle = '#ffffff';
      ctx.font = 'bold 12px ui-sans-serif, system-ui, sans-serif';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(`${Math.round((value / total) * 100)}%`, pos.x, pos.y);
      ctx.restore();
    });
  },
};

const STATUS = {
  correct: { label: 'Correct', kind: 'ok' },
  incorrect: { label: 'Wrong', kind: 'bad' },
  not_attempted: { label: 'Inactive', kind: 'neutral' },
};

function latestSubmit(student) {
  return (student.attempts || []).find((attempt) => !attempt.isRun) || student.attempts?.[0] || null;
}

const QuestionStatistics = () => {
  const navigate = useNavigate();
  const { classId, questionId } = useParams();
  const location = useLocation();
  const backState = location.state || {};

  const [report, setReport] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
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

  const loadReport = useCallback(
    async ({ silent = false } = {}) => {
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
    },
    [classId, questionId]
  );

  useEffect(() => {
    loadReport();
  }, [loadReport]);

  useEffect(() => {
    if (!classId) return undefined;
    const socket = getSocket();
    joinClassRoom(classId);
    const refresh = ({ classId: updatedClassId } = {}) => {
      if (!updatedClassId || String(updatedClassId) === String(classId)) {
        loadReport({ silent: true });
      }
    };
    const silentReload = () => loadReport({ silent: true });
    socket.on('analyticsUpdated', refresh);
    socket.on('codeRun', silentReload);
    socket.on('submissionUpdate', silentReload);
    socket.on('studentBlockStatusUpdated', silentReload);
    return () => {
      socket.off('analyticsUpdated', refresh);
      socket.off('codeRun', silentReload);
      socket.off('submissionUpdate', silentReload);
      socket.off('studentBlockStatusUpdated', silentReload);
      leaveClassRoom(classId);
    };
  }, [classId, loadReport]);

  useEffect(() => {
    if (!timerRunning) return undefined;
    const id = setInterval(() => setElapsedSec((s) => s + 1), 1000);
    return () => clearInterval(id);
  }, [timerRunning]);

  const timerLabel = `${String(Math.floor(elapsedSec / 3600)).padStart(2, '0')}:${String(
    Math.floor((elapsedSec % 3600) / 60)
  ).padStart(2, '0')}:${String(elapsedSec % 60).padStart(2, '0')}`;

  const handleBack = () => {
    if (backState.fromTakeClass) {
      navigate('/teacher/take-class', { state: { classId, questionId } });
    } else {
      navigate(`/teacher/classes/${classId}`);
    }
  };

  const summary = useMemo(
    () =>
      report
        ? {
            correct: report.totalStudentsCorrect ?? 0,
            incorrect: report.totalStudentsIncorrect ?? 0,
            notAttempted: report.totalStudentsNotAttempted ?? 0,
            enrolled: report.totalStudentsEnrolled ?? report.studentData?.length ?? 0,
          }
        : null,
    [report]
  );

  const chartData = useMemo(() => {
    if (!summary) return null;
    const attempted = summary.correct + summary.incorrect;
    if (!attempted) return null;
    return {
      labels: ['Correct', 'Wrong'],
      datasets: [
        {
          data: [summary.correct, summary.incorrect],
          backgroundColor: [tokenColor('--ok', '#059669'), tokenColor('--bad', '#e11d48')],
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
    const code = extractAnswerText(student.lastSubmittedAnswer);
    const language = student.lastSubmittedLanguage || (report?.question?.languages || [])[0] || 'javascript';
    setCodeStudent(student);
    setEditorCode(code);
    setOriginalCode(code);
    setEditorLanguage(language);
    setRunResults(null);
    setBoardMode(false);
  };

  const openAttemptReview = (student) => {
    const attempt = latestSubmit(student);
    if (!attempt?.submissionId) {
      notify('No saved attempt to review');
      return;
    }
    navigate(`/teacher/take-class/${classId}/questions/${questionId}/statistics/attempts/${attempt.submissionId}`, {
      state: {
        fromTakeClass: backState.fromTakeClass,
        selectedStudentId: student.studentId,
        studentName: student.studentName,
        studentEmail: student.studentEmail,
        questionTitle: stripHtml(report?.question?.title),
        questionType,
        attempt,
      },
    });
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
      const message = typeof err === 'string' ? err : err?.response?.data?.error || err?.message || 'Run failed';
      setRunResults({ error: true, message });
      notify(message, 'error');
    } finally {
      setRunLoading(false);
    }
  };

  const handleBlockAllInactive = async () => {
    const targets = unblockedInactive.length ? unblockedInactive : inactiveStudents;
    const shouldBlock = unblockedInactive.length > 0;
    const ids = targets.map((student) => String(student.studentId)).filter(Boolean);
    if (!ids.length) return;
    const ok = await confirmAction(
      shouldBlock
        ? `Block ${ids.length} inactive student(s) in this class?`
        : `Unblock ${ids.length} inactive student(s)?`
    );
    if (!ok) return;
    setBlocking(true);
    try {
      const response = await blockAllUsers(classId, shouldBlock, { studentIds: ids });
      notify(
        shouldBlock
          ? `${response?.data?.updated ?? ids.length} inactive student(s) blocked`
          : `${response?.data?.updated ?? ids.length} inactive student(s) unblocked`
      );
      await loadReport({ silent: true });
    } catch (err) {
      notify(typeof err === 'string' ? err : 'Failed to update inactive students');
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
        error: typeof err === 'string' ? err : 'Failed to load class report',
        columns: [],
        rows: [],
        title: 'Class report',
      });
    }
  };

  const handleShareClassReport = async () => {
    if (!classReport || classReport.loading || classReport.error) return;
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
    const ok = await confirmAction(
      shouldBlock ? `Block ${student.studentName} from this class?` : `Unblock ${student.studentName}?`
    );
    if (!ok) return;
    setBlocking(true);
    try {
      await blockUser(classId, student.studentId, shouldBlock);
      notify(`${student.studentName} ${shouldBlock ? 'blocked' : 'unblocked'}`);
      await loadReport({ silent: true });
    } catch (err) {
      notify(typeof err === 'string' ? err : 'Failed to update block status');
    } finally {
      setBlocking(false);
    }
  };

  const languages = (report?.question?.languages || []).length ? report.question.languages : LANGUAGES;

  if (loading) {
    return (
      <div className="flex justify-center items-center min-h-[50vh] bg-page">
        <div className="w-8 h-8 border-2 border-accent border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  if (error && !report) {
    return (
      <div className="h-full flex flex-col px-4 sm:px-5 py-5">
        <EmptyState
          title="Couldn't load statistics"
          message={error}
          action={<Button variant="secondary" onClick={handleBack}>Go back</Button>}
        />
      </div>
    );
  }

  return (
    <div className="flex flex-col h-[calc(100vh-4rem)] max-h-[calc(100vh-4rem)] bg-page">
      <header className="shrink-0 h-14 px-4 sm:px-5 border-b border-line bg-surface flex items-center gap-2">
        <Button variant="ghost" icon={ArrowLeft} className="h-9 w-9 justify-center p-0!" onClick={handleBack} aria-label="Back" />
        <h1 className={`${type.pageTitle} text-xl! truncate min-w-0`}>
          {stripHtml(report?.question?.title) || 'Question statistics'}
        </h1>
        {report?.class?.name && <StatusChip kind="neutral">{report.class.name}</StatusChip>}
        <div className="ml-auto flex items-center gap-2">
          <div className="hidden sm:flex items-center gap-2 rounded-xl border border-line bg-inset px-3 h-9">
            <span className="font-mono text-sm font-semibold tabular-nums text-fg">{timerLabel}</span>
            <button type="button" onClick={() => setTimerRunning((v) => !v)} className="text-[11px] font-semibold text-accent-ink">
              {timerRunning ? 'Pause' : 'Start'}
            </button>
            <button
              type="button"
              onClick={() => {
                setTimerRunning(false);
                setElapsedSec(0);
              }}
              className="text-[11px] font-semibold text-muted hover:text-fg"
            >
              Reset
            </button>
          </div>
          <Button variant="secondary" icon={Download} className="h-9" disabled={!report} onClick={openClassReport}>
            Report
          </Button>
        </div>
      </header>

      <section className="flex-1 min-h-0 flex flex-col gap-3 px-4 sm:px-5 py-4">
        {summary && (
          <div className="shrink-0 rounded-2xl border border-line bg-surface shadow-card px-4 py-3 flex flex-wrap items-center gap-5">
            <div className="w-24">
              {chartData ? (
                <Doughnut
                  data={chartData}
                  plugins={[doughnutPercentPlugin]}
                  options={{ plugins: { legend: { display: false }, tooltip: { enabled: true } }, cutout: '58%' }}
                />
              ) : (
                <div className="aspect-square rounded-full border-[10px] border-line flex items-center justify-center text-[10px] font-medium text-muted text-center">
                  No attempts
                </div>
              )}
            </div>
            {[
              { label: 'Correct', value: summary.correct, className: 'text-ok' },
              { label: 'Wrong', value: summary.incorrect, className: 'text-bad' },
              { label: 'Inactive', value: summary.notAttempted, className: 'text-muted' },
            ].map((item) => (
              <div key={item.label} className="min-w-[4.5rem]">
                <p className="text-[10px] font-bold uppercase tracking-wider text-muted">{item.label}</p>
                <p className={`text-xl font-bold leading-tight ${item.className}`}>{item.value}</p>
                <p className="text-[11px] text-subtle">of {summary.enrolled}</p>
              </div>
            ))}
          </div>
        )}

        <div className="shrink-0 flex flex-wrap items-center gap-2">
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
                  ? 'bg-accent text-on-accent border-accent'
                  : 'bg-surface text-body border-line hover:bg-hover'
              }`}
            >
              {opt.label} {opt.count != null ? `(${opt.count})` : ''}
            </button>
          ))}
          <Button
            variant="danger"
            className="px-2.5 py-1!"
            disabled={blocking || inactiveStudents.length === 0}
            onClick={handleBlockAllInactive}
          >
            {inactiveStudents.length === 0
              ? 'Block inactive'
              : unblockedInactive.length > 0
                ? `Block inactive (${unblockedInactive.length})`
                : 'Unblock inactive'}
          </Button>
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search name or email"
            className={`${inputClass} ml-auto w-full sm:w-56 h-9`}
          />
        </div>

        <Table
          fill
          columns={[
            { key: 'student', label: 'Student' },
            { key: 'status', label: 'Status' },
            { key: 'language', label: 'Language', className: 'hidden md:table-cell' },
            { key: 'action', label: 'Action', className: 'text-right' },
          ]}
        >
          {filteredStudents.map((student) => {
            const style = STATUS[student.status] || STATUS.not_attempted;
            const hasWork = Boolean(extractAnswerText(student.lastSubmittedAnswer));
            const attempt = latestSubmit(student);
            const highlighted = String(backState.selectedStudentId) === String(student.studentId);
            return (
              <tr key={student.studentId} className={`${tableClass.row} ${highlighted ? 'bg-accent-soft' : ''}`}>
                <td className={tableClass.td}>
                  <p className="font-semibold text-fg truncate">
                    {student.studentName}
                    {student.isBlocked ? <span className="ml-2 text-[11px] text-muted">Blocked</span> : null}
                  </p>
                  <p className="text-[11px] text-muted truncate">{student.studentEmail || 'No email'}</p>
                </td>
                <td className={tableClass.td}>
                  <StatusChip kind={style.kind}>{style.label}</StatusChip>
                </td>
                <td className={`${tableClass.td} hidden md:table-cell`}>{student.lastSubmittedLanguage || '—'}</td>
                <td className={tableClass.td}>
                  <div className="flex justify-end gap-1.5">
                    <Button variant="soft" className="h-8" disabled={!hasWork} onClick={() => openStudentWork(student)}>
                      {isCodingQuestion ? 'Board' : 'View'}
                    </Button>
                    <Button variant="secondary" className="h-8" disabled={!attempt?.submissionId} onClick={() => openAttemptReview(student)}>
                      Review
                    </Button>
                    <Button
                      variant="ghost"
                      className="h-8"
                      disabled={blocking}
                      onClick={() => handleBlockStudent(student, !student.isBlocked)}
                    >
                      {student.isBlocked ? 'Unblock' : 'Block'}
                    </Button>
                  </div>
                </td>
              </tr>
            );
          })}
        </Table>
        {filteredStudents.length === 0 && (
          <p className="text-xs text-muted text-center -mt-1">
            {report?.studentData?.length === 0 ? 'No students enrolled in this class.' : 'No students match this filter.'}
          </p>
        )}
      </section>

      <Modal
        open={Boolean(classReport)}
        onClose={() => setClassReport(null)}
        title={classReport?.title || 'Class report'}
        width="max-w-6xl"
        footer={
          classReport && !classReport.loading && !classReport.error ? (
            <>
              <Button variant="secondary" onClick={handleShareClassReport}>
                Share
              </Button>
              <Button onClick={() => downloadSheetReport(classReport)}>Download</Button>
            </>
          ) : null
        }
      >
        {shareNote && <p className="text-xs text-accent-ink">{shareNote}</p>}
        {classReport?.loading && <p className="text-xs text-muted">Loading report…</p>}
        {classReport?.error && <p className="text-xs text-bad">{classReport.error}</p>}
        {classReport && !classReport.loading && !classReport.error && (
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-line text-xs">
              <thead className="bg-inset">
                <tr>
                  {(classReport.columns || []).map((column) => (
                    <th key={column} className="px-3 py-2 text-left text-[10px] font-bold uppercase tracking-wider text-muted whitespace-nowrap">
                      {column}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-line">
                {(classReport.rows || []).length === 0 ? (
                  <tr>
                    <td colSpan={classReport.columns?.length || 1} className="px-3 py-4 text-muted">
                      No students in this class.
                    </td>
                  </tr>
                ) : (
                  classReport.rows.map((row, rowIndex) => (
                    <tr key={rowIndex}>
                      {row.map((cell, cellIndex) => (
                        <td key={cellIndex} className="px-3 py-2 whitespace-nowrap text-body">
                          {cell == null || cell === '' ? '—' : String(cell)}
                        </td>
                      ))}
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        )}
      </Modal>

      {codeStudent && (
        <div className={`fixed inset-0 z-50 flex flex-col ${boardMode ? 'bg-slate-950' : 'bg-page'}`}>
          <div className={`shrink-0 border-b px-4 py-3 flex flex-wrap items-center gap-2 ${boardMode ? 'border-slate-800 bg-slate-900' : 'border-line bg-surface'}`}>
            <Button
              variant={boardMode ? 'ghost' : 'secondary'}
              icon={X}
              className={boardMode ? 'text-white hover:bg-white/10' : ''}
              onClick={() => {
                setCodeStudent(null);
                setBoardMode(false);
                setRunResults(null);
              }}
            >
              Close
            </Button>
            <div className="min-w-0 flex-1">
              <p className={`text-sm font-semibold truncate ${boardMode ? 'text-white' : 'text-fg'}`}>
                {codeStudent.studentName}
                {codeStudent.lastSubmittedIsCorrect === true
                  ? ' · Correct'
                  : codeStudent.lastSubmittedIsCorrect === false
                    ? ' · Wrong'
                    : ''}
              </p>
              <p className={`text-[11px] truncate ${boardMode ? 'text-slate-300' : 'text-muted'}`}>
                Students watch the board and type the fix in their own editor.
                {codeStudent.lastSubmittedAt ? ` · ${format(new Date(codeStudent.lastSubmittedAt), 'MMM d, h:mm a')}` : ''}
              </p>
            </div>
            {isCodingQuestion && (
              <select
                value={editorLanguage}
                onChange={(e) => setEditorLanguage(e.target.value)}
                className={`${inputClass} h-9 w-auto ${boardMode ? 'bg-slate-800 text-white border-slate-700' : ''}`}
              >
                {languages.map((lang) => (
                  <option key={lang} value={lang}>
                    {lang}
                  </option>
                ))}
              </select>
            )}
            <Button
              variant={boardMode ? 'ghost' : 'secondary'}
              icon={RotateCcw}
              className={boardMode ? 'text-slate-200 hover:bg-white/10' : ''}
              onClick={() => {
                setEditorCode(originalCode);
                setRunResults(null);
              }}
            >
              Reset
            </Button>
            {isCodingQuestion && (
              <Button icon={Play} disabled={runLoading || !editorCode.trim()} onClick={handleRunCorrected}>
                {runLoading ? 'Submitting…' : 'Submit corrected'}
              </Button>
            )}
            <Button
              variant={boardMode ? 'ghost' : 'secondary'}
              icon={boardMode ? Minimize2 : Maximize2}
              className={boardMode ? 'text-white hover:bg-white/10' : ''}
              onClick={() => setBoardMode((v) => !v)}
            >
              {boardMode ? 'Exit board' : 'Board'}
            </Button>
          </div>
          <div className="flex-1 min-h-0 flex flex-col lg:flex-row">
            <div className="flex-1 min-h-0 min-w-0 p-3 lg:p-4">
              {isCodingQuestion ? (
                <div className={`h-full min-h-[320px] rounded-xl overflow-hidden border ${boardMode ? 'border-slate-700' : 'border-line'}`}>
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
                <textarea
                  value={editorCode}
                  onChange={(e) => setEditorCode(e.target.value)}
                  className={`${inputClass} w-full min-h-[50vh] font-mono ${boardMode ? 'bg-slate-900 text-white text-2xl' : ''}`}
                />
              )}
            </div>
            {isCodingQuestion && (
              <div className={`lg:w-[360px] shrink-0 border-t lg:border-t-0 lg:border-l overflow-y-auto p-4 ${boardMode ? 'bg-slate-900 border-slate-800 text-slate-100' : 'bg-surface border-line'}`}>
                <p className={`text-sm font-semibold mb-3 ${boardMode ? 'text-white' : 'text-fg'}`}>Test result</p>
                {!runResults && (
                  <p className={`text-xs ${boardMode ? 'text-slate-400' : 'text-muted'}`}>
                    Correct the code, then run it. Students copy the working version into their own editor.
                  </p>
                )}
                {runResults?.error && <p className="text-xs text-bad">{runResults.message}</p>}
                {runResults && !runResults.error && (
                  <div>
                    <p className={`font-semibold mb-3 ${runResults.isCorrect ? 'text-ok' : 'text-warn'}`}>
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
