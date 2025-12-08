import React, { useState, useEffect } from 'react';
import { useParams, useNavigate, useLocation } from 'react-router-dom';
import { getExamReport, releaseExamScores } from '../../../common/services/api';

const ExamReport = () => {
  const { examId, classId } = useParams();
  const navigate = useNavigate();
  const location = useLocation();
  
  // Detect if admin or teacher based on URL path
  const isAdmin = location.pathname.includes('/admin/');
  const basePath = isAdmin ? '/admin' : '/teacher';
  
  const [exam, setExam] = useState(null);
  const [attempts, setAttempts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    const fetchReport = async () => {
      try {
        setLoading(true);
        const response = await getExamReport(examId);
        setExam(response.data.exam);
        setAttempts(response.data.attempts || []);
        setLoading(false);
      } catch (err) {
        console.error('Failed to fetch report:', err);
        setError(err.response?.data?.error || 'Failed to fetch report');
        setLoading(false);
      }
    };

    fetchReport();
  }, [examId]);

  const handleReleaseScores = async () => {
    if (!window.confirm('Are you sure you want to release scores to all students?')) return;
    
    try {
      await releaseExamScores(examId);
      alert('Scores released successfully');
      // Refresh report
      const response = await getExamReport(examId);
      setExam(response.data.exam);
    } catch (err) {
      alert(err.response?.data?.error || 'Failed to release scores');
    }
  };

  const handleExportCSV = () => {
    // Create comprehensive CSV content with per-question breakdown
    const basicHeaders = ['Student Name', 'Email', 'Status', 'Total Score', 'Max Score', 'Percentage', 'Violations'];
    const questionHeaders = exam?.questions?.map((q, idx) => {
      const questionId = typeof q.questionId === 'object' ? q.questionId._id || q.questionId : q.questionId;
      const questionTitle = typeof q.questionId === 'object' && q.questionId.title
        ? q.questionId.title
        : `Q${idx + 1}`;
      return [`Q${idx + 1} Score`, `Q${idx + 1} Max`, `Q${idx + 1} Status`];
    }).flat() || [];
    
    const headers = [...basicHeaders, ...questionHeaders];
    
    const rows = attempts.map(attempt => {
      const percentage = attempt.maxScore > 0
        ? Math.round((attempt.totalScore / attempt.maxScore) * 100)
        : 0;
      
      const basicRow = [
        attempt.studentId?.name || 'Unknown',
        attempt.studentId?.email || '',
        attempt.status,
        attempt.totalScore || 0,
        attempt.maxScore || 0,
        `${percentage}%`,
        attempt.violations?.length || 0
      ];

      // Add per-question data
      const questionData = exam?.questions?.map((q) => {
        const questionId = typeof q.questionId === 'object' ? q.questionId._id || q.questionId : q.questionId;
        const answer = attempt.answers?.find(a => {
          const aQId = typeof a.questionId === 'object' ? a.questionId._id || a.questionId : a.questionId;
          return aQId && questionId && aQId.toString() === questionId.toString();
        });
        return [
          answer?.score || 0,
          answer?.maxScore || q.points || 0,
          answer?.isCorrect ? 'Correct' : (answer ? 'Incorrect' : 'Not Attempted')
        ];
      }).flat() || [];

      return [...basicRow, ...questionData];
    });

    const csvContent = [
      headers.join(','),
      ...rows.map(row => row.map(cell => `"${String(cell).replace(/"/g, '""')}"`).join(','))
    ].join('\n');

    // Download CSV
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    const url = URL.createObjectURL(blob);
    link.setAttribute('href', url);
    link.setAttribute('download', `${exam?.title || 'exam'}_detailed_report.csv`);
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-xl">Loading report...</div>
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

  const averageScore = attempts.length > 0
    ? attempts.reduce((sum, a) => sum + (a.totalScore || 0), 0) / attempts.length
    : 0;

  const maxScore = exam?.questions?.reduce((sum, q) => sum + (q.points || 0), 0) || 0;

  // Calculate per-question statistics
  const questionStats = exam?.questions?.map((question, idx) => {
    const questionId = typeof question.questionId === 'object' 
      ? question.questionId._id || question.questionId 
      : question.questionId;
    
    const questionTitle = typeof question.questionId === 'object' && question.questionId.title
      ? question.questionId.title
      : `Question ${idx + 1}`;

    const questionAnswers = attempts
      .flatMap(attempt => attempt.answers || [])
      .filter(answer => {
        const answerQId = typeof answer.questionId === 'object' 
          ? answer.questionId._id || answer.questionId 
          : answer.questionId;
        return answerQId && questionId && answerQId.toString() === questionId.toString();
      });

    const totalAttempts = questionAnswers.length;
    const correctAttempts = questionAnswers.filter(a => a.isCorrect).length;
    const averageScore = totalAttempts > 0
      ? questionAnswers.reduce((sum, a) => sum + (a.score || 0), 0) / totalAttempts
      : 0;
    const correctRate = totalAttempts > 0 ? (correctAttempts / totalAttempts) * 100 : 0;

    return {
      questionId: questionId,
      questionTitle: questionTitle,
      points: question.points || 0,
      totalAttempts,
      correctAttempts,
      averageScore: averageScore.toFixed(2),
      correctRate: correctRate.toFixed(1),
      maxScore: question.points || 0
    };
  }) || [];

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900 py-8">
      <div className="container mx-auto px-4">
        <div className="mb-6">
          <button
            onClick={() => {
              if (classId) {
                navigate(`${basePath}/classes/${classId}/exams`);
              } else {
                navigate(-1);
              }
            }}
            className="text-blue-500 hover:underline mb-4"
          >
            ← Back
          </button>
          <div className="flex justify-between items-center">
            <h1 className="text-3xl font-bold">{exam?.title} - Report</h1>
            <div className="flex gap-4">
              <button
                onClick={handleExportCSV}
                className="px-4 py-2 bg-blue-500 text-white rounded hover:bg-blue-600"
              >
                Export CSV
              </button>
              {exam?.scoring?.releaseStatus !== 'released' && (
                <button
                  onClick={handleReleaseScores}
                  className="px-4 py-2 bg-green-500 text-white rounded hover:bg-green-600"
                >
                  Release Scores
                </button>
              )}
            </div>
          </div>
        </div>

        {/* Statistics */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-8">
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6">
            <div className="text-2xl font-bold">{attempts.length}</div>
            <div className="text-sm text-gray-600 dark:text-gray-400">Total Attempts</div>
          </div>
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6">
            <div className="text-2xl font-bold">{averageScore.toFixed(2)}</div>
            <div className="text-sm text-gray-600 dark:text-gray-400">Average Score</div>
          </div>
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6">
            <div className="text-2xl font-bold">{maxScore}</div>
            <div className="text-sm text-gray-600 dark:text-gray-400">Maximum Score</div>
          </div>
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6">
            <div className="text-2xl font-bold">
              {attempts.filter(a => a.status === 'submitted' || a.status === 'auto_submitted').length}
            </div>
            <div className="text-sm text-gray-600 dark:text-gray-400">Completed</div>
          </div>
        </div>

        {/* Per-Question Statistics */}
        {questionStats.length > 0 && (
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow mb-8">
            <div className="p-6 border-b border-gray-200 dark:border-gray-700">
              <h2 className="text-2xl font-bold">Per-Question Statistics</h2>
              <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">
                Performance breakdown for each question
              </p>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-gray-100 dark:bg-gray-700">
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase">Question</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase">Points</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase">Total Attempts</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase">Correct</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase">Correct Rate</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase">Avg Score</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
                  {questionStats.map((stat, idx) => (
                    <tr key={stat.questionId || idx} className="hover:bg-gray-50 dark:hover:bg-gray-700">
                      <td className="px-6 py-4">
                        <div className="text-sm font-medium">Q{idx + 1}: {stat.questionTitle}</div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm">{stat.points}</td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm">{stat.totalAttempts}</td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm">
                        {stat.correctAttempts} / {stat.totalAttempts}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm">
                        <div className="flex items-center">
                          <span className="mr-2">{stat.correctRate}%</span>
                          <div className="flex-1 bg-gray-200 dark:bg-gray-700 rounded-full h-2 max-w-[100px]">
                            <div
                              className={`h-2 rounded-full ${
                                parseFloat(stat.correctRate) >= 70
                                  ? 'bg-green-500'
                                  : parseFloat(stat.correctRate) >= 50
                                  ? 'bg-yellow-500'
                                  : 'bg-red-500'
                              }`}
                              style={{ width: `${stat.correctRate}%` }}
                            />
                          </div>
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm">
                        {stat.averageScore} / {stat.maxScore}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* Attempts Table */}
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-gray-100 dark:bg-gray-700">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase">Student</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase">Status</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase">Score</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase">Percentage</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase">Violations</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
                {attempts.map((attempt) => {
                  const percentage = attempt.maxScore > 0
                    ? Math.round((attempt.totalScore / attempt.maxScore) * 100)
                    : 0;
                  
                  return (
                    <tr key={attempt._id} className="hover:bg-gray-50 dark:hover:bg-gray-700">
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="text-sm font-medium">
                          {attempt.studentId?.name || 'Unknown'}
                        </div>
                        <div className="text-sm text-gray-500 dark:text-gray-400">
                          {attempt.studentId?.email || ''}
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <span className={`px-2 py-1 rounded text-xs ${
                          attempt.status === 'submitted' || attempt.status === 'auto_submitted'
                            ? 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200'
                            : attempt.status === 'terminated'
                            ? 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200'
                            : 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200'
                        }`}>
                          {attempt.status}
                        </span>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm">
                        {attempt.totalScore} / {attempt.maxScore}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm">
                        {percentage}%
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm">
                        {attempt.violations?.length || 0}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm">
                        <button
                          onClick={() => {
                            // TODO: Implement attempt details view
                            alert('Attempt details view coming soon');
                          }}
                          className="text-blue-500 hover:underline"
                        >
                          View Details
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
};

export default ExamReport;

