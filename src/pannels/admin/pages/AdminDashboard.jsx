import React, { useEffect, useState } from 'react';
import { useSelector } from 'react-redux';
import { useNavigate } from 'react-router-dom';
import { ChartBarIcon, UsersIcon, AcademicCapIcon, UserGroupIcon, ClipboardDocumentListIcon } from '@heroicons/react/24/outline';
import { getCounts } from '../../../common/services/api';
import { IoBookSharp, IoPerson } from "react-icons/io5";
import { FaRegQuestionCircle, FaClipboardList } from "react-icons/fa";
import { PiStudentFill } from "react-icons/pi";
import { MdOutlineQuiz, MdOutlineAssignment, MdOutlineSchool } from "react-icons/md";

const AdminDashboard = () => {
  const navigate = useNavigate();
  const { classes, status: classesStatus, error: classesError } = useSelector((state) => state.classes);

  const [counts, setCounts] = useState({
    teachers: 0,
    students: 0,
    questions: 0,
    classes: 0,
    activeClasses: 0,
    inactiveClasses: 0,
    exams: 0,
    examDrafts: 0,
    examScheduled: 0,
    examActive: 0,
    examCompleted: 0,
    examTemplates: 0,
    examAttempts: 0,
    totalSubmissions: 0
  });
  const [classAnalytics, setClassAnalytics] = useState([]);
  const [countsStatus, setCountsStatus] = useState('idle');
  const [countsError, setCountsError] = useState(null);

  useEffect(() => {
    const fetchCounts = async () => {
      setCountsStatus('loading');
      try {
        const response = await getCounts();
        setCounts(response.data.counts || {});
        setClassAnalytics(response.data.classAnalytics || []);
        setCountsStatus('succeeded');
      } catch (error) {
        setCountsError(error || 'Failed to fetch counts');
        setCountsStatus('failed');
      }
    };

    fetchCounts();
  }, []);

  if (classesStatus === 'loading' || countsStatus === 'loading') {
    return (
      <div className="flex justify-center items-center min-h-screen">
        <div className="w-12 h-12 border-4 border-t-transparent rounded-full animate-spin" style={{ borderColor: 'var(--text-primary)', borderTopColor: 'transparent' }}></div>
      </div>
    );
  }

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      {/* Header */}
      <div className="mb-8">
        <h2 className="text-3xl font-bold tracking-tight" style={{ color: 'var(--text-primary)' }}>
          Admin Dashboard
        </h2>
        <p className="mt-1 text-sm" style={{ color: 'var(--text-secondary)' }}>
          Comprehensive overview of your platform's statistics and class analytics
        </p>
      </div>

      {/* Error State */}
      {(classesError || countsError) && (
        <div className="mb-6 p-4 bg-red-50 dark:bg-red-900/20 rounded-lg border border-red-200 dark:border-red-800">
          <p className="text-sm text-red-800 dark:text-red-200">{classesError || countsError}</p>
        </div>
      )}

      {/* Main Statistics Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
        {/* Classes Card */}
        <div className="bg-white dark:bg-gray-800 rounded-xl shadow-md border border-gray-200 dark:border-gray-700 p-6 hover:shadow-lg transition-shadow">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-600 dark:text-gray-400">Total Classes</p>
              <p className="text-3xl font-bold text-gray-900 dark:text-white mt-1">{counts.classes || 0}</p>
              <div className="flex items-center gap-3 mt-2">
                <span className="text-xs text-green-600 dark:text-green-400">
                  {counts.activeClasses || 0} active
                </span>
                <span className="text-xs text-gray-500 dark:text-gray-400">
                  {counts.inactiveClasses || 0} inactive
                </span>
              </div>
            </div>
            <div className="p-3 bg-blue-100 dark:bg-blue-900/30 rounded-lg">
              <IoBookSharp className="h-8 w-8 text-blue-600 dark:text-blue-400" />
            </div>
          </div>
        </div>

        {/* Students Card */}
        <div className="bg-white dark:bg-gray-800 rounded-xl shadow-md border border-gray-200 dark:border-gray-700 p-6 hover:shadow-lg transition-shadow">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-600 dark:text-gray-400">Total Students</p>
              <p className="text-3xl font-bold text-gray-900 dark:text-white mt-1">{counts.students || 0}</p>
            </div>
            <div className="p-3 bg-green-100 dark:bg-green-900/30 rounded-lg">
              <IoPerson className="h-8 w-8 text-green-600 dark:text-green-400" />
            </div>
          </div>
        </div>

        {/* Questions Card */}
        <div className="bg-white dark:bg-gray-800 rounded-xl shadow-md border border-gray-200 dark:border-gray-700 p-6 hover:shadow-lg transition-shadow">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-600 dark:text-gray-400">Total Questions</p>
              <p className="text-3xl font-bold text-gray-900 dark:text-white mt-1">{counts.questions || 0}</p>
            </div>
            <div className="p-3 bg-purple-100 dark:bg-purple-900/30 rounded-lg">
              <FaRegQuestionCircle className="h-8 w-8 text-purple-600 dark:text-purple-400" />
            </div>
          </div>
        </div>

        {/* Teachers Card */}
        <div className="bg-white dark:bg-gray-800 rounded-xl shadow-md border border-gray-200 dark:border-gray-700 p-6 hover:shadow-lg transition-shadow">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-600 dark:text-gray-400">Total Teachers</p>
              <p className="text-3xl font-bold text-gray-900 dark:text-white mt-1">{counts.teachers || 0}</p>
            </div>
            <div className="p-3 bg-orange-100 dark:bg-orange-900/30 rounded-lg">
              <PiStudentFill className="h-8 w-8 text-orange-600 dark:text-orange-400" />
            </div>
          </div>
        </div>
      </div>

      {/* Exam Statistics Section */}
      <div className="mb-8">
        <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">Exam Statistics</h3>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          {/* Total Exams */}
          <div className="bg-white dark:bg-gray-800 rounded-xl shadow-md border border-gray-200 dark:border-gray-700 p-6 hover:shadow-lg transition-shadow">
            <div className="flex items-center justify-between mb-3">
              <p className="text-sm font-medium text-gray-600 dark:text-gray-400">Total Exams</p>
              <div className="p-2 bg-indigo-100 dark:bg-indigo-900/30 rounded-lg">
                <MdOutlineQuiz className="h-6 w-6 text-indigo-600 dark:text-indigo-400" />
              </div>
            </div>
            <p className="text-2xl font-bold text-gray-900 dark:text-white">{counts.exams || 0}</p>
            <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
              {counts.examTemplates || 0} templates available
            </p>
          </div>

          {/* Exam Status Breakdown */}
          <div className="bg-white dark:bg-gray-800 rounded-xl shadow-md border border-gray-200 dark:border-gray-700 p-6 hover:shadow-lg transition-shadow">
            <div className="flex items-center justify-between mb-3">
              <p className="text-sm font-medium text-gray-600 dark:text-gray-400">Exam Status</p>
              <div className="p-2 bg-yellow-100 dark:bg-yellow-900/30 rounded-lg">
                <FaClipboardList className="h-6 w-6 text-yellow-600 dark:text-yellow-400" />
              </div>
            </div>
            <div className="space-y-2">
              <div className="flex items-center justify-between text-sm">
                <span className="text-gray-600 dark:text-gray-400">Draft</span>
                <span className="font-semibold text-gray-900 dark:text-white">{counts.examDrafts || 0}</span>
              </div>
              <div className="flex items-center justify-between text-sm">
                <span className="text-gray-600 dark:text-gray-400">Scheduled</span>
                <span className="font-semibold text-gray-900 dark:text-white">{counts.examScheduled || 0}</span>
              </div>
              <div className="flex items-center justify-between text-sm">
                <span className="text-gray-600 dark:text-gray-400">Active</span>
                <span className="font-semibold text-gray-900 dark:text-white">{counts.examActive || 0}</span>
              </div>
              <div className="flex items-center justify-between text-sm">
                <span className="text-gray-600 dark:text-gray-400">Completed</span>
                <span className="font-semibold text-gray-900 dark:text-white">{counts.examCompleted || 0}</span>
              </div>
            </div>
          </div>

          {/* Exam Attempts */}
          <div className="bg-white dark:bg-gray-800 rounded-xl shadow-md border border-gray-200 dark:border-gray-700 p-6 hover:shadow-lg transition-shadow">
            <div className="flex items-center justify-between mb-3">
              <p className="text-sm font-medium text-gray-600 dark:text-gray-400">Exam Attempts</p>
              <div className="p-2 bg-blue-100 dark:bg-blue-900/30 rounded-lg">
                <MdOutlineAssignment className="h-6 w-6 text-blue-600 dark:text-blue-400" />
              </div>
            </div>
            <p className="text-2xl font-bold text-gray-900 dark:text-white">{counts.examAttempts || 0}</p>
            <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
              Total student attempts
            </p>
          </div>

          {/* Total Submissions */}
          <div className="bg-white dark:bg-gray-800 rounded-xl shadow-md border border-gray-200 dark:border-gray-700 p-6 hover:shadow-lg transition-shadow">
            <div className="flex items-center justify-between mb-3">
              <p className="text-sm font-medium text-gray-600 dark:text-gray-400">Total Submissions</p>
              <div className="p-2 bg-purple-100 dark:bg-purple-900/30 rounded-lg">
                <ChartBarIcon className="h-6 w-6 text-purple-600 dark:text-purple-400" />
              </div>
            </div>
            <p className="text-2xl font-bold text-gray-900 dark:text-white">{counts.totalSubmissions || 0}</p>
            <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
              All question submissions
            </p>
          </div>
        </div>
      </div>

      {/* Class Analytics Table */}
      {classAnalytics.length > 0 && (
        <div className="bg-white dark:bg-gray-800 rounded-xl shadow-md border border-gray-200 dark:border-gray-700">
          <div className="px-6 py-4 border-b border-gray-200 dark:border-gray-700">
            <div className="flex justify-between items-center">
              <div>
                <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
                  Class Analytics
                </h3>
                <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
                  Detailed breakdown of classes, students, questions, and exams
                </p>
              </div>
              <button
                onClick={() => navigate('/admin/classes')}
                className="px-4 py-2 text-sm font-medium text-blue-600 dark:text-blue-400 hover:text-blue-700 dark:hover:text-blue-300 hover:underline"
              >
                View All →
              </button>
            </div>
          </div>
          
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
              <thead className="bg-gray-50 dark:bg-gray-900/50">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                    Class Name
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                    Status
                  </th>
                  <th className="px-6 py-3 text-center text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                    Students
                  </th>
                  <th className="px-6 py-3 text-center text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                    Teachers
                  </th>
                  <th className="px-6 py-3 text-center text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                    Questions
                  </th>
                  <th className="px-6 py-3 text-center text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                    Assignments
                  </th>
                  <th className="px-6 py-3 text-center text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                    Exams
                  </th>
                  <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                    Actions
                  </th>
                </tr>
              </thead>
              <tbody className="bg-white dark:bg-gray-800 divide-y divide-gray-200 dark:divide-gray-700">
                {classAnalytics.map((cls) => (
                  <tr 
                    key={cls.id} 
                    className="hover:bg-gray-50 dark:hover:bg-gray-700/50 transition-colors cursor-pointer"
                    onClick={() => navigate(`/admin/classes/${cls.id}`)}
                  >
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="flex items-center">
                        <div className="flex-shrink-0 h-10 w-10 flex items-center justify-center bg-indigo-100 dark:bg-indigo-900/30 rounded-lg">
                          <MdOutlineSchool className="h-5 w-5 text-indigo-600 dark:text-indigo-400" />
                        </div>
                        <div className="ml-4">
                          <div className="text-sm font-medium text-gray-900 dark:text-white">
                            {cls.name}
                          </div>
                        </div>
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                        cls.status === 'active' 
                          ? 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400' 
                          : 'bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-300'
                      }`}>
                        {cls.status || 'inactive'}
                      </span>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-center">
                      <div className="text-sm font-medium text-gray-900 dark:text-white">
                        {cls.studentCount}
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-center">
                      <div className="text-sm font-medium text-gray-900 dark:text-white">
                        {cls.teacherCount}
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-center">
                      <div className="text-sm font-medium text-gray-900 dark:text-white">
                        {cls.questionCount}
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-center">
                      <div className="text-sm font-medium text-gray-900 dark:text-white">
                        {cls.assignmentCount}
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="text-center">
                        <div className="text-sm font-medium text-gray-900 dark:text-white mb-1">
                          {cls.examCount || 0}
                        </div>
                        {cls.examStats && (cls.examStats.draft > 0 || cls.examStats.active > 0 || cls.examStats.completed > 0) && (
                          <div className="flex justify-center gap-1">
                            {cls.examStats.draft > 0 && (
                              <span className="inline-flex items-center px-1.5 py-0.5 rounded text-xs font-medium bg-gray-100 text-gray-700 dark:bg-gray-700 dark:text-gray-300" title="Draft">
                                {cls.examStats.draft}
                              </span>
                            )}
                            {cls.examStats.active > 0 && (
                              <span className="inline-flex items-center px-1.5 py-0.5 rounded text-xs font-medium bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400" title="Active">
                                {cls.examStats.active}
                              </span>
                            )}
                            {cls.examStats.completed > 0 && (
                              <span className="inline-flex items-center px-1.5 py-0.5 rounded text-xs font-medium bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400" title="Completed">
                                {cls.examStats.completed}
                              </span>
                            )}
                          </div>
                        )}
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          navigate(`/admin/classes/${cls.id}`);
                        }}
                        className="text-indigo-600 dark:text-indigo-400 hover:text-indigo-900 dark:hover:text-indigo-300"
                      >
                        View →
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {classAnalytics.length === 0 && countsStatus === 'succeeded' && (
        <div className="bg-white dark:bg-gray-800 rounded-xl shadow-md border border-gray-200 dark:border-gray-700 p-12 text-center">
          <MdOutlineSchool className="mx-auto h-12 w-12 text-gray-400" />
          <h3 className="mt-4 text-lg font-medium text-gray-900 dark:text-white">No classes found</h3>
          <p className="mt-2 text-sm text-gray-500 dark:text-gray-400">
            Get started by creating your first class
          </p>
          <button
            onClick={() => navigate('/admin/classes')}
            className="mt-6 px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition-colors"
          >
            Create Class
          </button>
        </div>
      )}
    </div>
  );
};

export default AdminDashboard;
