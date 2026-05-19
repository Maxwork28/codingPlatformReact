import React, { useState, useEffect } from 'react';
import { useParams, Link, useLocation } from 'react-router-dom';
import { getQuestion, getQuestionPerspectiveReport, teacherTestQuestion } from '../../../common/services/api';
import CodeEditor from '../../student/components/CodeEditor';
import parse from 'html-react-parser';

const TeacherQuestionDetail = () => {
  const { classId, questionId } = useParams();
  const { state } = useLocation();
  const [question, setQuestion] = useState(null);
  const [report, setReport] = useState(null);
  const [code, setCode] = useState('');
  const [selectedLanguage, setSelectedLanguage] = useState('javascript');
  const [loading, setLoading] = useState(true);
  const [testLoading, setTestLoading] = useState(false);
  const [testResults, setTestResults] = useState(null);
  const [error, setError] = useState('');

  const stripHtml = (html) => {
    if (!html || typeof html !== 'string') return '';
    const div = document.createElement('div');
    div.innerHTML = html;
    return div.textContent || div.innerText || '';
  };

  useEffect(() => {
    const fetchData = async () => {
      try {
        setLoading(true);
        const [qRes, rRes] = await Promise.all([
          getQuestion(questionId),
          classId ? getQuestionPerspectiveReport(classId, questionId).catch(() => ({ data: { report: null } })) : Promise.resolve({ data: { report: null } })
        ]);
        const q = qRes.data?.question || qRes.data;
        setQuestion(q);
        setReport(rRes.data?.report || null);
        const lang = state?.initialLanguage || q?.languages?.[0] || 'javascript';
        setSelectedLanguage(lang);
        if (state?.initialCode) {
          setCode(state.initialCode);
        } else {
          const sc = q?.starterCode?.find(s => s.language === lang) || q?.starterCode?.[0];
          setCode(sc?.code || '// Write your solution here');
        }
      } catch (err) {
        setError(err.response?.data?.error || err.message || 'Failed to load');
      } finally {
        setLoading(false);
      }
    };
    if (questionId) fetchData();
  }, [questionId, classId]);

  useEffect(() => {
    if (state?.initialCode) {
      setCode(state.initialCode);
      if (state?.initialLanguage) setSelectedLanguage(state.initialLanguage);
    } else if (question?.starterCode?.length && selectedLanguage) {
      const sc = question.starterCode.find(s => s.language === selectedLanguage);
      if (sc?.code) setCode(sc.code);
    }
  }, [question, selectedLanguage, state?.initialCode, state?.initialLanguage]);

  const handleRunCode = async () => {
    if (!question || !code.trim()) return;
    try {
      setTestLoading(true);
      setTestResults(null);
      const res = await teacherTestQuestion(questionId, code, classId || null, selectedLanguage);
      setTestResults({
        message: res.data.message,
        testResults: res.data.testResults,
        passedTestCases: res.data.passedTestCases,
        totalTestCases: res.data.totalTestCases,
        isCorrect: res.data.isCorrect,
        explanation: res.data.explanation
      });
    } catch (err) {
      setTestResults({ error: true, message: err.response?.data?.error || err.message || 'Test failed' });
    } finally {
      setTestLoading(false);
    }
  };

  const handleResetCode = () => {
    const sc = question?.starterCode?.find(s => s.language === selectedLanguage);
    setCode(sc?.code || '// Write your solution here');
  };

  if (loading) {
    return (
      <div className="flex justify-center items-center py-16">
        <div className="w-12 h-12 border-4 border-t-transparent rounded-full animate-spin border-indigo-600" />
      </div>
    );
  }

  if (error || !question) {
    return (
      <div className="max-w-2xl mx-auto p-6">
        <div className="p-4 bg-red-50 rounded-lg border border-red-200">
          <p className="text-red-700">{error || 'Question not found'}</p>
          <Link to={classId ? `/teacher/classes/${classId}` : '/teacher/questions'} className="text-indigo-600 hover:underline mt-2 inline-block">← Back</Link>
        </div>
      </div>
    );
  }

  const isCoding = ['coding', 'fillInTheBlanksCoding', 'codingWithDriver'].includes(question.type);

  return (
    <div className="max-w-6xl mx-auto p-6 space-y-6">
      <Link to={classId ? `/teacher/classes/${classId}` : '/teacher/questions'} className="text-indigo-600 hover:underline">← Back to {classId ? 'Class' : 'Questions'}</Link>

      {/* Question Summary */}
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

      {/* Question Info */}
      <div className="bg-white rounded-xl shadow border border-gray-200 overflow-hidden">
        <div className="p-6 border-b">
          <h1 className="text-xl font-bold text-gray-900">{stripHtml(question.title)}</h1>
          <div className="flex gap-2 mt-2">
            <span className="px-2 py-0.5 rounded text-xs bg-gray-100 text-gray-700">{question.type}</span>
            <span className="px-2 py-0.5 rounded text-xs bg-indigo-100 text-indigo-700">{question.difficulty}</span>
            <span className="px-2 py-0.5 rounded text-xs bg-green-100 text-green-700">{question.points} pts</span>
          </div>
          {question.description && (
            <div className="mt-4 prose prose-sm max-w-none text-gray-700">{parse(question.description)}</div>
          )}
          {isCoding && question.inputFormat && (
            <div className="mt-4">
              <h2 className="text-sm font-semibold text-gray-600 mb-2">Input format</h2>
              <div className="prose prose-sm max-w-none text-gray-700">{parse(question.inputFormat)}</div>
            </div>
          )}
          {isCoding && question.outputFormat && (
            <div className="mt-4">
              <h2 className="text-sm font-semibold text-gray-600 mb-2">Output format</h2>
              <div className="prose prose-sm max-w-none text-gray-700">{parse(question.outputFormat)}</div>
            </div>
          )}
          {question.explanation && (
            <div className="mt-4">
              <h2 className="text-sm font-semibold text-gray-600 mb-2">Explanation</h2>
              <div className="prose prose-sm max-w-none text-gray-700">{parse(question.explanation)}</div>
            </div>
          )}
          {isCoding &&
            question.sampleIo?.some((p) => (p.input || '').trim() || (p.output || '').trim()) && (
              <div className="mt-4">
                <h2 className="text-sm font-semibold text-gray-600 mb-2">Sample input / output</h2>
                <div className="space-y-3">
                  {question.sampleIo
                    .filter((p) => (p.input || '').trim() || (p.output || '').trim())
                    .map((pair, i) => (
                      <div key={i} className="rounded-lg border border-gray-200 bg-gray-50 p-3 text-sm space-y-2">
                        <div>
                          <span className="font-semibold text-gray-600">Input</span>
                          <pre className="mt-1 font-mono text-gray-800 whitespace-pre-wrap break-all text-xs">{pair.input || '—'}</pre>
                        </div>
                        <div>
                          <span className="font-semibold text-gray-600">Output</span>
                          <pre className="mt-1 font-mono text-gray-800 whitespace-pre-wrap break-all text-xs">{pair.output || '—'}</pre>
                        </div>
                      </div>
                    ))}
                </div>
              </div>
            )}
        </div>

        {/* Teacher Attempt - Code Editor */}
        {isCoding && (
          <div className="p-6 border-t">
            <h3 className="text-sm font-semibold text-gray-700 mb-3">Attempt Question</h3>
            {question.languages?.length > 1 && (
              <div className="flex gap-2 mb-3">
                {question.languages.map((lang) => (
                  <button
                    key={lang}
                    onClick={() => {
                      setSelectedLanguage(lang);
                      const sc = question.starterCode?.find(s => s.language === lang);
                      setCode(sc?.code || '');
                    }}
                    className={`px-3 py-1 rounded text-sm font-medium ${selectedLanguage === lang ? 'bg-indigo-600 text-white' : 'bg-gray-200 text-gray-700 hover:bg-gray-300'}`}
                  >
                    {lang}
                  </button>
                ))}
              </div>
            )}
            <div className="border rounded-lg overflow-hidden">
              <CodeEditor value={code} onChange={setCode} language={selectedLanguage} height="400px" />
            </div>
            <div className="flex gap-2 mt-3">
              <button onClick={handleRunCode} disabled={testLoading} className="px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 disabled:opacity-50 font-medium">
                {testLoading ? 'Running...' : 'Run Tests'}
              </button>
              <button onClick={handleResetCode} className="px-4 py-2 bg-gray-200 text-gray-700 rounded-lg hover:bg-gray-300 font-medium">Reset Code</button>
            </div>
          </div>
        )}
      </div>

      {/* Test Results */}
      {testResults && (
        <div className={`rounded-xl border p-6 ${testResults.error ? 'bg-red-50 border-red-200' : 'bg-white border-gray-200'}`}>
          <h3 className="text-lg font-semibold mb-3">{testResults.error ? 'Error' : 'Test Results'}</h3>
          {testResults.error ? (
            <p className="text-red-700">{testResults.message}</p>
          ) : (
            <>
              <p className={`font-medium ${testResults.isCorrect ? 'text-green-700' : 'text-amber-700'}`}>
                {testResults.isCorrect ? `All ${testResults.totalTestCases} test cases passed` : `${testResults.passedTestCases}/${testResults.totalTestCases} test cases passed`}
              </p>
              {testResults.testResults?.length > 0 && (
                <div className="mt-4 space-y-2">
                  {testResults.testResults.map((tr, i) => (
                    <div key={i} className={`p-3 rounded text-sm ${tr.passed ? 'bg-green-50' : 'bg-red-50'}`}>
                      <span className="font-medium">{tr.passed ? '✓' : '✗'} Test {i + 1}</span>
                      {tr.isTLE && <span className="ml-2 px-1.5 py-0.5 bg-amber-200 text-amber-900 rounded text-xs">TLE</span>}
                      {tr.isMLE && <span className="ml-2 px-1.5 py-0.5 bg-amber-200 text-amber-900 rounded text-xs">MLE</span>}
                    </div>
                  ))}
                </div>
              )}
              {testResults.explanation && <div className="mt-4 p-3 bg-gray-50 rounded prose prose-sm">{parse(testResults.explanation)}</div>}
            </>
          )}
        </div>
      )}
    </div>
  );
};

export default TeacherQuestionDetail;
