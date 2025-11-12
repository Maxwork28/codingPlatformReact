import axios from 'axios';
import { API_BASE_URL } from '../constants';

/**
 * Axios instance with base URL and token interceptor
 */
const api = axios.create({
  baseURL: API_BASE_URL,
});

/**
 * Request interceptor to attach Bearer token to headers
 */
api.interceptors.request.use((config) => {
  const token = localStorage.getItem('token');
  console.log('Request interceptor triggered', { url: config.url, token: token ? 'Present' : 'Not present' });
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

// Authentication Routes
/**
 * Logs in a user with email and password, stores token in localStorage
 * @param {string} email - User email
 * @param {string} password - User password
 * @returns {Promise} Axios response
 */
export const login = async (email, password) => {
  console.log('login called', { email });
  try {
    const response = await api.post('/auth/login', { email, password });
    const { token } = response.data;
    localStorage.setItem('token', token);
    console.log('login success', { email, token });
    return response;
  } catch (err) {
    console.error('login error', { email, error: err.response?.data?.error || 'Failed to login' });
    throw err.response?.data?.error || 'Failed to login';
  }
};

// Admin Routes
/**
 * Uploads an Excel file with user data
 * @param {File} file - Excel file
 * @param {string} role - Role of users in the file
 * @returns {Promise} Axios response
 */
export const uploadExcel = async (file, role) => {
  console.log('uploadExcel called', { role, fileName: file?.name });
  const formData = new FormData();
  formData.append('file', file);
  formData.append('role', role);
  try {
    const response = await api.post('/admin/upload', formData);
    console.log('uploadExcel success', { role, response: response.data });
    return response;
  } catch (err) {
    console.error('uploadExcel error', { role, error: err.response?.data?.error || 'Failed to upload Excel file' });
    throw err.response?.data?.error || 'Failed to upload Excel file';
  }
};

/**
 * Creates a new class
 * @param {Object} data - Class data (name, description)
 * @param {File} [file] - Optional file
 * @returns {Promise} Axios response
 */
export const createClass = async (data, file) => {
  console.log('createClass called', { name: data.name, description: data.description, file: file?.name });
  const formData = new FormData();
  formData.append('name', data.name);
  formData.append('description', data.description);
  if (file) formData.append('file', file);
  try {
    const response = await api.post('/admin/class', formData);
    console.log('createClass success', { name: data.name, response: response.data });
    return response;
  } catch (err) {
    console.error('createClass error', { name: data.name, error: err.response?.data?.error || 'Failed to create class' });
    throw err.response?.data?.error || 'Failed to create class';
  }
};

/**
 * Edits an existing class
 * @param {string} classId - Class ID
 * @param {Object} data - Updated class data
 * @returns {Promise} Axios response
 */
export const editClass = async (classId, data) => {
  console.log('editClass called', { classId, data });
  try {
    const response = await api.put(`/admin/classes/${classId}`, data);
    console.log('editClass success', { classId, response: response.data });
    return response;
  } catch (err) {
    console.error('editClass error', { classId, error: err.response?.data?.error || 'Failed to edit class' });
    throw err.response?.data?.error || 'Failed to edit class';
  }
};

/**
 * Changes the status of a class
 * @param {string} classId - Class ID
 * @param {string} status - New status
 * @returns {Promise} Axios response
 */
export const changeClassStatus = async (classId, status) => {
  console.log('changeClassStatus called', { classId, status });
  try {
    const response = await api.put(`/admin/classes/${classId}/status`, { status });
    console.log('changeClassStatus success', { classId, status, response: response.data });
    return response;
  } catch (err) {
    console.error('changeClassStatus error', { classId, status, error: err.response?.data?.error || 'Failed to change class status' });
    throw err.response?.data?.error || 'Failed to change class status';
  }
};

/**
 * Deletes a class
 * @param {string} classId - Class ID
 * @returns {Promise} Axios response
 */
export const deleteClass = async (classId) => {
  console.log('deleteClass called', { classId });
  try {
    const response = await api.delete(`/admin/classes/${classId}`);
    console.log('deleteClass success', { classId, response: response.data });
    return response;
  } catch (err) {
    console.error('deleteClass error', { classId, error: err.response?.data?.error || 'Failed to delete class' });
    throw err.response?.data?.error || 'Failed to delete class';
  }
};

/**
 * Fetches all classes
 * @returns {Promise} Axios response
 */
export const getClasses = async (search = '') => {
  console.log('getClasses called', { search });
  try {
    const params = search ? { search } : {};
    const response = await api.get('/admin/classes', { params });
    console.log('getClasses success', { classes: response.data });
    return response;
  } catch (err) {
    console.error('getClasses error', { error: err.response?.data?.error || 'Failed to fetch classes' });
    throw err.response?.data?.error || 'Failed to fetch classes';
  }
};

/**
 * Fetches all teachers
 * @returns {Promise} Axios response
 */
export const getTeachers = async (search = '') => {
  console.log('getTeachers called', { search });
  try {
    const params = search ? { search } : {};
    const response = await api.get('/admin/teachers', { params });
    console.log('getTeachers success', { teachers: response.data.teachers });
    return response;
  } catch (err) {
    console.error('getTeachers error', { error: err.response?.data?.error || 'Failed to fetch teachers' });
    throw err.response?.data?.error || 'Failed to fetch teachers';
  }
};

/**
 * Fetches all students
 * @returns {Promise} Axios response
 */
export const getStudents = async (search = '') => {
  console.log('getStudents called', { search });
  try {
    const params = search ? { search } : {};
    const response = await api.get('/admin/students', { params });
    console.log('getStudents success', { students: response.data.students });
    return response;
  } catch (err) {
    console.error('getStudents error', { error: err.response?.data?.error || 'Failed to fetch students' });
    throw err.response?.data?.error || 'Failed to fetch students';
  }
};

/**
 * Edits a student's information
 * @param {string} studentId - Student ID
 * @param {Object} data - Updated student data (name, email, number)
 * @returns {Promise} Axios response
 */
export const editStudent = async (studentId, data) => {
  console.log('editStudent called', { studentId, data });
  try {
    const response = await api.put(`/admin/students/${studentId}`, data);
    console.log('editStudent success', { studentId, response: response.data });
    return response;
  } catch (err) {
    console.error('editStudent error', { studentId, error: err.response?.data?.error || 'Failed to edit student' });
    throw err.response?.data?.error || 'Failed to edit student';
  }
};

/**
 * Deletes a student
 * @param {string} studentId - Student ID
 * @returns {Promise} Axios response
 */
export const deleteStudent = async (studentId) => {
  console.log('deleteStudent called', { studentId });
  try {
    const response = await api.delete(`/admin/students/${studentId}`);
    console.log('deleteStudent success', { studentId, response: response.data });
    return response;
  } catch (err) {
    console.error('deleteStudent error', { studentId, error: err.response?.data?.error || 'Failed to delete student' });
    throw err.response?.data?.error || 'Failed to delete student';
  }
};

/**
 * Fetches students in a specific class
 * @param {string} classId - Class ID
 * @returns {Promise} Axios response
 */
export const getClassStudents = async (classId) => {
  console.log('getClassStudents called', { classId });
  try {
    const response = await api.get(`/admin/classes/${classId}/students`);
    console.log('getClassStudents success', { classId, students: response.data.students });
    return response;
  } catch (err) {
    console.error('getClassStudents error', { classId, error: err.response?.data?.error || 'Failed to fetch class students' });
    throw err.response?.data?.error || 'Failed to fetch class students';
  }
};

/**
 * Fetches teachers in a specific class
 * @param {string} classId - Class ID
 * @returns {Promise} Axios response
 */
export const getClassTeachers = async (classId) => {
  console.log('getClassTeachers called', { classId });
  try {
    const response = await api.get(`/admin/classes/${classId}/teachers`);
    console.log('getClassTeachers success', { classId, teachers: response.data.teachers });
    return response;
  } catch (err) {
    console.error('getClassTeachers error', { classId, error: err.response?.data?.error || 'Failed to fetch class teachers' });
    throw err.response?.data?.error || 'Failed to fetch class teachers';
  }
};

/**
 * Manages teacher permissions
 * @param {string} teacherId - Teacher ID
 * @param {boolean} canCreateQuestion - Permission to create questions
 * @returns {Promise} Axios response
 */
export const manageTeacherPermission = async (teacherId, canCreateQuestion) => {
  console.log('manageTeacherPermission called', { teacherId, canCreateQuestion });
  try {
    const response = await api.post('/admin/teacher-permission', { teacherId, canCreateQuestion });
    console.log('manageTeacherPermission success', { teacherId, canCreateQuestion, response: response.data });
    return response;
  } catch (err) {
    console.error('manageTeacherPermission error', { teacherId, canCreateQuestion, error: err.response?.data?.error || 'Failed to manage teacher permission' });
    throw err.response?.data?.error || 'Failed to manage teacher permission';
  }
};

/**
 * Assigns a teacher to a class
 * @param {string} classId - Class ID
 * @param {string} teacherId - Teacher ID
 * @returns {Promise} Axios response
 */
export const assignTeacherToClass = async (classId, teacherId) => {
  console.log('assignTeacherToClass called', { classId, teacherId });
  try {
    const response = await api.post('/admin/assign-teacher', { classId, teacherId });
    console.log('assignTeacherToClass success', { classId, teacherId, response: response.data });
    return response;
  } catch (err) {
    console.error('assignTeacherToClass error', { classId, teacherId, error: err.response?.data?.error || 'Failed to assign teacher' });
    throw err.response?.data?.error || 'Failed to assign teacher';
  }
};

/**
 * Removes a teacher from a class
 * @param {string} classId - Class ID
 * @param {string} teacherId - Teacher ID
 * @returns {Promise} Axios response
 */
export const removeTeacherFromClass = async (classId, teacherId) => {
  console.log('removeTeacherFromClass called', { classId, teacherId });
  try {
    const response = await api.post('/admin/classes/remove-teacher', {
      data: { classId, teacherId },
    });
    console.log('removeTeacherFromClass success', { classId, teacherId, response: response.data });
    return response;
  } catch (err) {
    console.error('removeTeacherFromClass error', { classId, teacherId, error: err.response?.data?.error || 'Failed to remove teacher' });
    throw err.response?.data?.error || 'Failed to remove teacher';
  }
};

/**
 * Removes a student from a class
 * @param {string} classId - Class ID
 * @param {string} studentId - Student ID
 * @returns {Promise} Axios response
 */
export const removeStudentFromClass = async (classId, studentId) => {
  console.log('removeStudentFromClass called', { classId, studentId });
  try {
    const response = await api.post('/admin/classes/remove-student', {
      data: { classId, studentId },
    });
    console.log('removeStudentFromClass success', { classId, studentId, response: response.data });
    return response;
  } catch (err) {
    console.error('removeStudentFromClass error', { classId, studentId, error: err.response?.data?.error || 'Failed to remove student' });
    throw err.response?.data?.error || 'Failed to remove student';
  }
};

/**
 * Fetches details of a specific class
 * @param {string} classId - Class ID
 * @returns {Promise} Axios response
 */
export const getClassDetails = async (classId) => {
  console.log('getClassDetails called', { classId });
  try {
    const response = await api.get(`/admin/getClass/${classId}`);
    console.log('getClassDetails success', { classId, classData: response.data.class });
    return response;
  } catch (err) {
    console.error('getClassDetails error', { classId, error: err.response?.data?.error || 'Failed to fetch class details' });
    throw err.response?.data?.error || 'Failed to fetch class details';
  }
};

/**
 * Fetches participant statistics for a class
 * @param {string} classId - Class ID
 * @returns {Promise} Axios response
 */
export const getParticipantStats = async (classId) => {
  console.log('getParticipantStats called', { classId });
  try {
    const response = await api.get(`/admin/classes/${classId}/participant-stats`);
    console.log('getParticipantStats success', { classId, stats: response.data });
    return response;
  } catch (err) {
    console.error('getParticipantStats error', { classId, error: err.response?.data?.error || 'Failed to fetch participant stats' });
    throw err.response?.data?.error || 'Failed to fetch participant stats';
  }
};

/**
 * Fetches run/submit statistics for a class
 * @param {string} classId - Class ID
 * @returns {Promise} Axios response
 */
export const getRunSubmitStats = async (classId) => {
  console.log('getRunSubmitStats called', { classId });
  try {
    const response = await api.get(`/admin/classes/${classId}/run-submit-stats`);
    console.log('getRunSubmitStats success', { classId, stats: response.data });
    return response;
  } catch (err) {
    console.error('getRunSubmitStats error', { classId, error: err.response?.data?.error || 'Failed to fetch run/submit stats' });
    throw err.response?.data?.error || 'Failed to fetch run/submit stats';
  }
};

/**
 * Creates a new assignment for a class
 * @param {string} classId - Class ID
 * @param {Object} assignmentData - Assignment data
 * @returns {Promise} Axios response
 */
export const createAssignment = async (classId, assignmentData) => {
  console.log('createAssignment called', { classId, assignmentData });
  try {
    const response = await api.post(`/admin/classes/${classId}/assignments`, assignmentData);
    console.log('createAssignment success', { classId, assignmentData, response: response.data });
    return response;
  } catch (err) {
    console.error('createAssignment error', { classId, assignmentData, error: err.response?.data?.error || 'Failed to create assignment' });
    throw err.response?.data?.error || 'Failed to create assignment';
  }
};

/**
 * Fetches assignments for a class
 * @param {string} classId - Class ID
 * @returns {Promise} Axios response
 */
export const getAssignments = async (classId) => {
  console.log('getAssignments called', { classId });
  try {
    const response = await api.get(`/admin/classes/${classId}/assignments`);
    console.log('getAssignments success', { classId, assignments: response.data.assignments });
    return response;
  } catch (err) {
    console.error('getAssignments error', { classId, error: err.response?.data?.error || 'Failed to fetch assignments' });
    throw err.response?.data?.error || 'Failed to fetch assignments';
  }
};

/**
 * Deletes an assignment from a class
 * @param {string} classId - Class ID
 * @param {string} assignmentId - Assignment ID
 * @returns {Promise} Axios response
 */
export const deleteAssignment = async (classId, assignmentId) => {
  console.log('deleteAssignment called', { classId, assignmentId });
  try {
    const response = await api.delete(`/admin/classes/${classId}/assignments/${assignmentId}`);
    console.log('deleteAssignment success', { classId, assignmentId, response: response.data });
    return response;
  } catch (err) {
    console.error('deleteAssignment error', { classId, assignmentId, error: err.response?.data?.error || 'Failed to delete assignment' });
    throw err.response?.data?.error || 'Failed to delete assignment';
  }
};

/**
 * Blocks or unblocks a user in a class
 * @param {string} classId - Class ID
 * @param {string} studentId - Student ID
 * @param {boolean} isBlocked - Block status
 * @returns {Promise} Axios response
 */
export const blockUser = async (classId, studentId, isBlocked) => {
  console.log('blockUser called', { classId, studentId, isBlocked });
  try {
    const response = await api.put(`/admin/classes/${classId}/block-user`, { studentId, isBlocked });
    console.log('blockUser success', { classId, studentId, isBlocked, response: response.data });
    return response;
  } catch (err) {
    console.error('blockUser error', { classId, studentId, isBlocked, error: err.response?.data?.error || 'Failed to update user block status' });
    throw err.response?.data?.error || 'Failed to update user block status';
  }
};

/**
 * Marks a student for focus or unfocus in a class
 * @param {string} classId - Class ID
 * @param {string} studentId - Student ID
 * @param {boolean} needsFocus - Focus status
 * @returns {Promise} Axios response
 */
export const focusStudent = async (classId, studentId, needsFocus) => {
  console.log('focusStudent called', { classId, studentId, needsFocus });
  try {
    const response = await api.patch(`/admin/classes/${classId}/focus-student`, { studentId, needsFocus });
    console.log('focusStudent success', { classId, studentId, needsFocus, response: response.data });
    return response;
  } catch (err) {
    console.error('focusStudent error', { classId, studentId, needsFocus, error: err.response?.data?.error || 'Failed to update student focus status' });
    throw err.response?.data?.error || 'Failed to update student focus status';
  }
};

/**
 * Blocks or unblocks all users in a class
 * @param {string} classId - Class ID
 * @param {boolean} isBlocked - Block status
 * @returns {Promise} Axios response
 */
export const blockAllUsers = async (classId, isBlocked) => {
  console.log('blockAllUsers called', { classId, isBlocked });
  try {
    const response = await api.put(`/admin/classes/${classId}/block-all`, { isBlocked });
    console.log('blockAllUsers success', { classId, isBlocked, response: response.data });
    return response;
  } catch (err) {
    console.error('blockAllUsers error', { classId, isBlocked, error: err.response?.data?.error || 'Failed to update block status for all users' });
    throw err.response?.data?.error || 'Failed to update block status for all users';
  }
};

/**
 * Searches the leaderboard for a class
 * @param {string} classId - Class ID
 * @param {Object} [filters={}] - Search filters
 * @returns {Promise} Axios response
 */
export const searchLeaderboard = async (classId, filters = {}) => {
  console.log('searchLeaderboard called', { classId, filters });
  try {
    const response = await api.get(`/admin/classes/${classId}/leaderboard/search`, { params: filters });
    console.log('searchLeaderboard success', { classId, filters, leaderboard: response.data });
    return response;
  } catch (err) {
    console.error('searchLeaderboard error', { classId, filters, error: err.response?.data?.error || 'Failed to search leaderboard' });
    throw err.response?.data?.error || 'Failed to search leaderboard';
  }
};

/**
 * Fetches counts for admin dashboard
 * @returns {Promise} Axios response
 */
export const getCounts = async () => {
  console.log('getCounts called');
  try {
    const response = await api.get('/admin/counts');
    console.log('getCounts success', { counts: response.data });
    return response;
  } catch (err) {
    console.error('getCounts error', { error: err.response?.data?.error || 'Failed to fetch counts' });
    throw err.response?.data?.error || 'Failed to fetch counts';
  }
};

/**
 * Fetches all questions with pagination
 * @param {Object} params - Pagination parameters (page, limit)
 * @returns {Promise} Axios response
 */
export const getAllQuestionsPaginated = async (params = {}) => {
  console.log('getAllQuestionsPaginated called', { params });
  try {
    const response = await api.get('/admin/questions/paginated', { params });
    console.log('getAllQuestionsPaginated success', { questions: response.data.questions });
    return response;
  } catch (err) {
    console.error('getAllQuestionsPaginated error', { params, error: err.response?.data?.error || 'Failed to fetch questions' });
    throw err.response?.data?.error || 'Failed to fetch questions';
  }
};

/**
 * Creates a new question (admin-only)
 * @param {Object} questionData - Question data to create (supports new types: singleCorrectMcq, multipleCorrectMcq, fillInTheBlanks, fillInTheBlanksCoding, coding)
 * @returns {Promise} Axios response
 */
export const adminCreateQuestion = async (questionData) => {
  console.log('adminCreateQuestion called', { questionData });
  try {
    // Ensure questionData includes new fields where applicable (e.g., correctOptions, starterCode, maxAttempts, explanation)
    const response = await api.post('/admin/questions', questionData);
    console.log('adminCreateQuestion success', { question: response.data.question });
    return response;
  } catch (err) {
    console.error('adminCreateQuestion error', { questionData, error: err.response?.data?.error || 'Failed to create question' });
    throw err.response?.data?.error || 'Failed to create question';
  }
};

/**
 * Edits a question
 * @param {string} questionId - Question ID
 * @param {Object} questionData - Updated question data (supports new types and fields)
 * @returns {Promise} Axios response
 */
export const adminEditQuestion = async (questionId, questionData) => {
  console.log('adminEditQuestion called', { questionId, questionData });
  try {
    // Ensure questionData supports new fields (correctOptions, starterCode, maxAttempts, explanation)
    const response = await api.put(`/admin/questions/${questionId}`, questionData);
    console.log('adminEditQuestion success', { questionId, response: response.data });
    return response;
  } catch (err) {
    console.error('adminEditQuestion error', { questionId, error: err.response?.data?.error || 'Failed to edit question' });
    throw err.response?.data?.error || 'Failed to edit question';
  }
};

/**
 * Deletes a question
 * @param {string} questionId - Question ID
 * @returns {Promise} Axios response
 */
export const adminDeleteQuestion = async (questionId) => {
  console.log('adminDeleteQuestion called', { questionId });
  try {
    const response = await api.delete(`/admin/questions/${questionId}`);
    console.log('adminDeleteQuestion success', { questionId, response: response.data });
    return response;
  } catch (err) {
    console.error('adminDeleteQuestion error', { questionId, error: err.response?.data?.error || 'Failed to delete question' });
    throw err.response?.data?.error || 'Failed to delete question';
  }
};

/**
 * Searches questions by ID
 * @param {string} questionId - Question ID
 * @returns {Promise} Axios response
 */
export const adminSearchQuestionsById = async (questionId) => {
  console.log('adminSearchQuestionsById called', { questionId, type: typeof questionId });
  
  // Validate questionId
  if (!questionId || questionId === 'undefined' || questionId === 'null' || (typeof questionId === 'string' && questionId.trim() === '')) {
    const errorMsg = 'Question ID is required';
    console.error('adminSearchQuestionsById validation failed:', { questionId, error: errorMsg });
    throw new Error(errorMsg);
  }
  
  // Basic MongoDB ObjectId format validation (24 hex characters)
  const objectIdPattern = /^[0-9a-fA-F]{24}$/;
  if (typeof questionId === 'string' && !objectIdPattern.test(questionId)) {
    const errorMsg = `Invalid question ID format: ${questionId}`;
    console.error('adminSearchQuestionsById validation failed:', { questionId, error: errorMsg });
    throw new Error(errorMsg);
  }
  
  try {
    const response = await api.get('/admin/questions/search-by-id', { params: { questionId } });
    console.log('adminSearchQuestionsById success', { questionId, question: response.data?.question });
    if (!response.data?.question) {
      throw new Error('Question not found');
    }
    return response;
  } catch (err) {
    console.error('adminSearchQuestionsById error', { 
      questionId, 
      error: err,
      errorMessage: err.message,
      responseError: err.response?.data?.error,
      responseStatus: err.response?.status,
      responseData: err.response?.data
    });
    // Handle different error formats
    if (typeof err === 'string') {
      throw new Error(err);
    } else if (err.response?.data?.error) {
      throw new Error(err.response.data.error);
    } else if (err.message) {
      throw err;
    } else {
      throw new Error('Failed to search question');
    }
  }
};

// Draft Question Routes
/**
 * Creates a draft question
 * @param {Object} questionData - Draft question data
 * @returns {Promise} Axios response
 */
export const createDraftQuestion = async (questionData) => {
  console.log('createDraftQuestion called', { questionData });
  try {
    const response = await api.post('/admin/questions/draft', {
      ...questionData,
      status: 'draft',
      isDraft: true
    });
    console.log('createDraftQuestion success', { question: response.data.question });
    return response;
  } catch (err) {
    console.error('createDraftQuestion error', { error: err.response?.data?.error || 'Failed to create draft' });
    throw err.response?.data?.error || 'Failed to create draft';
  }
};

/**
 * Gets all draft questions
 * @param {Object} params - Query parameters (page, limit, search)
 * @returns {Promise} Axios response
 */
export const getDrafts = async (params = {}) => {
  console.log('getDrafts called', { params });
  try {
    const response = await api.get('/admin/questions/drafts', { params });
    console.log('getDrafts success', { drafts: response.data.drafts });
    return response;
  } catch (err) {
    console.error('getDrafts error', { error: err.response?.data?.error || 'Failed to fetch drafts' });
    throw err.response?.data?.error || 'Failed to fetch drafts';
  }
};

/**
 * Gets draft count
 * @returns {Promise} Axios response
 */
export const getDraftCount = async () => {
  console.log('getDraftCount called');
  try {
    const response = await api.get('/admin/questions/drafts/count');
    console.log('getDraftCount success', { count: response.data.count });
    return response;
  } catch (err) {
    console.error('getDraftCount error', { error: err.response?.data?.error || 'Failed to fetch draft count' });
    throw err.response?.data?.error || 'Failed to fetch draft count';
  }
};

/**
 * Gets a single draft question
 * @param {string} questionId - Draft question ID
 * @returns {Promise} Axios response
 */
export const getDraftQuestion = async (questionId) => {
  console.log('getDraftQuestion called', { questionId });
  try {
    const response = await api.get(`/admin/questions/drafts/${questionId}`);
    console.log('getDraftQuestion success', { question: response.data.question });
    return response;
  } catch (err) {
    console.error('getDraftQuestion error', { error: err.response?.data?.error || 'Failed to fetch draft' });
    throw err.response?.data?.error || 'Failed to fetch draft';
  }
};

/**
 * Updates a draft question
 * @param {string} questionId - Draft question ID
 * @param {Object} questionData - Updated question data
 * @returns {Promise} Axios response
 */
export const updateDraftQuestion = async (questionId, questionData) => {
  console.log('updateDraftQuestion called', { questionId, questionData });
  try {
    const response = await api.put(`/admin/questions/drafts/${questionId}`, questionData);
    console.log('updateDraftQuestion success', { question: response.data.question });
    return response;
  } catch (err) {
    console.error('updateDraftQuestion error', { error: err.response?.data?.error || 'Failed to update draft' });
    throw err.response?.data?.error || 'Failed to update draft';
  }
};

/**
 * Publishes a draft question
 * @param {string} questionId - Draft question ID
 * @param {Object} questionData - Optional final question data
 * @returns {Promise} Axios response
 */
export const publishDraftQuestion = async (questionId, questionData = {}) => {
  console.log('publishDraftQuestion called', { questionId, questionData });
  try {
    const response = await api.put(`/admin/questions/drafts/${questionId}/publish`, questionData);
    console.log('publishDraftQuestion success', { question: response.data.question });
    return response;
  } catch (err) {
    console.error('publishDraftQuestion error', { error: err.response?.data?.error || 'Failed to publish draft' });
    throw err.response?.data?.error || 'Failed to publish draft';
  }
};

/**
 * Deletes a draft question
 * @param {string} questionId - Draft question ID
 * @returns {Promise} Axios response
 */
export const deleteDraftQuestion = async (questionId) => {
  console.log('deleteDraftQuestion called', { questionId });
  try {
    const response = await api.delete(`/admin/questions/drafts/${questionId}`);
    console.log('deleteDraftQuestion success', { message: response.data.message });
    return response;
  } catch (err) {
    console.error('deleteDraftQuestion error', { error: err.response?.data?.error || 'Failed to delete draft' });
    throw err.response?.data?.error || 'Failed to delete draft';
  }
};

// Teacher Routes
/**
 * Assigns a question to classes
 * @param {Object} questionData - Question data (supports new types: singleCorrectMcq, multipleCorrectMcq, fillInTheBlanks, fillInTheBlanksCoding, coding)
 * @param {string[]} [classIds=[]] - Array of class IDs
 * @returns {Promise} Axios response
 */
export const assignQuestion = async (questionData, classIds = []) => {
  console.log('assignQuestion called', { questionData, classIds });
  try {
    // Ensure questionData includes new fields where applicable (e.g., correctOptions for multipleCorrectMcq, starterCode for fillInTheBlanksCoding, maxAttempts, explanation)
    const payload = { ...questionData, classIds };
    console.log('Payload being sent to API:', payload);
    const response = await api.post('/questions/assign', payload);
    console.log('assignQuestion success', { response: response.data });
    return response;
  } catch (err) {
    console.error('assignQuestion error', { error: err.response?.data?.error || 'Failed to assign question' });
    throw err.response?.data?.error || 'Failed to assign question';
  }
};

/**
 * Assigns a question to a specific class
 * @param {string} questionId - Question ID
 * @param {string} classId - Class ID
 * @returns {Promise} Axios response
 */
export const assignQuestionToClass = async (questionId, classId) => {
  console.log('assignQuestionToClass called', { questionId, classId });
  try {
    const requestBody = { classId };
    console.log('assignQuestionToClass request body:', requestBody);
    const response = await api.post(`/questions/${questionId}/assign`, requestBody);
    console.log('assignQuestionToClass success', { response: response.data });
    return response;
  } catch (err) {
    console.error('assignQuestionToClass error', { error: err.response?.data?.error || 'Failed to assign question to class' });
    throw err.response?.data?.error || 'Failed to assign question to class';
  }
};

/**
 * Edits a question
 * @param {string} questionId - Question ID
 * @param {Object} questionData - Updated question data (supports new types and fields)
 * @returns {Promise} Axios response
 */
export const editQuestion = async (questionId, questionData) => {
  console.log('editQuestion called', { questionId, questionData });
  try {
    // Ensure questionData supports new fields (correctOptions, starterCode, maxAttempts, explanation)
    const response = await api.put(`/questions/${questionId}`, questionData);
    console.log('editQuestion success', { response: response.data });
    return response;
  } catch (err) {
    console.error('editQuestion error', { error: err.response?.data?.error || 'Failed to edit question' });
    throw err.response?.data?.error || 'Failed to edit question';
  }
};

/**
 * Deletes a question
 * @param {string} questionId - Question ID
 * @returns {Promise} Axios response
 */
export const deleteQuestion = async (questionId) => {
  console.log('deleteQuestion called', { questionId });
  try {
    const response = await api.delete(`/questions/${questionId}`);
    console.log('deleteQuestion success', { response: response.data });
    return response;
  } catch (err) {
    console.error('deleteQuestion error', { error: err.response?.data?.error || 'Failed to delete question' });
    throw err.response?.data?.error || 'Failed to delete question';
  }
};

/**
 * Publishes a question for a class
 * @param {string} questionId - Question ID
 * @param {string} classId - Class ID
 * @returns {Promise} Axios response
 */
export const publishQuestion = async (questionId, classId) => {
  console.log('publishQuestion called', { questionId, classId });
  try {
    const response = await api.put(`/questions/${questionId}/publish`, { classId });
    console.log('publishQuestion success', { response: response.data });
    return response;
  } catch (err) {
    console.error('publishQuestion error', { error: err.response?.data?.error || 'Failed to publish question' });
    throw err.response?.data?.error || 'Failed to publish question';
  }
};

/**
 * Unpublishes a question for a class
 * @param {string} questionId - Question ID
 * @param {string} classId - Class ID
 * @returns {Promise} Axios response
 */
export const unpublishQuestion = async (questionId, classId) => {
  console.log('unpublishQuestion called', { questionId, classId });
  try {
    const response = await api.put(`/questions/${questionId}/unpublish`, { classId });
    console.log('unpublishQuestion success', { response: response.data });
    return response;
  } catch (err) {
    console.error('unpublishQuestion error', { error: err.response?.data?.error || 'Failed to unpublish question' });
    throw err.response?.data?.error || 'Failed to unpublish question';
  }
};

/**
 * Disables a question for a class
 * @param {string} questionId - Question ID
 * @param {string} classId - Class ID
 * @returns {Promise} Axios response
 */
export const disableQuestion = async (questionId, classId) => {
  console.log('disableQuestion called', { questionId, classId });
  try {
    const response = await api.put(`/questions/${questionId}/disable`, { classId });
    console.log('disableQuestion success', { response: response.data });
    return response;
  } catch (err) {
    console.error('disableQuestion error', { error: err.response?.data?.error || 'Failed to disable question' });
    throw err.response?.data?.error || 'Failed to disable question';
  }
};

/**
 * Enables a question for a class
 * @param {string} questionId - Question ID
 * @param {string} classId - Class ID
 * @returns {Promise} Axios response
 */
export const enableQuestion = async (questionId, classId) => {
  console.log('enableQuestion called', { questionId, classId });
  try {
    const response = await api.put(`/questions/${questionId}/enable`, { classId });
    console.log('enableQuestion success', { response: response.data });
    return response;
  } catch (err) {
    console.error('enableQuestion error', { error: err.response?.data?.error || 'Failed to enable question' });
    throw err.response?.data?.error || 'Failed to enable question';
  }
};

/**
 * Fetches the solution for a question
 * @param {string} questionId - Question ID
 * @returns {Promise} Axios response (includes correctOptions, codeSnippet, starterCode)
 */
export const viewSolution = async (questionId) => {
  console.log('viewSolution called', { questionId });
  try {
    const response = await api.get(`/questions/${questionId}/solution`);
    console.log('viewSolution success', { response: response.data });
    return response;
  } catch (err) {
    console.error('viewSolution error', { error: err.response?.data?.error || 'Failed to fetch solution' });
    throw err.response?.data?.error || 'Failed to fetch solution';
  }
};

/**
 * Fetches test cases for a question
 * @param {string} questionId - Question ID
 * @returns {Promise} Axios response
 */
export const viewTestCases = async (questionId) => {
  console.log('viewTestCases called', { questionId });
  try {
    const response = await api.get(`/questions/${questionId}/test-cases`);
    console.log('viewTestCases success', { response: response.data });
    return response;
  } catch (err) {
    console.error('viewTestCases error', { error: err.response?.data?.error || 'Failed to fetch test cases' });
    throw err.response?.data?.error || 'Failed to fetch test cases';
  }
};

/**
 * Fetches the statement for a question
 * @param {string} questionId - Question ID
 * @returns {Promise} Axios response (includes codeSnippet, starterCode, excludes functionSignature)
 */
export const viewStatement = async (questionId) => {
  console.log('viewStatement called', { questionId });
  try {
    const response = await api.get(`/questions/${questionId}/statement`);
    console.log('viewStatement success', { response: response.data });
    return response;
  } catch (err) {
    console.error('viewStatement error', { error: err.response?.data?.error || 'Failed to fetch question statement' });
    throw err.response?.data?.error || 'Failed to fetch question statement';
  }
};

/**
 * Fetches questions for a specific class
 * @param {string} classId - Class ID
 * @returns {Promise} Axios response
 */
export const getQuestionsByClass = async (classId) => {
  console.log('getQuestionsByClass called', { classId });
  try {
    const response = await api.get(`/questions/classes/${classId}/questions`);
    console.log('getQuestionsByClass success', { response: response.data });
    return response;
  } catch (err) {
    console.error('getQuestionsByClass error', { error: err.response?.data?.error || 'Failed to fetch questions' });
    throw err.response?.data?.error || 'Failed to fetch questions';
  }
};

/**
 * Fetches a specific question
 * @param {string} questionId - Question ID
 * @param {string} [classId=null] - Optional class ID
 * @returns {Promise} Axios response
 */
export const getQuestion = async (questionId, classId = null) => {
  console.log('getQuestion called', { questionId, classId });
  try {
    const params = classId ? { classId } : {};
    const response = await api.get(`/questions/${questionId}`, { params });
    console.log('getQuestion success', { response: response.data });
    return response;
  } catch (err) {
    console.error('getQuestion error', { error: err.response?.data?.error || 'Failed to fetch question' });
    throw err.response?.data?.error || 'Failed to fetch question';
  }
};

/**
 * Fetches all questions
 * @param {Object} [params={}] - Query parameters
 * @returns {Promise} Axios response
 */
export const getAllQuestions = async (params = {}) => {
  console.log('getAllQuestions called', { params });
  try {
    const response = await api.get('/questions', { params });
    console.log('getAllQuestions success', { response: response.data });
    return response;
  } catch (err) {
    console.error('getAllQuestions error', { error: err.response?.data?.error || 'Failed to fetch all questions' });
    throw err.response?.data?.error || 'Failed to fetch all questions';
  }
};

/**
 * Searches questions with filters
 * @param {Object} [filters={}] - Search filters (supports new types: singleCorrectMcq, multipleCorrectMcq, fillInTheBlanks, fillInTheBlanksCoding, coding)
 * @returns {Promise} Axios response
 */
export const searchQuestions = async (filters = {}) => {
  console.log('searchQuestions called', { filters });
  try {
    const response = await api.get('/questions/search', { params: filters });
    console.log('searchQuestions success', { response: response.data });
    return response;
  } catch (err) {
    console.error('searchQuestions error', { error: err.response?.data?.error || 'Failed to search questions' });
    throw err.response?.data?.error || 'Failed to search questions';
  }
};

/**
 * Fetches submission code
 * @param {string} submissionId - Submission ID
 * @returns {Promise} Axios response
 */
export const viewSubmissionCode = async (submissionId) => {
  console.log('viewSubmissionCode called', { submissionId });
  try {
    const response = await api.get(`/questions/submission/${submissionId}`);
    console.log('viewSubmissionCode success', { response: response.data });
    return response;
  } catch (err) {
    console.error('viewSubmissionCode error', { error: err.response?.data?.error || 'Failed to fetch submission code' });
    throw err.response?.data?.error || 'Failed to fetch submission code';
  }
};

/**
 * Fetches question perspective report
 * @param {string} classId - Class ID
 * @param {string} questionId - Question ID
 * @returns {Promise} Axios response
 */
export const getQuestionPerspectiveReport = async (classId, questionId) => {
  console.log('getQuestionPerspectiveReport called', { classId, questionId });
  try {
    const response = await api.get(`/questions/classes/${classId}/questions/${questionId}/report`);
    console.log('getQuestionPerspectiveReport success', { response: response.data });
    return response;
  } catch (err) {
    console.error('getQuestionPerspectiveReport error', { error: err.response?.data?.error || 'Failed to fetch question perspective report' });
    throw err.response?.data?.error || 'Failed to fetch question perspective report';
  }
};

// Student Routes
/**
 * Submits an answer for a question
 * @param {string} questionId - Question ID
 * @param {string|number|number[]} answer - Answer (string for coding/fillInTheBlanks, number for singleCorrectMcq, number[] for multipleCorrectMcq)
 * @param {string} [classId] - Class ID
 * @param {string} [language] - Programming language (for coding/fillInTheBlanksCoding)
 * @param {boolean} [isRun=false] - Whether it's a run or submit
 * @returns {Promise} Axios response (includes explanation)
 */
export const submitAnswer = async (questionId, answer, classId, language, isRun = false) => {
  console.log('submitAnswer called', { questionId, classId, language, isRun });
  try {
    const response = await api.post(`/questions/${questionId}/submit`, { answer, classId, language, isRun });
    console.log('submitAnswer success', { response: response.data });
    return response;
  } catch (err) {
    console.error('submitAnswer error', { error: err.response?.data?.error || 'Failed to submit answer' });
    // Handle maxAttempts error specifically for UI feedback
    if (err.response?.data?.error === 'Maximum submission attempts reached') {
      throw new Error('You have reached the maximum number of submission attempts for this question.');
    }
    throw err.response?.data?.error || 'Failed to submit answer';
  }
};

/**
 * Runs code for a question
 * @param {string} questionId - Question ID
 * @param {string} answer - Code to run (for coding or fillInTheBlanksCoding)
 * @param {string} classId - Class ID
 * @param {string} language - Programming language
 * @returns {Promise} Axios response (includes explanation)
 */
export const runCode = async (questionId, answer, classId, language) => {
  console.log('runCode called', { questionId, classId, language });
  try {
    const response = await api.post(`/questions/${questionId}/run`, { answer, classId, language });
    console.log('runCode success', { response: response.data });
    return response;
  } catch (err) {
    console.error('runCode error', { error: err.response?.data?.error || 'Failed to run code' });
    throw err.response?.data?.error || 'Failed to run code';
  }
};

/**
 * Fetches the leaderboard for a class
 * @param {string} classId - Class ID
 * @returns {Promise} Axios response
 */
export const getLeaderboard = async (classId) => {
  console.log('getLeaderboard called', { classId });
  try {
    // Updated endpoint to match questionController.js
    const response = await api.get(`/questions/classes/${classId}/leaderboard`);
    console.log('getLeaderboard success', { response: response.data });
    return response;
  } catch (err) {
    console.error('getLeaderboard error', { error: err.response?.data?.error || 'Failed to fetch leaderboard' });
    throw err.response?.data?.error || 'Failed to fetch leaderboard';
  }
};
export const runCodeWithCustomInput = async (questionId, answer, classId, language, customInput,expectedOutput) => {
  console.log('api: runCodeWithCustomInput called', { questionId, classId, language, customInput,expectedOutput });
  try {
    const response = await api.post(`/questions/${questionId}/run-custom`, {
      answer,
      classId,
      language,
      customInput,
      expectedOutput
    });
    console.log('api: runCodeWithCustomInput success', { response: response.data });
    return response;
  } catch (err) {
    console.error('api: runCodeWithCustomInput error', { error: err.response?.data?.error || 'Failed to run code with custom input' });
    throw err.response?.data?.error || 'Failed to run code with custom input';
  }
};

// Teacher Testing Routes (no leaderboard/stats impact)
/**
 * Tests code with ALL test cases (public + hidden) - Teacher only
 * @param {string} questionId - Question ID
 * @param {string} answer - Code to test
 * @param {string} classId - Class ID (optional, for verification)
 * @param {string} language - Programming language
 * @returns {Promise} Axios response with all test results
 */
export const teacherTestQuestion = async (questionId, answer, classId, language) => {
  console.log('========================================');
  console.log('[API] teacherTestQuestion called');
  console.log('[API] Parameters:', { 
    questionId, 
    classId: classId || 'null (draft)', 
    language,
    answerLength: answer?.length || 0
  });
  
  try {
    console.log('[API] Making POST request to:', `/questions/${questionId}/teacher-test`);
    console.log('[API] Request payload:', {
      answer: answer ? `${answer.substring(0, 100)}... (length: ${answer.length})` : 'MISSING',
      classId: classId || null,
      language
    });
    
    const response = await api.post(`/questions/${questionId}/teacher-test`, {
      answer,
      classId,
      language
    });
    
    console.log('[API] ====== SUCCESS ======');
    console.log('[API] Response status:', response.status);
    console.log('[API] Response data:', {
      message: response.data.message,
      testResultsCount: response.data.testResults?.length || 0,
      passedTestCases: response.data.passedTestCases,
      totalTestCases: response.data.totalTestCases,
      publicTestCases: response.data.publicTestCases,
      hiddenTestCases: response.data.hiddenTestCases,
      isCorrect: response.data.isCorrect
    });
    console.log('[API] Full response data:', JSON.stringify(response.data, null, 2));
    console.log('========================================');
    
    return response;
  } catch (err) {
    console.error('[API] ====== ERROR ======');
    console.error('[API] Error type:', err.constructor.name);
    console.error('[API] Error message:', err.message);
    console.error('[API] Error response status:', err.response?.status);
    console.error('[API] Error response data:', err.response?.data);
    console.error('[API] Error response headers:', err.response?.headers);
    console.error('[API] Full error:', JSON.stringify(err, Object.getOwnPropertyNames(err), 2));
    console.error('========================================');
    
    const errorMessage = err.response?.data?.error || err.message || 'Failed to test question';
    throw new Error(errorMessage);
  }
};

/**
 * Tests code with custom input - Teacher only
 * @param {string} questionId - Question ID
 * @param {string} answer - Code to test
 * @param {string} classId - Class ID (optional, for verification)
 * @param {string} language - Programming language
 * @param {string} customInput - Custom test input
 * @param {string} expectedOutput - Expected output (optional)
 * @returns {Promise} Axios response with custom test result
 */
export const teacherTestWithCustomInput = async (questionId, answer, classId, language, customInput, expectedOutput) => {
  console.log('teacherTestWithCustomInput called', { questionId, classId, language, customInput, expectedOutput });
  try {
    const response = await api.post(`/questions/${questionId}/teacher-test-custom`, {
      answer,
      classId,
      language,
      customInput,
      expectedOutput
    });
    console.log('teacherTestWithCustomInput success', { 
      testResult: response.data.testResult,
      actualOutput: response.data.actualOutput,
      passed: response.data.passed
    });
    return response;
  } catch (err) {
    console.error('teacherTestWithCustomInput error', { error: err.response?.data?.error || 'Failed to test with custom input' });
    throw err.response?.data?.error || 'Failed to test with custom input';
  }
};

export default api;