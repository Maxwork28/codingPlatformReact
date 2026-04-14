import React, { useState, useEffect } from 'react';
import { useParams, useNavigate, useLocation } from 'react-router-dom';
import { getQuestion, getDraftQuestion, teacherTestQuestion } from '../../../common/services/api';
import QuestionStatement from './QuestionStatement';
import CodeEditor from '../../student/components/CodeEditor';

const QuestionPreview = () => {
  const { questionId } = useParams();
  const navigate = useNavigate();
  const location = useLocation();
  const [question, setQuestion] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [classId, setClassId] = useState(location.state?.classId || '');
  const [solutionCode, setSolutionCode] = useState('');
  const [solutionLanguage, setSolutionLanguage] = useState('javascript');
  const [isTestingSolution, setIsTestingSolution] = useState(false);
  const [testResults, setTestResults] = useState(null);
  const [activeTab, setActiveTab] = useState('preview');

  const resolveClassId = (questionData) => {
    if (!questionData) return '';
    const classEntry = questionData.classes?.[0];
    if (classEntry?.classId?._id) return classEntry.classId._id;
    if (classEntry?.classId) return classEntry.classId;
    if (Array.isArray(questionData.classIds) && questionData.classIds.length > 0) return questionData.classIds[0];
    return '';
  };

  useEffect(() => {
    console.log('[QuestionPreview] Fetching question:', { questionId });
    const fetchQuestion = async () => {
      try {
        setLoading(true);
        setError('');
        
        // Validate questionId
        if (!questionId || questionId === 'undefined' || questionId === 'null' || (typeof questionId === 'string' && questionId.trim() === '')) {
          console.error('[QuestionPreview] Invalid questionId:', questionId);
          setError('Valid questionId is required');
          setLoading(false);
          return;
        }
        
        // Check if questionId is a valid MongoDB ObjectId format
        const objectIdPattern = /^[0-9a-fA-F]{24}$/;
        if (!objectIdPattern.test(questionId)) {
          console.error('[QuestionPreview] Invalid questionId format:', questionId);
          setError('Invalid question ID format');
          setLoading(false);
          return;
        }
        
        // Try to fetch as draft first
        let fetchedQuestion = null;
        try {
          const draftResponse = await getDraftQuestion(questionId);
          fetchedQuestion = draftResponse.data.question;
          console.log('[QuestionPreview] Fetched as draft');
        } catch (draftErr) {
          // If not a draft, fetch as regular question
          console.log('[QuestionPreview] Not a draft, fetching as regular question');
          const response = await getQuestion(questionId);
          fetchedQuestion = response.data.question || response.data;
        }
        
        console.log('[QuestionPreview] Question fetched:', {
          id: fetchedQuestion._id,
          title: fetchedQuestion.title,
          classes: fetchedQuestion.classes,
          isDraft: fetchedQuestion.isDraft,
        });
        
        setQuestion(fetchedQuestion);
        const derivedClassId = resolveClassId(fetchedQuestion);
        if (!classId && derivedClassId) {
          setClassId(derivedClassId);
        }
        
        // Set solution code and language from question if available
        if (fetchedQuestion.solutionCode) {
          setSolutionCode(fetchedQuestion.solutionCode);
        }
        if (fetchedQuestion.solutionLanguage) {
          setSolutionLanguage(fetchedQuestion.solutionLanguage);
        } else if (fetchedQuestion.languages && fetchedQuestion.languages.length > 0) {
          setSolutionLanguage(fetchedQuestion.languages[0]);
        }

        // For drafts, don't require classes
        if (!fetchedQuestion.isDraft) {
          // Check if question has classes assigned or a class context provided (only for published questions)
          if ((!fetchedQuestion.classes || fetchedQuestion.classes.length === 0) && !derivedClassId && !classId) {
            console.warn('[QuestionPreview] No classes found, redirecting to /teacher/questions');
            navigate('/teacher/questions');
            return;
          }
        }
      } catch (err) {
        console.error('[QuestionPreview] Fetch error:', err.message, err.response?.data);
        const errorMessage = err.response?.data?.error || err.message || 'Failed to fetch question';
        setError(errorMessage);
      } finally {
        setLoading(false);
      }
    };
    fetchQuestion();
  }, [questionId, navigate, classId]);

  if (loading) {
    console.log('[QuestionPreview] Rendering loading state');
    return (
      <div className="fixed inset-0 bg-gray-600 bg-opacity-60 flex items-center justify-center z-50">
        <div className="bg-white/90 backdrop-blur-sm p-8 rounded-2xl shadow-xl max-w-sm w-full">
          <div className="flex items-center justify-center">
            <svg
              className="animate-spin h-10 w-10 text-indigo-600"
              xmlns="http://www.w3.org/2000/svg"
              fill="none"
              viewBox="0 0 24 24"
            >
              <circle
                className="opacity-25"
                cx="12"
                cy="12"
                r="10"
                stroke="currentColor"
                strokeWidth="4"
              ></circle>
              <path
                className="opacity-75"
                fill="currentColor"
                d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
              ></path>
            </svg>
            <span className="ml-4 text-lg font-semibold text-gray-800">Loading...</span>
          </div>
        </div>
      </div>
    );
  }

  if (error) {
    console.log('[QuestionPreview] Rendering error state:', error);
    return (
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="mb-6 p-4 rounded-xl bg-red-50/80 backdrop-blur-sm border border-red-200 shadow-sm">
          <div className="flex items-center">
            <div className="flex-shrink-0">
              <svg
                className="h-6 w-6 text-red-500"
                xmlns="http://www.w3.org/2000/svg"
                viewBox="0 0 20 20"
                fill="currentColor"
              >
                <path
                  fillRule="evenodd"
                  d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z"
                  clipRule="evenodd"
                />
              </svg>
            </div>
            <div className="ml-3">
              <p className="text-sm font-semibold text-red-800">{error}</p>
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (!question) {
    console.log('[QuestionPreview] Rendering question not found state');
    return (
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="bg-white/90 backdrop-blur-sm rounded-2xl shadow-lg p-6 border border-gray-100">
          <p className="text-center text-gray-800 font-semibold">Question not found</p>
        </div>
      </div>
    );
  }

  // Test solution against test cases
  const handleTestSolution = async () => {
    if (!solutionCode.trim()) {
      alert('Please write a solution first');
      return;
    }
    if (!question.testCases || question.testCases.length === 0) {
      alert('Please add at least one test case');
      return;
    }
    if (question.testCases.some(tc => !tc.input?.trim() || !tc.expectedOutput?.trim())) {
      alert('All test cases must have input and expected output');
      return;
    }

    // Check if question exists
    if (!question._id) {
      alert('Question ID is required to test the solution');
      return;
    }

    // Check if it's a coding question
    if (question.type !== 'coding' && question.type !== 'fillInTheBlanksCoding' && question.type !== 'codingWithDriver') {
      alert('Solution testing is only available for coding questions');
      return;
    }

    setIsTestingSolution(true);
    setTestResults(null);

    try {
      console.log('[QuestionPreview] Testing solution for question:', question._id);
      
      // Use the first classId if available, otherwise null (for testing purposes)
  const fallbackClassId = classId || resolveClassId(question);
      const classIdForTest = fallbackClassId || null;
      
      // Call the teacher test API
      const response = await teacherTestQuestion(
        question._id,
        solutionCode,
        classIdForTest,
        solutionLanguage
      );

      const { testResults: results, passedTestCases, totalTestCases, isCorrect, publicTestCases, hiddenTestCases } = response.data;

      setTestResults({
        message: isCorrect 
          ? `✅ All ${totalTestCases} test cases passed! (${publicTestCases} public, ${hiddenTestCases} hidden)`
          : `⚠️ ${passedTestCases}/${totalTestCases} test cases passed (${publicTestCases} public, ${hiddenTestCases} hidden)`,
        results: results,
        totalTestCases,
        passedTestCases,
        isCorrect,
        publicTestCases,
        hiddenTestCases
      });
    } catch (err) {
      console.error('[QuestionPreview] Error testing solution:', err);
      const errorMessage = err.response?.data?.error || err.message || 'Failed to test solution';
      setTestResults({
        error: true,
        message: `Error: ${errorMessage}`
      });
    } finally {
      setIsTestingSolution(false);
    }
  };

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      <div className="flex items-center mb-8">
        <button
          onClick={() => navigate(backHref, backState ? { state: backState } : undefined)}
          className="mr-4 p-2 rounded-full bg-gray-100 hover:bg-gray-200 transition-all duration-200"
        >
          <svg
            xmlns="http://www.w3.org/2000/svg"
            className="h-5 w-5 text-gray-600"
            viewBox="0 0 20 20"
            fill="currentColor"
          >
            <path
              fillRule="evenodd"
              d="M9.707 16.707a1 1 0 01-1.414 0l-6-6a1 1 0 010-1.414l6-6a1 1 0 011.414 1.414L5.414 9H17a1 1 0 110 2H5.414l4.293 4.293a1 1 0 010 1.414z"
              clipRule="evenodd"
            />
          </svg>
        </button>
        <h1 className="text-3xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-indigo-600 to-indigo-400 tracking-tight">
          Student Preview
        </h1>
      </div>
      
      <div className="bg-white/90 backdrop-blur-sm rounded-2xl shadow-lg p-6 border border-gray-100">
        <div className="mb-4 p-3 bg-blue-50 rounded-lg border border-blue-200">
          <p className="text-sm text-blue-800">
            <strong>Preview Mode:</strong> This is how students will see this question. You can test the interface but submissions are disabled.
          </p>
        </div>
        
        {/* Tabs Navigation - Only show Test Solution tab for coding questions */}
        {(question.type === 'coding' || question.type === 'fillInTheBlanksCoding' || question.type === 'codingWithDriver') && (
          <div className="mb-6 border-b border-gray-200">
            <nav className="flex space-x-8" aria-label="Tabs">
              <button
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
        
        {/* Tab Content */}
        {activeTab === 'preview' && (
        <QuestionStatement isPreview={true} question={question} />
        )}
        
        {/* Test Solution Tab - Only for coding questions */}
        {activeTab === 'test' && (question.type === 'coding' || question.type === 'fillInTheBlanksCoding' || question.type === 'codingWithDriver') && (
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
                  {question.languages?.map(lang => (
                    <option key={lang} value={lang}>
                      {lang.charAt(0).toUpperCase() + lang.slice(1)}
                    </option>
                  )) || (
                    <option value="javascript">JavaScript</option>
                  )}
                </select>
              </div>
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2">Solution Code</label>
                <div className="border border-gray-200 rounded-lg overflow-hidden">
                  <CodeEditor
                    value={solutionCode}
                    onChange={setSolutionCode}
                    language={solutionLanguage}
                    disabled={false}
                    isFillInTheBlanks={false}
                  />
                </div>
                <p className="mt-2 text-xs text-gray-500">
                  Write or paste your solution code here to test it against all test cases (including hidden ones).
                </p>
              </div>
              <div className="flex items-center gap-3">
                <button
                  type="button"
                  onClick={handleTestSolution}
                  disabled={isTestingSolution || !solutionCode.trim() || !question.testCases || question.testCases.length === 0 || !question._id}
                  className="inline-flex items-center px-4 py-2 rounded-lg text-sm font-semibold text-white bg-indigo-600 hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2 transition-all disabled:bg-gray-400 disabled:cursor-not-allowed"
                >
                  {isTestingSolution ? (
                    <>
                      <svg className="animate-spin -ml-1 mr-2 h-4 w-4 text-white" fill="none" viewBox="0 0 24 24">
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                      </svg>
                      Testing...
                    </>
                  ) : (
                    'Test Solution'
                  )}
                </button>
              </div>
              {testResults && (
                <div className={`mt-4 p-4 rounded-lg border ${
                  testResults.error 
                    ? 'bg-red-50 border-red-200' 
                    : testResults.isCorrect 
                      ? 'bg-green-50 border-green-200' 
                      : 'bg-yellow-50 border-yellow-200'
                }`}>
                  <div className="flex items-center justify-between mb-2">
                    <h4 className="text-sm font-semibold text-gray-800">
                      {testResults.error ? 'Error' : 'Test Results'}
                    </h4>
                    {!testResults.error && (
                      <span className={`text-xs font-semibold ${
                        testResults.isCorrect ? 'text-green-700' : 'text-yellow-700'
                      }`}>
                        {testResults.passedTestCases}/{testResults.totalTestCases} Passed
                      </span>
                    )}
                  </div>
                  <p className="text-sm text-gray-700 mb-3">{testResults.message}</p>
                  {testResults.results && testResults.results.length > 0 && (
                    <div className="space-y-2 max-h-96 overflow-y-auto">
                      {testResults.results.map((result, idx) => (
                        <div 
                          key={idx} 
                          className={`p-3 rounded border ${
                            result.passed 
                              ? 'bg-green-50 border-green-200' 
                              : 'bg-red-50 border-red-200'
                          }`}
                        >
                          <div className="flex items-center justify-between mb-2">
                            <span className="text-xs font-semibold text-gray-700">
                              Test Case {idx + 1}
                            </span>
                            <span className={`text-xs font-bold ${
                              result.passed ? 'text-green-700' : 'text-red-700'
                            }`}>
                              {result.passed ? '✓ PASSED' : '✗ FAILED'}
                            </span>
                          </div>
                          <div className="text-xs text-gray-600 space-y-1">
                            <div><strong>Input:</strong> <code className="bg-gray-100 px-1 rounded">{result.input}</code></div>
                            <div><strong>Expected:</strong> <code className="bg-gray-100 px-1 rounded">{result.expected || result.expectedOutput}</code></div>
                            <div><strong>Output:</strong> <code className="bg-gray-100 px-1 rounded">{result.output || 'N/A'}</code></div>
                            {result.error && (
                              <div className="mt-1 text-red-600"><strong>Error:</strong> {result.error}</div>
                            )}
                            {!result.isPublic && (
                              <span className="inline-block mt-1 px-2 py-0.5 text-xs bg-purple-100 text-purple-700 rounded">
                                Hidden Test Case
                              </span>
                            )}
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default QuestionPreview;