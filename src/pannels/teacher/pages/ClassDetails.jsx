  import React, { useState, useEffect, useCallback } from 'react';
import { useParams, Link } from 'react-router-dom';
import { useSelector, shallowEqual } from 'react-redux';
import { format } from 'date-fns';
import { Menu, Transition, Dialog, Disclosure, Tab, Portal } from '@headlessui/react';
import { Bar } from 'react-chartjs-2';
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  BarElement,
  Title,
  Tooltip,
  Legend,
} from 'chart.js';
import {
  getParticipantStats,
  getRunSubmitStats,
  createAssignment,
  getAssignments,
  deleteAssignment,
  blockUser,
  blockAllUsers,
  searchLeaderboard,
  viewSubmissionCode,
  getClassDetails,
  getQuestionPerspectiveReport,
} from '../../../common/services/api';

// Register Chart.js components
ChartJS.register(CategoryScale, LinearScale, BarElement, Title, Tooltip, Legend);

const ClassDetails = () => {
  const { classId } = useParams();
  const { user } = useSelector((state) => state.auth, shallowEqual);
  const [classDetails, setClassDetails] = useState(null);
  const [participantStats, setParticipantStats] = useState(null);
  const [runSubmitStats, setRunSubmitStats] = useState(null);
  const [assignments, setAssignments] = useState([]);
  const [leaderboard, setLeaderboard] = useState([]);
  const [submissionCode, setSubmissionCode] = useState('');
  const [questionReport, setQuestionReport] = useState(null);
  const [questionIdInput, setQuestionIdInput] = useState('');
  const [newAssignment, setNewAssignment] = useState({
    questionId: '',
    dueDate: '',
    maxPoints: '',
  });
  const [leaderboardFilters, setLeaderboardFilters] = useState({
    studentName: '',
    activityStatus: '',
    minCorrectAttempts: '',
    maxAttempts: '',
  });
  const [submissionId, setSubmissionId] = useState('');
  const [blockStudentId, setBlockStudentId] = useState('');
  const [blockAll, setBlockAll] = useState(false);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);
  const [reportLoading, setReportLoading] = useState(false);
  const [formErrors, setFormErrors] = useState({});
  const [selectedStudent, setSelectedStudent] = useState(null);
  const [isModalOpen, setIsModalOpen] = useState(false);
  
  // Search and pagination for assignments
  const [assignmentSearch, setAssignmentSearch] = useState('');
  const [assignmentCurrentPage, setAssignmentCurrentPage] = useState(1);
  const [assignmentItemsPerPage] = useState(5);

  // Filter assignments based on search
  const filteredAssignments = assignmentSearch === ''
    ? assignments
    : assignments.filter((assignment) =>
        (assignment.questionId?.title || '').toLowerCase().includes(assignmentSearch.toLowerCase())
      );

  const assignmentIndexOfLastItem = assignmentCurrentPage * assignmentItemsPerPage;
  const assignmentIndexOfFirstItem = assignmentIndexOfLastItem - assignmentItemsPerPage;
  const currentAssignments = filteredAssignments.slice(assignmentIndexOfFirstItem, assignmentIndexOfLastItem);
  const assignmentTotalPages = Math.ceil(filteredAssignments.length / assignmentItemsPerPage);

  console.log('[ClassDetails] Component mounted', { classId, user });

  const fetchData = useCallback(async () => {
    if (!user) {
      console.log('[ClassDetails] No user, skipping data fetch');
      return;
    }
    try {
      setLoading(true);
      console.log('[ClassDetails] Fetching data for classId:', classId);

      const classResponse = await getClassDetails(classId);
      console.log('[ClassDetails] getClassDetails response:', classResponse.data);
      const cls = classResponse.data.class;

      if (cls && (cls.teachers.some((t) => t._id === user.id) || cls.createdBy._id === user.id)) {
        setClassDetails(cls);

        console.log('[ClassDetails] Calling getParticipantStats');
        const participantResponse = await getParticipantStats(classId);
        console.log('[ClassDetails] getParticipantStats response:', participantResponse.data);
        setParticipantStats(participantResponse.data.stats);

        console.log('[ClassDetails] Calling getRunSubmitStats');
        const runSubmitResponse = await getRunSubmitStats(classId);
        console.log('[ClassDetails] getRunSubmitStats response:', runSubmitResponse.data);
        setRunSubmitStats(runSubmitResponse.data.stats);

        console.log('[ClassDetails] Calling getAssignments');
        const assignmentsResponse = await getAssignments(classId);
        console.log('[ClassDetails] getAssignments response:', assignmentsResponse.data);
        setAssignments(assignmentsResponse.data.assignments);

        console.log('[ClassDetails] Calling searchLeaderboard with empty filters');
        const leaderboardResponse = await searchLeaderboard(classId, {});
        console.log('[ClassDetails] searchLeaderboard response:', leaderboardResponse.data);
        setLeaderboard(Array.isArray(leaderboardResponse.data.leaderboard) ? leaderboardResponse.data.leaderboard : []);
      } else {
        console.log('[ClassDetails] Authorization failed', {
          teachers: cls?.teachers,
          createdBy: cls?.createdBy,
          userId: user.id,
        });
        setError('Class not found or you are not authorized');
      }
    } catch (err) {
      console.error('[ClassDetails] Error fetching data:', {
        error: err.message,
        response: err.response?.data,
      });
      setError(err.error || 'Failed to fetch data');
    } finally {
      setLoading(false);
      console.log('[ClassDetails] Data fetch completed, loading set to false');
    }
  }, [classId, user]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const handleFetchQuestionReport = async (e) => {
    e.preventDefault();
    if (!questionIdInput.trim()) {
      setError('Question ID is required');
      return;
    }
    setError('');
    setReportLoading(true);
    try {
      console.log('[ClassDetails] Fetching question perspective report for:', questionIdInput);
      const response = await getQuestionPerspectiveReport(classId, questionIdInput);
      console.log('[ClassDetails] getQuestionPerspectiveReport response:', response.data);
      setQuestionReport(response.data.report);
    } catch (err) {
      console.error('[ClassDetails] Error fetching question report:', {
        error: err.message,
        response: err.response?.data,
      });
      setError(err.error || 'Failed to fetch question report');
    } finally {
      setReportLoading(false);
    }
  };

  const validateAssignmentForm = () => {
    const errors = {};
    if (!newAssignment.questionId.trim()) errors.questionId = 'Question ID is required';
    if (!newAssignment.dueDate) errors.dueDate = 'Due date is required';
    if (!newAssignment.maxPoints || isNaN(newAssignment.maxPoints) || newAssignment.maxPoints <= 0) {
      errors.maxPoints = 'Valid max points is required';
    }
    return errors;
  };

  const handleCreateAssignment = async (e) => {
    e.preventDefault();
    console.log('[ClassDetails] Creating assignment with data:', newAssignment);
    const errors = validateAssignmentForm();
    if (Object.keys(errors).length > 0) {
      console.log('[ClassDetails] Assignment form validation errors:', errors);
      setFormErrors(errors);
      return;
    }
    setError('');
    setFormErrors({});
    try {
      const response = await createAssignment(classId, {
        questionId: newAssignment.questionId,
        dueDate: new Date(newAssignment.dueDate).toISOString(),
        maxPoints: parseInt(newAssignment.maxPoints),
      });
      console.log('[ClassDetails] createAssignment response:', response.data);
      setAssignments([...assignments, response.data]);
      setNewAssignment({ questionId: '', dueDate: '', maxPoints: '' });
      console.log('[ClassDetails] Assignment created, form reset');
    } catch (err) {
      console.error('[ClassDetails] Error creating assignment:', {
        error: err.message,
        response: err.response?.data,
      });
      setError(err.error || 'Failed to create assignment');
    }
  };

  const handleDeleteAssignment = async (assignmentId) => {
    console.log('[ClassDetails] Deleting assignment:', assignmentId);
    setError('');
    try {
      await deleteAssignment(classId, assignmentId);
      console.log('[ClassDetails] Assignment deleted successfully');
      setAssignments(assignments.filter((a) => a._id !== assignmentId));
    } catch (err) {
      console.error('[ClassDetails] Error deleting assignment:', {
        error: err.message,
        response: err.response?.data,
      });
      setError(err.error || 'Failed to delete assignment');
    }
  };

  const handleBlockUser = async (studentId, block) => {
    console.log('[ClassDetails] Blocking/Unblocking user:', studentId, block);
    setError('');
    try {
      await blockUser(classId, studentId, block);
      console.log(`[ClassDetails] User ${block ? 'blocked' : 'unblocked'} successfully`);
      alert(`User ${block ? 'blocked' : 'unblocked'} successfully`);
      const participantResponse = await getParticipantStats(classId);
      console.log('[ClassDetails] getParticipantStats response after block:', participantResponse.data);
      setParticipantStats(participantResponse.data.stats);
      const leaderboardResponse = await searchLeaderboard(classId, {});
      setLeaderboard(Array.isArray(leaderboardResponse.data.leaderboard) ? leaderboardResponse.data.leaderboard : []);
    } catch (err) {
      console.error(`[ClassDetails] Error ${block ? 'blocking' : 'unblocking'} user:`, {
        error: err.message,
        response: err.response?.data,
      });
      setError(err.error || `Failed to ${block ? 'block' : 'unblock'} user`);
    }
  };

  const handleBlockAllUsers = async () => {
    console.log('[ClassDetails] Blocking all users:', blockAll);
    setError('');
    try {
      await blockAllUsers(classId, blockAll);
      console.log('[ClassDetails] All users block status updated');
      alert(`All users ${blockAll ? 'blocked' : 'unblocked'} successfully`);
      console.log('[ClassDetails] Refreshing participant stats after block all');
      const participantResponse = await getParticipantStats(classId);
      console.log('[ClassDetails] getParticipantStats response after block all:', participantResponse.data);
      setParticipantStats(participantResponse.data.stats);
    } catch (err) {
      console.error('[ClassDetails] Error blocking all users:', {
        error: err.message,
        response: err.response?.data,
      });
      setError(err.error || 'Failed to update block status for all users');
    }
  };

  const handleSearchLeaderboard = async (e) => {
    e.preventDefault();
    console.log('[ClassDetails] Searching leaderboard with filters:', leaderboardFilters);
    setError('');
    try {
      const filters = {
        ...(leaderboardFilters.studentName && { studentName: leaderboardFilters.studentName }),
        ...(leaderboardFilters.activityStatus && { activityStatus: leaderboardFilters.activityStatus }),
        ...(leaderboardFilters.minCorrectAttempts && {
          minCorrectAttempts: parseInt(leaderboardFilters.minCorrectAttempts),
        }),
        ...(leaderboardFilters.maxAttempts && {
          maxAttempts: parseInt(leaderboardFilters.maxAttempts),
        }),
      };
      console.log('[ClassDetails] Processed leaderboard filters:', filters);
      const response = await searchLeaderboard(classId, filters);
      console.log('[ClassDetails] searchLeaderboard response:', response.data);
      setLeaderboard(Array.isArray(response.data.leaderboard) ? leaderboardResponse.data.leaderboard : []);
    } catch (err) {
      console.error('[ClassDetails] Error searching leaderboard:', {
        error: err.message,
        response: err.response?.data,
      });
      setError(err.error || 'Failed to search leaderboard');
    }
  };

  const handleViewSubmissionCode = async (submissionId) => {
    console.log('[ClassDetails] Viewing submission code for ID:', submissionId);
    if (!submissionId.trim()) {
      console.log('[ClassDetails] View submission error: Submission ID is empty');
      setError('Submission ID is required');
      return;
    }
    setError('');
    try {
      const response = await viewSubmissionCode(submissionId);
      console.log('[ClassDetails] viewSubmissionCode response:', response.data);
      setSubmissionCode(response.data.code || 'No code found');
    } catch (err) {
      console.error('[ClassDetails] Error viewing submission code:', {
        error: err.message,
        response: err.response?.data,
      });
      setError(err.error || 'Failed to fetch submission code');
    }
  };

  const handleFocusUser = async (studentId, focus) => {
    console.log(`[ClassDetails] ${focus ? 'Focusing' : 'Unfocusing'} user:`, studentId);
    setError('');
    try {
      console.log(`[ClassDetails] User ${focus ? 'focused' : 'unfocused'} successfully`);
      alert(`User ${focus ? 'focused' : 'unfocused'} successfully`);
      const participantResponse = await getParticipantStats(classId);
      setParticipantStats(participantResponse.data.stats);
      const leaderboardResponse = await searchLeaderboard(classId, {});
      setLeaderboard(Array.isArray(leaderboardResponse.data.leaderboard) ? leaderboardResponse.data.leaderboard : []);
    } catch (err) {
      console.error(`[ClassDetails] Error ${focus ? 'focusing' : 'unfocusing'} user:`, {
        error: err.message,
        response: err.response?.data,
      });
      setError(err.error || `Failed to ${focus ? 'focus' : 'unfocus'} user`);
    }
  };

  const openStudentModal = (student) => {
    setSelectedStudent(student);
    setIsModalOpen(true);
  };

  // Question Report Graph Component
  const QuestionReportGraph = () => {
    if (!questionReport || !questionReport.studentData?.length) return null;

    const studentNames = questionReport.studentData.map((s) => s.studentName);
    const correctAttempts = questionReport.studentData.map((s) => s.correctAttempts || 0);
    const totalAttempts = questionReport.studentData.map((s) => s.totalAttempts || 0);
    const highestScores = questionReport.studentData.map((s) => s.highestScore || 0);

    const chartOptions = {
      responsive: true,
      plugins: {
        legend: { position: 'top' },
        title: { display: true, text: 'Question Performance by Student' },
      },
    };

    const chartData = {
      labels: studentNames,
      datasets: [
        {
          label: 'Correct Attempts',
          data: correctAttempts,
          backgroundColor: 'rgba(75, 192, 192, 0.6)',
        },
        {
          label: 'Total Attempts',
          data: totalAttempts,
          backgroundColor: 'rgba(54, 162, 235, 0.6)',
        },
       
        {
          label: 'Highest Score',
          data: highestScores,
          backgroundColor: 'rgba(255, 206, 86, 0.6)',
        },
      ],
    };

    return (
      <div className="mt-6">
        <Bar options={chartOptions} data={chartData} />
      </div>
    );
  };

  if (!user) {
    console.log('[ClassDetails] Rendering: User not logged in');
    return (
      <div className="max-w-4xl mx-auto p-6">
        <div className="flex items-center p-4 bg-red-50/80 backdrop-blur-sm rounded-xl shadow-sm border border-red-200">
          <svg
            className="h-6 w-6 text-red-500 mr-3"
            xmlns="http://www.w3.org/2000/svg"
            viewBox="0 0 20 20"
            fill="currentColor"
          >
            <path
              fillRule="evenodd"
              d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.134 1.293a1 1 0 001.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l-1.293-1.293a1 1 0 00-1.414 1.414L8.586 10 8.707 7.293z"
              clipRule="evenodd"
            />
          </svg>
          <p className="text-sm text-red-700 font-semibold">You must be logged in to view this page.</p>
        </div>
      </div>
    );
  }

  if (loading) {
    console.log('[ClassDetails] Rendering: Loading state');
    return (
      <div className="flex justify-center items-center h-64">
        <div className="w-12 h-12 border-4 border-indigo-500 border-t-transparent rounded-full animate-spin"></div>
      </div>
    );
  }

  if (error && !classDetails) {
    console.log('[ClassDetails] Rendering: Error state', { error, classDetails });
    return (
      <div className="max-w-4xl mx-auto p-6">
        <div className="flex items-center p-4 bg-red-50/80 backdrop-blur-sm rounded-xl shadow-sm border border-red-200">
          <svg
            className="h-6 w-6 text-red-500 mr-3"
            xmlns="http://www.w3.org/2000/svg"
            viewBox="0 0 20 20"
            fill="currentColor"
          >
            <path
              fillRule="evenodd"
              d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 001.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l-1.293-1.293a1 1 0 00-1.414 1.414L8.586 10 8.707 7.293z"
              clipRule="evenodd"
            />
          </svg>
          <p className="text-sm text-red-700 font-semibold">
            {error === 'Class not found or you are not authorized'
              ? 'You do not have permission to view this class or it does not exist.'
              : error}
          </p>
        </div>
      </div>
    );
  }

  console.log('[ClassDetails] Rendering: Main content', {
    classDetails: classDetails?.name,
    assignments: assignments.length,
    leaderboard: leaderboard.length,
    questionReport: !!questionReport,
  });

  // Student Card Component
  const StudentCard = ({ student }) => {
    const { name, id, email } = student.student;
    const { totalRuns, totalSubmissions } = student;
    const studentData = Array.isArray(leaderboard) ? leaderboard.find(l => l.studentId?._id === id) : null;
    const isFocused = studentData?.activityStatus === 'focused';
    const isBlocked = studentData?.isBlocked || false;

    return (
      <div className={`${isBlocked ? 'bg-gray-800 text-white' : 'bg-white/90'} backdrop-blur-sm rounded-xl shadow-lg p-6 border border-gray-100 transition-all duration-300 hover:shadow-xl overflow-visible`} style={{ position: 'relative', zIndex: 1 }}>
        <div className="flex justify-between items-center">
          <div className="flex items-center">
            <div>
              <h3 className={`text-lg font-semibold ${isBlocked ? 'text-white' : 'text-gray-800'}`}>{name}</h3>
              <p className={`text-sm ${isBlocked ? 'text-gray-300' : 'text-gray-600'}`}>ID: {id}</p>
              <p className={`text-sm ${isBlocked ? 'text-gray-300' : 'text-gray-600'}`}>Email: {email}</p>
            </div>
            {isFocused && (
              <svg
                className="h-6 w-6 text-yellow-500 ml-2"
                xmlns="http://www.w3.org/2000/svg"
                viewBox="0 0 20 20"
                fill="currentColor"
              >
                <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
              </svg>
            )}
          </div>
          <div className="flex items-center space-x-2" style={{ position: 'relative', zIndex: 100 }}>
            <button
              onClick={() => openStudentModal(student)}
              className={`p-2 rounded-full ${isBlocked ? 'text-gray-300 hover:bg-gray-700' : 'text-gray-600 hover:bg-gray-100'} focus:outline-none transition-colors duration-200`}
              aria-label="View student details"
            >
              <svg
                className="h-5 w-5"
                xmlns="http://www.w3.org/2000/svg"
                viewBox="0 0 20 20"
                fill="currentColor"
              >
                <path
                  fillRule="evenodd"
                  d="M10 18a8 8 0 100-16 8 8 0 000 16zm1-12a1 1 0 10-2 0v4a1 1 0 00.293.707l2.828 2.829a1 1 0 101.415-1.415L11 9.586V6z"
                  clipRule="evenodd"
                />
              </svg>
            </button>
            <Menu as="div" className="relative">
              <Menu.Button 
                className={`inline-flex items-center p-2 rounded-full ${isBlocked ? 'text-gray-300 hover:bg-gray-700' : 'text-gray-600 hover:bg-gray-100'} focus:outline-none transition-colors duration-200`} 
                aria-label="Student actions"
              >
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
                <Menu.Items className="absolute right-0 mt-2 w-48 origin-top-right rounded-md bg-white shadow-lg ring-1 ring-black ring-opacity-5 focus:outline-none z-[9999]">
                  <div className="py-1">
                    <Menu.Item>
                      {({ active }) => (
                        <button
                          onClick={() => {
                            handleFocusUser(id, !isFocused);
                          }}
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
                          onClick={() => {
                            handleBlockUser(id, !isBlocked);
                          }}
                          className={`${
                            active ? 'bg-gray-100 text-gray-900' : 'text-gray-700'
                          } block w-full px-4 py-2 text-sm text-left`}
                        >
                          {isBlocked ? 'Unblock' : 'Block'}
                        </button>
                      )}
                    </Menu.Item>
                    <Menu.Item>
                      {({ active }) => (
                        <button
                          onClick={() => {
                            setSubmissionId(id);
                            handleViewSubmissionCode(id);
                          }}
                          className={`${
                            active ? 'bg-gray-100 text-gray-900' : 'text-gray-700'
                          } block w-full px-4 py-2 text-sm text-left`}
                        >
                          View Code
                        </button>
                      )}
                    </Menu.Item>
                  </div>
                </Menu.Items>
              </Transition>
            </Menu>
          </div>
        </div>
        <div className="mt-4 grid grid-cols-2 gap-4">
          <div>
            <p className={`text-sm font-medium ${isBlocked ? 'text-gray-300' : 'text-gray-600'}`}>Total Runs</p>
            <p className={`text-lg font-bold ${isBlocked ? 'text-white' : 'text-indigo-900'}`}>{totalRuns ?? 0}</p>
          </div>
          <div>
            <p className={`text-sm font-medium ${isBlocked ? 'text-gray-300' : 'text-gray-600'}`}>Total Submissions</p>
            <p className={`text-lg font-bold ${isBlocked ? 'text-white' : 'text-indigo-900'}`}>{totalSubmissions ?? 0}</p>
          </div>
        </div>
      </div>
    );
  };

  // Stats Graphs Component
  const StatsGraphs = () => {
    const studentNames = runSubmitStats?.studentStats.map((s) => s.student.name) || [];
    const correctAttempts = leaderboard.map((l) => l.correctAttempts || 0);
    const totalAttempts = leaderboard.map((l) => l.totalAttempts || 0);
    const wrongAttempts = leaderboard.map((l) => (l.totalAttempts || 0) - (l.correctAttempts || 0));

    const chartOptions = {
      responsive: true,
      plugins: {
        legend: { position: 'top' },
        title: { display: true },
      },
    };

    const correctChartData = {
      labels: studentNames,
      datasets: [
        {
          label: 'Correct Attempts',
          data: correctAttempts,
          backgroundColor: 'rgba(75, 192, 192, 0.6)',
        },
      ],
    };

    const totalChartData = {
      labels: studentNames,
      datasets: [
        {
          label: 'Total Attempts',
          data: totalAttempts,
          backgroundColor: 'rgba(54, 162, 235, 0.6)',
        },
      ],
    };

    const wrongChartData = {
      labels: studentNames,
      datasets: [
        {
          label: 'Wrong Attempts',
          data: wrongAttempts,
          backgroundColor: 'rgba(255, 99, 132, 0.6)',
        },
      ],
    };

    return (
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div>
          <h3 className="text-lg font-semibold text-gray-800 mb-4">Correct Attempts</h3>
          <Bar options={{ ...chartOptions, plugins: { ...chartOptions.plugins, title: { text: 'Correct Attempts' } } }} data={correctChartData} />
        </div>
        <div>
          <h3 className="text-lg font-semibold text-gray-800 mb-4">Total Attempts</h3>
          <Bar options={{ ...chartOptions, plugins: { ...chartOptions.plugins, title: { text: 'Total Attempts' } } }} data={totalChartData} />
        </div>
        
        <div>
          <h3 className="text-lg font-semibold text-gray-800 mb-4">Wrong Attempts</h3>
          <Bar options={{ ...chartOptions, plugins: { ...chartOptions.plugins, title: { text: 'Wrong Attempts' } } }} data={wrongChartData} />
        </div>
      </div>
    );
  };

  // Student Details Modal
  const StudentDetailsModal = () => {
    if (!selectedStudent) return null;

    const studentData = Array.isArray(leaderboard) ? leaderboard.find(l => l.studentId?._id === selectedStudent.student.id) : null;
    if (!studentData) return null;

    return (
      <Transition appear show={isModalOpen} as={React.Fragment}>
        <Dialog as="div" className="relative z-50" onClose={() => setIsModalOpen(false)}>
          <Transition.Child
            as={React.Fragment}
            enter="ease-out duration-300"
            enterFrom="opacity-0"
            enterTo="opacity-100"
            leave="ease-in duration-200"
            leaveFrom="opacity-100"
            leaveTo="opacity-0"
          >
            <div className="fixed inset-0 bg-black bg-opacity-25" />
          </Transition.Child>

          <div className="fixed inset-0 overflow-y-auto">
            <div className="flex min-h-full items-center justify-center p-4 text-center">
              <Transition.Child
                as={React.Fragment}
                enter="ease-out duration-300"
                enterFrom="opacity-0 scale-95"
                enterTo="opacity-100 scale-100"
                leave="ease-in duration-200"
                leaveFrom="opacity-100 scale-100"
                leaveTo="opacity-0 scale-95"
              >
                <Dialog.Panel className="w-full max-w-2xl transform overflow-hidden rounded-2xl bg-white p-6 text-left align-middle shadow-xl transition-all">
                  <Dialog.Title as="h3" className="text-lg font-medium leading-6 text-gray-900">
                    Student Details: {studentData.studentId.name}
                  </Dialog.Title>
                  <div className="mt-4 space-y-2">
                    <p className="text-sm text-gray-600">Email: {studentData.studentId.email}</p>
                    <p className="text-sm text-gray-600">Activity Status: {studentData.activityStatus}</p>
                    <p className="text-sm text-gray-600">Total Score: {studentData.totalScore}</p>
                    <p className="text-sm text-gray-600">Correct Attempts: {studentData.correctAttempts}</p>
                    <p className="text-sm text-gray-600">Wrong Attempts: {studentData.wrongAttempts}</p>
                    <p className="text-sm text-gray-600">Total Runs: {studentData.totalRuns}</p>
                    <p className="text-sm text-gray-600">Total Submissions: {studentData.totalSubmits}</p>
                    <h4 className="mt-4 text-sm font-medium text-gray-800">Attempts:</h4>
                    <ul className="mt-2 space-y-2">
                      {studentData.attempts.map((attempt, index) => (
                        <li key={index} className="text-sm text-gray-600">
                          Question ID: {attempt.questionId} - 
                          {attempt.isCorrect ? 'Correct' : 'Incorrect'} - 
                          Score: {attempt.score} - 
                          Submitted: {format(new Date(attempt.submittedAt), 'MM/dd/yyyy HH:mm')}
                        </li>
                      ))}
                    </ul>
                  </div>
                  <div className="mt-6">
                    <button
                      type="button"
                      className="inline-flex justify-center rounded-md border border-transparent bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2 transition-all duration-300"
                      onClick={() => setIsModalOpen(false)}
                    >
                      Close
                    </button>
                  </div>
                </Dialog.Panel>
              </Transition.Child>
            </div>
          </div>
        </Dialog>
      </Transition>
    );
  };

  // Question Report Component
  const QuestionReport = () => {
    if (!questionReport) return null;

    const isStudent = user.role === 'student';
    return (
      <div className="bg-white/90 backdrop-blur-sm rounded-2xl shadow-lg p-6 border border-gray-100">
        <h3 className="text-lg font-semibold text-gray-800 mb-4">
          Question: {questionReport.question.title}
        </h3>
        <div className="space-y-4">
          <div>
            <p className="text-sm font-medium text-gray-600">Description</p>
            <p className="text-gray-800">{questionReport.question.description}</p>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <p className="text-sm font-medium text-gray-600">Difficulty</p>
              <p className="text-gray-800">{questionReport.question.difficulty}</p>
            </div>
            <div>
              <p className="text-sm font-medium text-gray-600">Type</p>
              <p className="text-gray-800">{questionReport.question.type}</p>
            </div>
            <div>
              <p className="text-sm font-medium text-gray-600">Points</p>
              <p className="text-gray-800">{questionReport.question.points}</p>
            </div>
            <div>
              <p className="text-sm font-medium text-gray-600">Tags</p>
              <p className="text-gray-800">{questionReport.question.tags?.join(', ') || 'None'}</p>
            </div>
          </div>
          {!isStudent && (
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
              <div>
                <p className="text-sm font-medium text-gray-600">Total Students Attempted</p>
                <p className="text-lg font-bold text-indigo-900">{questionReport.totalStudentsAttempted ?? 0}</p>
              </div>
              <div>
                <p className="text-sm font-medium text-gray-600">Total Correct</p>
                <p className="text-lg font-bold text-green-900">{questionReport.totalCorrect ?? 0}</p>
              </div>
              <div>
                <p className="text-sm font-medium text-gray-600">Total Wrong</p>
                <p className="text-lg font-bold text-red-900">{questionReport.totalWrong ?? 0}</p>
              </div>
              <div>
                <p className="text-sm font-medium text-gray-600">Total Runs</p>
                <p className="text-lg font-bold text-blue-900">{questionReport.totalRuns ?? 0}</p>
              </div>
              <div>
                <p className="text-sm font-medium text-gray-600">Total Submits</p>
                <p className="text-lg font-bold text-blue-900">{questionReport.totalSubmits ?? 0}</p>
              </div>
                  <div>
                <p className="text-sm font-medium text-gray-600">              Total Unique Correct Attempt
</p>
                <p className="text-lg font-bold text-blue-900">2</p>
              </div>
              Total Unique Correct Attempt: 2
              <div>
                <p className="text-sm font-medium text-gray-600">Average Score</p>
                <p className="text-lg font-bold text-yellow-900">{questionReport.avgScore?.toFixed(2) ?? 0}</p>
              </div>
            </div>
          )}
          <div>
            <h4 className="text-sm font-medium text-gray-800 mb-2">Student Performance</h4>
            {questionReport.studentData?.length > 0 ? (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                {questionReport.studentData.map((student, index) => (
                  <div key={index} className="bg-gray-50 p-4 rounded-lg">
                    <p className="text-sm font-medium text-gray-600">{student.studentName}</p>
                    <p className="text-sm text-gray-600">Email: {student.studentEmail}</p>
                    <p className="text-sm text-gray-600">Total Attempts: {student.totalAttempts}</p>
 
                    <p className="text-sm text-gray-600">Correct Attempts: {student.correctAttempts}</p>
                    <p className="text-sm text-gray-600">Wrong Attempts: {student.wrongAttempts}</p>
                    <p className="text-sm text-gray-600">Total Runs: {student.totalRuns}</p>
                    <p className="text-sm text-gray-600">Total Submits: {student.totalSubmits}</p>
                    <p className="text-sm text-gray-600">Highest Score: {student.highestScore}</p>
                    <p className="text-sm text-gray-600">
                      Latest Submission: {student.latestSubmission ? format(new Date(student.latestSubmission), 'MM/dd/yyyy HH:mm') : 'N/A'}
                    </p>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-gray-500">No student performance data available</p>
            )}
          </div>
          {!isStudent && <QuestionReportGraph />}
        </div>
      </div>
    );
  };

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
      <div className="mb-12">
        <div className="flex justify-between items-start">
          <div>
            <h1 className="text-4xl font-extrabold bg-clip-text text-transparent bg-gradient-to-r from-indigo-600 to-indigo-400 tracking-tight">
              Admin Dashboard - {classDetails.name}
            </h1>
            <p className="mt-3 text-lg text-gray-600 font-medium">{classDetails.description}</p>
          </div>
          <Link
            to={`/teacher/classes/${classId}`}
            className="inline-flex items-center px-4 py-2 rounded-lg text-sm font-semibold text-gray-700 bg-white border border-gray-200 shadow-sm hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2 transition-all duration-300"
          >
            Back to Class
          </Link>
        </div>
      </div>

      {error && (
        <div className="mb-8 p-4 rounded-xl bg-red-50/80 backdrop-blur-sm border border-red-200 shadow-sm">
          <div className="flex items-center">
            <svg
              className="h-6 w-6 text-red-500 mr-3"
              xmlns="http://www.w3.org/2000/svg"
              viewBox="0 0 20 20"
              fill="currentColor"
            >
              <path
                fillRule="evenodd"
                d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 001.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l-1.293-1.293a1 1 0 00-1.414 1.414L8.586 10 8.707 7.293z"
                clipRule="evenodd"
              />
            </svg>
            <p className="text-sm font-semibold text-red-800">
              {error === 'Class not found or you are not authorized'
                ? 'You do not have permission to view this class or it does not exist.'
                : error}
            </p>
          </div>
        </div>
      )}

      {/* Tab Navigation */}
      <Tab.Group>
        <Tab.List className="flex space-x-1 rounded-xl bg-gray-100 dark:bg-gray-800 p-1 mb-6">
          {['Analytics', 'Students', 'Management'].map((category) => (
            <Tab
              key={category}
              className={({ selected }) =>
                `w-full rounded-lg py-2.5 text-sm font-medium leading-5 transition-all duration-200 focus:outline-none
                ${
                  selected
                    ? 'bg-white dark:bg-gray-700 text-gray-900 dark:text-white shadow'
                    : 'text-gray-700 dark:text-gray-300 hover:bg-white/[0.12] hover:text-gray-900 dark:hover:text-white'
                }`
              }
            >
              {category}
            </Tab>
          ))}
        </Tab.List>

        <Tab.Panels>
          {/* Analytics Tab */}
          <Tab.Panel>
      {/* Participant Statistics */}
      <section className="mb-12">
        <h2 className="text-2xl font-semibold text-gray-800 mb-4">Participant Statistics</h2>
        <div className="bg-white/90 backdrop-blur-sm rounded-2xl shadow-lg p-6 border border-gray-100">
          {participantStats ? (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
              <div className="p-4 bg-indigo-50 rounded-lg">
                <p className="text-sm font-medium text-indigo-700">Total Students</p>
                <p className="text-2xl font-bold text-indigo-900">
                  {participantStats.totalParticipants ?? 0}
                </p>
              </div>
              <div className="p-4 bg-green-50 rounded-lg">
                <p className="text-sm font-medium text-green-700">Active Students</p>
                <p className="text-2xl font-bold text-green-900">
                  {participantStats.activityStats?.active ?? 0} ({participantStats.activityPercentage?.active ?? 0}%)
                </p>
              </div>
              <div className="p-4 bg-red-50 rounded-lg">
                <p className="text-sm font-medium text-red-700">Blocked Students</p>
                <p className="text-2xl font-bold text-red-900">
                  {participantStats.blockedStudents ?? 0}
                </p>
              </div>
              <div className="p-4 bg-yellow-50 rounded-lg">
                <p className="text-sm font-medium text-yellow-700">Focused Students</p>
                <p className="text-2xl font-bold text-yellow-900">
                  {participantStats.activityStats?.focused ?? 0} ({participantStats.activityPercentage?.focused ?? 0}%)
                </p>
              </div>
              <div className="p-4 bg-gray-50 rounded-lg">
                <p className="text-sm font-medium text-gray-700">Inactive Students</p>
                <p className="text-2xl font-bold text-gray-900">
                  {participantStats.activityStats?.inactive ?? 0} ({participantStats.activityPercentage?.inactive ?? 0}%)
                </p>
              </div>
              <div className="p-4 bg-blue-50 rounded-lg">
                <p className="text-sm font-medium text-blue-700">Correct Submission Rate</p>
                <p className="text-2xl font-bold text-blue-900">
                  {participantStats.correctPercentage ?? 0}%
                </p>
              </div>
            </div>
          ) : (
            <p className="text-gray-500">No participant stats available</p>
          )}
        </div>
      </section>

      {/* Run/Submit Statistics */}
      <section className="mb-12">
        <h2 className="text-2xl font-semibold text-gray-800 mb-4">Run/Submit Statistics</h2>
        <div className="bg-white/90 backdrop-blur-sm rounded-2xl shadow-lg p-6 border border-gray-100">
          {runSubmitStats ? (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
              <div className="p-4 bg-indigo-50 rounded-lg">
                <p className="text-sm font-medium text-indigo-700">Total Runs</p>
                <p className="text-2xl font-bold text-indigo-900">
                  {runSubmitStats.classTotalRuns ?? 0}
                </p>
              </div>
              <div className="p-4 bg-green-50 rounded-lg">
                <p className="text-sm font-medium text-green-700">Total Submissions</p>
                <p className="text-2xl font-bold text-green-900">
                  {runSubmitStats.classTotalSubmits ?? 0}
                </p>
              </div>
              <div className="p-4 bg-blue-50 rounded-lg">
                <p className="text-sm font-medium text-blue-700">Correct Submissions</p>
                <p className="text-2xl font-bold text-blue-900">
                  {runSubmitStats.correctSubmissions ?? 0}
                </p>
              </div>
            </div>
          ) : (
            <p className="text-gray-500">No run/submit stats available</p>
          )}
        </div>
      </section>

      {/* Attempt Graphs */}
      <section className="mb-12">
        <h2 className="text-2xl font-semibold text-gray-800 mb-4">Attempt Statistics</h2>
        <div className="bg-white/90 backdrop-blur-sm rounded-2xl shadow-lg p-6 border border-gray-100">
          {runSubmitStats && leaderboard.length > 0 ? (
            <StatsGraphs />
          ) : (
            <p className="text-gray-500">No attempt data available</p>
          )}
        </div>
      </section>
          </Tab.Panel>

          {/* Students Tab */}
          <Tab.Panel>
      {/* Student Cards */}
      <section className="mb-12">
        <h2 className="text-2xl font-semibold text-gray-800 mb-4">Students</h2>
        <div className="bg-white/90 backdrop-blur-sm rounded-2xl shadow-lg p-6 border border-gray-100 overflow-visible">
          {runSubmitStats?.studentStats?.length > 0 ? (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6 overflow-visible" style={{ position: 'relative' }}>
              {runSubmitStats.studentStats.map((student, index) => (
                <StudentCard key={student.student.id || index} student={student} />
              ))}
            </div>
          ) : (
            <p className="text-gray-500">No student data available</p>
          )}
        </div>
      </section>
          </Tab.Panel>

          {/* Management Tab */}
          <Tab.Panel>
      {/* Question Perspective Report */}
      <section className="mb-12">
        <Disclosure>
          {({ open }) => (
            <>
              <Disclosure.Button className="flex justify-between w-full px-4 py-2 text-lg font-semibold text-gray-800 bg-gray-50 rounded-lg hover:bg-gray-100 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2 transition-all duration-300">
                <span>Question Perspective Report</span>
                <svg
                  className={`${open ? 'transform rotate-180' : ''} w-5 h-5 text-gray-600`}
                  xmlns="http://www.w3.org/2000/svg"
                  viewBox="0 0 20 20"
                  fill="currentColor"
                >
                  <path
                    fillRule="evenodd"
                    d="M5.293 7.293a1 1 0 011.414 0L10 10.586l3.293-3.293a1 1 0 111.414 1.414l-4 4a1 1 0 01-1.414 0l-4-4a1 1 0 010-1.414z"
                    clipRule="evenodd"
                  />
                </svg>
              </Disclosure.Button>
              <Disclosure.Panel className="mt-4">
                <div className="bg-white/90 backdrop-blur-sm rounded-2xl shadow-lg p-6 border border-gray-100">
                  <form onSubmit={handleFetchQuestionReport} className="space-y-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-800">Question ID</label>
                      <input
                        type="text"
                        value={questionIdInput}
                        onChange={(e) => setQuestionIdInput(e.target.value)}
                        className="mt-1 block w-full border-gray-300 rounded-md shadow-sm focus:ring-indigo-500 focus:border-indigo-500"
                        placeholder="Enter question ID"
                        required
                      />
                    </div>
                    <button
                      type="submit"
                      className="inline-flex items-center px-4 py-2 rounded-lg text-sm font-semibold text-white bg-indigo-600 hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2 transition-all duration-300 disabled:bg-indigo-400"
                      disabled={reportLoading}
                    >
                      {reportLoading ? (
                        <svg
                          className="animate-spin h-5 w-5 mr-2 text-white"
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
                      ) : null}
                      {reportLoading ? 'Loading...' : 'Fetch Report'}
                    </button>
                  </form>
                  {questionReport && <QuestionReport />}
                </div>
              </Disclosure.Panel>
            </>
          )}
        </Disclosure>
      </section>

      {/* Create Assignment */}
      <section className="mb-12">
        <h2 className="text-2xl font-semibold text-gray-800 mb-4">Create Assignment</h2>
        <div className="bg-white/90 backdrop-blur-sm rounded-2xl shadow-lg p-6 border border-gray-100">
          <form onSubmit={handleCreateAssignment} className="space-y-6">
            <div>
              <label className="block text-sm font-medium text-gray-800">Question ID</label>
              <input
                type="text"
                value={newAssignment.questionId}
                onChange={(e) =>
                  setNewAssignment({ ...newAssignment, questionId: e.target.value })
                }
                className="mt-1 block w-full border-gray-300 rounded-md shadow-sm focus:ring-indigo-500 focus:border-indigo-500"
                placeholder="Enter question ID"
                required
              />
              {formErrors.questionId && (
                <p className="mt-1 text-sm text-red-600">{formErrors.questionId}</p>
              )}
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-800">Due Date</label>
              <input
                type="datetime-local"
                value={newAssignment.dueDate}
                onChange={(e) =>
                  setNewAssignment({ ...newAssignment, dueDate: e.target.value })
                }
                className="mt-1 block w-full border-gray-300 rounded-md shadow-sm focus:ring-indigo-500 focus:border-indigo-500"
                required
              />
              {formErrors.dueDate && (
                <p className="mt-1 text-sm text-red-600">{formErrors.dueDate}</p>
              )}
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-800">Max Points</label>
              <input
                type="number"
                value={newAssignment.maxPoints}
                onChange={(e) =>
                  setNewAssignment({ ...newAssignment, maxPoints: e.target.value })
                }
                className="mt-1 block w-full border-gray-300 rounded-md shadow-sm focus:ring-indigo-500 focus:border-indigo-500"
                placeholder="Enter max points"
                required
              />
              {formErrors.maxPoints && (
                <p className="mt-1 text-sm text-red-600">{formErrors.maxPoints}</p>
              )}
            </div>
            <button
              type="submit"
              className="inline-flex items-center px-4 py-2 rounded-lg text-sm font-semibold text-white bg-indigo-600 hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2 transition-all duration-300"
            >
              Create Assignment
            </button>
          </form>
        </div>
      </section>

      {/* Assignments List */}
      <section className="mb-12">
        <div className="flex justify-between items-center mb-4">
          <h2 className="text-2xl font-semibold text-gray-800">Assignments ({filteredAssignments.length})</h2>
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
            <svg className="h-5 w-5 text-gray-400 absolute left-3 top-2.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
            </svg>
          </div>
        </div>
        <div className="bg-white/90 backdrop-blur-sm rounded-2xl shadow-lg p-6 border border-gray-100">
          {filteredAssignments.length > 0 ? (
            <>
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Question
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Due Date
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Max Points
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
                        {assignment.questionId.title || assignment.questionId}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                        {format(new Date(assignment.dueDate), 'MM/dd/yyyy HH:mm')}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                        {assignment.maxPoints}
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
                  Showing {assignmentIndexOfFirstItem + 1} to {Math.min(assignmentIndexOfLastItem, filteredAssignments.length)} of {filteredAssignments.length} assignments
                </p>
                <div className="flex gap-2">
                  <button
                    onClick={() => setAssignmentCurrentPage(p => Math.max(1, p - 1))}
                    disabled={assignmentCurrentPage === 1}
                    className="px-3 py-1 border rounded-md text-sm disabled:opacity-50 disabled:cursor-not-allowed hover:bg-gray-50"
                  >
                    Previous
                  </button>
                  <span className="px-3 py-1 text-sm text-gray-700">
                    Page {assignmentCurrentPage} of {assignmentTotalPages}
                  </span>
                  <button
                    onClick={() => setAssignmentCurrentPage(p => Math.min(assignmentTotalPages, p + 1))}
                    disabled={assignmentCurrentPage === assignmentTotalPages}
                    className="px-3 py-1 border rounded-md text-sm disabled:opacity-50 disabled:cursor-not-allowed hover:bg-gray-50"
                  >
                    Next
                  </button>
                </div>
              </div>
            )}
            </>
          ) : (
            <p className="text-gray-500">
              {assignmentSearch ? `No assignments found matching "${assignmentSearch}"` : 'No assignments available'}
            </p>
          )}
        </div>
      </section>

      {/* Block User */}
      <section className="mb-12">
        <h2 className="text-2xl font-semibold text-gray-800 mb-4">Block User</h2>
        <div className="bg-white/90 backdrop-blur-sm rounded-2xl shadow-lg p-6 border border-gray-100">
          <form
            onSubmit={(e) => {
              e.preventDefault();
              handleBlockUser(blockStudentId, true);
            }}
            className="space-y-6"
          >
            <div>
              <label className="block text-sm font-medium text-gray-800">Student ID</label>
              <input
                type="text"
                value={blockStudentId}
                onChange={(e) => setBlockStudentId(e.target.value)}
                className="mt-1 block w-full border-gray-300 rounded-md shadow-sm focus:ring-indigo-500 focus:border-indigo-500"
                placeholder="Enter student ID"
                required
              />
            </div>
            <button
              type="submit"
              className="inline-flex items-center px-4 py-2 rounded-lg text-sm font-semibold text-white bg-red-600 hover:bg-red-700 focus:outline-none focus:ring-2 focus:ring-red-500 focus:ring-offset-2 transition-all duration-300"
            >
              Block User
            </button>
          </form>
        </div>
      </section>

      {/* Block All Users */}
      <section className="mb-12">
        <h2 className="text-2xl font-semibold text-gray-800 mb-4">Block All Users</h2>
        <div className="bg-white/90 backdrop-blur-sm rounded-2xl shadow-lg p-6 border border-gray-100">
          <div className="flex items-center space-x-4">
            <label className="flex items-center text-sm font-medium text-gray-800">
              <input
                type="checkbox"
                checked={blockAll}
                onChange={(e) => setBlockAll(e.target.checked)}
                className="mr-2 h-4 w-4 text-indigo-600 focus:ring-indigo-500 border-gray-200 rounded"
              />
              Block All Students
            </label>
            <button
              onClick={handleBlockAllUsers}
              className="inline-flex items-center px-4 py-2 rounded-lg text-sm font-semibold text-white bg-red-600 hover:bg-red-700 focus:outline-none focus:ring-2 focus:ring-red-500 focus:ring-offset-2 transition-all duration-300"
            >
              Apply
            </button>
          </div>
        </div>
      </section>

      {/* Search Leaderboard */}
      <section className="mb-12">
        <h2 className="text-2xl font-semibold text-gray-800 mb-4">Search Leaderboard</h2>
        <div className="bg-white/90 backdrop-blur-sm rounded-2xl shadow-lg p-6 border border-gray-100">
          <form onSubmit={handleSearchLeaderboard} className="space-y-6">
            <div>
              <label className="block text-sm font-medium text-gray-800">Student Name</label>
              <input
                type="text"
                value={leaderboardFilters.studentName}
                onChange={(e) =>
                  setLeaderboardFilters({
                    ...leaderboardFilters,
                    studentName: e.target.value,
                  })
                }
                className="mt-1 block w-full border-gray-300 rounded-md shadow-sm focus:ring-indigo-500 focus:border-indigo-500"
                placeholder="Enter student name"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-800">Activity Status</label>
              <select
                value={leaderboardFilters.activityStatus}
                onChange={(e) =>
                  setLeaderboardFilters({
                    ...leaderboardFilters,
                    activityStatus: e.target.value,
                  })
                }
                className="mt-1 block w-full border-gray-300 rounded-md shadow-sm focus:ring-indigo-500 focus:border-indigo-500"
              >
                <option value="">All</option>
                <option value="active">Active</option>
                <option value="inactive">Inactive</option>
                <option value="focused">Focused</option>
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-800">Min Correct Attempts</label>
              <input
                type="number"
                value={leaderboardFilters.minCorrectAttempts}
                onChange={(e) =>
                  setLeaderboardFilters({
                    ...leaderboardFilters,
                    minCorrectAttempts: e.target.value,
                  })
                }
                className="mt-1 block w-full border-gray-300 rounded-md shadow-sm focus:ring-indigo-500 focus:border-indigo-500"
                placeholder="Enter minimum correct attempts"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-800">Max Attempts</label>
              <input
                type="number"
                value={leaderboardFilters.maxAttempts}
                onChange={(e) =>
                  setLeaderboardFilters({
                    ...leaderboardFilters,
                    maxAttempts: e.target.value,
                  })
                }
                className="mt-1 block w-full border-gray-300 rounded-md shadow-sm focus:ring-indigo-500 focus:border-indigo-500"
                placeholder="Enter maximum attempts"
              />
            </div>
            <button
              type="submit"
              className="inline-flex items-center px-4 py-2 rounded-lg text-sm font-semibold text-white bg-indigo-600 hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2 transition-all duration-300"
            >
              Search
            </button>
          </form>
        </div>
      </section>

      {/* View Submission Code */}
      <section className="mb-12">
        <h2 className="text-2xl font-semibold text-gray-800 mb-4">View Submission Code</h2>
        <div className="bg-white/90 backdrop-blur-sm rounded-2xl shadow-lg p-6 border border-gray-100">
          <form
            onSubmit={(e) => {
              e.preventDefault();
              handleViewSubmissionCode(submissionId);
            }}
            className="space-y-6"
          >
            <div>
              <label className="block text-sm font-medium text-gray-800">Submission ID</label>
              <input
                type="text"
                value={submissionId}
                onChange={(e) => setSubmissionId(e.target.value)}
                className="mt-1 block w-full border-gray-300 rounded-md shadow-sm focus:ring-indigo-500 focus:border-indigo-500"
                placeholder="Enter submission ID"
                required
              />
            </div>
            <button
              type="submit"
              className="inline-flex items-center px-4 py-2 rounded-lg text-sm font-semibold text-white bg-indigo-600 hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2 transition-all duration-300"
            >
              View Code
            </button>
          </form>
          {submissionCode && (
            <pre className="mt-6 bg-gray-50 p-4 rounded-lg overflow-auto text-sm text-gray-800 font-mono">
              <code>{submissionCode}</code>
            </pre>
          )}
        </div>
      </section>
          </Tab.Panel>
        </Tab.Panels>
      </Tab.Group>

      <StudentDetailsModal />
    </div>
  );
};

export default ClassDetails;