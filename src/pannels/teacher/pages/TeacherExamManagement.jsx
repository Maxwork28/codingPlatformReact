import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useSelector } from 'react-redux';
import { listClassExams, deleteExam } from '../../../common/services/api';

const TeacherExamManagement = () => {
  const navigate = useNavigate();
  const { classes } = useSelector((state) => state.classes);
  const { user } = useSelector((state) => state.auth);
  
  const [allExams, setAllExams] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [selectedClassId, setSelectedClassId] = useState('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');

  // Get classes where user is a teacher
  const teacherClasses = classes.filter(cls => 
    cls.teachers?.some(t => t._id === user?.id || t === user?.id)
  );

  useEffect(() => {
    const fetchAllExams = async () => {
      try {
        setLoading(true);
        const examsByClass = [];

        // Fetch exams for each class
        for (const cls of teacherClasses) {
          try {
            const response = await listClassExams(cls._id);
            const exams = (response.data.exams || []).map(exam => ({
              ...exam,
              className: cls.name,
              classId: cls._id
            }));
            examsByClass.push(...exams);
          } catch (err) {
            console.error(`Failed to fetch exams for class ${cls._id}:`, err);
          }
        }

        setAllExams(examsByClass);
        setLoading(false);
      } catch (err) {
        console.error('Failed to fetch exams:', err);
        setError(err.response?.data?.error || 'Failed to fetch exams');
        setLoading(false);
      }
    };

    if (teacherClasses.length > 0) {
      fetchAllExams();
    } else {
      setLoading(false);
    }
  }, [teacherClasses.length]);

  const handleDelete = async (examId) => {
    if (!window.confirm('Are you sure you want to delete this exam?')) return;
    
    try {
      await deleteExam(examId);
      setAllExams(allExams.filter(e => e._id !== examId));
    } catch (err) {
      alert(err.response?.data?.error || 'Failed to delete exam');
    }
  };

  /** Draft, scheduled, and active exams can be edited; completed/archived are read-only */
  const canTeacherEditExam = (exam) =>
    exam?.status !== 'completed' && exam?.status !== 'archived';

  const getStatusBadge = (exam) => {
    if (exam.status === 'scheduled') {
      return <span className="px-2 py-1 bg-yellow-500 text-white rounded text-xs">Scheduled</span>;
    } else if (exam.status === 'active') {
      return <span className="px-2 py-1 bg-green-500 text-white rounded text-xs">Active</span>;
    } else if (exam.status === 'completed') {
      return <span className="px-2 py-1 bg-gray-500 text-white rounded text-xs">Completed</span>;
    } else if (exam.status === 'draft') {
      return <span className="px-2 py-1 bg-blue-500 text-white rounded text-xs">Draft</span>;
    }
    return <span className="px-2 py-1 bg-blue-500 text-white rounded text-xs">{exam.status}</span>;
  };

  // Filter exams by selected class, search, and status
  const filteredExams = allExams.filter(exam => {
    const matchesClass = selectedClassId === 'all' || exam.classId === selectedClassId;
    const matchesSearch = searchQuery === '' || 
      exam.title?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      exam.description?.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesStatus = statusFilter === 'all' || exam.status === statusFilter;
    return matchesClass && matchesSearch && matchesStatus;
  });

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-xl">Loading exams...</div>
      </div>
    );
  }

  if (teacherClasses.length === 0) {
    return (
      <div className="min-h-screen bg-gray-50 dark:bg-gray-900 py-8">
        <div className="container mx-auto px-4">
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-8 text-center">
            <p className="text-gray-600 dark:text-gray-400">You are not assigned to any classes yet.</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900 py-8">
      <div className="container mx-auto px-4">
        <div className="mb-6 flex justify-between items-center">
          <h1 className="text-3xl font-bold">Exam Management</h1>
          {teacherClasses.length > 0 && (
            <div className="flex gap-2 items-center">
              <select
                value={selectedClassId}
                onChange={(e) => setSelectedClassId(e.target.value)}
                className="px-4 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 dark:bg-gray-700 dark:border-gray-600"
              >
                {teacherClasses.map(cls => (
                  <option key={cls._id} value={cls._id}>{cls.name}</option>
                ))}
              </select>
              <button
                onClick={() => {
                  const classToUse = selectedClassId === 'all' 
                    ? teacherClasses[0]?._id 
                    : selectedClassId;
                  if (classToUse) {
                    navigate(`/teacher/classes/${classToUse}/exams/create`);
                  }
                }}
                className="px-4 py-2 bg-blue-500 text-white rounded hover:bg-blue-600"
              >
                Create Exam
              </button>
            </div>
          )}
        </div>

        {error && (
          <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded mb-4">
            {error}
          </div>
        )}

        {allExams.length > 0 && (
          <div className="mb-6 grid grid-cols-1 md:grid-cols-3 gap-4">
            {teacherClasses.length > 1 && (
              <div>
                <label className="block text-sm font-medium mb-2">Filter by Class:</label>
                <select
                  value={selectedClassId}
                  onChange={(e) => setSelectedClassId(e.target.value)}
                  className="w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 dark:bg-gray-700 dark:border-gray-600"
                >
                  <option value="all">All Classes</option>
                  {teacherClasses.map(cls => (
                    <option key={cls._id} value={cls._id}>{cls.name}</option>
                  ))}
                </select>
              </div>
            )}
            <div>
              <label className="block text-sm font-medium mb-2">Search Exams</label>
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search by title or description..."
                className="w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 dark:bg-gray-700 dark:border-gray-600 dark:text-white"
              />
            </div>
            <div>
              <label className="block text-sm font-medium mb-2">Filter by Status</label>
              <select
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value)}
                className="w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 dark:bg-gray-700 dark:border-gray-600 dark:text-white"
              >
                <option value="all">All Statuses</option>
                <option value="draft">Draft</option>
                <option value="scheduled">Scheduled</option>
                <option value="active">Active</option>
                <option value="completed">Completed</option>
              </select>
            </div>
          </div>
        )}

        {filteredExams.length === 0 ? (
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-8 text-center">
            <p className="text-gray-600 dark:text-gray-400">
              {allExams.length === 0
                ? (selectedClassId === 'all' 
                    ? 'No exams available in any of your classes' 
                    : 'No exams available for this class')
                : 'No exams found matching your search criteria.'}
            </p>
          </div>
        ) : (
          <div className="grid gap-4">
            {filteredExams.map((exam) => (
              <div
                key={exam._id}
                className="bg-white dark:bg-gray-800 rounded-lg shadow p-6"
              >
                <div className="flex justify-between items-start mb-4">
                  <div className="flex-1">
                    <h2 className="text-2xl font-bold mb-2">{exam.title}</h2>
                    <p className="text-gray-600 dark:text-gray-400 mb-2">{exam.description}</p>
                    <p className="text-sm text-gray-500">
                      Class: <span className="font-semibold">{exam.className}</span>
                    </p>
                  </div>
                  {getStatusBadge(exam)}
                </div>

                <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-4 text-sm">
                  <div>
                    <span className="font-semibold">Duration:</span>{' '}
                    {exam.proctoring?.durationMinutes || 0} minutes
                  </div>
                  <div>
                    <span className="font-semibold">Questions:</span>{' '}
                    {exam.questions?.length || 0}
                  </div>
                  <div>
                    <span className="font-semibold">Start:</span>{' '}
                    {exam.proctoring?.startTime 
                      ? new Date(exam.proctoring.startTime).toLocaleString()
                      : 'Not scheduled'}
                  </div>
                  <div>
                    <span className="font-semibold">End:</span>{' '}
                    {exam.proctoring?.endTime 
                      ? new Date(exam.proctoring.endTime).toLocaleString()
                      : 'Not scheduled'}
                  </div>
                </div>

                <div className="flex gap-2 mt-4">
                  <button
                    onClick={() => navigate(`/teacher/classes/${exam.classId}/exams/${exam._id}/edit`)}
                    disabled={!canTeacherEditExam(exam)}
                    className="px-4 py-2 bg-green-500 text-white rounded hover:bg-green-600 disabled:opacity-50 disabled:cursor-not-allowed"
                    title={
                      canTeacherEditExam(exam)
                        ? 'Edit exam'
                        : 'Completed or archived exams cannot be edited'
                    }
                  >
                    Edit
                  </button>
                  <button
                    onClick={() => navigate(`/teacher/classes/${exam.classId}/exams/${exam._id}/report`)}
                    className="px-4 py-2 bg-purple-500 text-white rounded hover:bg-purple-600"
                  >
                    View Report
                  </button>
                  <button
                    onClick={() => handleDelete(exam._id)}
                    className="px-4 py-2 bg-red-500 text-white rounded hover:bg-red-600"
                  >
                    Delete
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

export default TeacherExamManagement;

