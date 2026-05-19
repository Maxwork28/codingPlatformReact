import React, { useEffect, useState, useCallback, Fragment } from 'react';
import { useParams, Link } from 'react-router-dom';
import { io } from 'socket.io-client';
import { API_BASE_URL } from '../../../common/constants';
import { useSelector } from 'react-redux';
import { Tab, Menu, Transition, Dialog, Disclosure, Combobox } from '@headlessui/react';
import { CheckIcon, ChevronUpDownIcon } from '@heroicons/react/20/solid';
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
  focusStudent,
  viewSubmissionCode,
  getQuestionPerspectiveReport,
  adminSearchQuestionsById,
  getClassStudents,
  getQuestionSummary,
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
  const [submissionViewData, setSubmissionViewData] = useState(null); // { code, language, questionId, classId, isCorrect, status }
  const [questionReport, setQuestionReport] = useState(null);
  const [questionSummary, setQuestionSummary] = useState([]);
  const [analyticsStudentFilter, setAnalyticsStudentFilter] = useState('all'); // all | correct | incorrect | inactive | active
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
  const [assignmentQuestionSearchQuery, setAssignmentQuestionSearchQuery] = useState('');
  const [allQuestionsForAssignment, setAllQuestionsForAssignment] = useState([]);

  // Question search
  const [questionSearchKeyword, setQuestionSearchKeyword] = useState('');
  const [selectedQuestionId, setSelectedQuestionId] = useState('');
  const [attachQuestionSearchQuery, setAttachQuestionSearchQuery] = useState('');
  const [allAvailableQuestions, setAllAvailableQuestions] = useState([]);

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
  const [studentModalSubmissionData, setStudentModalSubmissionData] = useState(null);
  const [studentModalSubmissionLoading, setStudentModalSubmissionLoading] = useState(false);
  const [studentModalLoadingSubmissionId, setStudentModalLoadingSubmissionId] = useState(null);
  
  // Tab state - persist selected tab
  const [selectedTabIndex, setSelectedTabIndex] = useState(0);
  
  // Tab change handler - prevents infinite loops
  const handleTabChange = useCallback((index) => {
    setSelectedTabIndex((prevIndex) => {
      // Only update if the index actually changed
      return index !== prevIndex ? index : prevIndex;
    });
  }, []);
  
  // Toast notification state
  const [toast, setToast] = useState({ show: false, message: '', type: '' });
  
  // Toast notification helper
  const showToast = (message, type = 'info') => {
    setToast({ show: true, message, type });
    setTimeout(() => {
      setToast({ show: false, message: '', type: '' });
    }, 5000); // Auto-dismiss after 5 seconds
  };

  // Search and pagination for assignments
  const [assignmentSearch, setAssignmentSearch] = useState('');
  const [assignmentCurrentPage, setAssignmentCurrentPage] = useState(1);
  const [assignmentItemsPerPage] = useState(5);

  // Search and pagination for students
  const [studentSearch, setStudentSearch] = useState('');
  const [studentCurrentPage, setStudentCurrentPage] = useState(1);
  const [studentItemsPerPage] = useState(10);

  // Search and pagination for questions
  const [questionSearch, setQuestionSearch] = useState('');
  const [questionCurrentPage, setQuestionCurrentPage] = useState(1);
  const [questionItemsPerPage] = useState(12);

  // Helper function
  const stripHtml = (html) => {
    if (!html || typeof html !== 'string') return '';
    const div = document.createElement('div');
    div.innerHTML = html;
    return div.textContent || div.innerText || '';
  };

  // Helper function to check if a string is a valid MongoDB ObjectId
  const isValidObjectId = (str) => {
    const objectIdPattern = /^[0-9a-fA-F]{24}$/;
    return objectIdPattern.test(str);
  };

  // Filter questions for assignment creation based on search query
  const filteredAssignmentQuestions = assignmentQuestionSearchQuery === ''
    ? allQuestionsForAssignment
    : allQuestionsForAssignment.filter((q) => {
        const searchLower = assignmentQuestionSearchQuery.toLowerCase();
        const titleMatch = stripHtml(q.title || '').toLowerCase().includes(searchLower);
        const idMatch = q._id.toLowerCase().includes(searchLower);
        const typeMatch = (q.type || '').toLowerCase().includes(searchLower);
        return titleMatch || idMatch || typeMatch;
      });

  // Filter questions for attach question dropdown
  // Always use availableQuestions (all teacher's questions) as the base, not filteredQuestions
  // This ensures all teacher's questions are available for attaching, regardless of search state
  const filteredAttachQuestions = attachQuestionSearchQuery === ''
    ? availableQuestions
    : availableQuestions.filter((q) => {
        const titleMatch = stripHtml(q.title || '').toLowerCase().includes(attachQuestionSearchQuery.toLowerCase());
        const idMatch = q._id && q._id.toLowerCase().includes(attachQuestionSearchQuery.toLowerCase());
        return titleMatch || idMatch;
      });
  
  // Debug logging for attach dropdown
  if (attachQuestionSearchQuery) {
    console.log('[TeacherClassView] 🔍 Attach dropdown search:', {
      searchQuery: attachQuestionSearchQuery,
      availableQuestionsCount: availableQuestions.length,
      filteredCount: filteredAttachQuestions.length,
      availableQuestionIds: availableQuestions.map(q => q._id),
      filteredQuestionIds: filteredAttachQuestions.map(q => q._id)
    });
  }

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

  // Filter students by analytics filter (correct/incorrect/inactive/active)
  const studentsByAnalyticsFilter = analyticsStudentFilter === 'all'
    ? leaderboard
    : leaderboard.filter((s) => {
        const correct = s.correctAttempts || 0;
        const total = s.totalAttempts || s.totalSubmissions || 0;
        const status = (s.activityStatus || 'inactive').toLowerCase();
        if (analyticsStudentFilter === 'correct') return correct > 0;
        if (analyticsStudentFilter === 'incorrect') return total > 0 && correct === 0;
        if (analyticsStudentFilter === 'inactive') return total === 0 || status === 'inactive';
        if (analyticsStudentFilter === 'active') return status === 'active';
        return true;
      });

  // Filter students based on search
  const filteredStudents =
    studentSearch === ''
      ? studentsByAnalyticsFilter
      : studentsByAnalyticsFilter.filter((studentData) => {
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

  // Filter questions based on search
  const filteredQuestionsList = questionSearch === ''
    ? questions
    : questions.filter((q) =>
        stripHtml(q.title || '').toLowerCase().includes(questionSearch.toLowerCase()) ||
        (q._id && q._id.toLowerCase().includes(questionSearch.toLowerCase())) ||
        (q.type && q.type.toLowerCase().includes(questionSearch.toLowerCase()))
      );

  const questionIndexOfLastItem = questionCurrentPage * questionItemsPerPage;
  const questionIndexOfFirstItem = questionIndexOfLastItem - questionItemsPerPage;
  const currentQuestions = filteredQuestionsList.slice(questionIndexOfFirstItem, questionIndexOfLastItem);
  const questionTotalPages = Math.ceil(filteredQuestionsList.length / questionItemsPerPage);

  // Fetch all data
  const fetchData = useCallback(async (skipLoading = false) => {
    if (!user) {
      console.log('[TeacherClassView] No user, skipping data fetch');
      return;
    }
    try {
      if (!skipLoading) {
        setLoading(true);
      }
      console.log('[TeacherClassView] Fetching data for classId:', classId);

      const classResponse = await getClassDetails(classId);
      console.log('[TeacherClassView] getClassDetails response:', classResponse.data);
      const cls = classResponse.data.class;

      if (cls && (cls.teachers.some((t) => String(t._id) === String(user.id)) || String(cls.createdBy._id) === String(user.id))) {
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

        // Fetch all enrolled students from the class
        let allEnrolledStudents = [];
        try {
          const studentsResponse = await getClassStudents(classId);
          allEnrolledStudents = studentsResponse.data.students || [];
          console.log('[TeacherClassView] 👥 All enrolled students fetched:', allEnrolledStudents.length);
        } catch (err) {
          console.error('[TeacherClassView] Failed to fetch enrolled students:', err.message);
          // Continue with leaderboard data only if students fetch fails
        }

        // Fetch leaderboard (students with submissions)
        const leaderboardResponse = await searchLeaderboard(classId, {});
        const leaderboardData = Array.isArray(leaderboardResponse.data.leaderboard)
          ? leaderboardResponse.data.leaderboard
          : [];
        
        console.log('[TeacherClassView] 📊 Leaderboard data received:', leaderboardData.length, 'entries');
        
        // Create a map of student IDs from leaderboard for quick lookup
        const leaderboardStudentIds = new Set(
          leaderboardData.map(entry => String(entry.studentId?._id || entry.studentId))
        );
        
        // Merge: Start with leaderboard data (has stats), then add enrolled students not in leaderboard
        const mergedStudents = [...leaderboardData];
        
        // Add enrolled students who don't have any submissions yet
        allEnrolledStudents.forEach((student) => {
          const studentId = String(student._id);
          if (!leaderboardStudentIds.has(studentId)) {
            // Create a leaderboard entry for students without submissions
            mergedStudents.push({
              studentId: {
                _id: student._id,
                name: student.name,
                email: student.email,
              },
              totalSubmits: 0,
              totalRuns: 0,
              correctAttempts: 0,
              totalAttempts: 0,
              needsFocus: false,
              activityStatus: 'inactive',
              isBlocked: student.isBlocked || false,
            });
          }
        });
        
        console.log('[TeacherClassView] ✅ Merged students:', mergedStudents.length, '(enrolled:', allEnrolledStudents.length, ', with submissions:', leaderboardData.length, ')');
        setLeaderboard(mergedStudents);

        // Fetch questions
        const questionsResponse = await getQuestionsByClass(classId);
        // Show all questions assigned to the class (including admin-created ones)
        // Backend already ensures teacher can only see questions from classes they're assigned to
        setQuestions(questionsResponse.data.questions || []);
        
        // Set questions associated with class for assignment creation (like admin)
        setAllQuestionsForAssignment(questionsResponse.data.questions);

        // Fetch available questions (backend now filters by role - teachers only get their own questions)
        console.log('[TeacherClassView] 🔍 Fetching questions for attach dropdown...');
        const allQuestionsResponse = await getAllQuestions();
        console.log('[TeacherClassView] 📦 Questions received:', allQuestionsResponse.data.questions.length);
        
        // Log all questions (backend already filtered for teachers)
        console.log('[TeacherClassView] 📋 Questions details:');
        allQuestionsResponse.data.questions.forEach((q, idx) => {
          const creatorId = q.createdBy?._id || q.createdBy || 'N/A';
          console.log(`  [${idx + 1}] ✅ ID: ${q._id}, Title: ${stripHtml(q.title || '').substring(0, 40)}..., CreatedBy: ${creatorId}, Type: ${q.type}`);
        });
        
        // Backend already filters to only teacher's questions, so no need to filter again
        const userQuestions = allQuestionsResponse.data.questions;
        
        console.log('[TeacherClassView] ✅ Teacher questions:', userQuestions.length);
        console.log('[TeacherClassView] 📝 Teacher question IDs:', userQuestions.map(q => q._id));
        console.log('[TeacherClassView] 📝 Teacher question titles:', userQuestions.map(q => stripHtml(q.title || '').substring(0, 30)));
        
        setAvailableQuestions(userQuestions);
        setFilteredQuestions(userQuestions); // Initialize filteredQuestions with user's questions
        setAllAvailableQuestions(allQuestionsResponse.data.questions);

        // Fetch question-wise summary
        try {
          const summaryRes = await getQuestionSummary(classId);
          setQuestionSummary(summaryRes.data.summaries || []);
        } catch (err) {
          console.error('[TeacherClassView] Failed to fetch question summary:', err.message);
          setQuestionSummary([]);
        }
      } else {
        setError('Class not found or you are not authorized');
      }
    } catch (err) {
      console.error('[TeacherClassView] Error fetching data:', err.message);
      setError(err.error || 'Failed to fetch data');
    } finally {
      if (!skipLoading) {
        setLoading(false);
      }
    }
  }, [classId, user]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  // Real-time analytics: listen for updates
  useEffect(() => {
    if (!classId) return;
    const socket = io(API_BASE_URL, { transports: ['websocket', 'polling'] });
    socket.emit('joinClass', classId);
    socket.on('analyticsUpdated', ({ classId: updatedClassId }) => {
      if (updatedClassId === classId) fetchData(true);
    });
    socket.on('codeRun', () => fetchData(true));
    socket.on('submissionUpdate', () => fetchData(true));
    socket.on('studentBlockStatusUpdated', () => fetchData(true));
    return () => {
      socket.off('analyticsUpdated');
      socket.off('codeRun');
      socket.off('submissionUpdate');
      socket.off('studentBlockStatusUpdated');
      socket.emit('leaveClass', classId);
      socket.disconnect();
    };
  }, [classId, fetchData]);

  // Debug: Log when availableQuestions changes
  useEffect(() => {
    console.log('[TeacherClassView] 📊 availableQuestions updated:', {
      count: availableQuestions.length,
      questionIds: availableQuestions.map(q => q._id),
      questionTitles: availableQuestions.map(q => stripHtml(q.title || '').substring(0, 30))
    });
  }, [availableQuestions]);

  // Question search effect - removed, using handleQuestionSearch instead

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
      await createAssignment(classId, {
        questionId: assignmentForm.questionId,
        maxPoints: assignmentForm.maxPoints,
        dueDate: assignmentForm.dueDate,
      });
      const successMsg = 'Assignment created successfully!';
      setAssignmentMessage(successMsg);
      setAssignmentForm({ questionId: '', maxPoints: '', dueDate: '' });
      setAssignmentQuestionSearchQuery('');
      showToast(successMsg, 'success');

      // Refresh assignments
      const assignmentsResponse = await getAssignments(classId);
      setAssignments(assignmentsResponse.data.assignments);

      setTimeout(() => setAssignmentMessage(''), 3000);
    } catch (err) {
      console.error('handleCreateAssignment error', err);
      const errorMsg = typeof err === 'string' ? err : (err.message || err.response?.data?.error || 'Failed to create assignment');
      setAssignmentError(errorMsg);
      showToast(errorMsg, 'error');
      setTimeout(() => setAssignmentError(''), 5000);
    } finally {
      setAssignmentLoading(false);
    }
  };

  const handleDeleteAssignment = async (assignmentId) => {
    if (!window.confirm('Are you sure you want to delete this assignment?')) return;

    try {
      await deleteAssignment(classId, assignmentId);
      setAssignments(assignments.filter((a) => a._id !== assignmentId));
      const successMsg = 'Assignment deleted successfully!';
      setAssignmentMessage(successMsg);
      showToast(successMsg, 'success');
      setTimeout(() => setAssignmentMessage(''), 3000);
    } catch (err) {
      const errorMsg = typeof err === 'string' ? err : (err.error || 'Failed to delete assignment');
      setAssignmentError(errorMsg);
      showToast(errorMsg, 'error');
    }
  };

  const handleQuestionSearch = async () => {
    console.log('handleQuestionSearch called', { keyword: questionSearchKeyword });
    try {
      if (!questionSearchKeyword.trim()) {
        setFilteredQuestions(availableQuestions);
        return;
      }

      // Check if the search keyword is a valid ObjectId
      if (isValidObjectId(questionSearchKeyword.trim())) {
        console.log('handleQuestionSearch: Searching by ID', { questionId: questionSearchKeyword.trim() });
        const response = await adminSearchQuestionsById(questionSearchKeyword.trim());
        console.log('handleQuestionSearch success (ID search)', { question: response.data.question });
        const questions = response.data.question ? [response.data.question] : [];
        // Filter to only user's questions
        const userQuestions = questions.filter((q) => String(q.createdBy._id) === String(user.id));
        setFilteredQuestions(userQuestions);
      } else {
        console.log('handleQuestionSearch: Searching by title', { title: questionSearchKeyword });
        const response = await searchQuestions({ title: questionSearchKeyword });
        console.log('handleQuestionSearch success (title search)', { questions: response.data.questions });
        const userQuestions = response.data.questions.filter((q) => String(q.createdBy._id) === String(user.id));
        setFilteredQuestions(userQuestions);
      }
    } catch (err) {
      console.error('handleQuestionSearch error', err);
      setError(err.message || 'Failed to search questions');
    }
  };

  const handleAttachQuestion = async () => {
    console.log('handleAttachQuestion called', { classId, selectedQuestionId });
    if (!selectedQuestionId) {
      const errorMsg = 'Please select a question to attach';
      setError(errorMsg);
      showToast(errorMsg, 'warning');
      return;
    }
    try {
      await assignQuestionToClass(selectedQuestionId, classId);
      await fetchData(true);
      setSelectedQuestionId('');
      setQuestionSearchKeyword('');
      setFilteredQuestions(availableQuestions);
      const successMsg = 'Question attached to class successfully';
      setError('');
      showToast(successMsg, 'success');
      console.log('handleAttachQuestion success');
    } catch (err) {
      console.error('handleAttachQuestion error', err);
      const errorMsg = typeof err === 'string' ? err : (err.message || 'Failed to attach question to class');
      setError(errorMsg);
      // Show specific error message based on error type
      if (errorMsg.toLowerCase().includes('already assigned') || errorMsg.toLowerCase().includes('already attached')) {
        showToast('This question is already attached to this class. Please select a different question.', 'warning');
      } else {
        showToast(errorMsg, 'error');
      }
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
    console.log('[handleBlockUser] 🔨 Called with:', { studentId, block, classId });
    try {
      console.log('[handleBlockUser] Calling blockUser API...');
      const response = await blockUser(classId, studentId, block);
      console.log('[handleBlockUser] ✅ API response:', response.data);
      
      const actionMsg = block ? 'Student blocked successfully' : 'Student unblocked successfully';
      showToast(actionMsg, 'success');
      
      // Refresh data without loading spinner or resetting tab
      console.log('[handleBlockUser] Refreshing data...');
      await fetchData(true);
      console.log('[handleBlockUser] ✅ Data refreshed');
    } catch (err) {
      console.error('[handleBlockUser] ❌ Error:', err);
      const errorMsg = typeof err === 'string' ? err : (err.error || 'Failed to block/unblock user');
      setError(errorMsg);
      showToast(errorMsg, 'error');
    }
  };

  const handleFocusUser = async (studentId, focus) => {
    console.log('[handleFocusUser] 🎯 Called with:', { studentId, focus, classId });
    try {
      console.log('[handleFocusUser] Calling focusStudent API...');
      const response = await focusStudent(classId, studentId, focus);
      console.log('[handleFocusUser] ✅ API response:', response.data);
      
      const actionMsg = focus ? 'Student marked for focus successfully' : 'Student unmarked from focus successfully';
      showToast(actionMsg, 'success');
      
      // Refresh data without loading spinner or resetting tab
      console.log('[handleFocusUser] Refreshing data...');
      await fetchData(true);
      console.log('[handleFocusUser] ✅ Data refreshed');
    } catch (err) {
      console.error('[handleFocusUser] ❌ Error:', err);
      const errorMsg = typeof err === 'string' ? err : (err.error || 'Failed to focus/unfocus user');
      setError(errorMsg);
      showToast(errorMsg, 'error');
    }
  };

  const handleBlockAllUsers = async (e) => {
    e.preventDefault();
    if (!confirm(`Are you sure you want to ${blockAll ? 'block' : 'unblock'} all students in this class?`)) {
      return;
    }
    try {
      await blockAllUsers(classId, blockAll);
      const actionMsg = blockAll ? 'All students blocked successfully' : 'All students unblocked successfully';
      showToast(actionMsg, 'success');
      // Refresh data without loading spinner or resetting tab
      await fetchData(true);
    } catch (err) {
      const errorMsg = typeof err === 'string' ? err : (err.error || 'Failed to block/unblock all users');
      setError(errorMsg);
      showToast(errorMsg, 'error');
    }
  };

  const handleViewSubmissionCode = async (sid) => {
    setError('');
    setSubmissionCode('');
    setSubmissionViewData(null);
    try {
      const response = await viewSubmissionCode(sid);
      const d = response.data;
      setSubmissionCode(d.code ?? 'No code available');
      setSubmissionViewData({
        code: d.code,
        language: d.language || 'javascript',
        questionId: d.questionId,
        classId: d.classId,
        isCorrect: Boolean(d.isCorrect),
        status: d.status,
        passedTestCases: d.passedTestCases,
        totalTestCases: d.totalTestCases,
        studentName: d.studentName,
        questionTitle: d.questionTitle,
      });
    } catch (err) {
      setError(err.response?.data?.error || err.error || 'Failed to fetch submission code');
      setSubmissionViewData(null);
    }
  };

  const openStudentModal = (student) => {
    setSelectedStudent(student);
    setIsModalOpen(true);
  };

  const closeStudentModal = () => {
    setSelectedStudent(null);
    setIsModalOpen(false);
    setStudentModalSubmissionData(null);
  };

  const handleViewStudentSubmission = async (submissionIdVal) => {
    if (!submissionIdVal) return;
    setStudentModalLoadingSubmissionId(submissionIdVal);
    setStudentModalSubmissionLoading(true);
    setStudentModalSubmissionData(null);
    try {
      const response = await viewSubmissionCode(submissionIdVal);
      setStudentModalSubmissionData(response.data);
    } catch (err) {
      setStudentModalSubmissionData({ error: err.response?.data?.error || err.message || 'Failed to load submission' });
    } finally {
      setStudentModalSubmissionLoading(false);
      setStudentModalLoadingSubmissionId(null);
    }
  };

  // Component: Student Details Modal (tabbed: Overview, Questions Attempted with answers)
  const StudentDetailsModal = () => {
    if (!selectedStudent) return null;

    const studentInfo = selectedStudent.studentId || selectedStudent.student || {};
    const totalRuns = selectedStudent.totalRuns ?? selectedStudent.totalSubmits ?? 0;
    const totalSubmissions = selectedStudent.totalSubmissions ?? selectedStudent.totalSubmits ?? 0;
    const activityStatus = selectedStudent.activityStatus || 'N/A';
    const correctAttempts = selectedStudent.correctAttempts || 0;
    const wrongAttempts = selectedStudent.wrongAttempts || 0;
    const highestScores = selectedStudent.highestScores || [];
    const attempts = selectedStudent.attempts || [];

    const getQuestionTitle = (qId) => {
      const q = questions.find((qu) => String(qu._id) === String(qId));
      return q?.title ? String(q.title).replace(/<[^>]*>/g, '').slice(0, 60) : `Question ${String(qId).slice(-6)}`;
    };

    const entriesToShow = highestScores.length > 0
      ? highestScores.map((h) => ({ questionId: h.questionId, submissionId: h.submissionId, score: h.score, isCorrect: h.isCorrect, submittedAt: h.submittedAt }))
      : [...attempts]
          .sort((a, b) => new Date(b.submittedAt) - new Date(a.submittedAt))
          .filter((a, i, arr) => arr.findIndex((x) => String(x.questionId) === String(a.questionId)) === i)
          .map((a) => ({ questionId: a.questionId, submissionId: a.submissionId, score: a.score, isCorrect: a.isCorrect, submittedAt: a.submittedAt }));

    return (
      <Dialog open={isModalOpen} onClose={closeStudentModal} className="relative z-50">
        <div className="fixed inset-0 bg-black/30" aria-hidden="true" />
        <div className="fixed inset-0 flex items-center justify-center p-4 overflow-y-auto">
          <Dialog.Panel className="mx-auto max-w-4xl w-full rounded-2xl bg-white shadow-xl my-8">
            <div className="p-6 border-b border-gray-200 flex justify-between items-center">
              <Dialog.Title className="text-2xl font-bold text-gray-800">
                {studentInfo.name || 'Student'} – Details
              </Dialog.Title>
              <button
                onClick={closeStudentModal}
                className="text-gray-500 hover:text-gray-700 p-1 rounded"
                aria-label="Close"
              >
                <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
              </button>
            </div>

            <Tab.Group>
              <Tab.List className="flex gap-1 px-6 pt-2 border-b border-gray-200">
                <Tab className={({ selected }) =>
                  `py-3 px-4 text-sm font-medium border-b-2 -mb-px focus:outline-none ${selected ? 'border-indigo-600 text-indigo-600' : 'border-transparent text-gray-500 hover:text-gray-700'}`
                }>
                  Overview
                </Tab>
                <Tab className={({ selected }) =>
                  `py-3 px-4 text-sm font-medium border-b-2 -mb-px focus:outline-none ${selected ? 'border-indigo-600 text-indigo-600' : 'border-transparent text-gray-500 hover:text-gray-700'}`
                }>
                  Questions Attempted
                  {entriesToShow.length > 0 && (
                    <span className="ml-1.5 bg-gray-200 text-gray-700 text-xs px-2 py-0.5 rounded-full">{entriesToShow.length}</span>
                  )}
                </Tab>
              </Tab.List>

              <Tab.Panels className="p-6">
                {/* Overview: analytics and stats */}
                <Tab.Panel className="space-y-6 focus:outline-none">
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
                    <div className="bg-gray-50 rounded-lg p-4">
                      <p className="text-xs text-gray-500 uppercase">Name</p>
                      <p className="font-semibold text-gray-900">{studentInfo.name || 'N/A'}</p>
                    </div>
                    <div className="bg-gray-50 rounded-lg p-4">
                      <p className="text-xs text-gray-500 uppercase">Email</p>
                      <p className="font-semibold text-gray-900 truncate" title={studentInfo.email}>{studentInfo.email || 'N/A'}</p>
                    </div>
                    <div className="bg-gray-50 rounded-lg p-4">
                      <p className="text-xs text-gray-500 uppercase">Student ID</p>
                      <p className="font-mono text-sm text-gray-700 truncate" title={studentInfo._id}>{studentInfo._id || 'N/A'}</p>
                    </div>
                    <div className="bg-gray-50 rounded-lg p-4">
                      <p className="text-xs text-gray-500 uppercase">Activity</p>
                      <span className={`inline-flex px-2 py-0.5 rounded text-xs font-medium ${
                        activityStatus === 'active' ? 'bg-green-100 text-green-800' :
                        activityStatus === 'focused' ? 'bg-yellow-100 text-yellow-800' : 'bg-gray-100 text-gray-700'
                      }`}>{activityStatus}</span>
                    </div>
                  </div>
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
                    <div className="bg-indigo-50 rounded-lg p-4">
                      <p className="text-xs text-indigo-600 uppercase">Total Runs</p>
                      <p className="text-xl font-bold text-indigo-900">{totalRuns}</p>
                    </div>
                    <div className="bg-indigo-50 rounded-lg p-4">
                      <p className="text-xs text-indigo-600 uppercase">Submissions</p>
                      <p className="text-xl font-bold text-indigo-900">{totalSubmissions}</p>
                    </div>
                    <div className="bg-green-50 rounded-lg p-4">
                      <p className="text-xs text-green-600 uppercase">Correct</p>
                      <p className="text-xl font-bold text-green-900">{correctAttempts}</p>
                    </div>
                    <div className="bg-red-50 rounded-lg p-4">
                      <p className="text-xs text-red-600 uppercase">Wrong</p>
                      <p className="text-xl font-bold text-red-900">{wrongAttempts}</p>
                    </div>
                  </div>
                  {totalSubmissions > 0 && (
                    <div className="flex items-center gap-4">
                      <p className="text-sm text-gray-600">Success rate</p>
                      <div className="flex-1 h-3 bg-gray-200 rounded-full overflow-hidden">
                        <div
                          className="h-full bg-green-500 rounded-full transition-all"
                          style={{ width: `${totalSubmissions ? Math.round((correctAttempts / totalSubmissions) * 100) : 0}%` }}
                        />
                      </div>
                      <span className="text-sm font-medium text-gray-700">
                        {totalSubmissions ? Math.round((correctAttempts / totalSubmissions) * 100) : 0}%
                      </span>
                    </div>
                  )}
                </Tab.Panel>

                {/* Questions Attempted: list + view answer */}
                <Tab.Panel className="space-y-4 focus:outline-none">
                  {entriesToShow.length === 0 ? (
                    <p className="text-gray-500">No questions attempted yet.</p>
                  ) : (
                    <div className="overflow-x-auto">
                      <table className="min-w-full divide-y divide-gray-200">
                        <thead className="bg-gray-50">
                          <tr>
                            <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">Question</th>
                            <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">Status</th>
                            <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">Score</th>
                            <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">Submitted</th>
                            <th className="px-4 py-2 text-right text-xs font-medium text-gray-500 uppercase">Action</th>
                          </tr>
                        </thead>
                        <tbody className="bg-white divide-y divide-gray-200">
                          {entriesToShow.map((entry) => (
                            <tr key={entry.submissionId || entry.questionId}>
                              <td className="px-4 py-3 text-sm text-gray-900 max-w-xs truncate" title={getQuestionTitle(entry.questionId)}>
                                {getQuestionTitle(entry.questionId)}
                              </td>
                              <td className="px-4 py-3">
                                <span className={`inline-flex px-2 py-0.5 rounded text-xs font-medium ${entry.isCorrect ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'}`}>
                                  {entry.isCorrect ? 'Correct' : 'Incorrect'}
                                </span>
                              </td>
                              <td className="px-4 py-3 text-sm text-gray-700">{entry.score ?? '–'}</td>
                              <td className="px-4 py-3 text-sm text-gray-500">
                                {entry.submittedAt ? format(new Date(entry.submittedAt), 'MMM d, yyyy HH:mm') : '–'}
                              </td>
                              <td className="px-4 py-3 text-right">
                                {entry.submissionId && (
                                  <button
                                    type="button"
                                    onClick={() => handleViewStudentSubmission(entry.submissionId)}
                                    disabled={studentModalLoadingSubmissionId === String(entry.submissionId)}
                                    className="text-indigo-600 hover:text-indigo-800 text-sm font-medium disabled:opacity-50"
                                  >
                                    {studentModalLoadingSubmissionId === String(entry.submissionId) ? 'Loading…' : 'View Answer'}
                                  </button>
                                )}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}

                  {/* Shown submission code / answer */}
                  {studentModalSubmissionLoading && (
                    <div className="mt-4 p-4 bg-gray-50 rounded-lg text-center text-gray-500">Loading submission…</div>
                  )}
                  {studentModalSubmissionData && !studentModalSubmissionData.error && (
                    <div className="mt-6 p-4 border rounded-lg bg-gray-50 space-y-3">
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <span className={`font-semibold ${studentModalSubmissionData.isCorrect ? 'text-green-700' : 'text-red-700'}`}>
                          {studentModalSubmissionData.isCorrect ? '✓ Successful' : '✗ Unsuccessful'}
                        </span>
                        {studentModalSubmissionData.status && ['tle', 'mle'].includes(String(studentModalSubmissionData.status).toLowerCase()) && (
                          <span className="px-2 py-0.5 rounded text-xs font-medium bg-amber-200 text-amber-900 uppercase">{studentModalSubmissionData.status}</span>
                        )}
                        <span className="text-sm text-gray-600">
                          {studentModalSubmissionData.passedTestCases ?? 0}/{studentModalSubmissionData.totalTestCases ?? 0} test cases passed
                        </span>
                        {studentModalSubmissionData.questionId && studentModalSubmissionData.classId && (
                          <Link
                            to={`/teacher/classes/${String(studentModalSubmissionData.classId)}/questions/${String(studentModalSubmissionData.questionId)}`}
                            state={{ initialCode: studentModalSubmissionData.code, initialLanguage: studentModalSubmissionData.language }}
                            className="px-3 py-1.5 bg-indigo-600 text-white rounded text-sm font-medium hover:bg-indigo-700"
                          >
                            Edit & Run
                          </Link>
                        )}
                      </div>
                      <p className="text-sm text-gray-600">Question: {studentModalSubmissionData.questionTitle || '–'}</p>
                      <p className="text-xs text-gray-500 font-mono">Code</p>
                      <pre className="p-3 bg-white border rounded text-sm overflow-x-auto max-h-64 overflow-y-auto">{studentModalSubmissionData.code || 'No code'}</pre>
                    </div>
                  )}
                  {studentModalSubmissionData?.error && (
                    <div className="mt-4 p-4 bg-red-50 border border-red-200 rounded-lg text-red-700 text-sm">{studentModalSubmissionData.error}</div>
                  )}
                </Tab.Panel>
              </Tab.Panels>
            </Tab.Group>

            <div className="px-6 py-4 border-t border-gray-200 flex justify-end">
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
      {/* Toast Notification */}
      {toast.show && (
        <div className="fixed top-4 right-4 z-50 animate-slide-in-right">
          <div className={`rounded-lg shadow-2xl border-l-4 p-4 max-w-md backdrop-blur-sm ${
            toast.type === 'success' ? 'bg-green-50/95 border-green-500' :
            toast.type === 'error' ? 'bg-red-50/95 border-red-500' :
            toast.type === 'warning' ? 'bg-yellow-50/95 border-yellow-500' :
            'bg-blue-50/95 border-blue-500'
          }`}>
            <div className="flex items-start">
              <div className="flex-shrink-0">
                {toast.type === 'success' && (
                  <svg className="h-6 w-6 text-green-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                )}
                {toast.type === 'error' && (
                  <svg className="h-6 w-6 text-red-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 14l2-2m0 0l2-2m-2 2l-2-2m2 2l2 2m7-2a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                )}
                {toast.type === 'warning' && (
                  <svg className="h-6 w-6 text-yellow-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                  </svg>
                )}
                {toast.type === 'info' && (
                  <svg className="h-6 w-6 text-blue-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                )}
              </div>
              <div className="ml-3 flex-1">
                <p className={`text-sm font-semibold ${
                  toast.type === 'success' ? 'text-green-800' :
                  toast.type === 'error' ? 'text-red-800' :
                  toast.type === 'warning' ? 'text-yellow-800' :
                  'text-blue-800'
                }`}>
                  {toast.type === 'success' ? 'Success!' :
                   toast.type === 'error' ? 'Error!' :
                   toast.type === 'warning' ? 'Warning!' :
                   'Info'}
                </p>
                <p className={`mt-1 text-sm ${
                  toast.type === 'success' ? 'text-green-700' :
                  toast.type === 'error' ? 'text-red-700' :
                  toast.type === 'warning' ? 'text-yellow-700' :
                  'text-blue-700'
                }`}>
                  {toast.message}
                </p>
              </div>
              <button
                onClick={() => setToast({ show: false, message: '', type: '' })}
                className={`ml-4 flex-shrink-0 rounded-lg p-1 hover:bg-white/50 transition-colors ${
                  toast.type === 'success' ? 'text-green-500' :
                  toast.type === 'error' ? 'text-red-500' :
                  toast.type === 'warning' ? 'text-yellow-500' :
                  'text-blue-500'
                }`}
              >
                <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
          </div>
        </div>
      )}

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
      <Tab.Group selectedIndex={selectedTabIndex} onChange={handleTabChange}>
        <Tab.List className="flex gap-2 rounded-xl p-1.5 mb-8 border" style={{ backgroundColor: 'var(--background-light)', borderColor: 'var(--card-border)' }}>
          {['Leaderboard', 'Assignments', 'Questions', 'Management'].map((tabName) => (
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

        <Tab.Panels className="overflow-visible">
          {/* Leaderboard Tab: students, filters, analytics, view code, block/unblock */}
          <Tab.Panel className="overflow-visible">
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-8">
              {/* Left: Registered students with filters (correct, incorrect, active, inactive) */}
              <div className="lg:col-span-1 order-2 lg:order-1">
                <div className="backdrop-blur-sm rounded-2xl shadow-lg border p-4" style={{ backgroundColor: 'var(--card-white)', borderColor: 'var(--card-border)' }}>
                  <h3 className="text-lg font-semibold mb-3" style={{ color: 'var(--text-heading)' }}>Registered Students</h3>
                  <div className="flex flex-wrap gap-2 mb-3">
                    {['all', 'correct', 'incorrect', 'active', 'inactive'].map((f) => (
                      <button
                        key={f}
                        onClick={() => setAnalyticsStudentFilter(f)}
                        className={`px-3 py-1 rounded text-xs font-medium capitalize ${analyticsStudentFilter === f ? 'bg-indigo-600 text-white' : 'bg-gray-200 hover:bg-gray-300'}`}
                      >
                        {f}
                      </button>
                    ))}
                  </div>
                  <div className="space-y-2 max-h-64 overflow-y-auto">
                    {filteredStudents.slice(0, 20).map((s) => {
                      const info = s.studentId || {};
                      return (
                        <div key={info._id} className="flex justify-between items-center py-1.5 border-b border-gray-100 text-sm">
                          <span className="truncate">{info.name || 'Unknown'}</span>
                          <span className={`px-1.5 py-0.5 rounded text-xs ${(s.correctAttempts || 0) > 0 ? 'bg-green-100 text-green-700' : (s.totalAttempts || 0) > 0 ? 'bg-red-100 text-red-700' : 'bg-gray-100'}`}>
                            {(s.correctAttempts || 0) > 0 ? 'Correct' : (s.totalAttempts || 0) > 0 ? 'Incorrect' : 'Inactive'}
                          </span>
                        </div>
                      );
                    })}
                  </div>
                  <p className="text-xs text-gray-500 mt-2">Showing {Math.min(filteredStudents.length, 20)} of {filteredStudents.length}</p>
                </div>
              </div>
              {/* Right: Analytics charts */}
              <div className="lg:col-span-2 order-1 lg:order-2">
            {/* Statistics Pie Charts */}
            <div className="mb-6">
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
            <div className="mb-6">
              <h2 className="text-2xl font-semibold mb-4" style={{ color: 'var(--text-heading)' }}>Attempt Statistics</h2>
              <div className="backdrop-blur-sm rounded-2xl shadow-lg p-6 border transition-all duration-300 hover:shadow-2xl" style={{ backgroundColor: 'var(--card-white)', borderColor: 'var(--card-border)' }}>
                <StatsGraphs />
              </div>
            </div>
              </div>
            </div>

            {/* Full Student Table with Block/Unblock */}
            <div className="mt-8">
              <h2 className="text-xl font-semibold mb-4" style={{ color: 'var(--text-heading)' }}>Student Actions</h2>
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
                      {currentStudents.map((studentData, idx) => {
                        const studentInfo = studentData.studentId || {};
                        const isFocused = studentData.activityStatus === 'focused';
                        const isBlocked = studentData.isBlocked || false;
                        
                        // Debug logging for rendering
                        if (idx === 0) {
                          console.log('[TeacherClassView] 🎨 Rendering students table, first student:', {
                            name: studentInfo.name,
                            needsFocus: studentData.needsFocus,
                            activityStatus: studentData.activityStatus,
                            isBlocked: studentData.isBlocked,
                            computedIsFocused: isFocused,
                            computedIsBlocked: isBlocked
                          });
                        }

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
            </div>

            {/* View Submission Code (in Leaderboard so teacher can view success/fail and Edit & Run) */}
            <div className="mt-8 backdrop-blur-sm rounded-2xl shadow-lg border p-6" style={{ backgroundColor: 'var(--card-white)', borderColor: 'var(--card-border)' }}>
              <h3 className="text-lg font-semibold mb-4" style={{ color: 'var(--text-heading)' }}>View Submission Code</h3>
              <p className="text-sm mb-3" style={{ color: 'var(--text-secondary)' }}>Enter a submission ID to view student code (success/fail, TLE/MLE) and use Edit & Run.</p>
              <form onSubmit={(e) => { e.preventDefault(); handleViewSubmissionCode(submissionId); }} className="flex gap-3">
                <input
                  type="text"
                  value={submissionId}
                  onChange={(e) => setSubmissionId(e.target.value)}
                  placeholder="Enter submission ID"
                  className="flex-1 rounded-lg border-gray-300 shadow-sm focus:ring-indigo-500 focus:border-indigo-500 text-sm"
                />
                <button type="submit" className="px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 text-sm font-medium">
                  View Code
                </button>
              </form>
              {submissionCode && (
                <div className="mt-6">
                  {submissionViewData && (
                    <div className={`mb-4 p-4 rounded-lg border ${submissionViewData.isCorrect ? 'bg-green-50 border-green-200' : 'bg-red-50 border-red-200'}`}>
                      <div className="flex flex-wrap items-center justify-between gap-3">
                        <div className="flex items-center gap-3">
                          <span className={`text-lg font-semibold ${submissionViewData.isCorrect ? 'text-green-800' : 'text-red-800'}`}>
                            {submissionViewData.isCorrect ? '✓ Successful' : '✗ Unsuccessful'}
                          </span>
                          {submissionViewData.status && ['tle', 'mle'].includes(String(submissionViewData.status).toLowerCase()) && (
                            <span className="px-2 py-1 rounded text-sm font-medium bg-amber-200 text-amber-900 uppercase">{submissionViewData.status}</span>
                          )}
                          <span className="text-sm text-gray-600">
                            {submissionViewData.passedTestCases}/{submissionViewData.totalTestCases} test cases passed
                          </span>
                        </div>
                        {submissionViewData.questionId && submissionViewData.classId && (
                          <Link
                            to={`/teacher/classes/${String(submissionViewData.classId)}/questions/${String(submissionViewData.questionId)}`}
                            state={{ initialCode: submissionViewData.code, initialLanguage: submissionViewData.language }}
                            className="px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 text-sm font-medium whitespace-nowrap"
                          >
                            Edit & Run
                          </Link>
                        )}
                      </div>
                      {submissionViewData.studentName && <p className="mt-2 text-sm text-gray-600">Student: {submissionViewData.studentName}</p>}
                      {submissionViewData.questionTitle && <p className="text-sm text-gray-600">Question: {submissionViewData.questionTitle}</p>}
                    </div>
                  )}
                  <h4 className="text-sm font-semibold mb-2" style={{ color: 'var(--text-heading)' }}>Code</h4>
                  <pre className="p-4 bg-gray-50/80 rounded-lg text-sm overflow-x-auto" style={{ color: 'var(--text-primary)' }}>{submissionCode}</pre>
                </div>
              )}
            </div>
            <StudentDetailsModal />
          </Tab.Panel>

          {/* Assignments Tab */}
          <Tab.Panel className="overflow-visible">
            {/* Create Assignment Form */}
            <div className="backdrop-blur-sm rounded-2xl shadow-lg border p-6 mb-8 transition-all duration-300 hover:shadow-2xl overflow-visible" style={{ backgroundColor: 'var(--card-white)', borderColor: 'var(--card-border)' }}>
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

              <form onSubmit={handleCreateAssignment} className="space-y-4 overflow-visible">
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Question
                    </label>
                    <Combobox 
                      value={assignmentForm.questionId}
                      onChange={(value) => {
                        setAssignmentForm({ ...assignmentForm, questionId: value });
                        setAssignmentQuestionSearchQuery('');
                      }}
                    >
                      <div className="relative">
                        <Combobox.Input
                          className="w-full rounded-lg border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm pl-3 pr-10 py-2"
                          onChange={(event) => setAssignmentQuestionSearchQuery(event.target.value)}
                          displayValue={(id) => {
                            if (assignmentQuestionSearchQuery) return assignmentQuestionSearchQuery;
                            if (!id) return '';
                            const question = allQuestionsForAssignment.find((q) => q._id === id);
                            return question ? stripHtml(question.title) : '';
                          }}
                          placeholder="Search questions by name..."
                        />
                        <Combobox.Button className="absolute inset-y-0 right-0 flex items-center pr-2">
                          <ChevronUpDownIcon className="h-5 w-5 text-gray-400" aria-hidden="true" />
                        </Combobox.Button>
                        <Combobox.Options
                          anchor="bottom start"
                          className="z-[100] mt-1 max-h-60 w-[var(--input-width)] overflow-auto rounded-md bg-white py-1 text-base shadow-lg ring-1 ring-black/5 focus:outline-none sm:text-sm empty:invisible [--anchor-gap:4px]"
                        >
                          {filteredAssignmentQuestions && filteredAssignmentQuestions.length > 0 ? (
                            filteredAssignmentQuestions.map((question) => (
                              <Combobox.Option
                                key={question._id}
                                value={question._id}
                                className={({ active }) =>
                                  `relative cursor-pointer select-none py-2 pl-10 pr-4 ${
                                    active ? 'bg-indigo-600 text-white' : 'text-gray-900'
                                  }`
                                }
                              >
                                {({ selected, active }) => (
                                  <>
                                    <span className={`block truncate ${selected ? 'font-medium' : 'font-normal'}`}>
                                      {stripHtml(question.title)}
                                    </span>
                                    {selected && (
                                      <span
                                        className={`absolute inset-y-0 left-0 flex items-center pl-3 ${
                                          active ? 'text-white' : 'text-indigo-600'
                                        }`}
                                      >
                                        <CheckIcon className="h-5 w-5" aria-hidden="true" />
                                      </span>
                                    )}
                                  </>
                                )}
                              </Combobox.Option>
                            ))
                          ) : (
                            <div className="relative cursor-default select-none py-2 px-4 text-gray-700">
                              {assignmentQuestionSearchQuery ? 'No questions found' : 'No questions available'}
                            </div>
                          )}
                        </Combobox.Options>
                      </div>
                    </Combobox>
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
          <Tab.Panel className="overflow-visible">
            {/* Attach Question to Class */}
            <div className="backdrop-blur-sm rounded-2xl shadow-lg border p-6 mb-8 transition-all duration-300 hover:shadow-2xl overflow-visible" style={{ backgroundColor: 'var(--card-white)', borderColor: 'var(--card-border)' }}>
              <h3 className="text-lg font-semibold mb-4" style={{ color: 'var(--text-heading)' }}>Attach Question to Class</h3>
              <div className="space-y-6">
                {/* Search Questions */}
                <div className="flex gap-4">
                  <div className="flex-1">
                    <label className="block text-sm font-medium text-gray-700 mb-2">Search Questions</label>
                    <div className="flex gap-2">
                  <input
                    type="text"
                    value={questionSearchKeyword}
                    onChange={(e) => setQuestionSearchKeyword(e.target.value)}
                        placeholder="Search questions by title or ID..."
                        className="flex-1 rounded-lg border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm"
                  />
                      <button
                        onClick={handleQuestionSearch}
                        className="inline-flex items-center px-4 py-2 rounded-lg text-sm font-semibold text-white bg-indigo-600 hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2 transition-all duration-300"
                      >
                        Search
                      </button>
                    </div>
                  </div>
                </div>

                {/* Available Questions */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Select Question to Attach</label>
                  <Combobox
                    value={selectedQuestionId}
                    onChange={(value) => {
                      setSelectedQuestionId(value);
                      setAttachQuestionSearchQuery('');
                    }}
                  >
                    <div className="relative">
                      <Combobox.Input
                        className="w-full rounded-lg border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm pl-3 pr-10 py-2"
                        onChange={(event) => setAttachQuestionSearchQuery(event.target.value)}
                        displayValue={(id) => {
                          if (attachQuestionSearchQuery) return attachQuestionSearchQuery;
                          if (!id) return '';
                          const question = availableQuestions.find((q) => q._id === id);
                          return question
                            ? `${stripHtml(question.title)} - ${question.type} (${question.points || 0} points)`
                            : '';
                        }}
                        placeholder="Search questions by title or ID..."
                      />
                      <Combobox.Button className="absolute inset-y-0 right-0 flex items-center pr-2">
                        <ChevronUpDownIcon className="h-5 w-5 text-gray-400" aria-hidden="true" />
                      </Combobox.Button>
                      <Combobox.Options
                        anchor="bottom start"
                        className="z-[100] mt-1 max-h-60 w-[var(--input-width)] overflow-auto rounded-md bg-white py-1 text-base shadow-lg ring-1 ring-black/5 focus:outline-none sm:text-sm empty:invisible [--anchor-gap:4px]"
                      >
                        {filteredAttachQuestions && filteredAttachQuestions.length > 0 ? (
                          filteredAttachQuestions.map((question) => {
                            if (!question._id || !question.title) {
                              return null;
                            }
                            return (
                              <Combobox.Option
                                key={question._id}
                                value={question._id}
                                className={({ active }) =>
                                  `relative cursor-pointer select-none py-2 pl-10 pr-4 ${
                                    active ? 'bg-indigo-600 text-white' : 'text-gray-900'
                                  }`
                                }
                              >
                                {({ selected, active }) => (
                                  <>
                                    <span className={`block truncate ${selected ? 'font-medium' : 'font-normal'}`}>
                                      {stripHtml(question.title)} - {question.type || 'Unknown'} ({question.points || 0} points)
                                    </span>
                                    {selected && (
                                      <span
                                        className={`absolute inset-y-0 left-0 flex items-center pl-3 ${
                                          active ? 'text-white' : 'text-indigo-600'
                                        }`}
                                      >
                                        <CheckIcon className="h-5 w-5" aria-hidden="true" />
                                      </span>
                                    )}
                                  </>
                                )}
                              </Combobox.Option>
                            );
                          }).filter(Boolean)
                        ) : (
                          <div className="relative cursor-default select-none py-2 px-4 text-gray-700">
                            {attachQuestionSearchQuery ? 'No questions found' : 'No questions available'}
                          </div>
                        )}
                      </Combobox.Options>
                    </div>
                  </Combobox>
                </div>

                {/* Attach Button */}
                <div className="flex justify-end">
                  <button
                    onClick={handleAttachQuestion}
                    disabled={!selectedQuestionId}
                    className="inline-flex items-center px-4 py-2 rounded-lg text-sm font-semibold text-white bg-green-600 hover:bg-green-700 focus:outline-none focus:ring-2 focus:ring-green-500 focus:ring-offset-2 transition-all duration-300 disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    Attach Question to Class
                  </button>
                </div>
              </div>
            </div>

            {/* Assigned Questions */}
            <div className="backdrop-blur-sm rounded-2xl shadow-lg border p-6 transition-all duration-300 hover:shadow-2xl overflow-visible" style={{ backgroundColor: 'var(--card-white)', borderColor: 'var(--card-border)' }}>
              <h3 className="text-lg font-semibold mb-4" style={{ color: 'var(--text-heading)' }}>
                Assigned Questions ({questions.length})
              </h3>

              {questions.length === 0 ? (
                <p className="text-sm" style={{ color: 'var(--text-secondary)' }}>No questions assigned to this class</p>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 overflow-visible">
                  {questions.map((question) => (
                    <TeacherQuestionCard
                      key={question._id}
                      question={question}
                      classId={classId}
                      onQuestionUpdate={() => fetchData(true)}
                      summary={questionSummary.find(s => String(s.questionId) === String(question._id))}
                    />
                  ))}
                </div>
              )}
            </div>
          </Tab.Panel>

          {/* Management Tab */}
          <Tab.Panel className="overflow-visible">
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
            <div className="backdrop-blur-sm rounded-2xl shadow-lg border p-6 mb-8" style={{ backgroundColor: 'var(--card-white)', borderColor: 'var(--card-border)' }}>
              <h3 className="text-lg font-semibold mb-4" style={{ color: 'var(--text-heading)' }}>View Submission Code</h3>
              <form onSubmit={(e) => { e.preventDefault(); handleViewSubmissionCode(submissionId); }} className="flex gap-3">
                <input
                  type="text"
                  value={submissionId}
                  onChange={(e) => setSubmissionId(e.target.value)}
                  placeholder="Enter submission ID"
                  className="flex-1 rounded-lg border-gray-300 shadow-sm focus:ring-indigo-500 focus:border-indigo-500 text-sm"
                />
                <button type="submit" className="px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 text-sm font-medium">
                  View Code
                </button>
              </form>
            </div>
            {submissionCode && (
              <div className="backdrop-blur-sm rounded-2xl shadow-lg border p-6 transition-all duration-300 hover:shadow-2xl" style={{ backgroundColor: 'var(--card-white)', borderColor: 'var(--card-border)' }}>
                {/* Success / Unsuccessful banner */}
                {submissionViewData && (
                  <div className={`mb-4 p-4 rounded-lg border ${submissionViewData.isCorrect ? 'bg-green-50 border-green-200' : 'bg-red-50 border-red-200'}`}>
                    <div className="flex flex-wrap items-center justify-between gap-3">
                      <div className="flex items-center gap-3">
                        <span className={`text-lg font-semibold ${submissionViewData.isCorrect ? 'text-green-800' : 'text-red-800'}`}>
                          {submissionViewData.isCorrect ? '✓ Successful' : '✗ Unsuccessful'}
                        </span>
                        {submissionViewData.status && ['tle', 'mle'].includes(String(submissionViewData.status).toLowerCase()) && (
                          <span className="px-2 py-1 rounded text-sm font-medium bg-amber-200 text-amber-900 uppercase">{submissionViewData.status}</span>
                        )}
                        <span className="text-sm text-gray-600">
                          {submissionViewData.passedTestCases}/{submissionViewData.totalTestCases} test cases passed
                        </span>
                      </div>
                      {submissionViewData.questionId && submissionViewData.classId && (
                        <Link
                          to={`/teacher/classes/${String(submissionViewData.classId)}/questions/${String(submissionViewData.questionId)}`}
                          state={{ initialCode: submissionViewData.code, initialLanguage: submissionViewData.language }}
                          className="px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 text-sm font-medium whitespace-nowrap"
                        >
                          Edit & Run
                        </Link>
                      )}
                    </div>
                    {submissionViewData.studentName && (
                      <p className="mt-2 text-sm text-gray-600">Student: {submissionViewData.studentName}</p>
                    )}
                    {submissionViewData.questionTitle && (
                      <p className="text-sm text-gray-600">Question: {submissionViewData.questionTitle}</p>
                    )}
                  </div>
                )}
                <h3 className="text-lg font-semibold mb-3" style={{ color: 'var(--text-heading)' }}>Code</h3>
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
