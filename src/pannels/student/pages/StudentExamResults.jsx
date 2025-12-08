import React, { useEffect, useState, useMemo } from 'react';
import { useParams, useNavigate, useLocation } from 'react-router-dom';
import { getStudentExamResults } from '../../../common/services/api';

const StudentExamResults = () => {
  const { examId } = useParams();
  const navigate = useNavigate();
  const location = useLocation();
  const classIdFromState = location.state?.classId;

  const [exam, setExam] = useState(null);
  const [attempt, setAttempt] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [selectedQuestion, setSelectedQuestion] = useState(null);

  useEffect(() => {
    const fetchData = async () => {
      try {
        setLoading(true);
        setError(null);
        const resultsData = await getStudentExamResults(examId);

        setExam(resultsData.data.exam);
        setAttempt(resultsData.data.attempt);
      } catch (err) {
        // Extract error message - handle both Error objects and axios errors
        const errorMessage = err.response?.data?.error || err.message || 'Failed to load exam results';
        setError(errorMessage);
        // Only log detailed error in development
        if (process.env.NODE_ENV === 'development') {
          console.error('[ExamResults] Error fetching data:', err);
        }
      } finally {
        setLoading(false);
      }
    };

    if (examId) {
      fetchData();
    }
  }, [examId]);

  const questionAnswerMap = useMemo(() => {
    const map = new Map();
    if (attempt?.answers) {
      attempt.answers.forEach((ans) => {
        if (ans.questionId) {
          const questionIdStr = ans.questionId.toString ? ans.questionId.toString() : String(ans.questionId);
          map.set(questionIdStr, ans);
        }
      });
    }
    return map;
  }, [attempt?.answers]);

  const totalCorrect = useMemo(() => {
    if (!attempt?.answers) return 0;
    return attempt.answers.filter((ans) => ans.isCorrect).length;
  }, [attempt?.answers]);

  const totalQuestions = useMemo(() => {
    return exam?.questions?.length || 0;
  }, [exam?.questions]);

  const totalScore = attempt?.totalScore || 0;
  const maxScore = attempt?.maxScore || 0;

  if (loading) {
    return (
      <div className="flex h-screen items-center justify-center" style={{ backgroundColor: 'var(--background-content)' }}>
        <div className="text-lg" style={{ color: 'var(--text-secondary)' }}>Loading exam results...</div>
      </div>
    );
  }

  if (error) {
    const isNotReleased = error.toLowerCase().includes('not released') || error.toLowerCase().includes('not available');
    
    return (
      <div className="min-h-screen flex flex-col items-center justify-center p-6" style={{ backgroundColor: 'var(--background-content)' }}>
        <div className="w-full max-w-2xl">
          <div className="rounded-xl border-2 border-yellow-200 bg-gradient-to-br from-yellow-50 to-orange-50 p-8 shadow-xl">
            <div className="flex flex-col items-center text-center space-y-4">
              <div className="w-20 h-20 rounded-full bg-yellow-100 flex items-center justify-center">
                <svg className="w-12 h-12 text-yellow-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
              </div>
              
              <div className="space-y-2">
                <h2 className="text-2xl font-bold text-gray-900">
                  {isNotReleased ? 'Results Not Released Yet' : 'Unable to Load Results'}
                </h2>
                <div className="h-1 w-24 bg-yellow-400 mx-auto rounded"></div>
              </div>
              
              <div className="bg-white rounded-lg p-6 shadow-sm max-w-lg w-full">
                <p className="text-base text-gray-700 leading-relaxed">
                  {isNotReleased ? (
                    <>
                      The exam results have not been released by your instructor yet. 
                      <br className="hidden sm:block" />
                      <span className="block mt-2 text-sm text-gray-600">
                        Results will be available once your instructor releases them. Please check back later or contact your instructor for more information.
                      </span>
                    </>
                  ) : (
                    <span className="text-gray-700">{error}</span>
                  )}
                </p>
              </div>

              <div className="flex flex-col sm:flex-row gap-3 w-full sm:w-auto pt-4">
                <button
                  onClick={() => navigate('/student/exams')}
                  className="flex-1 sm:flex-none flex items-center justify-center gap-2 rounded-lg px-6 py-3 text-sm font-semibold text-white bg-blue-600 hover:bg-blue-700 transition-all shadow-md hover:shadow-lg"
                >
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" />
                  </svg>
                  Back to Exams
                </button>
                {isNotReleased && (
                  <button
                    onClick={() => window.location.reload()}
                    className="flex-1 sm:flex-none flex items-center justify-center gap-2 rounded-lg px-6 py-3 text-sm font-semibold text-gray-700 bg-white border-2 border-gray-300 hover:bg-gray-50 transition-all shadow-sm hover:shadow"
                  >
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                    </svg>
                    Refresh Page
                  </button>
                )}
              </div>

              {isNotReleased && (
                <div className="mt-4 pt-4 border-t border-yellow-200 w-full">
                  <p className="text-xs text-gray-500">
                    <svg className="w-4 h-4 inline mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                    Tip: Results are typically released after the exam period ends or when your instructor manually releases them.
                  </p>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6 p-6" style={{ backgroundColor: 'var(--background-content)', minHeight: '100vh' }}>
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold" style={{ color: 'var(--text-primary)' }}>{exam?.title}</h1>
          <p className="mt-1 text-sm" style={{ color: 'var(--text-secondary)' }}>{exam?.description}</p>
        </div>
        <button
          onClick={() => navigate('/student/exams')}
          className="rounded-md px-4 py-2 text-sm font-semibold text-white hover:opacity-90"
          style={{ backgroundColor: 'var(--text-secondary)' }}
        >
          Back to Exams
        </button>
      </div>

      {/* Overall Score Summary */}
      <div className="rounded-xl border p-6 shadow-sm" style={{ backgroundColor: 'var(--card-white)', borderColor: 'var(--card-border)' }}>
        <h2 className="mb-4 text-lg font-semibold" style={{ color: 'var(--text-primary)' }}>Overall Score</h2>
        <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
          <div className="rounded-lg border p-4" style={{ backgroundColor: 'var(--background-light)', borderColor: 'var(--card-border)' }}>
            <div className="text-sm" style={{ color: 'var(--text-secondary)' }}>Correct Answers</div>
            <div className="mt-1 text-2xl font-bold text-green-600">
              {totalCorrect} / {totalQuestions}
            </div>
          </div>
          <div className="rounded-lg border p-4" style={{ backgroundColor: 'var(--background-light)', borderColor: 'var(--card-border)' }}>
            <div className="text-sm" style={{ color: 'var(--text-secondary)' }}>Total Score</div>
            <div className="mt-1 text-2xl font-bold text-blue-600">
              {totalScore} / {maxScore}
            </div>
          </div>
          <div className="rounded-lg border p-4" style={{ backgroundColor: 'var(--background-light)', borderColor: 'var(--card-border)' }}>
            <div className="text-sm" style={{ color: 'var(--text-secondary)' }}>Status</div>
            <div className="mt-1 text-sm font-semibold" style={{ color: 'var(--text-primary)' }}>
              {attempt?.status === 'auto_submitted' ? 'Auto Submitted' : 'Submitted'}
            </div>
          </div>
        </div>
      </div>

      {/* Question-wise Breakdown */}
      <div className="rounded-xl border shadow-sm" style={{ backgroundColor: 'var(--card-white)', borderColor: 'var(--card-border)' }}>
        <div className="border-b px-6 py-4" style={{ backgroundColor: 'var(--background-light)', borderColor: 'var(--card-border)' }}>
          <h2 className="text-lg font-semibold" style={{ color: 'var(--text-primary)' }}>Question Review</h2>
        </div>
        <div className="divide-y" style={{ borderColor: 'var(--card-border)' }}>
          {exam?.questions?.map((qItem, idx) => {
            const question = qItem.questionId;
            if (!question) return null;
            
            // Handle both ObjectId and string/question object
            const questionId = question._id?.toString() || (typeof question === 'object' && question.toString ? question.toString() : String(question));
            const answerData = questionAnswerMap.get(questionId);
            const isCorrect = answerData?.isCorrect || false;
            const score = answerData?.score || 0;
            const maxScoreForQ = answerData?.maxScore || qItem.points || 0;
            
            // Check if question is a populated object or just an ID
            const isQuestionObject = typeof question === 'object' && question !== null && 'title' in question;

            return (
              <div
                key={questionId || idx}
                className="p-6"
                style={{ backgroundColor: isCorrect ? 'rgba(34, 197, 94, 0.1)' : 'rgba(239, 68, 68, 0.1)' }}
              >
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <div className="mb-2 flex items-center gap-3">
                      <span className="text-lg font-semibold" style={{ color: 'var(--text-primary)' }}>Question {idx + 1}</span>
                      <span
                        className="rounded-full px-3 py-1 text-xs font-semibold"
                        style={{
                          backgroundColor: isCorrect ? 'rgba(34, 197, 94, 0.2)' : 'rgba(239, 68, 68, 0.2)',
                          color: isCorrect ? '#16a34a' : '#dc2626'
                        }}
                      >
                        {isCorrect ? 'Correct' : 'Incorrect'}
                      </span>
                      <span className="text-sm" style={{ color: 'var(--text-secondary)' }}>
                        Score: {score} / {maxScoreForQ}
                      </span>
                    </div>
                    {isQuestionObject && question.title && (
                      <div
                        className="mb-4 text-sm"
                        style={{ color: 'var(--text-primary)' }}
                        dangerouslySetInnerHTML={{ __html: question.title }}
                      />
                    )}
                    {isQuestionObject && question.description && (
                      <div
                        className="mb-4 text-sm"
                        style={{ color: 'var(--text-secondary)' }}
                        dangerouslySetInnerHTML={{ __html: question.description }}
                      />
                    )}
                    {!isQuestionObject && (
                      <div className="mb-4 text-sm" style={{ color: 'var(--text-primary)' }}>Question {idx + 1}</div>
                    )}
                    <button
                      onClick={() => setSelectedQuestion(selectedQuestion === questionId ? null : questionId)}
                      className="rounded-md px-4 py-2 text-sm font-semibold text-white hover:opacity-90"
                      style={{ backgroundColor: 'var(--primary-blue)' }}
                    >
                      {selectedQuestion === questionId ? 'Hide Details' : 'View Question & Your Answer'}
                    </button>
                  </div>
                </div>

                {selectedQuestion === questionId && (
                  <div className="mt-4 space-y-4 rounded-lg border p-4" style={{ backgroundColor: 'var(--card-white)', borderColor: 'var(--card-border)' }}>
                    <div>
                      <h3 className="mb-2 text-sm font-semibold" style={{ color: 'var(--text-primary)' }}>Your Answer:</h3>
                      {answerData?.submission ? (
                        <div className="rounded-md p-3 text-sm" style={{ backgroundColor: 'var(--background-light)' }}>
                          <SubmissionDisplay
                            submission={answerData.submission}
                            questionType={isQuestionObject ? (question?.type || 'unknown') : 'unknown'}
                            question={isQuestionObject ? question : null}
                          />
                        </div>
                      ) : answerData?.submissionId ? (
                        <div className="text-sm" style={{ color: 'var(--text-secondary)' }}>Submission data loading...</div>
                      ) : (
                        <div className="text-sm" style={{ color: 'var(--text-secondary)' }}>No answer submitted</div>
                      )}
                    </div>
                    {!isCorrect && isQuestionObject && (
                      <div>
                        <h3 className="mb-2 text-sm font-semibold" style={{ color: 'var(--text-primary)' }}>Correct Answer:</h3>
                        <div className="rounded-md p-3 text-sm" style={{ backgroundColor: 'rgba(34, 197, 94, 0.1)' }}>
                          {question.type === 'singleCorrectMcq' || question.type === 'multipleCorrectMcq' ? (
                            Array.isArray(question.correctOptions) ? (
                              <div>
                                {question.correctOptions.map((opt, i) => (
                                  <div key={i} style={{ color: 'var(--text-primary)' }}>
                                    Option {opt + 1}: <span dangerouslySetInnerHTML={{ __html: question.options?.[opt] || `Option ${opt + 1}` }} />
                                  </div>
                                ))}
                              </div>
                            ) : (
                              <div style={{ color: 'var(--text-primary)' }}>
                                Option {question.correctOptions + 1}: <span dangerouslySetInnerHTML={{ __html: question.options?.[question.correctOptions] || `Option ${question.correctOptions + 1}` }} />
                              </div>
                            )
                          ) : question.correctAnswer ? (
                            <div className="whitespace-pre-wrap" style={{ color: 'var(--text-primary)' }}>{question.correctAnswer}</div>
                          ) : (
                            <div style={{ color: 'var(--text-secondary)' }}>Correct answer not available</div>
                          )}
                        </div>
                      </div>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
};

// Component to display submission details
const SubmissionDisplay = ({ submission, questionType, question }) => {
  if (!submission) {
    return <div className="text-sm" style={{ color: 'var(--text-secondary)' }}>No submission data available</div>;
  }

  return (
    <div style={{ color: 'var(--text-primary)' }}>
      {['coding', 'fillInTheBlanksCoding', 'codingWithDriver'].includes(questionType) ? (
        <div>
          <div className="mb-2 flex items-center justify-between">
            <div className="font-semibold" style={{ color: 'var(--text-primary)' }}>Code Submission</div>
            {submission.passedTestCases !== undefined && submission.totalTestCases !== undefined && (
              <div className="text-sm" style={{ color: 'var(--text-secondary)' }}>
                Test Cases: {submission.passedTestCases} / {submission.totalTestCases} passed
              </div>
            )}
          </div>
          <div className="mt-2 rounded p-3 text-xs font-mono whitespace-pre-wrap overflow-x-auto" style={{ backgroundColor: '#1e293b', color: '#e2e8f0' }}>
            {submission.answer || 'No code submitted'}
          </div>
          {submission.language && (
            <div className="mt-2 text-xs" style={{ color: 'var(--text-secondary)' }}>Language: {submission.language}</div>
          )}
        </div>
      ) : questionType === 'fillInTheBlanks' ? (
        <div>
          <div className="font-semibold" style={{ color: 'var(--text-primary)' }}>Text Answer</div>
          <div className="mt-2 rounded p-3 text-sm" style={{ backgroundColor: 'var(--background-light)' }}>{submission.answer || 'No answer submitted'}</div>
        </div>
      ) : questionType === 'singleCorrectMcq' || questionType === 'multipleCorrectMcq' ? (
        <div>
          <div className="font-semibold" style={{ color: 'var(--text-primary)' }}>Selected Options</div>
          <div className="mt-2 space-y-1">
            {Array.isArray(submission.answer) ? (
              submission.answer.map((optIdx, i) => (
                <div key={i} className="rounded p-2 text-sm" style={{ backgroundColor: 'var(--background-light)' }}>
                  Option {optIdx + 1}: {question?.options?.[optIdx] || `Option ${optIdx + 1}`}
                </div>
              ))
            ) : (
              <div className="rounded p-2 text-sm" style={{ backgroundColor: 'var(--background-light)' }}>
                Option {submission.answer + 1}: {question?.options?.[submission.answer] || `Option ${submission.answer + 1}`}
              </div>
            )}
          </div>
        </div>
      ) : (
        <div>
          <div className="font-semibold" style={{ color: 'var(--text-primary)' }}>Answer</div>
          <div className="mt-2 rounded p-3 text-sm" style={{ backgroundColor: 'var(--background-light)' }}>{String(submission.answer) || 'No answer submitted'}</div>
        </div>
      )}
    </div>
  );
};

export default StudentExamResults;

