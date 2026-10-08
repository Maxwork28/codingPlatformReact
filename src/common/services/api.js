import axios from 'axios';
import { API_BASE_URL } from '../constants';
import { SEB_REQUIRED_EVENT, sebRequestHeaders } from '../utils/seb';

/** Default request timeout. Judge-backed calls (run/submit/teacher-test) pass JUDGE_TIMEOUT instead. */
const DEFAULT_TIMEOUT = 30000;
export const JUDGE_TIMEOUT = 90000;
const JUDGE_OPTS = { timeout: JUDGE_TIMEOUT };
export const JUDGE_TIMEOUT_MESSAGE = 'The judge took too long. Please try again.';

/** Endpoints where a 401 is a normal "wrong credentials / bad token" answer, not an expired session. */
const PUBLIC_AUTH_PATHS = ['/auth/login', '/auth/forgot-password', '/auth/reset-password'];

/**
 * Axios instance with base URL and token interceptor
 */
const api = axios.create({
  baseURL: API_BASE_URL,
  timeout: DEFAULT_TIMEOUT,
});

/**
 * Request interceptor to attach Bearer token to headers
 */
api.interceptors.request.use((config) => {
  const token = localStorage.getItem('token');
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

const requestPath = (config) => {
  try {
    const url = config?.url || '';
    return url.startsWith('http') ? new URL(url).pathname : url.split('?')[0];
  } catch {
    return config?.url || '';
  }
};

let sessionExpiredHandled = false;

/**
 * Response interceptor:
 * - 401 on any authenticated endpoint: the session is gone. Clear the token and send the user to
 *   /login?expired=1 exactly once (later 401s from in-flight requests are ignored).
 * - 429 with code JUDGE_BUSY / RATE_LIMITED: make sure the server's message sits in
 *   `response.data.error`, which is what every wrapper below rethrows as its string.
 * - Timeouts (ECONNABORTED) are given a synthetic `response.data.error` with a friendly message so
 *   the same wrappers surface it instead of their generic fallback.
 */
api.interceptors.response.use(
  (response) => response,
  (error) => {
    const status = error.response?.status;
    const data = error.response?.data;
    if (status === 401 && !PUBLIC_AUTH_PATHS.includes(requestPath(error.config))) {
      if (!sessionExpiredHandled) {
        sessionExpiredHandled = true;
        try {
          localStorage.removeItem('token');
        } catch {
          /* ignore */
        }
        if (typeof window !== 'undefined' && !window.location.pathname.startsWith('/login')) {
          window.location.assign('/login?expired=1');
        }
      }
      return Promise.reject(error);
    }
    if (status === 429 && (data?.code === 'JUDGE_BUSY' || data?.code === 'RATE_LIMITED')) {
      const message = data.error || data.message || 'The server is busy. Please try again in a moment.';
      error.response.data = { ...data, error: message };
      return Promise.reject(error);
    }
    if (error.code === 'ECONNABORTED' && !error.response) {
      error.response = { status: 0, data: { error: JUDGE_TIMEOUT_MESSAGE, code: 'TIMEOUT' } };
    }
    return Promise.reject(error);
  },
);

// Authentication Routes
/**
 * Logs in a user with email and password, stores token in localStorage
 * @param {string} email - User email
 * @param {string} password - User password
 * @returns {Promise} Axios response
 */
export const login = async (email, password) => {
  try {
    const response = await api.post('/auth/login', { email, password });
    const { token } = response.data;
    localStorage.setItem('token', token);
    return response;
  } catch (err) {
    throw err.response?.data?.error || 'Failed to login';
  }
};

/**
 * Requests a password-reset email.
 * @param {string} email
 * @returns {Promise<{ message: string }>}
 */
export const forgotPassword = async (email) => {
  try {
    const response = await api.post('/auth/forgot-password', { email: String(email || '').trim().toLowerCase() });
    return response.data;
  } catch (err) {
    throw err.response?.data?.error || 'Failed to send reset email';
  }
};

/**
 * Completes a password reset with the token from the email link.
 * @param {string} token
 * @param {string} newPassword
 * @returns {Promise<{ message: string }>}
 */
export const resetPassword = async (token, newPassword) => {
  try {
    const response = await api.post('/auth/reset-password', { token, newPassword });
    return response.data;
  } catch (err) {
    throw err.response?.data?.error || 'Failed to reset password';
  }
};

/**
 * Changes the signed-in user's password. The server returns a fresh token plus the user fields;
 * the caller should dispatch `passwordChanged({ token })` so the forced-change gate lifts.
 * @param {string} oldPassword
 * @param {string} newPassword
 * @returns {Promise<{ message: string, token: string }>}
 */
export const changePassword = async (oldPassword, newPassword) => {
  try {
    const response = await api.post('/auth/change-password', { oldPassword, newPassword });
    if (response.data?.token) localStorage.setItem('token', response.data.token);
    return response.data;
  } catch (err) {
    throw err.response?.data?.error || 'Failed to change password';
  }
};

/** Backend liveness probe (no auth). */
export const getHealth = async () => {
  const response = await api.get('/health', { timeout: 5000 });
  return response.data;
};

/**
 * Upload student profile picture
 * @param {File} file - Image file
 * @returns {Promise} Axios response with profilePicture path
 */
export const uploadProfilePicture = async (file) => {
  const formData = new FormData();
  formData.append('profilePicture', file);
  try {
    const response = await api.post('/auth/profile-picture', formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
    });
    return response;
  } catch (err) {
    throw err.response?.data?.error || 'Failed to upload profile picture';
  }
};

/**
 * Uploads an image for use inside a question description.
 * @param {File} file
 * @returns {Promise<{ url: string }>}
 */
export const uploadQuestionImage = async (file) => {
  const formData = new FormData();
  formData.append('image', file);
  try {
    const response = await api.post('/questions/upload-image', formData);
    return response.data;
  } catch (err) {
    throw new Error(err.response?.data?.error || 'Failed to upload image');
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
  const formData = new FormData();
  formData.append('file', file);
  formData.append('role', role);
  try {
    const response = await api.post('/admin/upload', formData);
    return response;
  } catch (err) {
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
  const formData = new FormData();
  formData.append('name', data.name);
  formData.append('description', data.description);
  if (file) formData.append('file', file);
  try {
    const response = await api.post('/admin/class', formData);
    return response;
  } catch (err) {
    throw err.response?.data?.error || 'Failed to create class';
  }
};

/**
 * Edits an existing class
 * @param {string} classId - Class ID
 * @param {Object} data - Updated class data
 * @returns {Promise} Axios response
 */
export const addStudentsToClass = async (classId, { file, emails } = {}) => {
  const formData = new FormData();
  if (file) formData.append('file', file);
  if (emails) formData.append('emails', emails);
  try {
    return await api.post(`/admin/classes/${classId}/students`, formData);
  } catch (err) {
    throw err.response?.data?.error || 'Failed to add students to class';
  }
};

export const editClass = async (classId, data) => {
  try {
    const response = await api.put(`/admin/classes/${classId}`, data);
    return response;
  } catch (err) {
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
  try {
    const response = await api.put(`/admin/classes/${classId}/status`, { status });
    return response;
  } catch (err) {
    throw err.response?.data?.error || 'Failed to change class status';
  }
};

/**
 * Deletes a class
 * @param {string} classId - Class ID
 * @returns {Promise} Axios response
 */
export const deleteClass = async (classId) => {
  try {
    const response = await api.delete(`/admin/classes/${classId}`);
    return response;
  } catch (err) {
    throw err.response?.data?.error || 'Failed to delete class';
  }
};

/**
 * Fetches all classes
 * @returns {Promise} Axios response
 */
export const getClasses = async (search = '') => {
  try {
    const params = search ? { search } : {};
    const response = await api.get('/admin/classes', { params });
    return response;
  } catch (err) {
    throw err.response?.data?.error || 'Failed to fetch classes';
  }
};

/**
 * Fetches all teachers
 * @returns {Promise} Axios response
 */
export const getTeachers = async (search = '') => {
  try {
    const params = search ? { search } : {};
    const response = await api.get('/admin/teachers', { params });
    return response;
  } catch (err) {
    throw err.response?.data?.error || 'Failed to fetch teachers';
  }
};

/**
 * Deletes a teacher account from the teacher list.
 * Related classes, questions, exams, and student work are kept.
 * @param {string} teacherId - Teacher ID
 * @returns {Promise} Axios response
 */
export const deleteTeacher = async (teacherId) => {
  try {
    const response = await api.delete(`/admin/teachers/${teacherId}`);
    return response;
  } catch (err) {
    throw err.response?.data?.error || 'Failed to delete teacher';
  }
};

/**
 * Fetches all students
 * @returns {Promise} Axios response
 */
export const getStudents = async (search = '') => {
  try {
    const params = search ? { search } : {};
    const response = await api.get('/admin/students', { params });
    return response;
  } catch (err) {
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
  try {
    const response = await api.put(`/admin/students/${studentId}`, data);
    return response;
  } catch (err) {
    throw err.response?.data?.error || 'Failed to edit student';
  }
};

/**
 * Deletes a student
 * @param {string} studentId - Student ID
 * @returns {Promise} Axios response
 */
export const deleteStudent = async (studentId) => {
  try {
    const response = await api.delete(`/admin/students/${studentId}`);
    return response;
  } catch (err) {
    throw err.response?.data?.error || 'Failed to delete student';
  }
};

/**
 * Fetches students in a specific class
 * @param {string} classId - Class ID
 * @returns {Promise} Axios response
 */
export const getClassStudents = async (classId) => {
  try {
    const response = await api.get(`/admin/classes/${classId}/students`);
    return response;
  } catch (err) {
    throw err.response?.data?.error || 'Failed to fetch class students';
  }
};

/**
 * Fetches teachers in a specific class
 * @param {string} classId - Class ID
 * @returns {Promise} Axios response
 */
export const getClassTeachers = async (classId) => {
  try {
    const response = await api.get(`/admin/classes/${classId}/teachers`);
    return response;
  } catch (err) {
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
  try {
    const response = await api.post('/admin/teacher-permission', { teacherId, canCreateQuestion });
    return response;
  } catch (err) {
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
  try {
    const response = await api.post('/admin/classes/assign-teacher', { classId, teacherId });
    return response;
  } catch (err) {
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
  try {
    const response = await api.post('/admin/classes/remove-teacher', { classId, teacherId });
    return response;
  } catch (err) {
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
  try {
    const response = await api.post('/admin/classes/remove-student', { classId, studentId });
    return response;
  } catch (err) {
    throw err.response?.data?.error || 'Failed to remove student';
  }
};

/**
 * Fetches details of a specific class
 * @param {string} classId - Class ID
 * @returns {Promise} Axios response
 */
export const getClassDetails = async (classId) => {
  try {
    const response = await api.get(`/admin/getClass/${classId}`);
    return response;
  } catch (err) {
    throw err.response?.data?.error || 'Failed to fetch class details';
  }
};

/**
 * Fetches participant statistics for a class
 * @param {string} classId - Class ID
 * @returns {Promise} Axios response
 */
export const getParticipantStats = async (classId) => {
  try {
    const response = await api.get(`/admin/classes/${classId}/participant-stats`);
    return response;
  } catch (err) {
    throw err.response?.data?.error || 'Failed to fetch participant stats';
  }
};

/**
 * Fetches run/submit statistics for a class
 * @param {string} classId - Class ID
 * @returns {Promise} Axios response
 */
export const getQuestionSummary = async (classId) => {
  try {
    const response = await api.get(`/admin/classes/${classId}/question-summary`);
    return response;
  } catch (err) {
    throw err.response?.data?.error || 'Failed to fetch question summary';
  }
};

export const getRunSubmitStats = async (classId) => {
  try {
    const response = await api.get(`/admin/classes/${classId}/run-submit-stats`);
    return response;
  } catch (err) {
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
  try {
    const response = await api.post(`/admin/classes/${classId}/assignments`, assignmentData);
    return response;
  } catch (err) {
    throw err.response?.data?.error || 'Failed to create assignment';
  }
};

/**
 * Fetches assignments for a class
 * @param {string} classId - Class ID
 * @returns {Promise} Axios response
 */
export const getAssignments = async (classId) => {
  try {
    const response = await api.get(`/admin/classes/${classId}/assignments`);
    return response;
  } catch (err) {
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
  try {
    const response = await api.delete(`/admin/classes/${classId}/assignments/${assignmentId}`);
    return response;
  } catch (err) {
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
  try {
    const response = await api.put(`/admin/classes/${classId}/block-user`, { studentId, isBlocked });
    return response;
  } catch (err) {
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
  try {
    const response = await api.patch(`/admin/classes/${classId}/focus-student`, { studentId, needsFocus });
    return response;
  } catch (err) {
    throw err.response?.data?.error || 'Failed to update student focus status';
  }
};

/**
 * Blocks or unblocks all users in a class
 * @param {string} classId - Class ID
 * @param {boolean} isBlocked - Block status
 * @param {Object} [options={}] - Optional filters: onlyInactive, studentIds
 * @returns {Promise} Axios response
 */
export const blockAllUsers = async (classId, isBlocked, options = {}) => {
  try {
    const response = await api.put(`/admin/classes/${classId}/block-all`, { isBlocked, ...options });
    return response;
  } catch (err) {
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
  try {
    const response = await api.get(`/admin/classes/${classId}/leaderboard/search`, { params: filters });
    return response;
  } catch (err) {
    throw err.response?.data?.error || 'Failed to search leaderboard';
  }
};

/**
 * Fetches counts for admin dashboard
 * @returns {Promise} Axios response
 */
export const getCounts = async () => {
  try {
    const response = await api.get('/admin/counts');
    return response;
  } catch (err) {
    throw err.response?.data?.error || 'Failed to fetch counts';
  }
};

export const getQuestionOverview = async (questionId) => {
  try {
    return await api.get(`/admin/questions/${questionId}/overview`);
  } catch (err) {
    throw err.response?.data?.error || 'Failed to load question';
  }
};

export const getClassOverview = async (classId) => {
  try {
    const tz = Intl.DateTimeFormat().resolvedOptions().timeZone;
    return await api.get(`/admin/classes/${classId}/overview`, { params: { tz } });
  } catch (err) {
    throw err.response?.data?.error || 'Failed to load class';
  }
};

export const removeQuestionFromClass = async (classId, questionId) => {
  try {
    return await api.delete(`/admin/classes/${classId}/questions/${questionId}`);
  } catch (err) {
    throw err.response?.data?.error || 'Failed to remove question from class';
  }
};

export const getAdminDashboard = async () => {
  try {
    const tz = Intl.DateTimeFormat().resolvedOptions().timeZone;
    return await api.get('/admin/dashboard', { params: { tz } });
  } catch (err) {
    throw err.response?.data?.error || 'Failed to load dashboard';
  }
};

export const getStudentDashboard = async () => {
  try {
    return await api.get('/admin/student-dashboard');
  } catch (err) {
    throw err.response?.data?.error || 'Failed to load dashboard';
  }
};

/**
 * Fetches all questions with pagination
 * @param {Object} params - Pagination parameters (page, limit)
 * @returns {Promise} Axios response
 */
export const getAllQuestionsPaginated = async (params = {}) => {
  try {
    const response = await api.get('/admin/questions/paginated', { params });
    return response;
  } catch (err) {
    throw err.response?.data?.error || 'Failed to fetch questions';
  }
};

/**
 * Creates a new question (admin-only)
 * @param {Object} questionData - Question data to create (supports new types: singleCorrectMcq, multipleCorrectMcq, fillInTheBlanks, fillInTheBlanksCoding, coding)
 * @returns {Promise} Axios response
 */
export const adminCreateQuestion = async (questionData) => {
  try {
    // Ensure questionData includes new fields where applicable (e.g., correctOptions, starterCode, maxAttempts, explanation)
    const response = await api.post('/admin/questions', questionData);
    return response;
  } catch (err) {
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
  try {
    // Ensure questionData supports new fields (correctOptions, starterCode, maxAttempts, explanation)
    const response = await api.put(`/admin/questions/${questionId}`, questionData);
    return response;
  } catch (err) {
    throw err.response?.data?.error || 'Failed to edit question';
  }
};

/**
 * Deletes a question
 * @param {string} questionId - Question ID
 * @returns {Promise} Axios response
 */
export const adminDeleteQuestion = async (questionId) => {
  try {
    const response = await api.delete(`/admin/questions/${questionId}`);
    return response;
  } catch (err) {
    throw err.response?.data?.error || 'Failed to delete question';
  }
};

/**
 * Searches questions by ID
 * @param {string} questionId - Question ID
 * @returns {Promise} Axios response
 */
export const adminSearchQuestionsById = async (questionId) => {
  // Validate questionId
  if (!questionId || questionId === 'undefined' || questionId === 'null' || (typeof questionId === 'string' && questionId.trim() === '')) {
    const errorMsg = 'Question ID is required';
    throw new Error(errorMsg);
  }
  
  // Basic MongoDB ObjectId format validation (24 hex characters)
  const objectIdPattern = /^[0-9a-fA-F]{24}$/;
  if (typeof questionId === 'string' && !objectIdPattern.test(questionId)) {
    const errorMsg = `Invalid question ID format: ${questionId}`;
    throw new Error(errorMsg);
  }
  
  try {
    const response = await api.get('/admin/questions/search-by-id', { params: { questionId } });
    if (!response.data?.question) {
      throw new Error('Question not found');
    }
    return response;
  } catch (err) {
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
  try {
    const response = await api.post('/admin/questions/draft', {
      ...questionData,
      status: 'draft',
      isDraft: true
    });
    return response;
  } catch (err) {
    throw err.response?.data?.error || 'Failed to create draft';
  }
};

/**
 * Gets all draft questions
 * @param {Object} params - Query parameters (page, limit, search)
 * @returns {Promise} Axios response
 */
export const getDrafts = async (params = {}) => {
  try {
    const response = await api.get('/admin/questions/drafts', { params });
    return response;
  } catch (err) {
    throw err.response?.data?.error || 'Failed to fetch drafts';
  }
};

/**
 * Gets draft count
 * @returns {Promise} Axios response
 */
export const getDraftCount = async () => {
  try {
    const response = await api.get('/admin/questions/drafts/count');
    return response;
  } catch (err) {
    throw err.response?.data?.error || 'Failed to fetch draft count';
  }
};

/**
 * Gets a single draft question
 * @param {string} questionId - Draft question ID
 * @returns {Promise} Axios response
 */
export const getDraftQuestion = async (questionId) => {
  try {
    const response = await api.get(`/admin/questions/drafts/${questionId}`);
    return response;
  } catch (err) {
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
  try {
    const response = await api.put(`/admin/questions/drafts/${questionId}`, questionData);
    return response;
  } catch (err) {
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
  try {
    const response = await api.put(`/admin/questions/drafts/${questionId}/publish`, questionData);
    return response;
  } catch (err) {
    throw err.response?.data?.error || 'Failed to publish draft';
  }
};

/**
 * Deletes a draft question
 * @param {string} questionId - Draft question ID
 * @returns {Promise} Axios response
 */
export const deleteDraftQuestion = async (questionId) => {
  try {
    const response = await api.delete(`/admin/questions/drafts/${questionId}`);
    return response;
  } catch (err) {
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
  try {
    // Ensure questionData includes new fields where applicable (e.g., correctOptions for multipleCorrectMcq, starterCode for fillInTheBlanksCoding, maxAttempts, explanation)
    const payload = { ...questionData, classIds };
    const response = await api.post('/questions/assign', payload);
    return response;
  } catch (err) {
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
  try {
    const requestBody = { classId };
    const response = await api.post(`/questions/${questionId}/assign`, requestBody);
    return response;
  } catch (err) {
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
  try {
    // Ensure questionData supports new fields (correctOptions, starterCode, maxAttempts, explanation)
    const response = await api.put(`/questions/${questionId}`, questionData);
    return response;
  } catch (err) {
    throw err.response?.data?.error || 'Failed to edit question';
  }
};

export const updateQuestionLimits = async (questionId, timeLimit, memoryLimit) => {
  const response = await api.put(`/questions/${questionId}/limits`, { timeLimit, memoryLimit });
  return response;
};

/**
 * Deletes a question
 * @param {string} questionId - Question ID
 * @returns {Promise} Axios response
 */
export const deleteQuestion = async (questionId) => {
  try {
    const response = await api.delete(`/questions/${questionId}`);
    return response;
  } catch (err) {
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
  try {
    const response = await api.put(`/questions/${questionId}/publish`, { classId });
    return response;
  } catch (err) {
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
  try {
    const response = await api.put(`/questions/${questionId}/unpublish`, { classId });
    return response;
  } catch (err) {
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
  try {
    const response = await api.put(`/questions/${questionId}/disable`, { classId });
    return response;
  } catch (err) {
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
  try {
    const response = await api.put(`/questions/${questionId}/enable`, { classId });
    return response;
  } catch (err) {
    throw err.response?.data?.error || 'Failed to enable question';
  }
};

/**
 * Fetches the solution for a question
 * @param {string} questionId - Question ID
 * @returns {Promise} Axios response (includes correctOptions, codeSnippet, starterCode)
 */
export const viewSolution = async (questionId) => {
  try {
    const response = await api.get(`/questions/${questionId}/solution`);
    return response;
  } catch (err) {
    throw err.response?.data?.error || 'Failed to fetch solution';
  }
};

/**
 * Fetches test cases for a question
 * @param {string} questionId - Question ID
 * @returns {Promise} Axios response
 */
export const viewTestCases = async (questionId) => {
  try {
    const response = await api.get(`/questions/${questionId}/test-cases`);
    return response;
  } catch (err) {
    throw err.response?.data?.error || 'Failed to fetch test cases';
  }
};

/**
 * Fetches the statement for a question
 * @param {string} questionId - Question ID
 * @returns {Promise} Axios response (includes codeSnippet, starterCode, excludes functionSignature)
 */
export const viewStatement = async (questionId) => {
  try {
    const response = await api.get(`/questions/${questionId}/statement`);
    return response;
  } catch (err) {
    throw err.response?.data?.error || 'Failed to fetch question statement';
  }
};

/**
 * Fetches questions for a specific class
 * @param {string} classId - Class ID
 * @returns {Promise} Axios response
 */
export const getQuestionsByClass = async (classId) => {
  try {
    const response = await api.get(`/questions/classes/${classId}/questions`);
    return response;
  } catch (err) {
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
  try {
    const params = classId ? { classId } : {};
    const response = await api.get(`/questions/${questionId}`, { params });
    return response;
  } catch (err) {
    throw err.response?.data?.error || 'Failed to fetch question';
  }
};

/**
 * Fetches all questions
 * @param {Object} [params={}] - Query parameters
 * @returns {Promise} Axios response
 */
export const getAllQuestions = async (params = {}) => {
  try {
    const response = await api.get('/questions', { params });
    return response;
  } catch (err) {
    throw err.response?.data?.error || 'Failed to fetch all questions';
  }
};

/**
 * Searches questions with filters
 * @param {Object} [filters={}] - Search filters (supports new types: singleCorrectMcq, multipleCorrectMcq, fillInTheBlanks, fillInTheBlanksCoding, coding)
 * @returns {Promise} Axios response
 */
export const searchQuestions = async (filters = {}) => {
  try {
    const response = await api.get('/questions/search', { params: filters });
    return response;
  } catch (err) {
    throw err.response?.data?.error || 'Failed to search questions';
  }
};

/**
 * Fetches submission code
 * @param {string} submissionId - Submission ID
 * @returns {Promise} Axios response
 */
export const viewSubmissionCode = async (submissionId) => {
  try {
    const response = await api.get(`/questions/submissions/${submissionId}/code`);
    return response;
  } catch (err) {
    throw err.response?.data?.error || 'Failed to fetch submission code';
  }
};

/**
 * Teacher marks a student submission as correct (updates leaderboard).
 * @param {string} submissionId - Submission ID
 */
export const markSubmissionCorrect = async (submissionId) => {
  try {
    const response = await api.post(`/questions/submissions/${submissionId}/mark-correct`);
    return response;
  } catch (err) {
    throw err.response?.data?.error || err.response?.data || 'Failed to mark submission correct';
  }
};

/**
 * Fetches question perspective report
 * @param {string} classId - Class ID
 * @param {string} questionId - Question ID
 * @returns {Promise} Axios response
 */
export const getClassSheetReport = async (classId, { scope = 'class', questionId } = {}) => {
  const params = { scope };
  if (questionId) params.questionId = questionId;
  try {
    const response = await api.get(`/questions/classes/${classId}/sheet-report`, { params });
    return response;
  } catch (err) {
    throw err.response?.data?.error || 'Failed to download report';
  }
};

export const getQuestionPerspectiveReport = async (classId, questionId) => {
  try {
    const response = await api.get(`/questions/classes/${classId}/questions/${questionId}/report`);
    return response;
  } catch (err) {
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
export const submitAnswer = async (questionId, answer, classId, language, isRun = false, examContext = null) => {
  try {
    const payload = { answer, classId, language, isRun };
    if (examContext) {
      payload.examAttemptId = examContext.examAttemptId;
      payload.examId = examContext.examId;
    }
    const response = await api.post(`/questions/${questionId}/submit`, payload, JUDGE_OPTS);
    return response;
  } catch (err) {
    if (typeof err === 'string') throw err;
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
export const runCode = async (questionId, answer, classId, language, examContext = null) => {
  try {
    const payload = { answer, classId, language };
    if (examContext) {
      payload.examAttemptId = examContext.examAttemptId;
      payload.examId = examContext.examId;
    }
    const response = await api.post(`/questions/${questionId}/run`, payload, JUDGE_OPTS);
    return response;
  } catch (err) {
    if (typeof err === 'string') throw err;
    throw err.response?.data?.error || 'Failed to run code';
  }
};

/**
 * Fetches the leaderboard for a class
 * @param {string} classId - Class ID
 * @returns {Promise} Axios response
 */
export const getLeaderboard = async (classId) => {
  try {
    // Updated endpoint to match questionController.js
    const response = await api.get(`/questions/classes/${classId}/leaderboard`);
    return response;
  } catch (err) {
    throw err.response?.data?.error || 'Failed to fetch leaderboard';
  }
};
export const runCodeWithCustomInput = async (questionId, answer, classId, language, customInput, expectedOutput, examContext = null) => {
  try {
    const payload = {
      answer,
      classId,
      language,
      customInput,
      expectedOutput
    };
    if (examContext) {
      payload.examAttemptId = examContext.examAttemptId;
      payload.examId = examContext.examId;
    }
    const response = await api.post(`/questions/${questionId}/run-custom`, payload, JUDGE_OPTS);
    return response;
  } catch (err) {
    if (typeof err === 'string') throw err;
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
export const teacherTestQuestion = async (questionId, answer, classId, language, options = {}) => {
  try {
    const response = await api.post(`/questions/${questionId}/teacher-test`, {
      answer,
      classId,
      language,
      publicOnly: Boolean(options.publicOnly),
      ...(options.runs != null ? { runs: Number(options.runs) } : {}),
      ...(options.timeLimit != null ? { timeLimit: Number(options.timeLimit) } : {}),
      ...(options.memoryLimit != null ? { memoryLimit: Number(options.memoryLimit) } : {}),
    }, {
      // Benchmark mode (runs > 1) executes the solution many times; give it longer.
      timeout: Number(options.runs) > 1 ? 300000 : JUDGE_TIMEOUT,
    });
    return response;
  } catch (err) {
    if (typeof err === 'string') throw new Error(err);
    const errorMessage = err.response?.data?.error
      || (err.code === 'ECONNABORTED' ? JUDGE_TIMEOUT_MESSAGE : null)
      || ((err.code === 'ERR_NETWORK' || err.message === 'Network Error')
        ? 'Could not reach the server. Check your connection and try again.'
        : (err.message || 'Failed to test question'));
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
  try {
    const response = await api.post(`/questions/${questionId}/teacher-test-custom`, {
      answer,
      classId,
      language,
      customInput,
      expectedOutput
    }, JUDGE_OPTS);
    return response;
  } catch (err) {
    if (typeof err === 'string') throw err;
    throw err.response?.data?.error || 'Failed to test with custom input';
  }
};

// ==================== EXAMS ====================

/**
 * Runs an exam request and rethrows the server's error message as a string.
 * A 403 with code SEB_REQUIRED (exam must run in Safe Exam Browser) is also announced as a window event
 * so the exam screen can show a blocking message instead of a generic error.
 */
const examCall = async (request, fallback) => {
  try {
    return await request();
  } catch (err) {
    const data = err.response?.data;
    if (data?.code === 'SEB_REQUIRED' && typeof window !== 'undefined') {
      window.dispatchEvent(new CustomEvent(SEB_REQUIRED_EVENT, { detail: { message: data.error } }));
    }
    throw data?.error || fallback;
  }
};

/** Request options for student exam calls: forwards SEB's Config Key proof when running inside SEB. */
const sebOpts = (extra = {}) => ({ ...extra, headers: { ...(extra.headers || {}), ...sebRequestHeaders() } });

// Staff
export const createExamTemplate = (data) => examCall(() => api.post('/exams/templates', data), 'Failed to create template');
export const listExamTemplates = () => examCall(() => api.get('/exams/templates'), 'Failed to fetch templates');
export const listExamQuestionBank = (classId) =>
  examCall(() => api.get('/exams/question-bank', { params: classId ? { classId } : {} }), 'Failed to load questions');
export const createExam = (data) => examCall(() => api.post('/exams', data), 'Failed to create exam');
export const listStaffExams = () => examCall(() => api.get('/exams'), 'Failed to fetch exams');
export const listClassExams = (classId) => examCall(() => api.get(`/exams/class/${classId}`), 'Failed to fetch exams');
export const getClassExams = listClassExams;
export const getExamDetails = (examId) => examCall(() => api.get(`/exams/${examId}`), 'Failed to fetch exam details');
export const editExam = (examId, data) => examCall(() => api.put(`/exams/${examId}`, data), 'Failed to save exam');
export const setExamStatus = (examId, status) =>
  examCall(() => api.patch(`/exams/${examId}/status`, { status }), 'Failed to update exam status');
export const duplicateExam = (examId, data = {}) =>
  examCall(() => api.post(`/exams/${examId}/duplicate`, data), 'Failed to duplicate exam');
export const deleteExam = (examId) => examCall(() => api.delete(`/exams/${examId}`), 'Failed to delete exam');
export const getExamReport = (examId) => examCall(() => api.get(`/exams/${examId}/report`), 'Failed to fetch report');
export const releaseExamScores = (examId, release = true) =>
  examCall(() => api.post(`/exams/${examId}/release`, { release }), 'Failed to update score release');
export const forceSubmitExamAttempt = (examId, attemptId) =>
  examCall(() => api.post(`/exams/${examId}/attempts/${attemptId}/submit`), 'Failed to submit attempt');
export const extendExamAttempt = (examId, attemptId, minutes) =>
  examCall(() => api.post(`/exams/${examId}/attempts/${attemptId}/extend`, { minutes }), 'Failed to add time');
export const resetExamAttempt = (examId, attemptId) =>
  examCall(() => api.delete(`/exams/${examId}/attempts/${attemptId}`), 'Failed to reset attempt');

// Safe Exam Browser (staff)
/** New entry + exit passwords for an exam that requires SEB. Returns { seb } (staff view). */
export const regenerateSebPasswords = (examId) =>
  examCall(() => api.post(`/exams/${examId}/seb/regenerate`), 'Failed to generate new passwords');
/** The exam's .seb file as a Blob (same file SEB downloads through the launch link). */
export const downloadSebConfig = (examId) =>
  examCall(() => api.get(`/exams/${examId}/seb-config`, { responseType: 'blob' }), 'Failed to download the .seb file');
/** How this browser looks to the server's SEB check: { inSeb, uaMatched, configKeyHashPresent, configKeyHashValid, expectedMode, ... }. */
export const getSebCheck = (examId) => examCall(() => api.get(`/exams/${examId}/seb-check`, sebOpts()), 'Failed to check Safe Exam Browser');

// Student
export const getStudentExamSummary = (examId) => examCall(() => api.get(`/exams/${examId}/summary`, sebOpts()), 'Failed to load exam');
/** `entryPassword` is required when the exam runs in Safe Exam Browser and the attempt has not started yet. */
export const startExam = (examId, entryPassword) =>
  examCall(() => api.post(`/exams/${examId}/start`, entryPassword ? { entryPassword } : {}, sebOpts()), 'Failed to start exam');
export const getExamAttempt = (examId) => examCall(() => api.get(`/exams/${examId}/attempt`, sebOpts()), 'Failed to fetch attempt');
export const submitExamAnswer = (examId, data) =>
  examCall(() => api.post(`/exams/${examId}/submit-answer`, data, sebOpts()), 'Failed to save answer');
export const runExamCode = (examId, data) => examCall(() => api.post(`/exams/${examId}/run`, data, sebOpts()), 'Failed to run code');
export const logProctoringEvent = (examId, attemptId, type, details = {}) =>
  examCall(() => api.post(`/exams/${examId}/events`, { attemptId, type, details }, sebOpts()), 'Failed to log event');
/** Tell the server which question is open; it pauses/starts the section and question timers and returns their state. */
export const navigateExam = (examId, data) =>
  examCall(() => api.post(`/exams/${examId}/navigate`, data, sebOpts()), 'Failed to change question');
/** Legacy timer routes: the server ignores remainingSeconds; use navigateExam instead. */
export const updateSectionTimer = (examId, data) =>
  examCall(() => api.patch(`/exams/${examId}/section-timer`, data, sebOpts()), 'Failed to update section timer');
export const updateQuestionTimer = (examId, data) =>
  examCall(() => api.patch(`/exams/${examId}/question-timer`, data, sebOpts()), 'Failed to update question timer');
export const submitExam = (examId, attemptId) =>
  examCall(() => api.post(`/exams/${examId}/submit`, { attemptId }, sebOpts()), 'Failed to submit exam');
export const autoSubmitExam = (examId, attemptId) =>
  examCall(() => api.post(`/exams/${examId}/auto-submit`, { attemptId }, sebOpts()), 'Failed to submit exam');
export const getStudentExamResults = (examId) =>
  examCall(() => api.get(`/exams/${examId}/results`), 'Failed to fetch exam results');

export default api;

