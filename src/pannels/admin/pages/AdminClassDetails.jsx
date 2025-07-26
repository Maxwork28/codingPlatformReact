import React, { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
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

  console.log('AdminClassDetails rendered', { classId });

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

  const fetchAllUsers = async () => {
    console.log('fetchAllUsers called');
    try {
      const [studentsRes, teachersRes] = await Promise.all([getStudents(), getTeachers()]);
      console.log('fetchAllUsers success', {
        students: studentsRes.data.students,
        teachers: teachersRes.data.teachers,
      });
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
      const [classRes, studentsRes, teachersRes] = await Promise.all([
        getClassDetails(id),
        getClassStudents(id),
        getClassTeachers(id),
      ]);
      console.log('fetchClassDetails success', {
        classData: classRes.data.class,
        students: studentsRes.data.students,
        teachers: teachersRes.data.teachers,
      });
      setClassData(classRes.data.class);
      setClassStudents(studentsRes.data.students);
      setClassTeachers(teachersRes.data.teachers);
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
      setMessage('Assignment created successfully');
      setError('');
      console.log('handleCreateAssignment success');
    } catch (err) {
      console.error('handleCreateAssignment error', err);
      setError(err.message || 'Failed to create assignment');
      setMessage('');
    }
  };

  const handleDeleteAssignment = async (assignmentId) => {
    console.log('handleDeleteAssignment called', { classId, assignmentId });
    try {
      await deleteAssignment(classId, assignmentId);
      await fetchAssignments(classId);
      setMessage('Assignment deleted successfully');
      setError('');
      console.log('handleDeleteAssignment success');
    } catch (err) {
      console.error('handleDeleteAssignment error', err);
      setError(err.message || 'Failed to delete assignment');
      setMessage('');
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

  const handleManageTeacherPermission = async (teacherId, canCreateClass) => {
    console.log('handleManageTeacherPermission called', { teacherId, canCreateClass });
    try {
      await manageTeacherPermission(teacherId, canCreateClass);
      await fetchClassDetails(classId);
      setMessage(`Teacher permission ${canCreateClass ? 'granted' : 'revoked'} successfully`);
      setError('');
      console.log('handleManageTeacherPermission success');
    } catch (err) {
      console.error('handleManageTeacherPermission error', err);
      setError(err.message || 'Failed to manage teacher permission');
      setMessage('');
    }
  };

  const [assignmentForm, setAssignmentForm] = useState({
    questionId: '',
    maxPoints: '',
    dueDate: '',
  });

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
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
        <div className="bg-white/90 backdrop-blur-sm rounded-2xl shadow-lg border border-gray-100 p-6">
          <div className="flex justify-between items-center mb-6">
            <h3 className="text-lg font-semibold text-gray-800">{editName}</h3>
            <div className="flex gap-3">
              <button
                onClick={() => {
                  console.log('Edit Class toggled', { editMode: !editMode });
                  setEditMode(!editMode);
                }}
                className="inline-flex items-center px-4 py-2 rounded-lg text-sm font-semibold text-gray-700 bg-gray-100 hover:bg-gray-200 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2 transition-all duration-300"
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
                <p className="text-sm font-medium text-gray-700">Status</p>
                <div className="flex items-center gap-3">
                  <span
                    className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold ${
                      classStatus === 'active'
                        ? 'bg-green-100 text-green'
                        : 'bg-red-100 text-red-800'
                    }`}
                  >
                    {classStatus}
                  </span>
                  <button
                    onClick={handleChangeStatus}
                    className="inline-flex items-center px-4 py-2 rounded-lg text-sm font-semibold text-white bg-indigo-600 hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2 transition-all duration-300"
                  >
                    Toggle Status
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
                    <select
                      value={studentId}
                      onChange={(e) => {
                        console.log('studentId updated', { newValue: e.target.value });
                        setStudentId(e.target.value);
                      }}
                      className="w-full rounded-lg border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm"
                    >
                      <option value="">Select Student</option>
                      {allStudents.map((student) => (
                        <option key={student._id} value={student._id}>
                          {student.name} ({student.email})
                        </option>
                      ))}
                    </select>
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
                    <select
                      value={teacherId}
                      onChange={(e) => {
                        console.log('teacherId updated', { newValue: e.target.value });
                        setTeacherId(e.target.value);
                      }}
                      className="w-full rounded-lg border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm"
                    >
                      <option value="">Select Teacher</option>
                      {allTeachers.map((teacher) => (
                        <option key={teacher._id} value={teacher._id}>
                          {teacher.name} ({teacher.email})
                        </option>
                      ))}
                    </select>
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

          {/* Create Assignment Form */}
          <div className="mb-8 border-t border-gray-200 pt-6">
            <h4 className="text-md font-semibold text-gray-800 mb-4">Create Assignment</h4>
            <form onSubmit={handleCreateAssignment} className="space-y-6">
              <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Question ID</label>
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
            <h4 className="text-md font-semibold text-gray-800 mb-3">Assignments ({assignments.length})</h4>
            {assignments.length === 0 ? (
              <p className="text-sm text-gray-500">No assignments available</p>
            ) : (
              <div className="bg-white/90 backdrop-blur-sm rounded-2xl shadow-lg border border-gray-100 overflow-x-auto">
                <table className="min-w-full divide-y divide-gray-200">
                  <thead className="bg-gray-50">
                    <tr>
                      <th
                        scope="col"
                        className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider"
                      >
                        Question Title
                      </th>
                      <th
                        scope="col"
                        className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider"
                      >
                        Max Points
                      </th>
                      <th
                        scope="col"
                        className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider"
                      >
                        Assigned At
                      </th>
                      <th
                        scope="col"
                        className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider"
                      >
                        Due Date
                      </th>
                      <th
                        scope="col"
                        className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider"
                      >
                        Actions
                      </th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-200">
                    {assignments.map((assignment) => (
                      <tr key={assignment._id}>
                        <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                          {assignment.questionId?.title || 'N/A'}
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
            )}
          </div>

          {/* Questions List */}
          <div className="mb-8">
            <h4 className="text-md font-semibold text-gray-800 mb-3">Questions ({classData.questions?.length || 0})</h4>
            {classData.questions?.length === 0 ? (
              <p className="text-sm text-gray-500">No questions available</p>
            ) : (
              <div className="bg-white/90 backdrop-blur-sm rounded-2xl shadow-lg border border-gray-100 overflow-x-auto">
                <table className="min-w-full divide-y divide-gray-200">
                  <thead className="bg-gray-50">
                    <tr>
                      <th
                        scope="col"
                        className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider"
                      >
                        Title
                      </th>
                      <th
                        scope="col"
                        className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider"
                      >
                        Description
                      </th>
                      <th
                        scope="col"
                        className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider"
                      >
                        Type
                      </th>
                      <th
                        scope="col"
                        className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider"
                      >
                        Points
                      </th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-200">
                    {classData.questions.map((question) => (
                      <tr key={question._id}>
                        <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                          {question.title}
                        </td>
                        <td className="px-6 py-4 text-sm text-gray-500">{question.description}</td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">{question.type}</td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">{question.points}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>

          {/* Participant Statistics */}
          <div className="mb-8">
            <h4 className="text-md font-semibold text-gray-800 mb-3">Participant Statistics</h4>
            {participantStats ? (
              <div className="bg-white/90 backdrop-blur-sm rounded-2xl shadow-lg border border-gray-100 p-4">
                <p className="text-sm text-gray-500">
                  Total Participants: {participantStats.stats?.totalParticipants || 'N/A'}
                </p>
                <p className="text-sm text-gray-500">
                  Correct Percentage: {participantStats.stats?.correctPercentage || 'N/A'}%
                </p>
                <p className="text-sm text-gray-500">
                  Total Correct Attempts: {participantStats.stats?.totalCorrectAttempts || 'N/A'}
                </p>
                <p className="text-sm text-gray-500">
                  Total Wrong Attempts: {participantStats.stats?.totalWrongAttempts || 'N/A'}
                </p>
                <p className="text-sm text-gray-500">
                  Active Percentage: {participantStats.stats?.activityPercentage?.active || 'N/A'}%
                </p>
                <p className="text-sm text-gray-500">
                  Focused Percentage: {participantStats.stats?.activityPercentage?.focused || 'N/A'}%
                </p>
                <p className="text-sm text-gray-500">
                  Inactive Percentage: {participantStats.stats?.activityPercentage?.inactive || 'N/A'}%
                </p>
              </div>
            ) : (
              <p className="text-sm text-gray-500">No participant stats available</p>
            )}
          </div>

          {/* Run/Submit Statistics */}
      {/* Run/Submit Statistics */}
<div className="mb-8">
  <h4 className="text-md font-semibold text-gray-800 mb-3">Run/Submit Statistics</h4>
  {runSubmitStats ? (
    <div className="bg-white/90 backdrop-blur-sm rounded-2xl shadow-lg border border-gray-100 p-4">
      <p className="text-sm text-gray-500">
        Total Runs: {runSubmitStats.stats?.classTotalRuns || 'N/A'}
      </p>
      <p className="text-sm text-gray-500">
        Total Submits: {runSubmitStats.stats?.classTotalSubmits || 'N/A'}
      </p>
      {runSubmitStats.stats?.studentStats?.length > 0 ? (
        <div className="mt-4">
          <h5 className="text-sm font-semibold text-gray-700 mb-2">Student Statistics</h5>
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
                  Submits
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200">
              {runSubmitStats.stats.studentStats.map((stat, index) => (
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
      ) : (
        <p className="text-sm text-gray-500 mt-2">No individual student statistics available</p>
      )}
    </div>
  ) : (
    <p className="text-sm text-gray-500">No run/submit stats available</p>
  )}
</div>

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

          {/* Teachers List */}
          <div className="mb-8">
            <h4 className="text-md font-semibold text-gray-800 mb-3">Teachers ({classTeachers.length})</h4>
            {classTeachers.length === 0 ? (
              <p className="text-sm text-gray-500">No teachers assigned yet</p>
            ) : (
              <div className="bg-white/90 backdrop-blur-sm rounded-2xl shadow-lg border border-gray-100 overflow-x-auto">
                <table className="min-w-full divide-y divide-gray-200">
                  <thead className="bg-gray-50">
                    <tr>
                      <th
                        scope="col"
                        className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider"
                      >
                        Name
                      </th>
                      <th
                        scope="col"
                        className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider"
                      >
                        Email
                      </th>
                      <th
                        scope="col"
                        className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider"
                      >
                        Can Create Class
                      </th>
                      <th
                        scope="col"
                        className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider"
                      >
                        Actions
                      </th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-200">
                    {classTeachers.map((teacher) => (
                      <tr key={teacher._id}>
                        <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                          {teacher.name}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                          {teacher.email}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                          <button
                            onClick={() => handleManageTeacherPermission(teacher._id, !teacher.canCreateClass)}
                            className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold ${
                              teacher.canCreateClass
                                ? 'bg-green-100 text-green-800'
                                : 'bg-red-100 text-red-800'
                            }`}
                          >
                            {teacher.canCreateClass ? 'Yes' : 'No'}
                          </button>
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
            )}
          </div>

          {/* Students List */}
          <div>
            <h4 className="text-md font-semibold text-gray-800 mb-3">Students ({classStudents.length})</h4>
            <div className="flex justify-end mb-3">
              <button
                onClick={() => handleBlockAllUsers(true)}
                className="inline-flex items-center px-4 py-2 rounded-lg text-sm font-semibold text-white bg-red-600 hover:bg-red-700 focus:outline-none focus:ring-2 focus:ring-red-500 focus:ring-offset-2 transition-all duration-300 mr-2"
              >
                Block All
              </button>
              <button
                onClick={() => handleBlockAllUsers(false)}
                className="inline-flex items-center px-4 py-2 rounded-lg text-sm font-semibold text-white bg-green-600 hover:bg-green-700 focus:outline-none focus:ring-2 focus:ring-green-500 focus:ring-offset-2 transition-all duration-300"
              >
                Unblock All
              </button>
            </div>
            {classStudents.length === 0 ? (
              <p className="text-sm text-gray-500">No students enrolled yet</p>
            ) : (
              <div className="bg-white/90 backdrop-blur-sm rounded-2xl shadow-lg border border-gray-100 overflow-x-auto">
                <table className="min-w-full divide-y divide-gray-200">
                  <thead className="bg-gray-50">
                    <tr>
                      <th
                        scope="col"
                        className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider"
                      >
                        Name
                      </th>
                      <th
                        scope="col"
                        className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider"
                      >
                        Email
                      </th>
                      <th
                        scope="col"
                        className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider"
                      >
                        Phone Number
                      </th>
                      <th
                        scope="col"
                        className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider"
                      >
                        Status
                      </th>
                      <th
                        scope="col"
                        className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider"
                      >
                        Actions
                      </th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-200">
                    {classStudents.map((student) => (
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
            )}
          </div>
        </div>
      )}
    </div>
  );
};

export default AdminClassDetails;