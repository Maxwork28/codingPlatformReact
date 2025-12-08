import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { getStudentExamResults } from '../../../common/services/api';
import parse from 'html-react-parser';

const ExamResults = () => {
  const { examId } = useParams();
  const navigate = useNavigate();
  
  const [exam, setExam] = useState(null);
  const [attempt, setAttempt] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    const fetchResults = async () => {
      try {
        setLoading(true);
        const response = await getStudentExamResults(examId);
        setExam(response.data.exam);
        setAttempt(response.data.attempt);
        setLoading(false);
      } catch (err) {
        console.error('Failed to fetch results:', err);
        setError(err.response?.data?.error || 'Failed to fetch results');
        setLoading(false);
      }
    };

    fetchResults();
  }, [examId]);

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-xl">Loading results...</div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-xl text-red-500">{error}</div>
      </div>
    );
  }

  if (!exam || !attempt) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-xl text-red-500">No results found</div>
      </div>
    );
  }

  // Check if scores are released
  const scoresReleased = exam.scoring?.releaseStatus === 'released' || exam.scoring?.immediateScoreRelease;
  
  if (!scoresReleased) {
    return (
      <div className="min-h-screen bg-gray-50 dark:bg-gray-900 py-8">
        <div className="container mx-auto px-4">
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow-lg p-8 text-center">
            <h1 className="text-3xl font-bold mb-2">{exam.title}</h1>
            <p className="text-gray-600 dark:text-gray-400 mb-4">{exam.description}</p>
            <div className="bg-yellow-50 dark:bg-yellow-900 border border-yellow-200 dark:border-yellow-700 rounded-lg p-6">
              <p className="text-lg font-semibold text-yellow-800 dark:text-yellow-200">
                Results are not available yet. Please wait for the administrator to release the scores.
              </p>
            </div>
            <div className="mt-8">
              <button
                onClick={() => navigate('/student')}
                className="px-6 py-2 bg-blue-500 text-white rounded hover:bg-blue-600"
              >
                Back to Dashboard
              </button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  const percentage = attempt.maxScore > 0 
    ? Math.round((attempt.totalScore / attempt.maxScore) * 100) 
    : 0;

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900 py-8">
      <div className="container mx-auto px-4">
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow-lg p-8">
          <div className="text-center mb-8">
            <h1 className="text-3xl font-bold mb-2">{exam.title}</h1>
            <p className="text-gray-600 dark:text-gray-400">{exam.description}</p>
          </div>

          {/* Score Summary */}
          <div className="bg-gradient-to-r from-blue-500 to-purple-500 rounded-lg p-6 text-white mb-8">
            <div className="grid grid-cols-3 gap-4 text-center">
              <div>
                <div className="text-2xl font-bold">{attempt.totalScore}</div>
                <div className="text-sm opacity-90">Your Score</div>
              </div>
              <div>
                <div className="text-2xl font-bold">{attempt.maxScore}</div>
                <div className="text-sm opacity-90">Total Score</div>
              </div>
              <div>
                <div className="text-2xl font-bold">{percentage}%</div>
                <div className="text-sm opacity-90">Percentage</div>
              </div>
            </div>
          </div>

          {/* Exam Details */}
          <div className="mb-8">
            <h2 className="text-xl font-bold mb-4">Exam Details</h2>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <span className="font-semibold">Status:</span>{' '}
                <span className={attempt.status === 'submitted' ? 'text-green-500' : 'text-yellow-500'}>
                  {attempt.status === 'submitted' ? 'Submitted' : attempt.status === 'auto_submitted' ? 'Auto-Submitted' : 'Terminated'}
                </span>
              </div>
              <div>
                <span className="font-semibold">Started At:</span>{' '}
                {new Date(attempt.startedAt).toLocaleString()}
              </div>
              <div>
                <span className="font-semibold">Submitted At:</span>{' '}
                {attempt.submittedAt ? new Date(attempt.submittedAt).toLocaleString() : 'N/A'}
              </div>
              {attempt.violations && attempt.violations.length > 0 && (
                <div>
                  <span className="font-semibold">Violations:</span>{' '}
                  <span className="text-red-500">{attempt.violations.length}</span>
                </div>
              )}
            </div>
          </div>

          {/* Questions and Answers */}
          <div>
            <h2 className="text-xl font-bold mb-4">Question-wise Results</h2>
            <div className="space-y-4">
              {attempt.answers?.map((answer, idx) => {
                // Handle both populated and non-populated question structures
                const questionMeta = exam.questions.find(q => String(q.questionId || q._id) === String(answer.questionId));
                const question = questionMeta?.questionId || questionMeta;
                const questionTitle = question?.title || questionMeta?.title || `Question ${idx + 1}`;
                const questionType = question?.type || questionMeta?.type;

                return (
                  <div
                    key={answer.questionId}
                    className={`border rounded-lg p-4 ${
                      answer.isCorrect ? 'bg-green-50 dark:bg-green-900' : 'bg-red-50 dark:bg-red-900'
                    }`}
                  >
                    <div className="flex justify-between items-start mb-2">
                      <h3 className="text-lg font-semibold">
                        Question {idx + 1}: {questionTitle}
                      </h3>
                      <div className="text-right">
                        <div className={`text-lg font-bold ${
                          answer.isCorrect ? 'text-green-600' : 'text-red-600'
                        }`}>
                          {answer.score} / {answer.maxScore}
                        </div>
                        {answer.isCorrect ? (
                          <span className="text-green-600">✓ Correct</span>
                        ) : (
                          <span className="text-red-600">✗ Incorrect</span>
                        )}
                      </div>
                    </div>

                    {question && question.description && (
                      <div className="mt-2 mb-4">
                        <div className="prose dark:prose-invert max-w-none text-sm">
                          {parse(question.description)}
                        </div>
                      </div>
                    )}

                    {answer.submission && (
                      <div className="mt-4 space-y-2">
                        {answer.submission.language && (
                          <div>
                            <span className="font-semibold">Language:</span> {answer.submission.language}
                          </div>
                        )}
                        {answer.submission.passedTestCases !== undefined && (
                          <div>
                            <span className="font-semibold">Test Cases:</span>{' '}
                            {answer.submission.passedTestCases} / {answer.submission.totalTestCases} passed
                          </div>
                        )}
                        {answer.submission.answer && (
                          <div className="mt-2">
                            <span className="font-semibold">Your Answer:</span>
                            {questionType === 'coding' || questionType === 'fillInTheBlanksCoding' || questionType === 'codingWithDriver' ? (
                              <pre className="mt-1 p-2 bg-gray-100 dark:bg-gray-700 rounded text-sm overflow-x-auto">
                                {typeof answer.submission.answer === 'string' 
                                  ? answer.submission.answer 
                                  : JSON.stringify(answer.submission.answer, null, 2)}
                              </pre>
                            ) : questionType === 'singleCorrectMcq' || questionType === 'multipleCorrectMcq' ? (
                              <div className="mt-1 p-2 bg-gray-100 dark:bg-gray-700 rounded text-sm">
                                {Array.isArray(answer.submission.answer) 
                                  ? answer.submission.answer.join(', ')
                                  : String(answer.submission.answer)}
                              </div>
                            ) : (
                              <div className="mt-1 p-2 bg-gray-100 dark:bg-gray-700 rounded text-sm">
                                {String(answer.submission.answer)}
                              </div>
                            )}
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>

          <div className="mt-8 text-center">
            <button
              onClick={() => navigate('/student')}
              className="px-6 py-2 bg-blue-500 text-white rounded hover:bg-blue-600"
            >
              Back to Dashboard
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default ExamResults;

