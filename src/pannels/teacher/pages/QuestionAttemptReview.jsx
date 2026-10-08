import React, { useCallback, useEffect, useState } from 'react';
import { useLocation, useNavigate, useParams } from 'react-router-dom';
import { format } from 'date-fns';
import { ArrowLeft, Check, Play } from 'lucide-react';
import {
  getQuestion,
  markSubmissionCorrect,
  teacherTestQuestion,
  viewSubmissionCode,
} from '../../../common/services/api';
import CodeEditor from '../../student/components/CodeEditor';
import TestCaseResultsList from '../../student/components/TestCaseResultsList';
import { parseTestCaseResultsList } from '../../../common/utils/testCaseResults';
import { Button, EmptyState, StatusChip } from '../../../common/ui/primitives';
import { confirmAction, notify } from '../../../common/ui/Toast';
import { type } from '../../../common/ui/format';
import { RUNNABLE_CODING_TYPES } from './takeClass/helpers';

const QuestionAttemptReview = () => {
  const navigate = useNavigate();
  const { classId, questionId, submissionId } = useParams();
  const location = useLocation();
  const navState = location.state || {};

  const [questionType, setQuestionType] = useState(navState.questionType || null);
  const [attemptDetail, setAttemptDetail] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [reviewCode, setReviewCode] = useState('');
  const [reviewLanguage, setReviewLanguage] = useState('javascript');
  const [runLoading, setRunLoading] = useState(false);
  const [runResults, setRunResults] = useState(null);
  const [markLoading, setMarkLoading] = useState(false);

  const attemptMeta = navState.attempt || {};
  const isCodingQuestion = RUNNABLE_CODING_TYPES.includes(questionType);
  const displayCorrect = attemptDetail?.isCorrect ?? attemptMeta.isCorrect;
  const canMarkCorrect = !attemptMeta.isRun && !displayCorrect;

  const loadDetail = useCallback(async () => {
    if (!submissionId) return;
    setLoading(true);
    setError('');
    try {
      if (!questionType && questionId) {
        const qRes = await getQuestion(questionId);
        const q = qRes.data?.question || qRes.data;
        if (q?.type) setQuestionType(q.type);
      }
      const response = await viewSubmissionCode(submissionId);
      const d = response.data;
      const codeStr =
        typeof d.code === 'string' ? d.code : d.code != null ? JSON.stringify(d.code, null, 2) : '';
      setAttemptDetail(d);
      setReviewCode(codeStr);
      setReviewLanguage(d.language || 'javascript');
    } catch (err) {
      setError(typeof err === 'string' ? err : err?.error || 'Failed to load attempt');
    } finally {
      setLoading(false);
    }
  }, [submissionId, questionId, questionType]);

  useEffect(() => {
    loadDetail();
  }, [loadDetail]);

  const handleBack = () => {
    navigate(`/teacher/take-class/${classId}/questions/${questionId}/statistics`, {
      state: {
        fromTakeClass: navState.fromTakeClass,
        selectedStudentId: navState.selectedStudentId,
      },
    });
  };

  const handleRunAttempt = async () => {
    if (!questionId || !reviewCode.trim()) return;
    setRunLoading(true);
    setRunResults(null);
    try {
      const res = await teacherTestQuestion(questionId, reviewCode, classId, reviewLanguage);
      setRunResults({
        isCorrect: res.data.isCorrect,
        passedTestCases: res.data.passedTestCases,
        totalTestCases: res.data.totalTestCases,
        testResults: res.data.testResults,
        message: res.data.message,
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

  const handleMarkCorrect = async () => {
    if (!await confirmAction('Mark this submission as correct? This updates the student score and leaderboard.')) {
      return;
    }
    setMarkLoading(true);
    try {
      await markSubmissionCorrect(submissionId);
      notify('Submission marked as correct');
      await loadDetail();
    } catch (err) {
      notify(typeof err === 'string' ? err : 'Failed to mark as correct');
    } finally {
      setMarkLoading(false);
    }
  };

  const studentName = navState.studentName || attemptDetail?.studentName || 'Student';

  return (
    <div className="flex flex-col h-[calc(100vh-4rem)] max-h-[calc(100vh-4rem)] bg-page">
      <header className="shrink-0 h-14 px-4 sm:px-5 border-b border-line bg-surface flex items-center gap-2">
        <Button variant="ghost" icon={ArrowLeft} className="h-9 w-9 justify-center p-0!" onClick={handleBack} aria-label="Back" />
        <h1 className={`${type.pageTitle} text-xl! truncate min-w-0`}>{studentName}</h1>
        {navState.questionTitle && <StatusChip kind="neutral">{navState.questionTitle}</StatusChip>}
        {attemptDetail && (
          <StatusChip kind={displayCorrect ? 'ok' : 'bad'}>{displayCorrect ? 'Correct' : 'Incorrect'}</StatusChip>
        )}
      </header>

      <div className="flex-1 min-h-0 overflow-y-auto px-4 sm:px-5 py-5 space-y-4">
        {loading && (
          <div className="flex justify-center py-16">
            <div className="w-8 h-8 border-2 border-accent border-t-transparent rounded-full animate-spin" />
          </div>
        )}

        {error && !loading && (
          <EmptyState title="Couldn't load attempt" message={error} action={<Button variant="secondary" onClick={handleBack}>Go back</Button>} />
        )}

        {!loading && !error && attemptDetail && (
          <>
            <div className="rounded-2xl border border-line bg-surface shadow-card p-4 grid grid-cols-1 sm:grid-cols-3 gap-4">
              <div>
                <p className="text-[10px] font-bold uppercase tracking-wider text-muted">Student</p>
                <p className="font-semibold text-fg mt-1">{studentName}</p>
                <p className="text-xs text-muted">{navState.studentEmail || attemptDetail.studentEmail || '—'}</p>
              </div>
              <div>
                <p className="text-[10px] font-bold uppercase tracking-wider text-muted">Attempt</p>
                <p className="font-semibold text-fg mt-1">
                  {attemptMeta.isRun ? 'Test run' : 'Submit'}
                  {attemptMeta.isCustomInput ? ' (custom input)' : ''}
                </p>
                <p className="text-xs text-muted">
                  {attemptMeta.submittedAt
                    ? format(new Date(attemptMeta.submittedAt), 'MMM d, yyyy h:mm a')
                    : attemptDetail.submittedAt
                      ? format(new Date(attemptDetail.submittedAt), 'MMM d, yyyy h:mm a')
                      : '—'}
                </p>
              </div>
              <div>
                <p className="text-[10px] font-bold uppercase tracking-wider text-muted">Score</p>
                <p className="font-semibold text-fg mt-1">
                  {attemptDetail.passedTestCases ?? attemptMeta.passedTestCases ?? 0}/
                  {attemptDetail.totalTestCases ?? attemptMeta.totalTestCases ?? 0} tests
                </p>
                <p className="text-xs text-muted">
                  {!attemptMeta.isRun && (attemptMeta.score != null || attemptDetail.score != null)
                    ? `Score ${attemptDetail.score ?? attemptMeta.score}`
                    : attemptDetail.status || attemptMeta.status || '—'}
                </p>
              </div>
            </div>

            <div className="rounded-2xl border border-line bg-surface shadow-card p-4 sm:p-5 space-y-4">
              {isCodingQuestion ? (
                <>
                  <p className={type.section}>Student code</p>
                  <div className="border border-line rounded-xl overflow-hidden">
                    <CodeEditor value={reviewCode} onChange={setReviewCode} language={reviewLanguage} height="420px" />
                  </div>
                  <div className="flex flex-wrap gap-2">
                    <Button icon={Play} disabled={runLoading || !reviewCode.trim()} onClick={handleRunAttempt}>
                      {runLoading ? 'Running…' : 'Run tests'}
                    </Button>
                    {canMarkCorrect && (
                      <Button variant="publish" icon={Check} className="px-4 py-2!" disabled={markLoading} onClick={handleMarkCorrect}>
                        {markLoading ? 'Saving…' : 'Mark as correct'}
                      </Button>
                    )}
                  </div>
                  {runResults && (
                    <div
                      className={`rounded-xl border p-4 ${
                        runResults.error
                          ? 'bg-bad-soft border-bad-line'
                          : runResults.isCorrect
                            ? 'bg-ok-soft border-ok-line'
                            : 'bg-warn-soft border-warn-line'
                      }`}
                    >
                      {runResults.error ? (
                        <p className="text-bad">{runResults.message}</p>
                      ) : (
                        <>
                          <p className={`font-medium mb-3 ${runResults.isCorrect ? 'text-ok' : 'text-warn'}`}>
                            {runResults.isCorrect
                              ? `All ${runResults.totalTestCases} test cases passed`
                              : `${runResults.passedTestCases}/${runResults.totalTestCases} passed`}
                          </p>
                          <TestCaseResultsList results={runResults.testResults} showHiddenDetails />
                        </>
                      )}
                    </div>
                  )}
                  {!runResults && (attemptDetail.testResults?.length > 0 || attemptDetail.output) && (
                    <div className="rounded-xl border border-line bg-inset p-4">
                      <p className="text-xs font-semibold text-muted mb-3">
                        {attemptDetail.testResults?.length ? 'Saved test cases' : 'Saved output'}
                      </p>
                      <TestCaseResultsList
                        results={
                          attemptDetail.testResults?.length
                            ? attemptDetail.testResults
                            : parseTestCaseResultsList(attemptDetail.output)
                        }
                        showHiddenDetails
                      />
                    </div>
                  )}
                </>
              ) : (
                <>
                  <p className={type.section}>Student answer</p>
                  <pre className="rounded-xl border border-line bg-inset p-4 text-xs whitespace-pre-wrap break-words text-fg">
                    {typeof attemptDetail.code === 'string'
                      ? attemptDetail.code
                      : JSON.stringify(attemptDetail.code, null, 2)}
                  </pre>
                  {canMarkCorrect && (
                    <Button variant="publish" icon={Check} className="px-4 py-2!" disabled={markLoading} onClick={handleMarkCorrect}>
                      {markLoading ? 'Saving…' : 'Mark as correct'}
                    </Button>
                  )}
                </>
              )}
            </div>
          </>
        )}
      </div>
    </div>
  );
};

export default QuestionAttemptReview;
