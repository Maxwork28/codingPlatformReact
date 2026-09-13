import React, { useState, useEffect, useMemo, useRef } from 'react';
import { useParams, Link, useLocation } from 'react-router-dom';
import { getQuestion, getDraftQuestion, getQuestionPerspectiveReport, teacherTestQuestion } from '../../../common/services/api';
import CodeEditor from '../../student/components/CodeEditor';
import QuestionStatement from '../components/QuestionStatement';
import TestSolutionResults from '../../../common/components/TestSolutionResults';
import TestSolutionLimitControls from '../../../common/components/TestSolutionLimitControls';
import {
  withPreviewStarterCode,
  questionTypeLabel,
  resolveClassId,
} from '../components/QuestionPreview';
import {
  buildSolutionCodesFromQuestion,
  hasSavedSolution,
  solutionCodeForLanguage,
} from '../../../common/utils/solutionCodes';

const RUNNABLE_TYPES = ['coding', 'fillInTheBlanksCoding', 'codingWithDriver'];

const apiErrorMessage = (err, fallback) =>
  (typeof err === 'string' && err) || err?.response?.data?.error || err?.message || fallback;

const TeacherQuestionDetail = () => {
  const { classId, questionId } = useParams();
  const { state } = useLocation();
  const [question, setQuestion] = useState(null);
  const [report, setReport] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [activeTab, setActiveTab] = useState('preview');
  const [solutionCodes, setSolutionCodes] = useState([]);
  const [solutionLanguage, setSolutionLanguage] = useState('javascript');
  const [isTestingSolution, setIsTestingSolution] = useState(false);
  const [testResults, setTestResults] = useState(null);
  const limitOptionsRef = useRef(null);

  const activeSolutionCode = solutionCodeForLanguage(solutionCodes, solutionLanguage);

  useEffect(() => {
    setActiveTab('preview');
  }, [questionId]);

  useEffect(() => {
    const fetchData = async () => {
      try {
        setLoading(true);
        setError('');
        let q = null;
        try {
          const draftResponse = await getDraftQuestion(questionId);
          q = draftResponse.data.question;
        } catch {
          const qRes = await getQuestion(questionId, classId || null);
          q = qRes.data?.question || qRes.data;
        }

        const rRes = classId
          ? await getQuestionPerspectiveReport(classId, questionId).catch(() => ({ data: { report: null } }))
          : { data: { report: null } };

        setQuestion(q);
        setReport(rRes.data?.report || null);

        const codes = buildSolutionCodesFromQuestion(q);
        setSolutionCodes(codes);
        const defaultLang =
          state?.initialLanguage ||
          q?.solutionLanguage ||
          codes.find((s) => s.code?.trim())?.language ||
          q?.languages?.[0] ||
          'javascript';
        setSolutionLanguage(defaultLang);
        if (state?.initialCode) {
          setSolutionCodes((prev) =>
            prev.map((s) => (s.language === defaultLang ? { ...s, code: state.initialCode } : s))
          );
        }
      } catch (err) {
        setError(apiErrorMessage(err, 'Failed to load'));
      } finally {
        setLoading(false);
      }
    };
    if (questionId) fetchData();
  }, [questionId, classId, state?.initialCode, state?.initialLanguage]);

  const previewQuestion = useMemo(() => withPreviewStarterCode(question), [question]);

  useEffect(() => {
    if (previewQuestion && !RUNNABLE_TYPES.includes(previewQuestion.type)) {
      setActiveTab('preview');
    }
  }, [previewQuestion]);

  const handleSolutionCodeChange = (code) => {
    setSolutionCodes((prev) =>
      prev.map((s) =>
        s.language?.toLowerCase() === solutionLanguage?.toLowerCase() ? { ...s, code } : s
      )
    );
  };

  const handleTestSolution = async () => {
    const q = previewQuestion;
    if (!activeSolutionCode.trim()) {
      alert('Please write a solution first');
      return;
    }
    if (!q.testCases || q.testCases.length === 0) {
      alert('Please add at least one test case');
      return;
    }
    if (q.testCases.some((tc) => !tc.input?.trim() || !tc.expectedOutput?.trim())) {
      alert('All test cases must have input and expected output');
      return;
    }
    if (!RUNNABLE_TYPES.includes(q.type)) {
      alert('Solution testing is only available for coding questions');
      return;
    }

    setIsTestingSolution(true);
    setTestResults(null);
    try {
      const classIdForTest = classId || resolveClassId(q) || null;
      const res = await teacherTestQuestion(
        q._id,
        activeSolutionCode,
        classIdForTest,
        solutionLanguage,
        limitOptionsRef.current || {}
      );
      const {
        testResults: results,
        passedTestCases,
        totalTestCases,
        isCorrect,
        publicTestCases,
        hiddenTestCases,
      } = res.data;
      setTestResults({
        message: isCorrect
          ? `All ${totalTestCases} test cases passed! (${publicTestCases} public, ${hiddenTestCases} hidden)`
          : `${passedTestCases}/${totalTestCases} test cases passed (${publicTestCases} public, ${hiddenTestCases} hidden)`,
        results,
        totalTestCases,
        passedTestCases,
        isCorrect,
        publicTestCases,
        hiddenTestCases,
      });
    } catch (err) {
      setTestResults({
        error: true,
        message: `Error: ${apiErrorMessage(err, 'Failed to test solution')}`,
      });
    } finally {
      setIsTestingSolution(false);
    }
  };

  if (loading) {
    return (
      <div className="flex justify-center items-center py-16">
        <div className="w-12 h-12 border-4 border-t-transparent rounded-full animate-spin border-indigo-600" />
      </div>
    );
  }

  if (error || !previewQuestion) {
    return (
      <div className="max-w-2xl mx-auto p-6">
        <div className="p-4 bg-red-50 rounded-lg border border-red-200">
          <p className="text-red-700">{error || 'Question not found'}</p>
          <Link to={classId ? `/teacher/classes/${classId}` : '/teacher/questions'} className="text-indigo-600 hover:underline mt-2 inline-block">
            ← Back
          </Link>
        </div>
      </div>
    );
  }

  const isRunnable = RUNNABLE_TYPES.includes(previewQuestion.type);
  const linkState = classId ? { classId, returnTo: `/teacher/classes/${classId}/questions/${questionId}` } : undefined;

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <Link to={classId ? `/teacher/classes/${classId}` : '/teacher/questions'} className="text-indigo-600 hover:underline">
          ← Back to {classId ? 'Class' : 'Questions'}
        </Link>
        <div className="flex flex-wrap gap-2">
          <Link
            to={`/teacher/questions/${questionId}/edit`}
            state={linkState}
            className="px-3 py-1.5 rounded-lg text-sm font-medium bg-gray-100 text-gray-800 hover:bg-gray-200"
          >
            Edit
          </Link>
          <Link
            to={`/teacher/questions/${questionId}/preview`}
            state={linkState}
            className="px-3 py-1.5 rounded-lg text-sm font-medium bg-indigo-600 text-white hover:bg-indigo-700"
          >
            Full Preview
          </Link>
        </div>
      </div>

      {report && (
        <div className="bg-white rounded-xl shadow border border-gray-200 p-6">
          <h2 className="text-lg font-semibold text-gray-800 mb-4">Question Summary</h2>
          <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
            <div className="bg-blue-50 rounded-lg p-4">
              <p className="text-sm text-gray-600">Attempted</p>
              <p className="text-2xl font-bold text-blue-700">{report.totalStudentsAttempted ?? 0}</p>
            </div>
            <div className="bg-green-50 rounded-lg p-4">
              <p className="text-sm text-gray-600">Successful</p>
              <p className="text-2xl font-bold text-green-700">{report.totalCorrect ?? 0}</p>
            </div>
            <div className="bg-red-50 rounded-lg p-4">
              <p className="text-sm text-gray-600">Unsuccessful</p>
              <p className="text-2xl font-bold text-red-700">{report.totalWrong ?? 0}</p>
            </div>
            <div className="bg-amber-50 rounded-lg p-4">
              <p className="text-sm text-gray-600">Total Runs</p>
              <p className="text-2xl font-bold text-amber-700">{report.totalRuns ?? 0}</p>
            </div>
            <div className="bg-indigo-50 rounded-lg p-4">
              <p className="text-sm text-gray-600">Avg Score</p>
              <p className="text-2xl font-bold text-indigo-700">{(report.avgScore ?? 0).toFixed(1)}</p>
            </div>
          </div>
        </div>
      )}

      <div className="bg-white/90 backdrop-blur-sm rounded-2xl shadow-lg p-6 border border-gray-100">
        <div className="mb-4 p-3 bg-blue-50 rounded-lg border border-blue-200">
          <p className="text-sm text-blue-800">
            <strong>Preview Mode:</strong> This is how students will see this question. Use Test Solution to run the official or your own answer against all cases.
          </p>
        </div>

        <div className="mb-6 flex flex-wrap gap-2 items-center text-sm">
          <span className="px-3 py-1.5 rounded-full font-semibold bg-slate-800 text-white">{questionTypeLabel(previewQuestion.type)}</span>
          {previewQuestion?.isDraft || previewQuestion?.status === 'draft' ? (
            <span className="px-3 py-1.5 rounded-full font-medium bg-amber-100 text-amber-900">Draft</span>
          ) : null}
          {previewQuestion?.languages?.length > 0 && (
            <span className="px-3 py-1.5 rounded-full font-medium bg-indigo-100 text-indigo-900">
              Languages: {previewQuestion.languages.join(', ')}
            </span>
          )}
          {previewQuestion?.testCases?.length > 0 && (
            <span className="px-3 py-1.5 rounded-full font-medium bg-gray-100 text-gray-800">
              {previewQuestion.testCases.length} test case{previewQuestion.testCases.length === 1 ? '' : 's'}
            </span>
          )}
        </div>

        {isRunnable && (
          <div className="mb-6 border-b border-gray-200">
            <nav className="flex space-x-8" aria-label="Tabs">
              <button
                type="button"
                onClick={() => setActiveTab('preview')}
                className={`py-4 px-1 border-b-2 font-medium text-sm transition-colors ${
                  activeTab === 'preview'
                    ? 'border-indigo-500 text-indigo-600'
                    : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                }`}
              >
                Preview
              </button>
              <button
                type="button"
                onClick={() => setActiveTab('test')}
                className={`py-4 px-1 border-b-2 font-medium text-sm transition-colors ${
                  activeTab === 'test'
                    ? 'border-indigo-500 text-indigo-600'
                    : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                }`}
              >
                Test Solution
              </button>
            </nav>
          </div>
        )}

        {activeTab === 'preview' && <QuestionStatement isPreview={true} question={previewQuestion} />}

        {activeTab === 'test' && isRunnable && (
          <div>
            <h2 className="text-2xl font-bold text-gray-800 mb-4">Test Solution</h2>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2">Solution Language</label>
                <select
                  value={solutionLanguage}
                  onChange={(e) => setSolutionLanguage(e.target.value)}
                  className="w-full px-4 py-2 rounded-lg border border-gray-200 focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 text-sm transition-all"
                >
                  {(previewQuestion.languages?.length > 0
                    ? previewQuestion.languages
                    : solutionCodes.map((s) => s.language)
                  ).map((lang) => (
                    <option key={lang} value={lang}>
                      {lang.charAt(0).toUpperCase() + lang.slice(1)}
                      {hasSavedSolution(solutionCodes, lang) ? '' : ' (no solution saved)'}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2">Solution Code</label>
                <div className="border border-gray-200 rounded-lg overflow-hidden">
                  <CodeEditor
                    key={`solution-${solutionLanguage}-${previewQuestion._id}`}
                    value={activeSolutionCode}
                    onChange={handleSolutionCodeChange}
                    language={solutionLanguage}
                    disabled={false}
                    isFillInTheBlanks={false}
                  />
                </div>
                <p className="mt-2 text-xs text-gray-500">
                  Saved solutions load per language. You can edit and run them against all test cases, including hidden ones.
                </p>
              </div>
              <TestSolutionLimitControls
                question={previewQuestion}
                testResults={testResults}
                optionsRef={limitOptionsRef}
                getBenchmarkPayload={() => ({
                  questionId: previewQuestion._id,
                  answer: activeSolutionCode,
                  classId: classId || resolveClassId(previewQuestion) || null,
                  language: solutionLanguage,
                })}
                onSaved={(timeLimit, memoryLimit) => {
                  setQuestion((prev) => (prev ? { ...prev, timeLimit, memoryLimit } : prev));
                }}
              />
              <div className="flex items-center gap-3">
                <button
                  type="button"
                  onClick={handleTestSolution}
                  disabled={isTestingSolution || !activeSolutionCode.trim() || !previewQuestion.testCases?.length}
                  className="inline-flex items-center px-4 py-2 rounded-lg text-sm font-semibold text-white bg-indigo-600 hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2 transition-all disabled:bg-gray-400 disabled:cursor-not-allowed"
                >
                  {isTestingSolution ? 'Testing...' : 'Test Solution'}
                </button>
              </div>
              {testResults && <TestSolutionResults testResults={testResults} />}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default TeacherQuestionDetail;
