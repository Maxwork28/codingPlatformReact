import React, { useState, useEffect } from 'react';
import { useSelector, useDispatch } from 'react-redux';
import { Menu, Transition, Dialog } from '@headlessui/react';
import { format } from 'date-fns';
import { fetchClasses } from '../../../../common/components/redux/classSlice';
import { 
  getParticipantStats, 
  getRunSubmitStats, 
  blockUser, 
  blockAllUsers, 
  searchLeaderboard 
} from '../../../../common/services/api';

const Students = () => {
  const { user } = useSelector((state) => state.auth);
  const { classes } = useSelector((state) => state.classes);
  const dispatch = useDispatch();
  
  const [selectedClassId, setSelectedClassId] = useState('');
  const [participantStats, setParticipantStats] = useState(null);
  const [runSubmitStats, setRunSubmitStats] = useState(null);
  const [leaderboard, setLeaderboard] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [blockStudentId, setBlockStudentId] = useState('');
  const [blockAll, setBlockAll] = useState(false);
  const [selectedStudent, setSelectedStudent] = useState(null);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [leaderboardFilters, setLeaderboardFilters] = useState({
    studentName: '',
    activityStatus: '',
    minCorrectAttempts: '',
    maxAttempts: '',
  });

  // Fetch classes on mount
  useEffect(() => {
    dispatch(fetchClasses(''));
  }, [dispatch]);

  // Fetch student data when class is selected
  useEffect(() => {
    const fetchStudentData = async () => {
      if (!selectedClassId) {
        setParticipantStats(null);
        setRunSubmitStats(null);
        setLeaderboard([]);
        return;
      }

      try {
        setLoading(true);
        
        const participantResponse = await getParticipantStats(selectedClassId);
        setParticipantStats(participantResponse.data.stats);

        const runSubmitResponse = await getRunSubmitStats(selectedClassId);
        setRunSubmitStats(runSubmitResponse.data.stats);

        const leaderboardResponse = await searchLeaderboard(selectedClassId, {});
        setLeaderboard(Array.isArray(leaderboardResponse.data.leaderboard) ? leaderboardResponse.data.leaderboard : []);
      } catch (err) {
        console.error('[Students] Fetch error:', err);
        setError(err.error || 'Failed to fetch student data');
      } finally {
        setLoading(false);
      }
    };

    fetchStudentData();
  }, [selectedClassId]);

  const handleBlockUser = async (studentId, block) => {
    console.log('[Students] Blocking/Unblocking user:', studentId, block);
    setError('');
    try {
      await blockUser(selectedClassId, studentId, block);
      alert(`User ${block ? 'blocked' : 'unblocked'} successfully`);
      
      // Refresh data
      const participantResponse = await getParticipantStats(selectedClassId);
      setParticipantStats(participantResponse.data.stats);
      const leaderboardResponse = await searchLeaderboard(selectedClassId, {});
      setLeaderboard(Array.isArray(leaderboardResponse.data.leaderboard) ? leaderboardResponse.data.leaderboard : []);
    } catch (err) {
      console.error('[Students] Error blocking/unblocking user:', err);
      setError(err.error || `Failed to ${block ? 'block' : 'unblock'} user`);
    }
  };

  const handleFocusUser = async (studentId, focus) => {
    console.log(`[Students] ${focus ? 'Focusing' : 'Unfocusing'} user:`, studentId);
    setError('');
    try {
      alert(`User ${focus ? 'focused' : 'unfocused'} successfully`);
      
      // Refresh data
      const participantResponse = await getParticipantStats(selectedClassId);
      setParticipantStats(participantResponse.data.stats);
      const leaderboardResponse = await searchLeaderboard(selectedClassId, {});
      setLeaderboard(Array.isArray(leaderboardResponse.data.leaderboard) ? leaderboardResponse.data.leaderboard : []);
    } catch (err) {
      console.error('[Students] Error focusing/unfocusing user:', err);
      setError(err.error || `Failed to ${focus ? 'focus' : 'unfocus'} user`);
    }
  };

  const handleBlockAllUsers = async () => {
    console.log('[Students] Blocking all users:', blockAll);
    setError('');
    try {
      await blockAllUsers(selectedClassId, blockAll);
      alert(`All users ${blockAll ? 'blocked' : 'unblocked'} successfully`);
      
      // Refresh data
      const participantResponse = await getParticipantStats(selectedClassId);
      setParticipantStats(participantResponse.data.stats);
    } catch (err) {
      console.error('[Students] Error blocking all users:', err);
      setError(err.error || 'Failed to update block status for all users');
    }
  };

  const handleSearchLeaderboard = async (e) => {
    e.preventDefault();
    console.log('[Students] Searching leaderboard with filters:', leaderboardFilters);
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
      
      const response = await searchLeaderboard(selectedClassId, filters);
      setLeaderboard(Array.isArray(response.data.leaderboard) ? response.data.leaderboard : []);
    } catch (err) {
      console.error('[Students] Error searching leaderboard:', err);
      setError(err.error || 'Failed to search leaderboard');
    }
  };

  const openStudentModal = (student) => {
    setSelectedStudent(student);
    setIsModalOpen(true);
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
                <Dialog.Panel className="w-full max-w-2xl transform overflow-hidden rounded-2xl p-6 text-left align-middle shadow-xl transition-all"
                              style={{ backgroundColor: 'var(--background-light)' }}>
                  <Dialog.Title as="h3" className="text-lg font-medium leading-6" style={{ color: 'var(--text-heading)' }}>
                    Student Details: {studentData.studentId.name}
                  </Dialog.Title>
                  <div className="mt-4 space-y-2">
                    <p className="text-sm" style={{ color: 'var(--text-secondary)' }}>Email: {studentData.studentId.email}</p>
                    <p className="text-sm" style={{ color: 'var(--text-secondary)' }}>Activity Status: {studentData.activityStatus}</p>
                    <p className="text-sm" style={{ color: 'var(--text-secondary)' }}>Total Score: {studentData.totalScore}</p>
                    <p className="text-sm" style={{ color: 'var(--text-secondary)' }}>Correct Attempts: {studentData.correctAttempts}</p>
                    <p className="text-sm" style={{ color: 'var(--text-secondary)' }}>Wrong Attempts: {studentData.wrongAttempts}</p>
                    <p className="text-sm" style={{ color: 'var(--text-secondary)' }}>Total Runs: {studentData.totalRuns}</p>
                    <p className="text-sm" style={{ color: 'var(--text-secondary)' }}>Total Submissions: {studentData.totalSubmits}</p>
                    <h4 className="mt-4 text-sm font-medium" style={{ color: 'var(--text-primary)' }}>Attempts:</h4>
                    <ul className="mt-2 space-y-2">
                      {studentData.attempts.map((attempt, index) => (
                        <li key={index} className="text-sm" style={{ color: 'var(--text-secondary)' }}>
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
                      className="inline-flex justify-center rounded-md border border-transparent px-4 py-2 text-sm font-medium text-white focus:outline-none focus:ring-2 focus:ring-offset-2 transition-all duration-300"
                      style={{ backgroundColor: 'var(--primary-navy)' }}
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

  // Filter classes that the teacher owns or is assigned to
  const myClasses = classes.filter(
    (cls) => cls.teachers?.some((t) => t._id === user?.id) || cls.createdBy?._id === user?.id
  );

  if (!user) {
    return (
      <div className="p-6">
        <p className="text-red-700 font-semibold text-center">You must be logged in to view this page.</p>
      </div>
    );
  }

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      <div className="mb-10">
        <h2 className="text-3xl font-bold tracking-tight" style={{ color: 'var(--text-heading)' }}>
          Students Management
        </h2>
        <p className="mt-1 text-sm" style={{ color: 'var(--text-secondary)' }}>
          Monitor and manage students across your classes
        </p>
      </div>

      {/* Class Selection */}
      <div className="backdrop-blur-sm rounded-2xl shadow-lg p-6 border mb-8" style={{ backgroundColor: 'var(--background-light)', borderColor: 'var(--card-border)' }}>
        <h3 className="text-lg font-semibold mb-4" style={{ color: 'var(--text-primary)' }}>Select Class</h3>
        <select
          value={selectedClassId}
          onChange={(e) => {
            setSelectedClassId(e.target.value);
            setError('');
            setLeaderboardFilters({ studentName: '', activityStatus: '', minCorrectAttempts: '', maxAttempts: '' });
          }}
          className="w-full rounded-lg border shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm"
          style={{ 
            borderColor: 'var(--card-border)', 
            backgroundColor: 'var(--background-light)', 
            color: 'var(--text-primary)',
            padding: '12px'
          }}
        >
          <option value="">Select a class</option>
          {myClasses.map((cls) => (
            <option key={cls._id} value={cls._id}>
              {cls.name} ({cls.students?.length || 0} students)
            </option>
          ))}
        </select>
      </div>

      {selectedClassId ? (
        <>
          {/* Error Message */}
          {error && (
            <div className="mb-6 p-4 rounded-xl bg-red-50/80 backdrop-blur-sm border border-red-200 shadow-sm">
              <div className="flex items-center">
                <svg className="h-6 w-6 text-red-500 mr-3" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor">
                  <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l-1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
                </svg>
                <p className="text-sm font-semibold text-red-800">{error}</p>
              </div>
            </div>
          )}

          {loading ? (
            <div className="flex justify-center py-12">
              <div className="w-12 h-12 border-4 border-indigo-500 border-t-transparent rounded-full animate-spin"></div>
            </div>
          ) : (
            <>
              {/* Students Table */}
              <div className="backdrop-blur-sm rounded-2xl shadow-lg p-6 border mb-8" style={{ backgroundColor: 'var(--background-light)', borderColor: 'var(--card-border)' }}>
                <h3 className="text-lg font-semibold mb-4" style={{ color: 'var(--text-primary)' }}>
                  Students ({runSubmitStats?.studentStats?.length ?? 0})
                </h3>
                {runSubmitStats?.studentStats?.length > 0 ? (
                  <div className="overflow-x-auto">
                    <table className="min-w-full divide-y" style={{ borderColor: 'var(--card-border)' }}>
                      <thead style={{ backgroundColor: 'var(--background-content)' }}>
                        <tr>
                          <th scope="col" className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider" style={{ color: 'var(--text-secondary)' }}>
                            Student
                          </th>
                          <th scope="col" className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider" style={{ color: 'var(--text-secondary)' }}>
                            Email
                          </th>
                          <th scope="col" className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider" style={{ color: 'var(--text-secondary)' }}>
                            Status
                          </th>
                          <th scope="col" className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider" style={{ color: 'var(--text-secondary)' }}>
                            Total Runs
                          </th>
                          <th scope="col" className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider" style={{ color: 'var(--text-secondary)' }}>
                            Total Submissions
                          </th>
                          <th scope="col" className="px-6 py-3 text-right text-xs font-medium uppercase tracking-wider" style={{ color: 'var(--text-secondary)' }}>
                            Actions
                          </th>
                        </tr>
                      </thead>
                      <tbody className="divide-y" style={{ borderColor: 'var(--card-border)' }}>
                        {runSubmitStats.studentStats.map((student, index) => {
                          const { name, id, email } = student.student;
                          const { totalRuns, totalSubmissions } = student;
                          const studentData = Array.isArray(leaderboard) ? leaderboard.find(l => l.studentId?._id === id) : null;
                          const isFocused = studentData?.activityStatus === 'focused';
                          const isBlocked = studentData?.isBlocked || false;

                          return (
                            <tr key={student.student.id || index} className={isBlocked ? 'bg-gray-800' : ''}>
                              <td className="px-6 py-4 whitespace-nowrap">
                                <div className="flex items-center">
                                  <div className="text-sm font-medium" style={{ color: isBlocked ? '#ffffff' : 'var(--text-primary)' }}>
                                    {name}
                                  </div>
                                  {isFocused && (
                                    <svg className="h-5 w-5 text-yellow-500 ml-2" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor">
                                      <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
                                    </svg>
                                  )}
                                </div>
                                <div className="text-xs" style={{ color: isBlocked ? '#d1d5db' : 'var(--text-secondary)' }}>
                                  ID: {id}
                                </div>
                              </td>
                              <td className="px-6 py-4 whitespace-nowrap text-sm" style={{ color: isBlocked ? '#d1d5db' : 'var(--text-secondary)' }}>
                                {email}
                              </td>
                              <td className="px-6 py-4 whitespace-nowrap">
                                {isBlocked ? (
                                  <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold bg-red-100 text-red-800">
                                    Blocked
                                  </span>
                                ) : (
                                  <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold ${
                                    studentData?.activityStatus === 'active' ? 'bg-green-100 text-green-800' :
                                    studentData?.activityStatus === 'focused' ? 'bg-yellow-100 text-yellow-800' :
                                    'bg-gray-100 text-gray-800'
                                  }`}>
                                    {studentData?.activityStatus || 'N/A'}
                                  </span>
                                )}
                              </td>
                              <td className="px-6 py-4 whitespace-nowrap text-sm" style={{ color: isBlocked ? '#ffffff' : 'var(--text-primary)' }}>
                                {totalRuns ?? 0}
                              </td>
                              <td className="px-6 py-4 whitespace-nowrap text-sm" style={{ color: isBlocked ? '#ffffff' : 'var(--text-primary)' }}>
                                {totalSubmissions ?? 0}
                              </td>
                              <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                                <div className="flex items-center justify-end space-x-2">
                                  <button
                                    onClick={() => openStudentModal(student)}
                                    className="text-indigo-600 hover:text-indigo-900"
                                  >
                                    View
                                  </button>
                                  <Menu as="div" className="relative inline-block text-left">
                                    <Menu.Button className="inline-flex items-center p-1 rounded-full hover:bg-gray-100 focus:outline-none transition-colors duration-200">
                                      <svg className="h-5 w-5" style={{ color: 'var(--text-secondary)' }} xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor">
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
                                      <Menu.Items className="absolute right-0 mt-2 w-48 origin-top-right rounded-md bg-white shadow-lg ring-1 ring-black ring-opacity-5 focus:outline-none z-10">
                                        <div className="py-1">
                                          <Menu.Item>
                                            {({ active }) => (
                                              <button
                                                onClick={() => handleFocusUser(id, !isFocused)}
                                                className={`${active ? 'bg-gray-100 text-gray-900' : 'text-gray-700'} block w-full px-4 py-2 text-sm text-left`}
                                              >
                                                {isFocused ? 'Unfocus' : 'Focus'}
                                              </button>
                                            )}
                                          </Menu.Item>
                                          <Menu.Item>
                                            {({ active }) => (
                                              <button
                                                onClick={() => handleBlockUser(id, !isBlocked)}
                                                className={`${active ? 'bg-gray-100 text-gray-900' : 'text-gray-700'} block w-full px-4 py-2 text-sm text-left`}
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
                ) : (
                  <p className="text-sm" style={{ color: 'var(--text-secondary)' }}>No student data available</p>
                )}
              </div>

              {/* Search Leaderboard */}
              <div className="backdrop-blur-sm rounded-2xl shadow-lg p-6 border mb-8" style={{ backgroundColor: 'var(--background-light)', borderColor: 'var(--card-border)' }}>
                <h3 className="text-lg font-semibold mb-4" style={{ color: 'var(--text-primary)' }}>Search Leaderboard</h3>
                <form onSubmit={handleSearchLeaderboard} className="space-y-4">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-medium mb-2" style={{ color: 'var(--text-primary)' }}>Student Name</label>
                      <input
                        type="text"
                        value={leaderboardFilters.studentName}
                        onChange={(e) => setLeaderboardFilters({ ...leaderboardFilters, studentName: e.target.value })}
                        placeholder="Enter student name"
                        className="w-full rounded-lg border shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm"
                        style={{ 
                          borderColor: 'var(--card-border)', 
                          backgroundColor: 'var(--background-light)', 
                          color: 'var(--text-primary)',
                          padding: '8px 12px'
                        }}
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium mb-2" style={{ color: 'var(--text-primary)' }}>Activity Status</label>
                      <select
                        value={leaderboardFilters.activityStatus}
                        onChange={(e) => setLeaderboardFilters({ ...leaderboardFilters, activityStatus: e.target.value })}
                        className="w-full rounded-lg border shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm"
                        style={{ 
                          borderColor: 'var(--card-border)', 
                          backgroundColor: 'var(--background-light)', 
                          color: 'var(--text-primary)',
                          padding: '8px 12px'
                        }}
                      >
                        <option value="">All</option>
                        <option value="active">Active</option>
                        <option value="inactive">Inactive</option>
                        <option value="focused">Focused</option>
                      </select>
                    </div>
                    <div>
                      <label className="block text-sm font-medium mb-2" style={{ color: 'var(--text-primary)' }}>Min Correct Attempts</label>
                      <input
                        type="number"
                        value={leaderboardFilters.minCorrectAttempts}
                        onChange={(e) => setLeaderboardFilters({ ...leaderboardFilters, minCorrectAttempts: e.target.value })}
                        placeholder="Enter minimum correct attempts"
                        className="w-full rounded-lg border shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm"
                        style={{ 
                          borderColor: 'var(--card-border)', 
                          backgroundColor: 'var(--background-light)', 
                          color: 'var(--text-primary)',
                          padding: '8px 12px'
                        }}
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium mb-2" style={{ color: 'var(--text-primary)' }}>Max Attempts</label>
                      <input
                        type="number"
                        value={leaderboardFilters.maxAttempts}
                        onChange={(e) => setLeaderboardFilters({ ...leaderboardFilters, maxAttempts: e.target.value })}
                        placeholder="Enter maximum attempts"
                        className="w-full rounded-lg border shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm"
                        style={{ 
                          borderColor: 'var(--card-border)', 
                          backgroundColor: 'var(--background-light)', 
                          color: 'var(--text-primary)',
                          padding: '8px 12px'
                        }}
                      />
                    </div>
                  </div>
                  <div className="flex justify-end">
                    <button
                      type="submit"
                      className="inline-flex items-center px-4 py-2 rounded-lg text-sm font-semibold text-white focus:outline-none focus:ring-2 focus:ring-offset-2 transition-all duration-300"
                      style={{ backgroundColor: 'var(--primary-navy)' }}
                    >
                      Search
                    </button>
                  </div>
                </form>
              </div>

              {/* Block User */}
              <div className="backdrop-blur-sm rounded-2xl shadow-lg p-6 border mb-8" style={{ backgroundColor: 'var(--background-light)', borderColor: 'var(--card-border)' }}>
                <h3 className="text-lg font-semibold mb-4" style={{ color: 'var(--text-primary)' }}>Block Individual Student</h3>
                <form
                  onSubmit={(e) => {
                    e.preventDefault();
                    handleBlockUser(blockStudentId, true);
                  }}
                  className="space-y-4"
                >
                  <div>
                    <label className="block text-sm font-medium mb-2" style={{ color: 'var(--text-primary)' }}>Student ID</label>
                    <input
                      type="text"
                      value={blockStudentId}
                      onChange={(e) => setBlockStudentId(e.target.value)}
                      placeholder="Enter student ID"
                      className="w-full rounded-lg border shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm"
                      style={{ 
                        borderColor: 'var(--card-border)', 
                        backgroundColor: 'var(--background-light)', 
                        color: 'var(--text-primary)',
                        padding: '8px 12px'
                      }}
                      required
                    />
                  </div>
                  <div className="flex justify-end">
                    <button
                      type="submit"
                      className="inline-flex items-center px-4 py-2 rounded-lg text-sm font-semibold text-white bg-red-600 hover:bg-red-700 focus:outline-none focus:ring-2 focus:ring-red-500 focus:ring-offset-2 transition-all duration-300"
                    >
                      Block Student
                    </button>
                  </div>
                </form>
              </div>

              {/* Block All Users */}
              <div className="backdrop-blur-sm rounded-2xl shadow-lg p-6 border mb-8" style={{ backgroundColor: 'var(--background-light)', borderColor: 'var(--card-border)' }}>
                <h3 className="text-lg font-semibold mb-4" style={{ color: 'var(--text-primary)' }}>Block All Students</h3>
                <div className="flex items-center justify-between">
                  <label className="flex items-center text-sm font-medium" style={{ color: 'var(--text-primary)' }}>
                    <input
                      type="checkbox"
                      checked={blockAll}
                      onChange={(e) => setBlockAll(e.target.checked)}
                      className="mr-2 h-4 w-4 text-indigo-600 focus:ring-indigo-500 border-gray-300 rounded"
                    />
                    Block All Students in Class
                  </label>
                  <button
                    onClick={handleBlockAllUsers}
                    className="inline-flex items-center px-4 py-2 rounded-lg text-sm font-semibold text-white bg-red-600 hover:bg-red-700 focus:outline-none focus:ring-2 focus:ring-red-500 focus:ring-offset-2 transition-all duration-300"
                  >
                    Apply
                  </button>
                </div>
              </div>
            </>
          )}

          <StudentDetailsModal />
        </>
      ) : (
        <div className="backdrop-blur-sm rounded-2xl shadow-lg p-8 border" style={{ backgroundColor: 'var(--background-light)', borderColor: 'var(--card-border)' }}>
          <div className="text-center py-12">
            <svg
              className="mx-auto h-14 w-14 mb-4"
              style={{ color: 'var(--text-secondary)' }}
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={1.5}
                d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z"
              />
            </svg>
            <h3 className="text-lg font-semibold" style={{ color: 'var(--text-primary)' }}>
              Select a Class
            </h3>
            <p className="mt-2 text-sm" style={{ color: 'var(--text-secondary)' }}>
              Choose a class from the dropdown above to view and manage students
            </p>
          </div>
        </div>
      )}
    </div>
  );
};

export default Students;

