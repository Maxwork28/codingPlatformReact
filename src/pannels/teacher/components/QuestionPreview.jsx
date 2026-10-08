import React, { useState, useEffect, useMemo, useRef } from 'react';
import { useParams, useNavigate, useLocation } from 'react-router-dom';
import { getQuestion, getDraftQuestion, teacherTestQuestion } from '../../../common/services/api';
import QuestionStatement from './QuestionStatement';
import CodeEditor from '../../student/components/CodeEditor';
import TestSolutionResults from '../../../common/components/TestSolutionResults';
import TestSolutionLimitControls from '../../../common/components/TestSolutionLimitControls';
import {
  buildSolutionCodesFromQuestion,
  hasSavedSolution,
  solutionCodeForLanguage,
} from '../../../common/utils/solutionCodes';
import { notify } from '../../../common/ui/Toast';
import { CODING_TYPES } from '../../../common/domain/questions';

const DEFAULT_BACK = '/teacher/questions';
const RUNNABLE_TYPES = CODING_TYPES;

const apiErrorMessage = (err, fallback) =>
  (typeof err === 'string' && err) || err?.response?.data?.error || err?.message || fallback;

const withPreviewStarterCode = (question) => {
  if (!question) return null;
  if (question.type !== 'codingWithDriver' && question.type !== 'coding') return question;
  const hasStarter = Array.isArray(question.starterCode) && question.starterCode.length > 0;
  const hasTemplate = Array.isArray(question.templateCode) && question.templateCode.length > 0;
  if (hasStarter || !hasTemplate) return question;
  return {
    ...question,
    starterCode: question.templateCode.map((tc) => ({ language: tc.language, code: tc.code })),
  };
};

const questionTypeLabel = (type) => {
  const map = {
    singleCorrectMcq: 'Single choice',
    multipleCorrectMcq: 'Multiple choice',
    fillInTheBlanks: 'Fill in the blanks',
    fillInTheBlanksCoding: 'Fill in the blanks (code)',
    coding: 'Coding',
    codingWithDriver: 'Coding (LeetCode-style)',
  };
  return map[type] || type || '—';
};

const resolveClassId = (questionData, fallback = '') => {
  if (fallback) return fallback;
  if (!questionData) return '';
  const classEntry = questionData.classes?.[0];
  if (classEntry?.classId?._id) return classEntry.classId._id;
  if (classEntry?.classId) return String(classEntry.classId);
  if (Array.isArray(questionData.classIds) && questionData.classIds.length > 0) return questionData.classIds[0];
  return '';
};

const QuestionPreview = () => {
  const { questionId } = useParams();
  const navigate = useNavigate();
  const location = useLocation();
  const stateClassId = location.state?.classId || '';
  const returnTo =
    typeof location.state?.returnTo === 'string' && location.state.returnTo.startsWith('/teacher')
      ? location.state.returnTo
      : stateClassId
        ? `/teacher/classes/${stateClassId}`
        : DEFAULT_BACK;

  const [question, setQuestion] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [classId, setClassId] = useState(stateClassId);
  const [solutionCodes, setSolutionCodes] = useState([]);
  const [solutionLanguage, setSolutionLanguage] = useState('javascript');
  const activeSolutionCode = solutionCodeForLanguage(solutionCodes, solutionLanguage);
  const [isTestingSolution, setIsTestingSolution] = useState(false);
  const [testResults, setTestResults] = useState(null);
  const [activeTab, setActiveTab] = useState('preview');
  const limitOptionsRef = useRef(null);

  useEffect(() => {
    setActiveTab('preview');
  }, [questionId]);

  useEffect(() => {
    if (question && !RUNNABLE_TYPES.includes(question.type)) {
      setActiveTab('preview');
    }
  }, [question]);

  useEffect(() => {
    const fetchQuestion = async () => {
      if (
        !questionId ||
        questionId === 'undefined' ||
        questionId === 'null' ||
        (typeof questionId === 'string' && questionId.trim() === '')
      ) {
        setError('Question ID is required. Please open preview from the question page.');
        setLoading(false);
        return;
      }

      const objectIdPattern = /^[0-9a-fA-F]{24}$/;
      if (!objectIdPattern.test(questionId)) {
        setError(`Invalid question ID format: ${questionId}`);
        setLoading(false);
        return;
      }

      try {
        setLoading(true);
        setError('');

        let fetchedQuestion = null;
        try {
          const draftResponse = await getDraftQuestion(questionId);
          fetchedQuestion = draftResponse.data.question;
        } catch {
          const response = await getQuestion(questionId, stateClassId || null);
          fetchedQuestion = response?.data?.question || response?.data;
        }

        if (!fetchedQuestion) {
          setError('Question not found');
          return;
        }

        setQuestion(fetchedQuestion);
        const codes = buildSolutionCodesFromQuestion(fetchedQuestion);
        setSolutionCodes(codes);
        const defaultLang =
          fetchedQuestion.solutionLanguage ||
          codes.find((s) => s.code?.trim())?.language ||
          fetchedQuestion.languages?.[0] ||
          'javascript';
        setSolutionLanguage(defaultLang);
        setClassId(resolveClassId(fetchedQuestion, stateClassId));
      } catch (err) {
        setError(apiErrorMessage(err, 'Failed to fetch question'));
      } finally {
        setLoading(false);
      }
    };

    fetchQuestion();
  }, [questionId, stateClassId]);

  const previewQuestion = useMemo(() => withPreviewStarterCode(question), [question]);

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
      notify('Please write a solution first');
      return;
    }
    if (!q.testCases || q.testCases.length === 0) {
      notify('Please add at least one test case');
      return;
    }
    if (q.testCases.some((tc) => !tc.input?.trim() || !tc.expectedOutput?.trim())) {
      notify('All test cases must have input and expected output');
      return;
    }
    if (!q._id) {
      notify('Question ID is required to test the solution');
      return;
    }
    if (!RUNNABLE_TYPES.includes(q.type)) {
      notify('Solution testing is only available for coding questions');
      return;
    }

    setIsTestingSolution(true);
    setTestResults(null);

    try {
      const classIdForTest = classId || resolveClassId(q) || null;
      const response = await teacherTestQuestion(
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
      } = response.data;

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
      <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50">
        <div className="bg-surface backdrop-blur-sm p-8 rounded-2xl shadow-xl max-w-sm w-full">
          <div className="flex items-center justify-center">
            <svg className="animate-spin h-10 w-10 text-accent-ink" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
            </svg>
            <span className="ml-4 text-lg font-semibold text-fg">Loading...</span>
          </div>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="w-full px-4 sm:px-5 py-8">
        <div className="mb-6 p-4 rounded-xl bg-bad-soft backdrop-blur-sm border border-bad-line shadow-sm">
          <p className="text-sm font-semibold text-bad">{error}</p>
          <button type="button" onClick={() => navigate(returnTo)} className="mt-3 text-sm text-accent-ink hover:underline">
            ← Back
          </button>
        </div>
      </div>
    );
  }

  if (!previewQuestion) {
    return (
      <div className="w-full px-4 sm:px-5 py-8">
        <div className="bg-surface backdrop-blur-sm rounded-2xl shadow-lg p-6 border border-line">
          <p className="text-center text-fg font-semibold">Question not found</p>
        </div>
      </div>
    );
  }

  const isRunnable = RUNNABLE_TYPES.includes(previewQuestion.type);

  return (
    <div className="w-full px-4 sm:px-5 py-8">
      <div className="flex items-center mb-8">
        <button
          type="button"
          onClick={() => navigate(returnTo)}
          className="mr-4 p-2 rounded-full bg-inset hover:bg-line-strong transition-all duration-200"
          aria-label="Go back"
        >
          <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 text-muted" viewBox="0 0 20 20" fill="currentColor">
            <path fillRule="evenodd" d="M9.707 16.707a1 1 0 01-1.414 0l-6-6a1 1 0 010-1.414l6-6a1 1 0 011.414 1.414L5.414 9H17a1 1 0 110 2H5.414l4.293 4.293a1 1 0 010 1.414z" clipRule="evenodd" />
          </svg>
        </button>
        <h1 className="text-3xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-accent to-accent-hover tracking-tight">
          Student Preview
        </h1>
      </div>

      <div className="bg-surface backdrop-blur-sm rounded-2xl shadow-lg p-6 border border-line">
        <div className="mb-4 p-3 bg-info-soft rounded-lg border border-info-line">
          <p className="text-sm text-info">
            <strong>Preview Mode:</strong> This is how students will see this question. You can test the solution here; student submissions are disabled.
          </p>
        </div>

        <div className="mb-6 flex flex-wrap gap-2 items-center text-sm">
          <span className="px-3 py-1.5 rounded-full font-semibold bg-slate-800 text-white">{questionTypeLabel(previewQuestion.type)}</span>
          {previewQuestion?.isDraft || previewQuestion?.status === 'draft' ? (
            <span className="px-3 py-1.5 rounded-full font-medium bg-warn-soft text-warn">Draft</span>
          ) : null}
          {previewQuestion?.languages?.length > 0 && (
            <span className="px-3 py-1.5 rounded-full font-medium bg-accent-soft text-accent-ink">
              Languages: {previewQuestion.languages.join(', ')}
            </span>
          )}
          {previewQuestion?.testCases?.length > 0 && (
            <span className="px-3 py-1.5 rounded-full font-medium bg-inset text-fg">
              {previewQuestion.testCases.length} test case{previewQuestion.testCases.length === 1 ? '' : 's'}
            </span>
          )}
        </div>

        {isRunnable && (
          <div className="mb-6 border-b border-line">
            <nav className="flex space-x-8" aria-label="Tabs">
              <button
                type="button"
                onClick={() => setActiveTab('preview')}
                className={`py-4 px-1 border-b-2 font-medium text-sm transition-colors ${
                  activeTab === 'preview'
                    ? 'border-accent text-accent-ink'
                    : 'border-transparent text-muted hover:text-body hover:border-line-strong'
                }`}
              >
                Preview
              </button>
              <button
                type="button"
                onClick={() => setActiveTab('test')}
                className={`py-4 px-1 border-b-2 font-medium text-sm transition-colors ${
                  activeTab === 'test'
                    ? 'border-accent text-accent-ink'
                    : 'border-transparent text-muted hover:text-body hover:border-line-strong'
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
            <h2 className="text-2xl font-bold text-fg mb-4">Test Solution</h2>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-semibold text-body mb-2">Solution Language</label>
                <select
                  value={solutionLanguage}
                  onChange={(e) => setSolutionLanguage(e.target.value)}
                  className="w-full px-4 py-2 rounded-lg border border-line focus:ring-2 focus:ring-accent focus:border-accent text-sm transition-all"
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
                <label className="block text-sm font-semibold text-body mb-2">Solution Code</label>
                <div className="border border-line rounded-lg overflow-hidden">
                  <CodeEditor
                    key={`solution-${solutionLanguage}-${previewQuestion._id}`}
                    value={activeSolutionCode}
                    onChange={handleSolutionCodeChange}
                    language={solutionLanguage}
                    disabled={false}
                    isFillInTheBlanks={false}
                  />
                </div>
                <p className="mt-2 text-xs text-muted">
                  Switch language to view or edit each saved solution. Test runs against all cases, including hidden ones.
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
                  disabled={isTestingSolution || !activeSolutionCode.trim() || !previewQuestion.testCases?.length || !previewQuestion._id}
                  className="inline-flex items-center px-4 py-2 rounded-lg text-sm font-semibold text-on-accent bg-accent hover:bg-accent-hover focus:outline-none focus:ring-2 focus:ring-accent focus:ring-offset-2 transition-all disabled:bg-subtle disabled:cursor-not-allowed"
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

export default QuestionPreview;
