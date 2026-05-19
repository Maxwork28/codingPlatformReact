import React, { useCallback, useEffect, useState } from 'react';
import { useNavigate, useParams, useLocation } from 'react-router-dom';
import { ArrowLeftIcon, PlayIcon, CheckIcon } from '@heroicons/react/24/outline';
import { format } from 'date-fns';
import {
  getQuestion,
  viewSubmissionCode,
  teacherTestQuestion,
  markSubmissionCorrect,
} from '../../../common/services/api';
import CodeEditor from '../../student/components/CodeEditor';
import TestCaseResultsList, { parseTestCaseResultsList } from '../../student/components/TestCaseResultsList';

const CODING_TYPES = ['coding', 'fillInTheBlanksCoding', 'codingWithDriver'];

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
  const isCodingQuestion = CODING_TYPES.includes(questionType);
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
    if (!window.confirm('Mark this submission as correct? This updates the student score and leaderboard.')) {
      return;
    }
    setMarkLoading(true);
    try {
      await markSubmissionCorrect(submissionId);
      await loadDetail();
    } catch (err) {
      setError(typeof err === 'string' ? err : err?.error || 'Failed to mark as correct');
    } finally {
      setMarkLoading(false);
    }
  };

  return (
    <div className="min-h-screen" style={{ backgroundColor: 'var(--background-content)' }}>
      <div
        className="border-b px-4 py-4 sm:px-6"
        style={{ backgroundColor: 'var(--card-white)', borderColor: 'var(--card-border)' }}
      >
        <div className="max-w-5xl mx-auto flex flex-wrap items-center gap-3">
          <button
            type="button"
            onClick={handleBack}
            className="inline-flex items-center gap-2 px-3 py-2 rounded-lg border text-sm font-medium hover:opacity-90"
            style={{ borderColor: 'var(--card-border)', color: 'var(--text-primary)' }}
          >
            <ArrowLeftIcon className="w-4 h-4" />
            Back to statistics
          </button>
          <div className="flex-1 min-w-0">
            <h1 className="text-lg sm:text-xl font-bold truncate" style={{ color: 'var(--text-heading)' }}>
              Review attempt
            </h1>
            <p className="text-sm truncate" style={{ color: 'var(--text-secondary)' }}>
              {navState.studentName || attemptDetail?.studentName || 'Student'}
              {navState.questionTitle ? ` · ${navState.questionTitle}` : ''}
            </p>
          </div>
        </div>
      </div>

      <div className="max-w-5xl mx-auto p-4 sm:p-6 space-y-6">
        {loading && (
          <div className="flex justify-center py-16">
            <div className="w-10 h-10 border-4 border-t-transparent rounded-full animate-spin border-indigo-600" />
          </div>
        )}

        {error && !loading && (
          <div className="rounded-xl border border-red-200 bg-red-50 p-4">
            <p className="text-red-700">{error}</p>
            <button type="button" onClick={handleBack} className="mt-3 text-indigo-600 text-sm font-medium hover:underline">
              Go back
            </button>
          </div>
        )}

        {!loading && !error && attemptDetail && (
          <>
            <div
              className="rounded-xl border p-4 grid grid-cols-1 sm:grid-cols-2 gap-4"
              style={{ backgroundColor: 'var(--card-white)', borderColor: 'var(--card-border)' }}
            >
              <div>
                <p className="text-xs font-semibold uppercase" style={{ color: 'var(--text-secondary)' }}>
                  Student
                </p>
                <p className="font-semibold mt-1" style={{ color: 'var(--text-heading)' }}>
                  {navState.studentName || attemptDetail.studentName}
                </p>
                <p className="text-sm" style={{ color: 'var(--text-secondary)' }}>
                  {navState.studentEmail || attemptDetail.studentEmail}
                </p>
              </div>
              <div>
                <p className="text-xs font-semibold uppercase" style={{ color: 'var(--text-secondary)' }}>
                  Attempt
                </p>
                <p className="font-semibold mt-1" style={{ color: 'var(--text-heading)' }}>
                  {attemptMeta.isRun ? 'Test run' : 'Submit'}
                  {attemptMeta.isCustomInput ? ' (custom input)' : ''}
                </p>
                <p className="text-sm" style={{ color: 'var(--text-secondary)' }}>
                  {attemptMeta.submittedAt
                    ? format(new Date(attemptMeta.submittedAt), 'MMM d, yyyy h:mm a')
                    : attemptDetail.submittedAt
                      ? format(new Date(attemptDetail.submittedAt), 'MMM d, yyyy h:mm a')
                      : '—'}
                </p>
              </div>
              <div className="sm:col-span-2 flex flex-wrap items-center gap-3">
                <span
                  className={`text-sm font-semibold px-3 py-1 rounded-full ${
                    displayCorrect ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'
                  }`}
                >
                  {displayCorrect ? 'Correct' : 'Incorrect'}
                </span>
                {(attemptDetail.status || attemptMeta.status) && (
                  <span className="text-xs px-2 py-1 rounded bg-gray-100 text-gray-700 uppercase">
                    {attemptDetail.status || attemptMeta.status}
                  </span>
                )}
                <span className="text-sm" style={{ color: 'var(--text-secondary)' }}>
                  Tests: {attemptDetail.passedTestCases ?? attemptMeta.passedTestCases ?? 0}/
                  {attemptDetail.totalTestCases ?? attemptMeta.totalTestCases ?? 0}
                  {!attemptMeta.isRun && (attemptMeta.score != null || attemptDetail.score != null) && (
                    <> · Score: {attemptDetail.score ?? attemptMeta.score}</>
                  )}
                </span>
              </div>
            </div>

            <div
              className="rounded-xl border p-4 sm:p-6 space-y-4"
              style={{ backgroundColor: 'var(--card-white)', borderColor: 'var(--card-border)' }}
            >
              {isCodingQuestion ? (
                <>
                  <h2 className="text-sm font-semibold" style={{ color: 'var(--text-heading)' }}>
                    Student code
                  </h2>
                  <div className="border rounded-lg overflow-hidden">
                    <CodeEditor
                      value={reviewCode}
                      onChange={setReviewCode}
                      language={reviewLanguage}
                      height="420px"
                    />
                  </div>
                  <div className="flex flex-wrap gap-2">
                    <button
                      type="button"
                      onClick={handleRunAttempt}
                      disabled={runLoading || !reviewCode.trim()}
                      className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-indigo-600 text-white text-sm font-medium hover:bg-indigo-700 disabled:opacity-50"
                    >
                      <PlayIcon className="w-5 h-5" />
                      {runLoading ? 'Running…' : 'Run tests'}
                    </button>
                    {canMarkCorrect && (
                      <button
                        type="button"
                        onClick={handleMarkCorrect}
                        disabled={markLoading}
                        className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-green-600 text-white text-sm font-medium hover:bg-green-700 disabled:opacity-50"
                      >
                        <CheckIcon className="w-5 h-5" />
                        {markLoading ? 'Saving…' : 'Mark as correct'}
                      </button>
                    )}
                  </div>

                  {runResults && (
                    <div
                      className={`rounded-lg border p-4 ${
                        runResults.error
                          ? 'bg-red-50 border-red-200'
                          : runResults.isCorrect
                            ? 'bg-green-50 border-green-200'
                            : 'bg-amber-50 border-amber-200'
                      }`}
                    >
                      {runResults.error ? (
                        <p className="text-red-700">{runResults.message}</p>
                      ) : (
                        <>
                          <p
                            className={`font-medium mb-3 ${
                              runResults.isCorrect ? 'text-green-800' : 'text-amber-800'
                            }`}
                          >
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
                    <div className="rounded-lg border bg-gray-50 p-4">
                      <p className="text-sm font-semibold text-gray-600 mb-3">
                        {attemptDetail.testResults?.length ? 'All test cases' : 'Saved test results'}
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
                  <h2 className="text-sm font-semibold" style={{ color: 'var(--text-heading)' }}>
                    Student answer
                  </h2>
                  <div className="rounded-lg border bg-gray-50 p-4">
                    <pre className="text-sm whitespace-pre-wrap break-words text-gray-800">
                      {typeof attemptDetail.code === 'string'
                        ? attemptDetail.code
                        : JSON.stringify(attemptDetail.code, null, 2)}
                    </pre>
                  </div>
                  {canMarkCorrect && (
                    <button
                      type="button"
                      onClick={handleMarkCorrect}
                      disabled={markLoading}
                      className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-green-600 text-white text-sm font-medium hover:bg-green-700 disabled:opacity-50"
                    >
                      <CheckIcon className="w-5 h-5" />
                      {markLoading ? 'Saving…' : 'Mark as correct'}
                    </button>
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
