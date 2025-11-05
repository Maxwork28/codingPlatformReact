import React, { useEffect, useState, useCallback } from 'react';
import { useParams, Link } from 'react-router-dom';
import { useSelector } from 'react-redux';
import { Tab, Menu, Transition, Dialog, Disclosure } from '@headlessui/react';
import { format } from 'date-fns';
import { Bar, Pie } from 'react-chartjs-2';
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  BarElement,
  Title,
  Tooltip,
  Legend,
  ArcElement,
} from 'chart.js';
import {
  getClassDetails,
  getQuestionsByClass,
  getAllQuestions,
  assignQuestionToClass,
  searchQuestions,
  createAssignment,
  getAssignments,
  deleteAssignment,
  getParticipantStats,
  getRunSubmitStats,
  searchLeaderboard,
  blockUser,
  blockAllUsers,
  viewSubmissionCode,
  getQuestionPerspectiveReport,
} from '../../../common/services/api';
import TeacherQuestionCard from '../components/TeacherQuestionCard';

// Register Chart.js components
ChartJS.register(CategoryScale, LinearScale, BarElement, Title, Tooltip, Legend, ArcElement);

const TeacherClassView = () => {
  const { classId } = useParams();
  const { user } = useSelector((state) => state.auth);

  // State variables
  const [classDetails, setClassDetails] = useState(null);
  const [participantStats, setParticipantStats] = useState(null);
  const [runSubmitStats, setRunSubmitStats] = useState(null);
  const [assignments, setAssignments] = useState([]);
  const [leaderboard, setLeaderboard] = useState([]);
  const [questions, setQuestions] = useState([]);
  const [availableQuestions, setAvailableQuestions] = useState([]);
  const [filteredQuestions, setFilteredQuestions] = useState([]);
  const [submissionCode, setSubmissionCode] = useState('');
  const [questionReport, setQuestionReport] = useState(null);
  const [loading, setLoading] = useState(true);
  const [reportLoading, setReportLoading] = useState(false);
  const [error, setError] = useState('');

  // Assignment form
  const [assignmentForm, setAssignmentForm] = useState({
    questionId: '',
    maxPoints: '',
    dueDate: '',
  });
  const [assignmentLoading, setAssignmentLoading] = useState(false);
  const [assignmentError, setAssignmentError] = useState('');
  const [assignmentMessage, setAssignmentMessage] = useState('');

  // Question search
  const [questionSearchKeyword, setQuestionSearchKeyword] = useState('');
  const [selectedQuestionId, setSelectedQuestionId] = useState('');

  // Other forms
  const [questionIdInput, setQuestionIdInput] = useState('');
  const [leaderboardFilters, setLeaderboardFilters] = useState({
    studentName: '',
    activityStatus: '',
    minCorrectAttempts: '',
    maxAttempts: '',
  });
  const [submissionId, setSubmissionId] = useState('');
  const [blockStudentId, setBlockStudentId] = useState('');
  const [blockAll, setBlockAll] = useState(false);
  const [formErrors, setFormErrors] = useState({});

  // Student modal
  const [selectedStudent, setSelectedStudent] = useState(null);
  const [isModalOpen, setIsModalOpen] = useState(false);

  // Search and pagination for assignments
  const [assignmentSearch, setAssignmentSearch] = useState('');
  const [assignmentCurrentPage, setAssignmentCurrentPage] = useState(1);
  const [assignmentItemsPerPage] = useState(5);

  // Search and pagination for students
  const [studentSearch, setStudentSearch] = useState('');
  const [studentCurrentPage, setStudentCurrentPage] = useState(1);
  const [studentItemsPerPage] = useState(10);

  // Helper function
  const stripHtml = (html) => {
    if (!html || typeof html !== 'string') return '';
    const div = document.createElement('div');
    div.innerHTML = html;
    return div.textContent || div.innerText || '';
  };

  // Filter assignments based on search
  const filteredAssignments =
    assignmentSearch === ''
      ? assignments
      : assignments.filter((assignment) =>
          stripHtml(assignment.questionId?.title || '')
            .toLowerCase()
            .includes(assignmentSearch.toLowerCase())
        );

  const assignmentIndexOfLastItem = assignmentCurrentPage * assignmentItemsPerPage;
  const assignmentIndexOfFirstItem = assignmentIndexOfLastItem - assignmentItemsPerPage;
  const currentAssignments = filteredAssignments.slice(
    assignmentIndexOfFirstItem,
    assignmentIndexOfLastItem
  );
  const assignmentTotalPages = Math.ceil(filteredAssignments.length / assignmentItemsPerPage);

  // Filter students based on search
  const filteredStudents =
    studentSearch === ''
      ? leaderboard
      : leaderboard.filter((studentData) => {
          const studentInfo = studentData.studentId || {};
          const searchLower = studentSearch.toLowerCase();
          return (
            (studentInfo.name || '').toLowerCase().includes(searchLower) ||
            (studentInfo.email || '').toLowerCase().includes(searchLower) ||
            (studentInfo._id || '').toLowerCase().includes(searchLower)
          );
        });

  const studentIndexOfLastItem = studentCurrentPage * studentItemsPerPage;
  const studentIndexOfFirstItem = studentIndexOfLastItem - studentItemsPerPage;
  const currentStudents = filteredStudents.slice(studentIndexOfFirstItem, studentIndexOfLastItem);
  const studentTotalPages = Math.ceil(filteredStudents.length / studentItemsPerPage);

  // Fetch all data
  const fetchData = useCallback(async () => {
    if (!user) {
      console.log('[TeacherClassView] No user, skipping data fetch');
      return;
    }
    try {
      setLoading(true);
      console.log('[TeacherClassView] Fetching data for classId:', classId);

      const classResponse = await getClassDetails(classId);
      console.log('[TeacherClassView] getClassDetails response:', classResponse.data);
      const cls = classResponse.data.class;

      if (cls && (cls.teachers.some((t) => t._id === user.id) || cls.createdBy._id === user.id)) {
        setClassDetails(cls);

        // Fetch stats
        try {
          const participantResponse = await getParticipantStats(classId);
          console.log('[TeacherClassView] Participant stats:', participantResponse.data);
          setParticipantStats(participantResponse.data.stats);
        } catch (err) {
          console.error('[TeacherClassView] Failed to fetch participant stats:', err.message);
          setParticipantStats(null);
        }

        try {
          const runSubmitResponse = await getRunSubmitStats(classId);
          console.log('[TeacherClassView] Run/Submit stats:', runSubmitResponse.data);
          setRunSubmitStats(runSubmitResponse.data.stats);
        } catch (err) {
          console.error('[TeacherClassView] Failed to fetch run/submit stats:', err.message);
          setRunSubmitStats(null);
        }

        // Fetch assignments
        const assignmentsResponse = await getAssignments(classId);
        setAssignments(assignmentsResponse.data.assignments);

        // Fetch leaderboard
        const leaderboardResponse = await searchLeaderboard(classId, {});
        setLeaderboard(
          Array.isArray(leaderboardResponse.data.leaderboard)
            ? leaderboardResponse.data.leaderboard
            : []
        );

        // Fetch questions
        const questionsResponse = await getQuestionsByClass(classId);
        setQuestions(questionsResponse.data.questions);

        // Fetch available questions
        const allQuestionsResponse = await getAllQuestions();
        const userQuestions = allQuestionsResponse.data.questions.filter(
          (q) => q.createdBy._id === user.id
        );
        setAvailableQuestions(userQuestions);
        setFilteredQuestions(userQuestions);
      } else {
        setError('Class not found or you are not authorized');
      }
    } catch (err) {
      console.error('[TeacherClassView] Error fetching data:', err.message);
      setError(err.error || 'Failed to fetch data');
    } finally {
      setLoading(false);
    }
  }, [classId, user]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  // Question search effect
  useEffect(() => {
    const searchQuestionsAsync = async () => {
      if (!questionSearchKeyword.trim()) {
        setFilteredQuestions(availableQuestions);
        return;
      }
      try {
        const response = await searchQuestions(questionSearchKeyword);
        const userQuestions = response.data.questions.filter((q) => q.createdBy._id === user.id);
        setFilteredQuestions(userQuestions);
      } catch (err) {
        console.error('[TeacherClassView] Search error:', err.message);
        setFilteredQuestions(availableQuestions);
      }
    };
    searchQuestionsAsync();
  }, [questionSearchKeyword, availableQuestions, user]);

  // Handlers
  const handleFetchQuestionReport = async (e) => {
    e.preventDefault();
    if (!questionIdInput.trim()) {
      setError('Question ID is required');
      return;
    }
    setError('');
    setReportLoading(true);
    try {
      const response = await getQuestionPerspectiveReport(classId, questionIdInput);
      setQuestionReport(response.data.report);
    } catch (err) {
      setError(err.error || 'Failed to fetch question report');
    } finally {
      setReportLoading(false);
    }
  };

  const handleCreateAssignment = async (e) => {
    e.preventDefault();
    setAssignmentLoading(true);
    setAssignmentError('');
    setAssignmentMessage('');

    try {
      await createAssignment({
        classId,
        questionId: assignmentForm.questionId,
        maxPoints: assignmentForm.maxPoints,
        dueDate: assignmentForm.dueDate,
      });
      setAssignmentMessage('Assignment created successfully!');
      setAssignmentForm({ questionId: '', maxPoints: '', dueDate: '' });

      // Refresh assignments
      const assignmentsResponse = await getAssignments(classId);
      setAssignments(assignmentsResponse.data.assignments);

      setTimeout(() => setAssignmentMessage(''), 3000);
    } catch (err) {
      setAssignmentError(err.error || 'Failed to create assignment');
    } finally {
      setAssignmentLoading(false);
    }
  };

  const handleDeleteAssignment = async (assignmentId) => {
    if (!window.confirm('Are you sure you want to delete this assignment?')) return;

    try {
      await deleteAssignment(assignmentId);
      setAssignments(assignments.filter((a) => a._id !== assignmentId));
      setAssignmentMessage('Assignment deleted successfully!');
      setTimeout(() => setAssignmentMessage(''), 3000);
    } catch (err) {
      setAssignmentError(err.error || 'Failed to delete assignment');
    }
  };

  const handleAssignQuestion = async () => {
    if (!selectedQuestionId) {
      setError('Please select a question');
      return;
    }

    try {
      await assignQuestionToClass(selectedQuestionId, { classId });
      setError('');
      alert('Question assigned successfully!');

      // Refresh questions
      const questionsResponse = await getQuestionsByClass(classId);
      setQuestions(questionsResponse.data.questions);
      setSelectedQuestionId('');
    } catch (err) {
      setError(err.error || 'Failed to assign question');
    }
  };

  const handleSearchLeaderboard = async (e) => {
    e.preventDefault();
    try {
      const response = await searchLeaderboard(classId, leaderboardFilters);
      setLeaderboard(
        Array.isArray(response.data.leaderboard) ? response.data.leaderboard : []
      );
    } catch (err) {
      setError(err.error || 'Failed to search leaderboard');
    }
  };

  const handleBlockUser = async (studentId, block) => {
    try {
      await blockUser(classId, studentId, block);
      fetchData();
    } catch (err) {
      setError(err.error || 'Failed to block/unblock user');
    }
  };

  const handleFocusUser = async (studentId, focus) => {
    try {
      await blockUser(classId, studentId, focus, true);
      fetchData();
    } catch (err) {
      setError(err.error || 'Failed to focus/unfocus user');
    }
  };

  const handleBlockAllUsers = async (e) => {
    e.preventDefault();
    try {
      await blockAllUsers(classId, blockAll);
      fetchData();
    } catch (err) {
      setError(err.error || 'Failed to block/unblock all users');
    }
  };

  const handleViewSubmissionCode = async (submissionId) => {
    try {
      const response = await viewSubmissionCode(classId, submissionId);
      setSubmissionCode(response.data.code || 'No code available');
    } catch (err) {
      setError(err.error || 'Failed to fetch submission code');
    }
  };

  const openStudentModal = (student) => {
    setSelectedStudent(student);
    setIsModalOpen(true);
  };

  const closeStudentModal = () => {
    setSelectedStudent(null);
    setIsModalOpen(false);
  };

  // Component: Student Details Modal
  const StudentDetailsModal = () => {
    if (!selectedStudent) return null;

    // Handle both data structures
    const studentInfo = selectedStudent.studentId || selectedStudent.student || {};
    const totalRuns = selectedStudent.totalRuns || 0;
    const totalSubmissions = selectedStudent.totalSubmissions || 0;
    const activityStatus = selectedStudent.activityStatus || 'N/A';
    const correctAttempts = selectedStudent.correctAttempts || 0;
    const wrongAttempts = selectedStudent.wrongAttempts || 0;

    return (
      <Dialog open={isModalOpen} onClose={closeStudentModal} className="relative z-50">
        <div className="fixed inset-0 bg-black/30" aria-hidden="true" />
        <div className="fixed inset-0 flex items-center justify-center p-4">
          <Dialog.Panel className="mx-auto max-w-2xl w-full rounded-2xl bg-white p-8 shadow-xl">
            <Dialog.Title className="text-2xl font-bold text-gray-800 mb-6">
              Student Details
            </Dialog.Title>

            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <p className="text-sm text-gray-500">Name</p>
                  <p className="text-lg font-semibold text-gray-800">{studentInfo.name || 'N/A'}</p>
                </div>
                <div>
                  <p className="text-sm text-gray-500">Student ID</p>
                  <p className="text-lg font-semibold text-gray-800">{studentInfo._id || 'N/A'}</p>
                </div>
                <div>
                  <p className="text-sm text-gray-500">Email</p>
                  <p className="text-lg font-semibold text-gray-800">{studentInfo.email || 'N/A'}</p>
                </div>
                <div>
                  <p className="text-sm text-gray-500">Activity Status</p>
                  <p className="text-lg font-semibold text-gray-800">{activityStatus}</p>
                </div>
                <div>
                  <p className="text-sm text-gray-500">Total Runs</p>
                  <p className="text-lg font-semibold text-gray-800">{totalRuns}</p>
                </div>
                <div>
                  <p className="text-sm text-gray-500">Total Submissions</p>
                  <p className="text-lg font-semibold text-gray-800">{totalSubmissions}</p>
                </div>
                <div>
                  <p className="text-sm text-gray-500">Correct Attempts</p>
                  <p className="text-lg font-semibold text-gray-800">{correctAttempts}</p>
                </div>
                <div>
                  <p className="text-sm text-gray-500">Wrong Attempts</p>
                  <p className="text-lg font-semibold text-gray-800">{wrongAttempts}</p>
                </div>
              </div>
            </div>

            <div className="mt-8 flex justify-end">
              <button
                onClick={closeStudentModal}
                className="px-6 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition-colors duration-200"
              >
                Close
              </button>
            </div>
          </Dialog.Panel>
        </div>
      </Dialog>
    );
  };

  // Component: Stats Graphs
  const StatsGraphs = () => {
    if (!leaderboard || leaderboard.length === 0) {
      return (
        <div className="text-center py-8">
          <p className="text-sm text-gray-500">No student data available to generate graphs.</p>
        </div>
      );
    }

    const students = leaderboard.map((l) => l.studentId?.name || 'Unknown');
    const correctAttempts = leaderboard.map((l) => l.correctAttempts || 0);
    const totalAttempts = leaderboard.map((l) => l.totalAttempts || 0);
    const wrongAttempts = leaderboard.map((l) => l.wrongAttempts || 0);

    const chartOptions = {
      responsive: true,
      maintainAspectRatio: true,
      plugins: {
        legend: {
          position: 'top',
          labels: {
            font: { size: 12 },
          },
        },
        title: {
          display: false,
        },
      },
      scales: {
        y: {
          beginAtZero: true,
          title: {
            display: true,
            text: 'Number of Attempts',
          },
        },
      },
    };

    const chartData = {
      labels: students,
      datasets: [
        {
          label: 'Correct Attempts',
          data: correctAttempts,
          backgroundColor: 'rgba(75, 192, 192, 0.7)',
          borderColor: 'rgba(75, 192, 192, 1)',
          borderWidth: 1,
        },
        {
          label: 'Total Attempts',
          data: totalAttempts,
          backgroundColor: 'rgba(54, 162, 235, 0.7)',
          borderColor: 'rgba(54, 162, 235, 1)',
          borderWidth: 1,
        },
        {
          label: 'Wrong Attempts',
          data: wrongAttempts,
          backgroundColor: 'rgba(255, 99, 132, 0.7)',
          borderColor: 'rgba(255, 99, 132, 1)',
          borderWidth: 1,
        },
      ],
    };

    return (
      <div>
        <Bar options={chartOptions} data={chartData} />
      </div>
    );
  };

  if (!user) {
    return (
      <div className="max-w-4xl mx-auto p-6">
        <div className="flex items-center p-4 bg-red-50/80 backdrop-blur-sm rounded-xl shadow-sm border border-red-200">
          <p className="text-sm text-red-700 font-semibold">
            You must be logged in to view this page.
          </p>
        </div>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="flex justify-center items-center py-16 backdrop-blur-sm rounded-xl shadow-lg" style={{ backgroundColor: 'var(--card-white)' }}>
        <div className="w-12 h-12 border-4 border-t-transparent rounded-full animate-spin" style={{ borderColor: 'var(--text-primary)', borderTopColor: 'transparent' }}></div>
      </div>
    );
  }

  if (error && !classDetails) {
    return (
      <div className="max-w-4xl mx-auto p-6">
        <div className="flex items-center p-4 bg-red-50/80 backdrop-blur-sm rounded-xl shadow-sm border border-red-200">
          <svg className="h-6 w-6 text-red-500 mr-3" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor">
            <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
          </svg>
          <div>
            <h3 className="text-sm font-semibold text-red-800">Error</h3>
            <p className="mt-1 text-sm text-red-700">{error}</p>
          </div>
        </div>
      </div>
    );
  }
 
  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      {/* Header */}
      <div className="mb-8">
        <h1 className="text-3xl font-bold" style={{ color: 'var(--text-heading)' }}>
          {classDetails?.name || 'Class View'}
        </h1>
        <p className="mt-2 text-sm" style={{ color: 'var(--text-secondary)' }}>
          {classDetails?.description || ''}
        </p>
      </div>

      {/* Error Messages */}
      {error && (
        <div className="mb-6 flex items-center p-4 bg-red-50/80 backdrop-blur-sm rounded-xl shadow-sm border border-red-200">
          <svg className="h-6 w-6 text-red-500 mr-3" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor">
            <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
          </svg>
          <p className="text-sm text-red-700">{error}</p>
        </div>
      )}

      {/* Tabs */}
      <Tab.Group>
        <Tab.List className="flex gap-2 rounded-xl p-1.5 mb-8 border" style={{ backgroundColor: 'var(--background-light)', borderColor: 'var(--card-border)' }}>
          {['Analytics', 'Students', 'Assignments', 'Questions', 'Management'].map((tabName) => (
            <Tab key={tabName} className="flex-1">
              {({ selected }) => (
                <div
                  className={`w-full rounded-lg py-3 px-4 text-sm font-semibold leading-5 transition-all duration-200 focus:outline-none text-center ${
                    selected ? 'shadow-lg' : 'hover:shadow'
                  }`}
                  style={{
                    backgroundColor: selected ? 'var(--accent-indigo)' : 'var(--card-white)',
                    color: 'var(--text-primary)',
                    border: selected ? '2px solid var(--accent-indigo)' : '1px solid var(--card-border)',
                  }}
                >
                  {tabName}
                </div>
              )}
            </Tab>
          ))}
        </Tab.List>

        <Tab.Panels>
          {/* Analytics Tab */}
          <Tab.Panel>
            {/* Statistics Pie Charts */}
            <div className="mb-8">
              <h2 className="text-2xl font-semibold mb-4" style={{ color: 'var(--text-heading)' }}>Analytics Overview</h2>

              {(participantStats || runSubmitStats) && (
                <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
                  {/* Student Activity Status Pie Chart */}
                  {participantStats && participantStats.activityPercentage && (
                  <div className="backdrop-blur-sm rounded-2xl shadow-lg p-6 border transition-all duration-300 hover:shadow-2xl" style={{ backgroundColor: 'var(--card-white)', borderColor: 'var(--card-border)' }}>
                    <h3 className="text-lg font-semibold mb-4 text-center" style={{ color: 'var(--text-heading)' }}>
                      Student Activity Status
                    </h3>
                    <div className="h-64 flex items-center justify-center">
                      <Pie
                        data={{
                          labels: ['Active', 'Focused', 'Inactive'],
                          datasets: [
                            {
                              data: [
                                parseFloat(participantStats.activityPercentage?.active) || 0,
                                parseFloat(participantStats.activityPercentage?.focused) || 0,
                                parseFloat(participantStats.activityPercentage?.inactive) || 0,
                              ],
                              backgroundColor: [
                                'rgba(75, 192, 192, 0.7)',
                                'rgba(255, 206, 86, 0.7)',
                                'rgba(156, 163, 175, 0.7)',
                              ],
                              borderColor: [
                                'rgba(75, 192, 192, 1)',
                                'rgba(255, 206, 86, 1)',
                                'rgba(156, 163, 175, 1)',
                              ],
                              borderWidth: 1,
                            },
                          ],
                        }}
                        options={{
                          responsive: true,
                          maintainAspectRatio: true,
                          plugins: {
                            legend: {
                              position: 'bottom',
                              labels: {
                                font: { size: 11 },
                                padding: 10,
                              },
                            },
                            tooltip: {
                              callbacks: {
                                label: (context) => {
                                  const label = context.label || '';
                                  const value = context.parsed || 0;
                                  const count = participantStats.activityStats?.[label.toLowerCase()] || 0;
                                  return `${label}: ${count} students (${value}%)`;
                                },
                              },
                            },
                          },
                        }}
                      />
                    </div>
                  </div>
                  )}

                  {/* Correct Submission Rate Pie Chart */}
                  {participantStats && (
                  <div className="backdrop-blur-sm rounded-2xl shadow-lg p-6 border transition-all duration-300 hover:shadow-2xl" style={{ backgroundColor: 'var(--card-white)', borderColor: 'var(--card-border)' }}>
                    <h3 className="text-lg font-semibold mb-4 text-center" style={{ color: 'var(--text-heading)' }}>
                      Submission Accuracy
                    </h3>
                    <div className="h-64 flex items-center justify-center">
                      <Pie
                        data={{
                          labels: ['Correct', 'Wrong'],
                          datasets: [
                            {
                              data: [
                                participantStats.totalCorrectAttempts || 0,
                                participantStats.totalWrongAttempts || 0,
                              ],
                              backgroundColor: ['rgba(34, 197, 94, 0.7)', 'rgba(239, 68, 68, 0.7)'],
                              borderColor: ['rgba(34, 197, 94, 1)', 'rgba(239, 68, 68, 1)'],
                              borderWidth: 1,
                            },
                          ],
                        }}
                        options={{
                          responsive: true,
                          maintainAspectRatio: true,
                          plugins: {
                            legend: {
                              position: 'bottom',
                              labels: {
                                font: { size: 11 },
                                padding: 10,
                              },
                            },
                            tooltip: {
                              callbacks: {
                                label: (context) => {
                                  const label = context.label || '';
                                  const value = context.parsed || 0;
                                  const total = participantStats.totalCorrectAttempts + participantStats.totalWrongAttempts;
                                  const percentage = total > 0 ? ((value / total) * 100).toFixed(1) : 0;
                                  return `${label}: ${value} (${percentage}%)`;
                                },
                              },
                            },
                          },
                        }}
                      />
                    </div>
                  </div>
                  )}

                  {/* Runs vs Submits Pie Chart */}
                  {runSubmitStats && (
                  <div className="backdrop-blur-sm rounded-2xl shadow-lg p-6 border transition-all duration-300 hover:shadow-2xl" style={{ backgroundColor: 'var(--card-white)', borderColor: 'var(--card-border)' }}>
                    <h3 className="text-lg font-semibold mb-4 text-center" style={{ color: 'var(--text-heading)' }}>
                      Runs vs Submissions
                    </h3>
                    <div className="h-64 flex items-center justify-center">
                      <Pie
                        data={{
                          labels: ['Runs', 'Submissions'],
                          datasets: [
                            {
                              data: [
                                runSubmitStats.classTotalRuns || 0,
                                runSubmitStats.classTotalSubmits || 0,
                              ],
                              backgroundColor: ['rgba(59, 130, 246, 0.7)', 'rgba(168, 85, 247, 0.7)'],
                              borderColor: ['rgba(59, 130, 246, 1)', 'rgba(168, 85, 247, 1)'],
                              borderWidth: 1,
                            },
                          ],
                        }}
                        options={{
                          responsive: true,
                          maintainAspectRatio: true,
                          plugins: {
                            legend: {
                              position: 'bottom',
                              labels: {
                                font: { size: 11 },
                                padding: 10,
                              },
                            },
                          },
                        }}
                      />
                    </div>
                  </div>
                  )}
                </div>
              )}
            </div>

            {/* Attempt Statistics */}
            <div className="mb-8">
              <h2 className="text-2xl font-semibold mb-4" style={{ color: 'var(--text-heading)' }}>Attempt Statistics</h2>
              <div className="backdrop-blur-sm rounded-2xl shadow-lg p-6 border transition-all duration-300 hover:shadow-2xl" style={{ backgroundColor: 'var(--card-white)', borderColor: 'var(--card-border)' }}>
                <StatsGraphs />
              </div>
            </div>
          </Tab.Panel>

          {/* Students Tab */}
          <Tab.Panel>
            <div className="flex justify-between items-center mb-4">
              <h2 className="text-2xl font-semibold" style={{ color: 'var(--text-heading)' }}>
                Students ({filteredStudents.length})
              </h2>
              <div className="relative">
                <input
                  type="text"
                  value={studentSearch}
                  onChange={(e) => {
                    setStudentSearch(e.target.value);
                    setStudentCurrentPage(1);
                  }}
                  placeholder="Search students..."
                  className="pl-10 pr-3 py-2 border rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 text-sm"
                />
                <svg
                  className="h-5 w-5 text-gray-400 absolute left-3 top-2.5"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"
                  />
                </svg>
              </div>
            </div>

            {filteredStudents.length === 0 ? (
              <div className="backdrop-blur-sm rounded-2xl shadow-lg p-6 border" style={{ backgroundColor: 'var(--card-white)', borderColor: 'var(--card-border)' }}>
                <p style={{ color: 'var(--text-secondary)' }}>
                  {studentSearch ? `No students found matching "${studentSearch}"` : 'No students enrolled in this class'}
                </p>
              </div>
            ) : (
              <div className="backdrop-blur-sm rounded-2xl shadow-lg border overflow-hidden transition-all duration-300 hover:shadow-2xl" style={{ backgroundColor: 'var(--card-white)', borderColor: 'var(--card-border)' }}>
                <div className="overflow-x-auto">
                  <table className="min-w-full divide-y divide-gray-200">
                    <thead className="bg-gray-50">
                      <tr>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                          Student
                        </th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                          Email
                        </th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                          Status
                        </th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                          Total Runs
                        </th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                          Total Submissions
                        </th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                          Correct Attempts
                        </th>
                        <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                          Actions
                        </th>
                      </tr>
                    </thead>
                    <tbody className="bg-white divide-y divide-gray-200">
                      {currentStudents.map((studentData) => {
                        const studentInfo = studentData.studentId || {};
                        const isFocused = studentData.activityStatus === 'focused';
                        const isBlocked = studentData.isBlocked || false;

                        return (
                          <tr
                            key={studentInfo._id}
                            className={`${
                              isBlocked ? 'bg-gray-800 text-white' : 'hover:bg-gray-50'
                            } transition-colors duration-150`}
                          >
                            <td className="px-6 py-4 whitespace-nowrap">
                              <div className="flex items-center">
                                <div className="flex-shrink-0 h-10 w-10">
                                  <div
                                    className={`h-10 w-10 rounded-full flex items-center justify-center ${
                                      isBlocked ? 'bg-gray-700' : 'bg-indigo-100'
                                    }`}
                                  >
                                    <span
                                      className={`text-sm font-medium ${
                                        isBlocked ? 'text-white' : 'text-indigo-800'
                                      }`}
                                    >
                                      {studentInfo.name?.charAt(0).toUpperCase() || '?'}
                                    </span>
                                  </div>
                                </div>
                                <div className="ml-4">
                                  <div className="flex items-center gap-2">
                                    <div
                                      className={`text-sm font-medium ${
                                        isBlocked ? 'text-white' : 'text-gray-900'
                                      }`}
                                    >
                                      {studentInfo.name || 'Unknown'}
                                    </div>
                                    {isFocused && (
                                      <svg
                                        className="h-4 w-4 text-yellow-500"
                                        xmlns="http://www.w3.org/2000/svg"
                                        viewBox="0 0 20 20"
                                        fill="currentColor"
                                      >
                                        <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
                                      </svg>
                                    )}
                                  </div>
                                  <div
                                    className={`text-xs ${
                                      isBlocked ? 'text-gray-300' : 'text-gray-500'
                                    }`}
                                  >
                                    ID: {studentInfo._id || 'N/A'}
                                  </div>
                                </div>
                              </div>
                            </td>
                            <td className="px-6 py-4 whitespace-nowrap">
                              <div
                                className={`text-sm ${
                                  isBlocked ? 'text-gray-300' : 'text-gray-500'
                                }`}
                              >
                                {studentInfo.email || 'N/A'}
                              </div>
                            </td>
                            <td className="px-6 py-4 whitespace-nowrap">
                              <span
                                className={`px-2 inline-flex text-xs leading-5 font-semibold rounded-full ${
                                  isBlocked
                                    ? 'bg-red-100 text-red-800'
                                    : studentData.activityStatus === 'active'
                                    ? 'bg-green-100 text-green-800'
                                    : studentData.activityStatus === 'focused'
                                    ? 'bg-yellow-100 text-yellow-800'
                                    : 'bg-gray-100 text-gray-800'
                                }`}
                              >
                                {isBlocked ? 'Blocked' : studentData.activityStatus || 'inactive'}
                              </span>
                            </td>
                            <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                              {studentData.totalRuns || 0}
                            </td>
                            <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                              {studentData.totalSubmissions || 0}
                            </td>
                            <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                              {studentData.correctAttempts || 0}
                            </td>
                            <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                              <div className="flex items-center justify-end gap-2">
                                <button
                                  onClick={() => openStudentModal(studentData)}
                                  className="text-indigo-600 hover:text-indigo-900"
                                >
                                  View
                                </button>
                                <Menu as="div" className="relative inline-block text-left">
                                  <Menu.Button className="inline-flex items-center p-1 text-gray-400 hover:text-gray-600 focus:outline-none">
                                    <svg
                                      className="h-5 w-5"
                                      xmlns="http://www.w3.org/2000/svg"
                                      viewBox="0 0 20 20"
                                      fill="currentColor"
                                    >
                                      <path d="M10 6a2 2 0 110-4 2 2 0 010 4zM10 12a2 2 0 110-4 2 2 0 010 4zM10 18a2 2 0 110-4 2 2 0 010 4z" />
                                    </svg>
                                  </Menu.Button>
                                  <Transition
                                    as={React.Fragment}
                                    enter="transition ease-out duration-100"
                                    enterFrom="transform opacity-0 scale-95"
                                    enterTo="transform opacity-100 scale-100"
                                    leave="transition ease-in duration-75"
                                    leaveFrom="transform opacity-100 scale-100"
                                    leaveTo="transform opacity-0 scale-95"
                                  >
                                    <Menu.Items className="absolute right-0 mt-2 w-36 origin-top-right rounded-md bg-white shadow-lg ring-1 ring-black ring-opacity-5 focus:outline-none z-10">
                                      <div className="py-1">
                                        <Menu.Item>
                                          {({ active }) => (
                                            <button
                                              onClick={() => handleFocusUser(studentInfo._id, !isFocused)}
                                              className={`${
                                                active ? 'bg-gray-100 text-gray-900' : 'text-gray-700'
                                              } block w-full px-4 py-2 text-sm text-left`}
                                            >
                                              {isFocused ? 'Unfocus' : 'Focus'}
                                            </button>
                                          )}
                                        </Menu.Item>
                                        <Menu.Item>
                                          {({ active }) => (
                                            <button
                                              onClick={() => handleBlockUser(studentInfo._id, !isBlocked)}
                                              className={`${
                                                active ? 'bg-gray-100 text-gray-900' : 'text-gray-700'
                                              } block w-full px-4 py-2 text-sm text-left`}
                                            >
                                              {isBlocked ? 'Unblock' : 'Block'}
                                            </button>
                                          )}
                                        </Menu.Item>
                                      </div>
                                    </Menu.Items>
                                  </Transition>
                                </Menu>
                              </div>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
                {/* Pagination */}
                {filteredStudents.length > studentItemsPerPage && (
                  <div className="px-6 py-4 flex items-center justify-between border-t border-gray-200">
                    <p className="text-sm text-gray-500">
                      Showing {studentIndexOfFirstItem + 1} to{' '}
                      {Math.min(studentIndexOfLastItem, filteredStudents.length)} of{' '}
                      {filteredStudents.length} students
                    </p>
                    <div className="flex gap-2">
                      <button
                        onClick={() => setStudentCurrentPage((p) => Math.max(1, p - 1))}
                        disabled={studentCurrentPage === 1}
                        className="px-3 py-1 border rounded-md text-sm disabled:opacity-50 disabled:cursor-not-allowed hover:bg-gray-50"
                      >
                        Previous
                      </button>
                      <span className="px-3 py-1 text-sm text-gray-700">
                        Page {studentCurrentPage} of {studentTotalPages}
                      </span>
                      <button
                        onClick={() =>
                          setStudentCurrentPage((p) => Math.min(studentTotalPages, p + 1))
                        }
                        disabled={studentCurrentPage === studentTotalPages}
                        className="px-3 py-1 border rounded-md text-sm disabled:opacity-50 disabled:cursor-not-allowed hover:bg-gray-50"
                      >
                        Next
                      </button>
                    </div>
                  </div>
                )}
              </div>
            )}

            <StudentDetailsModal />
          </Tab.Panel>

          {/* Assignments Tab */}
          <Tab.Panel>
            {/* Create Assignment Form */}
            <div className="backdrop-blur-sm rounded-2xl shadow-lg border p-6 mb-8 transition-all duration-300 hover:shadow-2xl" style={{ backgroundColor: 'var(--card-white)', borderColor: 'var(--card-border)' }}>
              <h3 className="text-lg font-semibold mb-4" style={{ color: 'var(--text-heading)' }}>Create Assignment</h3>

              {assignmentMessage && (
                <div className="mb-4 p-3 bg-green-50/80 backdrop-blur-sm border border-green-200 rounded-lg">
                  <p className="text-sm text-green-700">{assignmentMessage}</p>
                </div>
              )}

              {assignmentError && (
                <div className="mb-4 p-3 bg-red-50/80 backdrop-blur-sm border border-red-200 rounded-lg">
                  <p className="text-sm text-red-700">{assignmentError}</p>
                </div>
              )}

              <form onSubmit={handleCreateAssignment} className="space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Question ID
                    </label>
                    <input
                      type="text"
                      value={assignmentForm.questionId}
                      onChange={(e) =>
                        setAssignmentForm({ ...assignmentForm, questionId: e.target.value })
                      }
                      className="w-full rounded-lg border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm"
                      required
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Max Points
                    </label>
                    <input
                      type="number"
                      value={assignmentForm.maxPoints}
                      onChange={(e) =>
                        setAssignmentForm({ ...assignmentForm, maxPoints: e.target.value })
                      }
                      className="w-full rounded-lg border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm"
                      required
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Due Date
                    </label>
                    <input
                      type="datetime-local"
                      value={assignmentForm.dueDate}
                      onChange={(e) =>
                        setAssignmentForm({ ...assignmentForm, dueDate: e.target.value })
                      }
                      className="w-full rounded-lg border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm"
                      required
                    />
                  </div>
                </div>
                <div className="flex justify-end">
                  <button
                    type="submit"
                    disabled={assignmentLoading}
                    className="inline-flex items-center px-4 py-2 rounded-lg text-sm font-semibold text-white bg-indigo-600 hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2 transition-all duration-300 disabled:opacity-50"
                  >
                    {assignmentLoading ? 'Creating...' : 'Create Assignment'}
                  </button>
                </div>
              </form>
            </div>

            {/* Assignments List */}
            <div className="backdrop-blur-sm rounded-2xl shadow-lg border p-6 mb-8 transition-all duration-300 hover:shadow-2xl" style={{ backgroundColor: 'var(--card-white)', borderColor: 'var(--card-border)' }}>
              <div className="flex justify-between items-center mb-4">
                <h3 className="text-lg font-semibold" style={{ color: 'var(--text-heading)' }}>
                  Assignments ({filteredAssignments.length})
                </h3>
                <div className="relative">
                  <input
                    type="text"
                    value={assignmentSearch}
                    onChange={(e) => {
                      setAssignmentSearch(e.target.value);
                      setAssignmentCurrentPage(1);
                    }}
                    placeholder="Search assignments..."
                    className="pl-10 pr-3 py-2 border rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 text-sm"
                  />
                  <svg
                    className="h-5 w-5 text-gray-400 absolute left-3 top-2.5"
                    fill="none"
                    viewBox="0 0 24 24"
                    stroke="currentColor"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"
                    />
                  </svg>
                </div>
              </div>
              {filteredAssignments.length === 0 ? (
                <p className="text-sm text-gray-500">
                  {assignmentSearch
                    ? `No assignments found matching "${assignmentSearch}"`
                    : 'No assignments available'}
                </p>
              ) : (
                <>
                  <div className="overflow-x-auto">
                    <table className="min-w-full divide-y divide-gray-200">
                      <thead className="bg-gray-50">
                        <tr>
                          <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                            Question Title
                          </th>
                          <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                            Max Points
                          </th>
                          <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                            Assigned At
                          </th>
                          <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                            Due Date
                          </th>
                          <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                            Actions
                          </th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-gray-200">
                        {currentAssignments.map((assignment) => (
                          <tr key={assignment._id}>
                            <td className="px-6 py-4 text-sm font-medium text-gray-900">
                              {assignment.questionId?.title
                                ? stripHtml(assignment.questionId.title)
                                : 'N/A'}
                            </td>
                            <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                              {assignment.maxPoints}
                            </td>
                            <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                              {new Date(assignment.assignedAt).toLocaleString()}
                            </td>
                            <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                              {new Date(assignment.dueDate).toLocaleString()}
                            </td>
                            <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                              <button
                                onClick={() => handleDeleteAssignment(assignment._id)}
                                className="text-red-600 hover:text-red-900"
                              >
                                Delete
                              </button>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                  {/* Pagination */}
                  {filteredAssignments.length > assignmentItemsPerPage && (
                    <div className="mt-4 flex items-center justify-between">
                      <p className="text-sm text-gray-500">
                        Showing {assignmentIndexOfFirstItem + 1} to{' '}
                        {Math.min(assignmentIndexOfLastItem, filteredAssignments.length)} of{' '}
                        {filteredAssignments.length} assignments
                      </p>
                      <div className="flex gap-2">
                        <button
                          onClick={() => setAssignmentCurrentPage((p) => Math.max(1, p - 1))}
                          disabled={assignmentCurrentPage === 1}
                          className="px-3 py-1 border rounded-md text-sm disabled:opacity-50 disabled:cursor-not-allowed hover:bg-gray-50"
                        >
                          Previous
                        </button>
                        <span className="px-3 py-1 text-sm text-gray-700">
                          Page {assignmentCurrentPage} of {assignmentTotalPages}
                        </span>
                        <button
                          onClick={() =>
                            setAssignmentCurrentPage((p) => Math.min(assignmentTotalPages, p + 1))
                          }
                          disabled={assignmentCurrentPage === assignmentTotalPages}
                          className="px-3 py-1 border rounded-md text-sm disabled:opacity-50 disabled:cursor-not-allowed hover:bg-gray-50"
                        >
                          Next
                        </button>
                      </div>
                    </div>
                  )}
                </>
              )}
            </div>
          </Tab.Panel>

          {/* Questions Tab */}
          <Tab.Panel>
            {/* Attach Question to Class */}
            <div className="backdrop-blur-sm rounded-2xl shadow-lg border p-6 mb-8 transition-all duration-300 hover:shadow-2xl" style={{ backgroundColor: 'var(--card-white)', borderColor: 'var(--card-border)' }}>
              <h3 className="text-lg font-semibold mb-4" style={{ color: 'var(--text-heading)' }}>Attach Question to Class</h3>

              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Search Questions
                  </label>
                  <input
                    type="text"
                    value={questionSearchKeyword}
                    onChange={(e) => setQuestionSearchKeyword(e.target.value)}
                    placeholder="Search by title, tags, or content..."
                    className="w-full rounded-lg border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Select Question
                  </label>
                  <select
                    value={selectedQuestionId}
                    onChange={(e) => setSelectedQuestionId(e.target.value)}
                    className="w-full rounded-lg border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm"
                  >
                    <option value="">-- Select a Question --</option>
                    {filteredQuestions.map((q) => (
                      <option key={q._id} value={q._id}>
                        {stripHtml(q.title)}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="flex justify-end">
                  <button
                    onClick={handleAssignQuestion}
                    className="inline-flex items-center px-4 py-2 rounded-lg text-sm font-semibold text-white bg-indigo-600 hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2 transition-all duration-300"
                  >
                    Attach Question
                  </button>
                </div>
              </div>
            </div>

            {/* Assigned Questions */}
            <div className="backdrop-blur-sm rounded-2xl shadow-lg border p-6 transition-all duration-300 hover:shadow-2xl" style={{ backgroundColor: 'var(--card-white)', borderColor: 'var(--card-border)' }}>
              <h3 className="text-lg font-semibold mb-4" style={{ color: 'var(--text-heading)' }}>
                Assigned Questions ({questions.length})
              </h3>

              {questions.length === 0 ? (
                <p className="text-sm text-gray-500">No questions assigned to this class</p>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                  {questions.map((question) => (
                    <TeacherQuestionCard key={question._id} question={question} classId={classId} />
                  ))}
                </div>
              )}
            </div>
          </Tab.Panel>

          {/* Management Tab */}
          <Tab.Panel>
            {/* Question Perspective Report */}
            <Disclosure>
              {({ open }) => (
                <div className="backdrop-blur-sm rounded-2xl shadow-lg border p-6 mb-8 transition-all duration-300 hover:shadow-2xl" style={{ backgroundColor: 'var(--card-white)', borderColor: 'var(--card-border)' }}>
                  <Disclosure.Button className="flex justify-between w-full">
                    <h3 className="text-lg font-semibold" style={{ color: 'var(--text-heading)' }}>
                      Question Perspective Report
                    </h3>
                    <svg
                      className={`${open ? 'rotate-180 transform' : ''} h-5 w-5 text-gray-500`}
                      fill="none"
                      viewBox="0 0 24 24"
                      stroke="currentColor"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M19 9l-7 7-7-7"
                      />
                    </svg>
                  </Disclosure.Button>

                  <Disclosure.Panel className="mt-4">
                    <form onSubmit={handleFetchQuestionReport} className="space-y-4">
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">
                          Question ID
                        </label>
                        <input
                          type="text"
                          value={questionIdInput}
                          onChange={(e) => setQuestionIdInput(e.target.value)}
                          className="w-full rounded-lg border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm"
                          required
                        />
                      </div>
                      <div className="flex justify-end">
                        <button
                          type="submit"
                          disabled={reportLoading}
                          className="inline-flex items-center px-4 py-2 rounded-lg text-sm font-semibold text-white bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50"
                        >
                          {reportLoading ? 'Loading...' : 'Fetch Report'}
                        </button>
                      </div>
                    </form>

                    {questionReport && (
                      <div className="mt-6 p-4 bg-gray-50/80 backdrop-blur-sm rounded-lg">
                        <pre className="text-sm whitespace-pre-wrap" style={{ color: 'var(--text-primary)' }}>
                          {JSON.stringify(questionReport, null, 2)}
                        </pre>
                      </div>
                    )}
                  </Disclosure.Panel>
                </div>
              )}
            </Disclosure>

            {/* Search Leaderboard */}
            <div className="backdrop-blur-sm rounded-2xl shadow-lg border p-6 mb-8 transition-all duration-300 hover:shadow-2xl" style={{ backgroundColor: 'var(--card-white)', borderColor: 'var(--card-border)' }}>
              <h3 className="text-lg font-semibold mb-4" style={{ color: 'var(--text-heading)' }}>Search Leaderboard</h3>

              <form onSubmit={handleSearchLeaderboard} className="space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Student Name
                    </label>
                    <input
                      type="text"
                      value={leaderboardFilters.studentName}
                      onChange={(e) =>
                        setLeaderboardFilters({ ...leaderboardFilters, studentName: e.target.value })
                      }
                      className="w-full rounded-lg border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Activity Status
                    </label>
                    <select
                      value={leaderboardFilters.activityStatus}
                      onChange={(e) =>
                        setLeaderboardFilters({
                          ...leaderboardFilters,
                          activityStatus: e.target.value,
                        })
                      }
                      className="w-full rounded-lg border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm"
                    >
                      <option value="">All</option>
                      <option value="active">Active</option>
                      <option value="focused">Focused</option>
                      <option value="inactive">Inactive</option>
                    </select>
                  </div>
                </div>
                <div className="flex justify-end">
                  <button
                    type="submit"
                    className="inline-flex items-center px-4 py-2 rounded-lg text-sm font-semibold text-white bg-indigo-600 hover:bg-indigo-700"
                  >
                    Search
                  </button>
                </div>
              </form>
            </div>

            {/* Block All Users */}
            <div className="backdrop-blur-sm rounded-2xl shadow-lg border p-6 mb-8 transition-all duration-300 hover:shadow-2xl" style={{ backgroundColor: 'var(--card-white)', borderColor: 'var(--card-border)' }}>
              <h3 className="text-lg font-semibold mb-4" style={{ color: 'var(--text-heading)' }}>Block All Users</h3>

              <form onSubmit={handleBlockAllUsers} className="space-y-4">
                <div className="flex items-center">
                  <input
                    type="checkbox"
                    checked={blockAll}
                    onChange={(e) => setBlockAll(e.target.checked)}
                    className="h-4 w-4 text-indigo-600 focus:ring-indigo-500 border-gray-300 rounded"
                  />
                  <label className="ml-2 block text-sm text-gray-700">Block All Students</label>
                </div>
                <div className="flex justify-end">
                  <button
                    type="submit"
                    className="inline-flex items-center px-4 py-2 rounded-lg text-sm font-semibold text-white bg-red-600 hover:bg-red-700"
                  >
                    {blockAll ? 'Block All' : 'Unblock All'}
                  </button>
                </div>
              </form>
            </div>

            {/* View Submission Code */}
            {submissionCode && (
              <div className="backdrop-blur-sm rounded-2xl shadow-lg border p-6 transition-all duration-300 hover:shadow-2xl" style={{ backgroundColor: 'var(--card-white)', borderColor: 'var(--card-border)' }}>
                <h3 className="text-lg font-semibold mb-4" style={{ color: 'var(--text-heading)' }}>Submission Code</h3>
                <pre className="p-4 bg-gray-50/80 backdrop-blur-sm rounded-lg text-sm overflow-x-auto" style={{ color: 'var(--text-primary)' }}>
                  {submissionCode}
                </pre>
              </div>
            )}
          </Tab.Panel>
        </Tab.Panels>
      </Tab.Group>
    </div>
  );
};

export default TeacherClassView;
