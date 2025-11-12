import React, { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Tab, Combobox } from '@headlessui/react';
import { CheckIcon, ChevronUpDownIcon } from '@heroicons/react/20/solid';
import { Chart as ChartJS, ArcElement, Tooltip, Legend } from 'chart.js';
import { Pie } from 'react-chartjs-2';

ChartJS.register(ArcElement, Tooltip, Legend);
import {
  getClassDetails,
  getClassStudents,
  getClassTeachers,
  editClass,
  changeClassStatus,
  deleteClass,
  assignTeacherToClass,
  removeTeacherFromClass,
  removeStudentFromClass,
  getStudents,
  getTeachers,
  getParticipantStats,
  getRunSubmitStats,
  searchLeaderboard,
  createAssignment,
  getAssignments,
  deleteAssignment,
  blockUser,
  blockAllUsers,
  manageTeacherPermission,
  getQuestionsByClass,
  assignQuestionToClass,
  getAllQuestions,
  searchQuestions,
  adminSearchQuestionsById,
} from '../../../common/services/api';

const AdminClassDetails = () => {
  const { classId } = useParams();
  const navigate = useNavigate();
  const [classStudents, setClassStudents] = useState([]);
  const [classTeachers, setClassTeachers] = useState([]);
  const [allStudents, setAllStudents] = useState([]);
  const [allTeachers, setAllTeachers] = useState([]);
  const [teacherId, setTeacherId] = useState('');
  const [studentId, setStudentId] = useState('');
  const [editMode, setEditMode] = useState(false);
  const [editName, setEditName] = useState('');
  const [editDescription, setEditDescription] = useState('');
  const [classStatus, setClassStatus] = useState('active');
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const [classData, setClassData] = useState(null);
  const [toast, setToast] = useState({ show: false, message: '', type: '' });
  
  // Toast notification helper
  const showToast = (message, type = 'info') => {
    setToast({ show: true, message, type });
    setTimeout(() => {
      setToast({ show: false, message: '', type: '' });
    }, 5000); // Auto-dismiss after 5 seconds
  };
  
  const [classQuestions, setClassQuestions] = useState([]);
  const [allAvailableQuestions, setAllAvailableQuestions] = useState([]);
  const [filteredQuestions, setFilteredQuestions] = useState([]);
  const [questionSearchKeyword, setQuestionSearchKeyword] = useState('');
  const [selectedQuestionId, setSelectedQuestionId] = useState('');
  const [assignments, setAssignments] = useState([]);
  const [participantStats, setParticipantStats] = useState(null);
  const [runSubmitStats, setRunSubmitStats] = useState(null);
  const [leaderboard, setLeaderboard] = useState([]);
  const [leaderboardFilters, setLeaderboardFilters] = useState({
    name: '',
    minCorrectAttempts: '',
    maxAttempts: '',
    activityStatus: '',
  });

  console.log('AdminClassDetails rendered', { classId, filteredQuestionsLength: filteredQuestions?.length, filteredQuestions });

  useEffect(() => {
    let isMounted = true;
    console.log('useEffect triggered', { classId });

    const fetchData = async () => {
      try {
        await Promise.all([
          fetchAllUsers(),
          fetchClassDetails(classId),
          fetchAssignments(classId),
          fetchStats(classId),
          fetchAllAvailableQuestions(),
        ]);
      } catch (err) {
        if (isMounted) {
          console.error('useEffect error', err);
          setError(err.message || 'Failed to fetch data');
        }
      }
    };

    if (classId) {
      fetchData();
    }

    return () => {
      isMounted = false;
    };
  }, [classId]);

  useEffect(() => {
    console.log('Leaderboard state changed', leaderboard);
  }, [leaderboard]);

  useEffect(() => {
    console.log('allStudents state changed', allStudents);
  }, [allStudents]);

  useEffect(() => {
    console.log('filteredQuestions state changed', { length: filteredQuestions?.length, questions: filteredQuestions });
  }, [filteredQuestions]);

  const fetchAllUsers = async () => {
    console.log('fetchAllUsers called');
    try {
      console.log('fetchAllUsers: Calling getStudents() and getTeachers()');
      const [studentsRes, teachersRes] = await Promise.all([getStudents(), getTeachers()]);
      console.log('fetchAllUsers: Raw responses:', {
        studentsRes: studentsRes,
        teachersRes: teachersRes,
      });
      console.log('fetchAllUsers success', {
        students: studentsRes.data.students,
        teachers: teachersRes.data.teachers,
      });
      console.log('Setting allStudents:', studentsRes.data.students);
      console.log('Setting allTeachers:', teachersRes.data.teachers);
      setAllStudents(studentsRes.data.students);
      setAllTeachers(teachersRes.data.teachers);
    } catch (err) {
      console.error('fetchAllUsers error', err);
      setError(err.message || 'Failed to fetch users');
      throw err;
    }
  };

  const fetchClassDetails = async (id) => {
    console.log('fetchClassDetails called', { id });
    try {
      const [classRes, studentsRes, teachersRes, questionsRes] = await Promise.all([
        getClassDetails(id),
        getClassStudents(id),
        getClassTeachers(id),
        getQuestionsByClass(id),
      ]);
      console.log('fetchClassDetails success', {
        classData: classRes.data.class,
        students: studentsRes.data.students,
        teachers: teachersRes.data.teachers,
        questions: questionsRes.data.questions,
      });
      setClassData(classRes.data.class);
      setClassStudents(studentsRes.data.students);
      setClassTeachers(teachersRes.data.teachers);
      setClassQuestions(questionsRes.data.questions);
      setEditName(classRes.data?.class?.name || '');
      setEditDescription(classRes.data?.class?.description || '');
      setClassStatus(classRes.data?.class?.status || 'active');
      setMessage('');
      setError('');
    } catch (err) {
      console.error('fetchClassDetails error', err);
      setError(err.message || 'Failed to fetch class details');
      throw err;
    }
  };

  const fetchAssignments = async (id) => {
    console.log('fetchAssignments called', { id });
    try {
      const res = await getAssignments(id);
      console.log('fetchAssignments success', { assignments: res.data.assignments });
      setAssignments(res.data.assignments);
    } catch (err) {
      console.error('fetchAssignments error', err);
      setError(err.message || 'Failed to fetch assignments');
      throw err;
    }
  };

  const fetchStats = async (id) => {
    console.log('fetchStats called', { id });
    try {
      const [participantRes, runSubmitRes] = await Promise.all([
        getParticipantStats(id),
        getRunSubmitStats(id),
      ]);
      console.log('fetchStats success', {
        participantStats: participantRes.data,
        runSubmitStats: runSubmitRes.data,
      });
      console.log("qqqqqqqqqqqq",runSubmitRes.data.stats.studentStats)
      setParticipantStats(participantRes.data);
      setRunSubmitStats(runSubmitRes.data);
      setMessage('');
      setError('');
    } catch (err) {
      console.error('fetchStats error', err);
      setError(err.message || 'Failed to fetch statistics');
      throw err;
    }
  };

  const handleEditClass = async (e) => {
    e.preventDefault();
    console.log('handleEditClass called', { classId, editName, editDescription, studentId, teacherId });
    try {
      const data = { name: editName, description: editDescription };
      if (studentId) data.studentIds = [studentId];
      if (teacherId) data.teacherIds = [teacherId];
      console.log('editClass payload', data);
      await editClass(classId, data);
      await fetchClassDetails(classId);
      setEditMode(false);
      setStudentId('');
      setTeacherId('');
      setMessage('Class updated successfully');
      setError('');
      console.log('handleEditClass success');
    } catch (err) {
      console.error('handleEditClass error', err);
      setError(err.message || 'Failed to update class');
      setMessage('');
    }
  };

  const handleChangeStatus = async () => {
    console.log('handleChangeStatus called', { classId, currentStatus: classStatus });
    try {
      const newStatus = classStatus === 'active' ? 'inactive' : 'active';
      await changeClassStatus(classId, newStatus);
      await fetchClassDetails(classId);
      setMessage(`Class status changed to ${newStatus}`);
      setError('');
      console.log('handleChangeStatus success', { newStatus });
    } catch (err) {
      console.error('handleChangeStatus error', err);
      setError(err.message || 'Failed to change class status');
      setMessage('');
    }
  };

  const handleDeleteClass = async () => {
    console.log('handleDeleteClass called', { classId });
    try {
      await deleteClass(classId);
      setMessage('Class deleted successfully');
      setError('');
      console.log('handleDeleteClass success, navigating to /admin/classes');
      navigate('/admin/classes');
    } catch (err) {
      console.error('handleDeleteClass error', err);
      setError(err.message || 'Failed to delete class');
      setMessage('');
    }
  };

  const handleAssignTeacher = async () => {
    console.log('handleAssignTeacher called', { classId, teacherId });
    try {
      await assignTeacherToClass(classId, teacherId);
      await fetchClassDetails(classId);
      setTeacherId('');
      setMessage('Teacher assigned successfully');
      setError('');
      console.log('handleAssignTeacher success');
    } catch (err) {
      console.error('handleAssignTeacher error', err);
      setError(err.message || 'Failed to assign teacher');
      setMessage('');
    }
  };

  const handleRemoveTeacher = async (teacherId) => {
    console.log('handleRemoveTeacher called', { classId, teacherId });
    try {
      await removeTeacherFromClass(classId, teacherId);
      await fetchClassDetails(classId);
      setMessage('Teacher removed successfully');
      setError('');
      console.log('handleRemoveTeacher success');
    } catch (err) {
      console.error('handleRemoveTeacher error', err);
      setError(err.message || 'Failed to remove teacher');
      setMessage('');
    }
  };

  const handleRemoveStudent = async (studentId) => {
    console.log('handleRemoveStudent called', { classId, studentId });
    try {
      await removeStudentFromClass(classId, studentId);
      await fetchClassDetails(classId);
      setMessage('Student removed successfully');
      setError('');
      console.log('handleRemoveStudent success');
    } catch (err) {
      console.error('handleRemoveStudent error', err);
      setError(err.message || 'Failed to remove student');
      setMessage('');
    }
  };

  const handleCreateAssignment = async (e) => {
    e.preventDefault();
    console.log('handleCreateAssignment called', { classId, assignmentForm });
    try {
      await createAssignment(classId, assignmentForm);
      await fetchAssignments(classId);
      setAssignmentForm({ questionId: '', maxPoints: '', dueDate: '' });
      const successMsg = 'Assignment created successfully';
      setMessage(successMsg);
      setError('');
      showToast(successMsg, 'success');
      console.log('handleCreateAssignment success');
    } catch (err) {
      console.error('handleCreateAssignment error', err);
      const errorMsg = typeof err === 'string' ? err : (err.message || 'Failed to create assignment');
      setError(errorMsg);
      setMessage('');
      showToast(errorMsg, 'error');
    }
  };

  const handleDeleteAssignment = async (assignmentId) => {
    console.log('handleDeleteAssignment called', { classId, assignmentId });
    if (!confirm('Are you sure you want to delete this assignment?')) {
      return;
    }
    try {
      await deleteAssignment(classId, assignmentId);
      await fetchAssignments(classId);
      const successMsg = 'Assignment deleted successfully';
      setMessage(successMsg);
      setError('');
      showToast(successMsg, 'success');
      console.log('handleDeleteAssignment success');
    } catch (err) {
      console.error('handleDeleteAssignment error', err);
      const errorMsg = typeof err === 'string' ? err : (err.message || 'Failed to delete assignment');
      setError(errorMsg);
      setMessage('');
      showToast(errorMsg, 'error');
    }
  };

  const handleBlockUser = async (studentId, isBlocked) => {
    console.log('handleBlockUser called', { classId, studentId, isBlocked });
    try {
      await blockUser(classId, studentId, isBlocked);
      await fetchClassDetails(classId);
      setMessage(`Student ${isBlocked ? 'blocked' : 'unblocked'} successfully`);
      setError('');
      console.log('handleBlockUser success');
    } catch (err) {
      console.error('handleBlockUser error', err);
      setError(err.message || 'Failed to update block status');
      setMessage('');
    }
  };

  const handleBlockAllUsers = async (isBlocked) => {
    console.log('handleBlockAllUsers called', { classId, isBlocked });
    try {
      await blockAllUsers(classId, isBlocked);
      await fetchClassDetails(classId);
      setMessage(`All students ${isBlocked ? 'blocked' : 'unblocked'} successfully`);
      setError('');
      console.log('handleBlockAllUsers success');
    } catch (err) {
      console.error('handleBlockAllUsers error', err);
      setError(err.message || 'Failed to update block status for all students');
      setMessage('');
    }
  };

  const handleSearchLeaderboard = async (e) => {
    e.preventDefault();
    console.log('handleSearchLeaderboard called', { classId, filters: leaderboardFilters });
    try {
      if (
        (leaderboardFilters.minCorrectAttempts &&
          isNaN(parseInt(leaderboardFilters.minCorrectAttempts))) ||
        (leaderboardFilters.maxAttempts && isNaN(parseInt(leaderboardFilters.maxAttempts)))
      ) {
        setError('Min Correct Attempts and Max Attempts must be valid numbers');
        return;
      }
      const res = await searchLeaderboard(classId, leaderboardFilters);
      console.log('handleSearchLeaderboard success', { leaderboard: res.data });
      const sortedLeaderboard = res.data.leaderboard
        .map((entry, index) => ({
          ...entry,
          rank: index + 1,
        }))
        .sort((a, b) => b.totalScore - a.totalScore);
      setLeaderboard(sortedLeaderboard);
      console.log('Leaderboard state updated', sortedLeaderboard);
      setMessage('Leaderboard search completed');
      setError('');
    } catch (err) {
      console.error('handleSearchLeaderboard error', err);
      setError(err.message || 'Failed to search leaderboard');
      setMessage('');
    }
  };

  const handleManageTeacherPermission = async (teacherId, canCreateQuestion) => {
    console.log('handleManageTeacherPermission called', { teacherId, canCreateQuestion });
    try {
      await manageTeacherPermission(teacherId, canCreateQuestion);
      await fetchClassDetails(classId);
      setMessage(`Teacher question permission ${canCreateQuestion ? 'granted' : 'revoked'} successfully`);
      setError('');
      console.log('handleManageTeacherPermission success');
    } catch (err) {
      console.error('handleManageTeacherPermission error', err);
      setError(err.message || 'Failed to manage teacher permission');
      setMessage('');
    }
  };

  const fetchAllAvailableQuestions = async () => {
    console.log('fetchAllAvailableQuestions called');
    try {
      const response = await getAllQuestions();
      console.log('fetchAllAvailableQuestions success', { questions: response.data.questions });
      setAllAvailableQuestions(response.data.questions);
      setFilteredQuestions(response.data.questions);
    } catch (err) {
      console.error('fetchAllAvailableQuestions error', err);
      setError(err.message || 'Failed to fetch available questions');
    }
  };

  // Helper function to check if a string is a valid MongoDB ObjectId
  const isValidObjectId = (str) => {
    const objectIdPattern = /^[0-9a-fA-F]{24}$/;
    return objectIdPattern.test(str);
  };

  // Helper function to strip HTML tags from text
  const stripHtml = (html) => {
    if (!html) return '';
    try {
      const tmp = document.createElement('div');
      tmp.innerHTML = html;
      const result = tmp.textContent || tmp.innerText || '';
      console.log('stripHtml result:', { original: html, stripped: result });
      return result;
    } catch (error) {
      console.error('stripHtml error:', error);
      return html; // Return original if stripping fails
    }
  };

  const handleQuestionSearch = async () => {
    console.log('handleQuestionSearch called', { keyword: questionSearchKeyword });
    try {
      if (!questionSearchKeyword.trim()) {
        setFilteredQuestions(allAvailableQuestions);
        return;
      }

      // Check if the search keyword is a valid ObjectId
      if (isValidObjectId(questionSearchKeyword.trim())) {
        console.log('handleQuestionSearch: Searching by ID', { questionId: questionSearchKeyword.trim() });
        const response = await adminSearchQuestionsById(questionSearchKeyword.trim());
        console.log('handleQuestionSearch success (ID search)', { question: response.data.question });
        const questions = response.data.question ? [response.data.question] : [];
        console.log('handleQuestionSearch: Setting filteredQuestions to', questions);
        setFilteredQuestions(questions);
        console.log('handleQuestionSearch: filteredQuestions state should be updated to', questions);
      } else {
        console.log('handleQuestionSearch: Searching by title', { title: questionSearchKeyword });
        const response = await searchQuestions({ title: questionSearchKeyword });
        console.log('handleQuestionSearch success (title search)', { questions: response.data.questions });
        setFilteredQuestions(response.data.questions);
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
      await fetchClassDetails(classId);
      setSelectedQuestionId('');
      setQuestionSearchKeyword('');
      setFilteredQuestions(allAvailableQuestions);
      const successMsg = 'Question attached to class successfully';
      setMessage(successMsg);
      setError('');
      showToast(successMsg, 'success');
      console.log('handleAttachQuestion success');
    } catch (err) {
      console.error('handleAttachQuestion error', err);
      const errorMsg = typeof err === 'string' ? err : (err.message || 'Failed to attach question to class');
      setError(errorMsg);
      setMessage('');
      // Show specific error message based on error type
      if (errorMsg.toLowerCase().includes('already assigned')) {
        showToast('This question is already attached to this class. Please select a different question.', 'warning');
      } else {
        showToast(errorMsg, 'error');
      }
    }
  };

  const [assignmentForm, setAssignmentForm] = useState({
    questionId: '',
    maxPoints: '',
    dueDate: '',
  });

  // Search queries for dropdowns
  const [studentSearchQuery, setStudentSearchQuery] = useState('');
  const [teacherSearchQuery, setTeacherSearchQuery] = useState('');
  const [assignmentQuestionSearchQuery, setAssignmentQuestionSearchQuery] = useState('');
  const [attachQuestionSearchQuery, setAttachQuestionSearchQuery] = useState('');

  // Search and pagination for tables
  const [assignmentTableSearch, setAssignmentTableSearch] = useState('');
  const [assignmentCurrentPage, setAssignmentCurrentPage] = useState(1);
  const [assignmentItemsPerPage] = useState(5);

  const [questionTableSearch, setQuestionTableSearch] = useState('');
  const [questionCurrentPage, setQuestionCurrentPage] = useState(1);
  const [questionItemsPerPage] = useState(5);

  const [studentStatsSearch, setStudentStatsSearch] = useState('');
  const [studentStatsCurrentPage, setStudentStatsCurrentPage] = useState(1);
  const [studentStatsItemsPerPage] = useState(5);

  const [teacherTableSearch, setTeacherTableSearch] = useState('');
  const [teacherCurrentPage, setTeacherCurrentPage] = useState(1);
  const [teacherItemsPerPage] = useState(5);

  const [studentTableSearch, setStudentTableSearch] = useState('');
  const [studentCurrentPage, setStudentCurrentPage] = useState(1);
  const [studentItemsPerPage] = useState(10);

  // Filtered lists based on search
  const filteredStudents = studentSearchQuery === ''
    ? allStudents
    : allStudents.filter((student) =>
        student.name.toLowerCase().includes(studentSearchQuery.toLowerCase()) ||
        student.email.toLowerCase().includes(studentSearchQuery.toLowerCase())
      );

  const filteredTeachers = teacherSearchQuery === ''
    ? allTeachers
    : allTeachers.filter((teacher) =>
        teacher.name.toLowerCase().includes(teacherSearchQuery.toLowerCase()) ||
        teacher.email.toLowerCase().includes(teacherSearchQuery.toLowerCase())
      );

  const filteredAssignmentQuestions = assignmentQuestionSearchQuery === ''
    ? classQuestions
    : classQuestions.filter((q) =>
        stripHtml(q.title).toLowerCase().includes(assignmentQuestionSearchQuery.toLowerCase())
      );

  const filteredAttachQuestions = attachQuestionSearchQuery === ''
    ? filteredQuestions
    : filteredQuestions.filter((q) =>
        stripHtml(q.title).toLowerCase().includes(attachQuestionSearchQuery.toLowerCase()) ||
        q._id.toLowerCase().includes(attachQuestionSearchQuery.toLowerCase())
      );

  // Filtered assignments table
  const filteredAssignments = assignmentTableSearch === ''
    ? assignments
    : assignments.filter((assignment) =>
        stripHtml(assignment.questionId?.title || '').toLowerCase().includes(assignmentTableSearch.toLowerCase())
      );

  const assignmentIndexOfLastItem = assignmentCurrentPage * assignmentItemsPerPage;
  const assignmentIndexOfFirstItem = assignmentIndexOfLastItem - assignmentItemsPerPage;
  const currentAssignments = filteredAssignments.slice(assignmentIndexOfFirstItem, assignmentIndexOfLastItem);
  const assignmentTotalPages = Math.ceil(filteredAssignments.length / assignmentItemsPerPage);

  // Filtered questions table
  const filteredQuestionsTable = questionTableSearch === ''
    ? (classData?.questions || [])
    : (classData?.questions || []).filter((q) =>
        stripHtml(q.title).toLowerCase().includes(questionTableSearch.toLowerCase()) ||
        q.type.toLowerCase().includes(questionTableSearch.toLowerCase())
      );

  const questionIndexOfLastItem = questionCurrentPage * questionItemsPerPage;
  const questionIndexOfFirstItem = questionIndexOfLastItem - questionItemsPerPage;
  const currentQuestions = filteredQuestionsTable.slice(questionIndexOfFirstItem, questionIndexOfLastItem);
  const questionTotalPages = Math.ceil(filteredQuestionsTable.length / questionItemsPerPage);

  // Filtered student stats
  const filteredStudentStats = runSubmitStats?.stats?.studentStats?.filter((stat) => 
    !studentStatsSearch || 
    (stat.student.name || '').toLowerCase().includes(studentStatsSearch.toLowerCase())
  ) || [];

  const studentStatsIndexOfLastItem = studentStatsCurrentPage * studentStatsItemsPerPage;
  const studentStatsIndexOfFirstItem = studentStatsIndexOfLastItem - studentStatsItemsPerPage;
  const currentStudentStats = filteredStudentStats.slice(studentStatsIndexOfFirstItem, studentStatsIndexOfLastItem);
  const studentStatsTotalPages = Math.ceil(filteredStudentStats.length / studentStatsItemsPerPage);

  // Filtered teachers table
  const filteredTeachersTable = teacherTableSearch === ''
    ? classTeachers
    : classTeachers.filter((teacher) =>
        teacher.name.toLowerCase().includes(teacherTableSearch.toLowerCase()) ||
        teacher.email.toLowerCase().includes(teacherTableSearch.toLowerCase())
      );

  const teacherIndexOfLastItem = teacherCurrentPage * teacherItemsPerPage;
  const teacherIndexOfFirstItem = teacherIndexOfLastItem - teacherItemsPerPage;
  const currentTeachers = filteredTeachersTable.slice(teacherIndexOfFirstItem, teacherIndexOfLastItem);
  const teacherTotalPages = Math.ceil(filteredTeachersTable.length / teacherItemsPerPage);

  // Filtered students table
  const filteredStudentsTable = studentTableSearch === ''
    ? classStudents
    : classStudents.filter((student) =>
        student.name.toLowerCase().includes(studentTableSearch.toLowerCase()) ||
        student.email.toLowerCase().includes(studentTableSearch.toLowerCase())
      );

  const studentIndexOfLastItem = studentCurrentPage * studentItemsPerPage;
  const studentIndexOfFirstItem = studentIndexOfLastItem - studentItemsPerPage;
  const currentStudentsTable = filteredStudentsTable.slice(studentIndexOfFirstItem, studentIndexOfLastItem);
  const studentTotalPages = Math.ceil(filteredStudentsTable.length / studentItemsPerPage);

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

      <div className="mb-10 flex justify-between items-center">
        <div>
          <h2 className="text-3xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-indigo-600 to-indigo-400 tracking-tight">
            Class Details
          </h2>
          <p className="mt-1 text-sm text-gray-500">Manage class details, assignments, and participants.</p>
        </div>
        <button
          onClick={() => {
            console.log('Back to Classes clicked, navigating to /admin/classes');
            navigate('/admin/classes');
          }}
          className="inline-flex items-center px-4 py-2 rounded-lg text-sm font-semibold text-gray-700 bg-gray-100 hover:bg-gray-200 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2 transition-all duration-300"
        >
          Back to Classes
        </button>
      </div>

      {/* Messages */}
      {message && (
        <div className="mb-6 flex items-center p-4 bg-green-50/80 backdrop-blur-sm rounded-xl shadow-sm border border-green-200">
          <svg
            className="h-6 w-6 text-green-500 mr-3"
            xmlns="http://www.w3.org/2000/svg"
            viewBox="0 0 20 20"
            fill="currentColor"
          >
            <path
              fillRule="evenodd"
              d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z"
              clipRule="evenodd"
            />
          </svg>
          <p className="text-sm font-semibold text-green-800">{message}</p>
        </div>
      )}
      {error && (
        <div className="mb-6 flex items-center p-4 bg-red-50/80 backdrop-blur-sm rounded-xl shadow-sm border border-red-200">
          <svg
            className="h-6 w-6 text-red-500 mr-3"
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
          <p className="text-sm font-semibold text-red-800">{error}</p>
        </div>
      )}

      {/* Class Details */}
      {!classData ? (
        <div className="text-center py-12">
          <p className="text-sm text-gray-500">Class data not available</p>
        </div>
      ) : (
        <Tab.Group>
          {/* Tab Navigation */}
          <Tab.List className="flex space-x-1 rounded-xl bg-gray-100 dark:bg-gray-800 p-1 mb-6">
            {['Overview', 'Assignments', 'Questions', 'Analytics', 'Teachers', 'Students'].map((category) => (
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

          {/* Tab Panels */}
          <Tab.Panels>
            {/* Overview Tab Panel */}
            <Tab.Panel className="bg-white/90 backdrop-blur-sm rounded-2xl shadow-lg border border-gray-100 p-6 dark:bg-gray-800 dark:border-gray-700">
          <div className="flex justify-between items-center mb-6">
                <h3 className="text-lg font-semibold text-gray-800 dark:text-white">{editName}</h3>
            <div className="flex gap-3">
              <button
                onClick={() => {
                  console.log('Edit Class toggled', { editMode: !editMode });
                  setEditMode(!editMode);
                }}
                    className="inline-flex items-center px-4 py-2 rounded-lg text-sm font-semibold text-gray-700 bg-gray-100 hover:bg-gray-200 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2 transition-all duration-300 dark:bg-gray-700 dark:text-white dark:hover:bg-gray-600"
              >
                {editMode ? 'Cancel' : 'Edit Class'}
              </button>
              <button
                onClick={handleDeleteClass}
                className="inline-flex items-center px-4 py-2 rounded-lg text-sm font-semibold text-white bg-red-600 hover:bg-red-700 focus:outline-none focus:ring-2 focus:ring-red-500 focus:ring-offset-2 transition-all duration-300"
              >
                Delete Class
              </button>
            </div>
          </div>

          {/* Class Information */}
          <div className="mb-8">
            <h4 className="text-md font-semibold text-gray-800 mb-3">Class Information</h4>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <p className="text-sm font-medium text-gray-700">Name</p>
                <p className="text-sm text-gray-500">{classData.name}</p>
              </div>
              <div>
                <p className="text-sm font-medium text-gray-700">Description</p>
                <p className="text-sm text-gray-500">{classData.description}</p>
              </div>
              <div>
                <p className="text-sm font-medium text-gray-700 mb-2">Status</p>
                <div className="flex items-center gap-3">
                  <span className="text-sm text-gray-600">
                    {classStatus === 'active' ? 'Active' : 'Inactive'}
                  </span>
                  <button
                    onClick={handleChangeStatus}
                    className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2 ${
                      classStatus === 'active' ? 'bg-green-500' : 'bg-gray-300'
                    }`}
                    role="switch"
                    aria-checked={classStatus === 'active'}
                  >
                    <span
                      className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                        classStatus === 'active' ? 'translate-x-6' : 'translate-x-1'
                      }`}
                    />
                  </button>
                </div>
              </div>
              <div>
                <p className="text-sm font-medium text-gray-700">Created By</p>
                <p className="text-sm text-gray-500">{classData.createdBy?.name} ({classData.createdBy?.email})</p>
              </div>
              <div>
                <p className="text-sm font-medium text-gray-700">Created At</p>
                <p className="text-sm text-gray-500">{new Date(classData.createdAt).toLocaleString()}</p>
              </div>
              <div>
                <p className="text-sm font-medium text-gray-700">Total Runs / Submits</p>
                <p className="text-sm text-gray-500">{classData.totalRuns} / {classData.totalSubmits}</p>
              </div>
            </div>
          </div>

          {/* Edit Class Form */}
          {editMode && (
            <div className="mb-8 border-t border-gray-200 pt-6">
              <h4 className="text-md font-semibold text-gray-800 mb-4">Edit Class</h4>
              <form onSubmit={handleEditClass} className="space-y-6">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">Class Name</label>
                    <input
                      type="text"
                      value={editName}
                      onChange={(e) => {
                        console.log('editName updated', { newValue: e.target.value });
                        setEditName(e.target.value);
                      }}
                      className="w-full rounded-lg border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm"
                      required
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">Add Student</label>
                    <Combobox value={studentId} onChange={(value) => {
                      console.log('studentId updated', { newValue: value });
                      setStudentId(value);
                    }}>
                      <div className="relative">
                        <Combobox.Input
                          className="w-full rounded-lg border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm pl-3 pr-10 py-2"
                          onChange={(event) => setStudentSearchQuery(event.target.value)}
                          displayValue={(id) => {
                            const student = allStudents.find(s => s._id === id);
                            return student ? `${student.name} (${student.email})` : '';
                          }}
                          placeholder="Search students..."
                        />
                        <Combobox.Button className="absolute inset-y-0 right-0 flex items-center pr-2">
                          <ChevronUpDownIcon className="h-5 w-5 text-gray-400" aria-hidden="true" />
                        </Combobox.Button>
                        <Combobox.Options className="absolute z-10 mt-1 max-h-60 w-full overflow-auto rounded-md bg-white py-1 text-base shadow-lg ring-1 ring-black ring-opacity-5 focus:outline-none sm:text-sm">
                          {filteredStudents && filteredStudents.length > 0 ? (
                            filteredStudents.map((student) => (
                              <Combobox.Option
                                key={student._id}
                                value={student._id}
                                className={({ active }) =>
                                  `relative cursor-pointer select-none py-2 pl-10 pr-4 ${
                                    active ? 'bg-indigo-600 text-white' : 'text-gray-900'
                                  }`
                                }
                              >
                                {({ selected, active }) => (
                                  <>
                                    <span className={`block truncate ${selected ? 'font-medium' : 'font-normal'}`}>
                              {student.name || 'No Name'} ({student.email || 'No Email'})
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
                              {studentSearchQuery ? 'No students found' : 'No students available'}
                            </div>
                          )}
                        </Combobox.Options>
                      </div>
                    </Combobox>
                  </div>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">Description</label>
                    <textarea
                      value={editDescription}
                      onChange={(e) => {
                        console.log('editDescription updated', { newValue: e.target.value });
                        setEditDescription(e.target.value);
                      }}
                      rows={3}
                      className="w-full rounded-lg border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">Add Teacher</label>
                    <Combobox value={teacherId} onChange={(value) => {
                      console.log('teacherId updated', { newValue: value });
                      setTeacherId(value);
                    }}>
                      <div className="relative">
                        <Combobox.Input
                          className="w-full rounded-lg border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm pl-3 pr-10 py-2"
                          onChange={(event) => setTeacherSearchQuery(event.target.value)}
                          displayValue={(id) => {
                            const teacher = allTeachers.find(t => t._id === id);
                            return teacher ? `${teacher.name} (${teacher.email})` : '';
                          }}
                          placeholder="Search teachers..."
                        />
                        <Combobox.Button className="absolute inset-y-0 right-0 flex items-center pr-2">
                          <ChevronUpDownIcon className="h-5 w-5 text-gray-400" aria-hidden="true" />
                        </Combobox.Button>
                        <Combobox.Options className="absolute z-10 mt-1 max-h-60 w-full overflow-auto rounded-md bg-white py-1 text-base shadow-lg ring-1 ring-black ring-opacity-5 focus:outline-none sm:text-sm">
                          {filteredTeachers && filteredTeachers.length > 0 ? (
                            filteredTeachers.map((teacher) => (
                              <Combobox.Option
                                key={teacher._id}
                                value={teacher._id}
                                className={({ active }) =>
                                  `relative cursor-pointer select-none py-2 pl-10 pr-4 ${
                                    active ? 'bg-indigo-600 text-white' : 'text-gray-900'
                                  }`
                                }
                              >
                                {({ selected, active }) => (
                                  <>
                                    <span className={`block truncate ${selected ? 'font-medium' : 'font-normal'}`}>
                          {teacher.name} ({teacher.email})
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
                              {teacherSearchQuery ? 'No teachers found' : 'No teachers available'}
                            </div>
                          )}
                        </Combobox.Options>
                      </div>
                    </Combobox>
                  </div>
                </div>
                <div className="flex justify-end">
                  <button
                    type="submit"
                    className="inline-flex items-center px-4 py-2 rounded-lg text-sm font-semibold text-white bg-indigo-600 hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2 transition-all duration-300"
                  >
                    Save Changes
                  </button>
                </div>
              </form>
            </div>
          )}
            </Tab.Panel>

            {/* Assignments Tab Panel */}
            <Tab.Panel className="bg-white/90 backdrop-blur-sm rounded-2xl shadow-lg border border-gray-100 p-6 dark:bg-gray-800 dark:border-gray-700">
          {/* Create Assignment Form */}
          <div className="mb-8 border-t border-gray-200 pt-6">
            <h4 className="text-md font-semibold text-gray-800 mb-4">Create Assignment</h4>
            <form onSubmit={handleCreateAssignment} className="space-y-6">
              <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Question</label>
                  <Combobox value={assignmentForm.questionId} onChange={(value) =>
                    setAssignmentForm({ ...assignmentForm, questionId: value })
                  }>
                    <div className="relative">
                      <Combobox.Input
                        className="w-full rounded-lg border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm pl-3 pr-10 py-2"
                        onChange={(event) => setAssignmentQuestionSearchQuery(event.target.value)}
                        displayValue={(id) => {
                          const question = classQuestions.find(q => q._id === id);
                          return question ? stripHtml(question.title) : '';
                        }}
                        placeholder="Search questions..."
                      />
                      <Combobox.Button className="absolute inset-y-0 right-0 flex items-center pr-2">
                        <ChevronUpDownIcon className="h-5 w-5 text-gray-400" aria-hidden="true" />
                      </Combobox.Button>
                      <Combobox.Options className="absolute z-10 mt-1 max-h-60 w-full overflow-auto rounded-md bg-white py-1 text-base shadow-lg ring-1 ring-black ring-opacity-5 focus:outline-none sm:text-sm">
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
                            {assignmentQuestionSearchQuery ? 'No questions found' : 'No questions available for this class'}
                          </div>
                     )}
                      </Combobox.Options>
                    </div>
                  </Combobox>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Max Points</label>
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
                  <label className="block text-sm font-medium text-gray-700 mb-2">Due Date</label>
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
                  className="inline-flex items-center px-4 py-2 rounded-lg text-sm font-semibold text-white bg-indigo-600 hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2 transition-all duration-300"
                >
                  Create Assignment
                </button>
              </div>
            </form>
          </div>

          {/* Assignments List */}
          <div className="mb-8">
            <div className="flex justify-between items-center mb-4">
              <h4 className="text-md font-semibold text-gray-800">Assignments ({filteredAssignments.length})</h4>
              <div className="relative">
                <input
                  type="text"
                  value={assignmentTableSearch}
                  onChange={(e) => {
                    setAssignmentTableSearch(e.target.value);
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
            {filteredAssignments.length === 0 ? (
              <p className="text-sm text-gray-500">
                {assignmentTableSearch ? `No assignments found matching "${assignmentTableSearch}"` : 'No assignments available'}
              </p>
            ) : (
              <>
              <div className="bg-white/90 backdrop-blur-sm rounded-2xl shadow-lg border border-gray-100 overflow-x-auto">
                <table className="min-w-full divide-y divide-gray-200">
                  <thead className="bg-gray-50">
                    <tr>
                      <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Question Title
                      </th>
                      <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Max Points
                      </th>
                      <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Assigned At
                      </th>
                      <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Due Date
                      </th>
                      <th scope="col" className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Actions
                      </th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-200">
                    {currentAssignments.map((assignment) => (
                      <tr key={assignment._id}>
                        <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                          {assignment.questionId?.title ? stripHtml(assignment.questionId.title) : 'N/A'}
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
            )}
          </div>
            </Tab.Panel>

            {/* Questions Tab Panel */}
            <Tab.Panel className="bg-white/90 backdrop-blur-sm rounded-2xl shadow-lg border border-gray-100 p-6 dark:bg-gray-800 dark:border-gray-700">
                     {/* Questions List */}
           <div className="mb-8">
             <div className="flex justify-between items-center mb-4">
               <h4 className="text-md font-semibold text-gray-800">Questions ({filteredQuestionsTable.length})</h4>
               <div className="relative">
                 <input
                   type="text"
                   value={questionTableSearch}
                   onChange={(e) => {
                     setQuestionTableSearch(e.target.value);
                     setQuestionCurrentPage(1);
                   }}
                   placeholder="Search questions..."
                   className="pl-10 pr-3 py-2 border rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 text-sm"
                 />
                 <svg className="h-5 w-5 text-gray-400 absolute left-3 top-2.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                   <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                 </svg>
               </div>
             </div>
             {filteredQuestionsTable.length === 0 ? (
               <p className="text-sm text-gray-500">
                 {questionTableSearch ? `No questions found matching "${questionTableSearch}"` : 'No questions available'}
               </p>
             ) : (
               <>
               <div className="bg-white/90 backdrop-blur-sm rounded-2xl shadow-lg border border-gray-100 overflow-x-auto">
                 <table className="min-w-full divide-y divide-gray-200">
                  <thead className="bg-gray-50">
                    <tr>
                      <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Question ID
                      </th>
                      <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Title
                      </th>
                      <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Description
                      </th>
                      <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Type
                      </th>
                      <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Points
                      </th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-200">
                    {currentQuestions.map((question) => (
                      <tr key={question._id}>
                        <td className="px-6 py-4 text-sm text-gray-500">
                          <code className="px-2 py-1 bg-gray-100 rounded text-xs font-mono">{question._id}</code>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                          {stripHtml(question.title)}
                        </td>
                        <td className="px-6 py-4 text-sm text-gray-500">{stripHtml(question.description)}</td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">{question.type}</td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">{question.points}</td>
                      </tr>
                    ))}
                   </tbody>
                 </table>
               </div>
               {/* Pagination */}
               {filteredQuestionsTable.length > questionItemsPerPage && (
                 <div className="mt-4 flex items-center justify-between">
                   <p className="text-sm text-gray-500">
                     Showing {questionIndexOfFirstItem + 1} to {Math.min(questionIndexOfLastItem, filteredQuestionsTable.length)} of {filteredQuestionsTable.length} questions
                   </p>
                   <div className="flex gap-2">
                     <button
                       onClick={() => setQuestionCurrentPage(p => Math.max(1, p - 1))}
                       disabled={questionCurrentPage === 1}
                       className="px-3 py-1 border rounded-md text-sm disabled:opacity-50 disabled:cursor-not-allowed hover:bg-gray-50"
                     >
                       Previous
                     </button>
                     <span className="px-3 py-1 text-sm text-gray-700">
                       Page {questionCurrentPage} of {questionTotalPages}
                     </span>
                     <button
                       onClick={() => setQuestionCurrentPage(p => Math.min(questionTotalPages, p + 1))}
                       disabled={questionCurrentPage === questionTotalPages}
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

           {/* Attach Question to Class */}
           <div className="mb-8 border-t border-gray-200 pt-6">
             <h4 className="text-md font-semibold text-gray-800 mb-4">Attach Question to Class</h4>
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
                 <Combobox value={selectedQuestionId} onChange={(value) => setSelectedQuestionId(value)}>
                   <div className="relative">
                     <Combobox.Input
                       className="w-full rounded-lg border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm pl-3 pr-10 py-2"
                       onChange={(event) => setAttachQuestionSearchQuery(event.target.value)}
                       displayValue={(id) => {
                         const question = filteredQuestions.find(q => q._id === id);
                         return question ? `${stripHtml(question.title)} - ${question.type} (${question.points} points)` : '';
                       }}
                       placeholder="Search questions by title or ID..."
                     />
                     <Combobox.Button className="absolute inset-y-0 right-0 flex items-center pr-2">
                       <ChevronUpDownIcon className="h-5 w-5 text-gray-400" aria-hidden="true" />
                     </Combobox.Button>
                     <Combobox.Options className="absolute z-10 mt-1 max-h-60 w-full overflow-auto rounded-md bg-white py-1 text-base shadow-lg ring-1 ring-black ring-opacity-5 focus:outline-none sm:text-sm">
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
            </Tab.Panel>

            {/* Analytics Tab Panel (Statistics + Leaderboard) */}
            <Tab.Panel className="bg-white/90 backdrop-blur-sm rounded-2xl shadow-lg border border-gray-100 p-6 dark:bg-gray-800 dark:border-gray-700">
          {/* Statistics Overview - All Pie Charts in Single Row */}
          <div className="mb-8">
            <h4 className="text-md font-semibold text-gray-800 mb-4">Statistics Overview</h4>
            {(participantStats && runSubmitStats) ? (
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                {/* Activity Status Chart */}
                <div className="bg-white/90 backdrop-blur-sm rounded-xl shadow border border-gray-100 p-4">
                  <h5 className="text-xs font-semibold text-gray-700 mb-3 text-center">Activity Status</h5>
                  <div className="w-full h-48">
                    <Pie
                      data={{
                        labels: ['Active', 'Focused', 'Inactive'],
                        datasets: [{
                          data: [
                            participantStats.stats?.activityPercentage?.active || 0,
                            participantStats.stats?.activityPercentage?.focused || 0,
                            participantStats.stats?.activityPercentage?.inactive || 0
                          ],
                          backgroundColor: [
                            'rgba(34, 197, 94, 0.8)',
                            'rgba(59, 130, 246, 0.8)',
                            'rgba(156, 163, 175, 0.8)'
                          ],
                          borderColor: [
                            'rgba(34, 197, 94, 1)',
                            'rgba(59, 130, 246, 1)',
                            'rgba(156, 163, 175, 1)'
                          ],
                          borderWidth: 1,
                        }]
                      }}
                      options={{
                        responsive: true,
                        maintainAspectRatio: false,
                        plugins: {
                          legend: {
                            position: 'bottom',
                            labels: {
                              padding: 8,
                              font: { size: 10 },
                              boxWidth: 12
                            }
                          },
                          tooltip: {
                            callbacks: {
                              label: function(context) {
                                return context.label + ': ' + context.parsed + '%';
                              }
                            }
                          }
                        }
                      }}
                    />
                  </div>
                  <p className="text-xs text-gray-500 text-center mt-2">
                    Total: {participantStats.stats?.totalParticipants || 0}
                  </p>
                </div>

                {/* Submission Results Chart */}
                <div className="bg-white/90 backdrop-blur-sm rounded-xl shadow border border-gray-100 p-4">
                  <h5 className="text-xs font-semibold text-gray-700 mb-3 text-center">Submission Accuracy</h5>
                  <div className="w-full h-48">
                    <Pie
                      data={{
                        labels: ['Correct', 'Wrong'],
                        datasets: [{
                          data: [
                            participantStats.stats?.totalCorrectAttempts || 0,
                            participantStats.stats?.totalWrongAttempts || 0
                          ],
                          backgroundColor: [
                            'rgba(34, 197, 94, 0.8)',
                            'rgba(239, 68, 68, 0.8)'
                          ],
                          borderColor: [
                            'rgba(34, 197, 94, 1)',
                            'rgba(239, 68, 68, 1)'
                          ],
                          borderWidth: 1,
                        }]
                      }}
                      options={{
                        responsive: true,
                        maintainAspectRatio: false,
                        plugins: {
                          legend: {
                            position: 'bottom',
                            labels: {
                              padding: 8,
                              font: { size: 10 },
                              boxWidth: 12
                            }
                          },
                          tooltip: {
                            callbacks: {
                              label: function(context) {
                                return context.label + ': ' + context.parsed;
                              }
                            }
                          }
                        }
                      }}
                    />
                  </div>
                  <p className="text-xs text-gray-500 text-center mt-2">
                    Accuracy: {participantStats.stats?.correctPercentage || 0}%
                  </p>
                </div>

                {/* Runs vs Submits Chart */}
                <div className="bg-white/90 backdrop-blur-sm rounded-xl shadow border border-gray-100 p-4">
                  <h5 className="text-xs font-semibold text-gray-700 mb-3 text-center">Runs vs Submits</h5>
                  <div className="w-full h-48">
                    <Pie
                      data={{
                        labels: ['Runs', 'Submits'],
                        datasets: [{
                          data: [
                            runSubmitStats.stats?.classTotalRuns || 0,
                            runSubmitStats.stats?.classTotalSubmits || 0
                          ],
                          backgroundColor: [
                            'rgba(99, 102, 241, 0.8)',
                            'rgba(34, 197, 94, 0.8)'
                          ],
                          borderColor: [
                            'rgba(99, 102, 241, 1)',
                            'rgba(34, 197, 94, 1)'
                          ],
                          borderWidth: 1,
                        }]
                      }}
                      options={{
                        responsive: true,
                        maintainAspectRatio: false,
                        plugins: {
                          legend: {
                            position: 'bottom',
                            labels: {
                              padding: 8,
                              font: { size: 10 },
                              boxWidth: 12
                            }
                          },
                          tooltip: {
                            callbacks: {
                              label: function(context) {
                                const total = (runSubmitStats.stats?.classTotalRuns || 0) + (runSubmitStats.stats?.classTotalSubmits || 0);
                                const percentage = total > 0 ? ((context.parsed / total) * 100).toFixed(1) : 0;
                                return context.label + ': ' + context.parsed + ' (' + percentage + '%)';
                              }
                            }
                          }
                        }
                      }}
                    />
                  </div>
                  <p className="text-xs text-gray-500 text-center mt-2">
                    Total: {(runSubmitStats.stats?.classTotalRuns || 0) + (runSubmitStats.stats?.classTotalSubmits || 0)}
                  </p>
                </div>
              </div>
            ) : (
              <p className="text-sm text-gray-500">No statistics available</p>
            )}
          </div>

          {/* Individual Student Statistics */}
          {runSubmitStats?.stats?.studentStats?.length > 0 && (
<div className="mb-8">
  <div className="flex justify-between items-center mb-4">
    <h4 className="text-md font-semibold text-gray-800">Individual Student Statistics ({filteredStudentStats.length})</h4>
    <div className="relative">
      <input
        type="text"
        value={studentStatsSearch}
        onChange={(e) => {
          setStudentStatsSearch(e.target.value);
          setStudentStatsCurrentPage(1);
        }}
        placeholder="Search students..."
        className="pl-10 pr-3 py-2 border rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 text-sm"
      />
      <svg className="h-5 w-5 text-gray-400 absolute left-3 top-2.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
      </svg>
    </div>
  </div>
  {filteredStudentStats.length === 0 ? (
    <p className="text-sm text-gray-500 text-center py-4">
      {studentStatsSearch ? `No students found matching "${studentStatsSearch}"` : 'No student statistics available'}
    </p>
  ) : (
    <>
    <div className="bg-white/90 backdrop-blur-sm rounded-2xl shadow-lg border border-gray-100 overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Student Name
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Runs
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
              Submissions
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200">
          {currentStudentStats.map((stat, index) => (
                <tr key={stat.student.id || index}>
                  <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                    {stat.student.name || 'N/A'}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                    {stat.totalRuns || 0}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                    {stat.totalSubmissions || 0}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
    {/* Pagination */}
    {filteredStudentStats.length > studentStatsItemsPerPage && (
      <div className="mt-4 flex items-center justify-between">
        <p className="text-sm text-gray-500">
          Showing {studentStatsIndexOfFirstItem + 1} to {Math.min(studentStatsIndexOfLastItem, filteredStudentStats.length)} of {filteredStudentStats.length} students
        </p>
        <div className="flex gap-2">
          <button
            onClick={() => setStudentStatsCurrentPage(p => Math.max(1, p - 1))}
            disabled={studentStatsCurrentPage === 1}
            className="px-3 py-1 border rounded-md text-sm disabled:opacity-50 disabled:cursor-not-allowed hover:bg-gray-50"
          >
            Previous
          </button>
          <span className="px-3 py-1 text-sm text-gray-700">
            Page {studentStatsCurrentPage} of {studentStatsTotalPages}
          </span>
          <button
            onClick={() => setStudentStatsCurrentPage(p => Math.min(studentStatsTotalPages, p + 1))}
            disabled={studentStatsCurrentPage === studentStatsTotalPages}
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
          )}

          {/* Leaderboard Search */}
          <div className="mb-8 border-t border-gray-200 pt-6">
            <h4 className="text-md font-semibold text-gray-800 mb-4">Search Leaderboard</h4>
            <form onSubmit={handleSearchLeaderboard} className="space-y-6">
              <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Student Name</label>
                  <input
                    type="text"
                    value={leaderboardFilters.name}
                    onChange={(e) =>
                      setLeaderboardFilters({ ...leaderboardFilters, name: e.target.value })
                    }
                    className="w-full rounded-lg border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Min Correct Attempts</label>
                  <input
                    type="number"
                    value={leaderboardFilters.minCorrectAttempts}
                    onChange={(e) =>
                      setLeaderboardFilters({
                        ...leaderboardFilters,
                        minCorrectAttempts: e.target.value,
                      })
                    }
                    className="w-full rounded-lg border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Max Attempts</label>
                  <input
                    type="number"
                    value={leaderboardFilters.maxAttempts}
                    onChange={(e) =>
                      setLeaderboardFilters({
                        ...leaderboardFilters,
                        maxAttempts: e.target.value,
                      })
                    }
                    className="w-full rounded-lg border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Activity Status</label>
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
                    <option value="inactive">Inactive</option>
                    <option value="focused">Focused</option>
                  </select>
                </div>
              </div>
              <div className="flex justify-end">
                <button
                  type="submit"
                  className="inline-flex items-center px-4 py-2 rounded-lg text-sm font-semibold text-white bg-indigo-600 hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2 transition-all duration-300"
                >
                  Search Leaderboard
                </button>
              </div>
            </form>
            {leaderboard.length > 0 ? (
              <div className="mt-4 bg-white/90 backdrop-blur-sm rounded-2xl shadow-lg border border-gray-100 overflow-x-auto">
                <table className="min-w-full divide-y divide-gray-200">
                  <thead className="bg-gray-50">
                    <tr>
                      <th
                        scope="col"
                        className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider"
                      >
                        Student Name
                      </th>
                      <th
                        scope="col"
                        className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider"
                      >
                        Total Score
                      </th>
                      <th
                        scope="col"
                        className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider"
                      >
                        Rank
                      </th>
                      <th
                        scope="col"
                        className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider"
                      >
                        Activity Status
                      </th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-200">
                    {leaderboard.map((entry, index) => (
                      <tr key={entry._id || index}>
                        <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                          {entry.studentId?.name || 'N/A'}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                          {entry.totalScore || 0}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                          {entry.rank || index + 1}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                          {entry.activityStatus || 'N/A'}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <p className="mt-4 text-sm text-gray-500">No leaderboard data available</p>
            )}
          </div>
            </Tab.Panel>

            {/* Teachers Tab Panel */}
            <Tab.Panel className="bg-white/90 backdrop-blur-sm rounded-2xl shadow-lg border border-gray-100 p-6 dark:bg-gray-800 dark:border-gray-700">
          {/* Teachers List */}
          <div className="mb-8">
            <div className="flex justify-between items-center mb-4">
              <h4 className="text-md font-semibold text-gray-800">Teachers ({filteredTeachersTable.length})</h4>
              <div className="relative">
                <input
                  type="text"
                  value={teacherTableSearch}
                  onChange={(e) => {
                    setTeacherTableSearch(e.target.value);
                    setTeacherCurrentPage(1);
                  }}
                  placeholder="Search teachers..."
                  className="pl-10 pr-3 py-2 border rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 text-sm"
                />
                <svg className="h-5 w-5 text-gray-400 absolute left-3 top-2.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                </svg>
              </div>
            </div>
            {filteredTeachersTable.length === 0 ? (
              <p className="text-sm text-gray-500">
                {teacherTableSearch ? `No teachers found matching "${teacherTableSearch}"` : 'No teachers assigned yet'}
              </p>
            ) : (
              <>
              <div className="bg-white/90 backdrop-blur-sm rounded-2xl shadow-lg border border-gray-100 overflow-x-auto">
                <table className="min-w-full divide-y divide-gray-200">
                  <thead className="bg-gray-50">
                    <tr>
                      <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Name
                      </th>
                      <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Email
                      </th>
                      <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Can Create Question
                      </th>
                      <th scope="col" className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Actions
                      </th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-200">
                    {currentTeachers.map((teacher) => (
                      <tr key={teacher._id}>
                        <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                          {teacher.name}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                          {teacher.email}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                          <div className="flex items-center gap-2">
                            <button
                              onClick={() => handleManageTeacherPermission(teacher._id, !teacher.canCreateQuestion)}
                              className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2 ${
                                teacher.canCreateQuestion ? 'bg-green-500' : 'bg-gray-300'
                              }`}
                              role="switch"
                              aria-checked={teacher.canCreateQuestion}
                              title={teacher.canCreateQuestion ? 'Can create questions' : 'Cannot create questions'}
                            >
                              <span
                                className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                                  teacher.canCreateQuestion ? 'translate-x-6' : 'translate-x-1'
                                }`}
                              />
                            </button>
                            <span className="text-xs text-gray-600">
                              {teacher.canCreateQuestion ? 'Yes' : 'No'}
                            </span>
                          </div>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                          <button
                            onClick={() => handleRemoveTeacher(teacher._id)}
                            className="text-red-600 hover:text-red-900"
                          >
                            Remove
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              {/* Pagination */}
              {filteredTeachersTable.length > teacherItemsPerPage && (
                <div className="mt-4 flex items-center justify-between">
                  <p className="text-sm text-gray-500">
                    Showing {teacherIndexOfFirstItem + 1} to {Math.min(teacherIndexOfLastItem, filteredTeachersTable.length)} of {filteredTeachersTable.length} teachers
                  </p>
                  <div className="flex gap-2">
                    <button
                      onClick={() => setTeacherCurrentPage(p => Math.max(1, p - 1))}
                      disabled={teacherCurrentPage === 1}
                      className="px-3 py-1 border rounded-md text-sm disabled:opacity-50 disabled:cursor-not-allowed hover:bg-gray-50"
                    >
                      Previous
                    </button>
                    <span className="px-3 py-1 text-sm text-gray-700">
                      Page {teacherCurrentPage} of {teacherTotalPages}
                    </span>
                    <button
                      onClick={() => setTeacherCurrentPage(p => Math.min(teacherTotalPages, p + 1))}
                      disabled={teacherCurrentPage === teacherTotalPages}
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

            {/* Students Tab Panel */}
            <Tab.Panel className="bg-white/90 backdrop-blur-sm rounded-2xl shadow-lg border border-gray-100 p-6 dark:bg-gray-800 dark:border-gray-700">
          {/* Students List */}
          <div>
            <div className="flex justify-between items-center mb-4">
              <h4 className="text-md font-semibold text-gray-800">Students ({filteredStudentsTable.length})</h4>
              <div className="flex gap-3 items-center">
                <div className="relative">
                  <input
                    type="text"
                    value={studentTableSearch}
                    onChange={(e) => {
                      setStudentTableSearch(e.target.value);
                      setStudentCurrentPage(1);
                    }}
                    placeholder="Search students..."
                    className="pl-10 pr-3 py-2 border rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 text-sm"
                  />
                  <svg className="h-5 w-5 text-gray-400 absolute left-3 top-2.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                  </svg>
                </div>
              <button
                onClick={() => handleBlockAllUsers(true)}
                  className="inline-flex items-center px-3 py-2 rounded-lg text-xs font-semibold text-white bg-red-600 hover:bg-red-700 focus:outline-none transition-all duration-300"
              >
                Block All
              </button>
              <button
                onClick={() => handleBlockAllUsers(false)}
                  className="inline-flex items-center px-3 py-2 rounded-lg text-xs font-semibold text-white bg-green-600 hover:bg-green-700 focus:outline-none transition-all duration-300"
              >
                Unblock All
              </button>
            </div>
            </div>
            {filteredStudentsTable.length === 0 ? (
              <p className="text-sm text-gray-500">
                {studentTableSearch ? `No students found matching "${studentTableSearch}"` : 'No students enrolled yet'}
              </p>
            ) : (
              <>
              <div className="bg-white/90 backdrop-blur-sm rounded-2xl shadow-lg border border-gray-100 overflow-x-auto">
                <table className="min-w-full divide-y divide-gray-200">
                  <thead className="bg-gray-50">
                    <tr>
                      <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Name
                      </th>
                      <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Email
                      </th>
                      <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Phone Number
                      </th>
                      <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Status
                      </th>
                      <th scope="col" className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Actions
                      </th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-200">
                    {currentStudentsTable.map((student) => (
                      <tr key={student._id}>
                        <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                          {student.name}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                          {student.email}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                          {student.number || 'N/A'}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                          {student.isBlocked ? 'Blocked' : 'Active'}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                          <button
                            onClick={() => handleBlockUser(student._id, !student.isBlocked)}
                            className={`mr-2 text-${
                              student.isBlocked ? 'green' : 'red'
                            }-600 hover:text-${student.isBlocked ? 'green' : 'red'}-900`}
                          >
                            {student.isBlocked ? 'Unblock' : 'Block'}
                          </button>
                          <button
                            onClick={() => handleRemoveStudent(student._id)}
                            className="text-red-600 hover:text-red-900"
                          >
                            Remove
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              {/* Pagination */}
              {filteredStudentsTable.length > studentItemsPerPage && (
                <div className="mt-4 flex items-center justify-between">
                  <p className="text-sm text-gray-500">
                    Showing {studentIndexOfFirstItem + 1} to {Math.min(studentIndexOfLastItem, filteredStudentsTable.length)} of {filteredStudentsTable.length} students
                  </p>
                  <div className="flex gap-2">
                    <button
                      onClick={() => setStudentCurrentPage(p => Math.max(1, p - 1))}
                      disabled={studentCurrentPage === 1}
                      className="px-3 py-1 border rounded-md text-sm disabled:opacity-50 disabled:cursor-not-allowed hover:bg-gray-50"
                    >
                      Previous
                    </button>
                    <span className="px-3 py-1 text-sm text-gray-700">
                      Page {studentCurrentPage} of {studentTotalPages}
                    </span>
                    <button
                      onClick={() => setStudentCurrentPage(p => Math.min(studentTotalPages, p + 1))}
                      disabled={studentCurrentPage === studentTotalPages}
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
          </Tab.Panels>
        </Tab.Group>
      )}
    </div>
  );
};

export default AdminClassDetails;