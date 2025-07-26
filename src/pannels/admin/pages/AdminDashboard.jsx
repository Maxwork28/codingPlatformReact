import React, { useEffect, useState } from 'react';
import { useSelector } from 'react-redux';
import { ChartBarIcon, UsersIcon, AcademicCapIcon, UserGroupIcon } from '@heroicons/react/24/outline';
import { getCounts } from '../../../common/services/api'; // Import the getCounts function from api.js

const AdminDashboard = () => {
  // Redux state for classes
  const { classes, status: classesStatus, error: classesError } = useSelector((state) => state.classes);

  // Local state for counts
  const [counts, setCounts] = useState({
    teachers: 0,
    students: 0,
    questions: 0,
    classes: 0,
  });
  const [countsStatus, setCountsStatus] = useState('idle');
  const [countsError, setCountsError] = useState(null);

  // Fetch counts on component mount
  useEffect(() => {
    const fetchCounts = async () => {
      setCountsStatus('loading');
      try {
        const response = await getCounts();
        setCounts(response.data.counts);
        setCountsStatus('succeeded');
      } catch (error) {
        setCountsError(error || 'Failed to fetch counts');
        setCountsStatus('failed');
      }
    };

    fetchCounts();
  }, []);

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      <div className="mb-10">
        <h2 className="text-3xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-indigo-600 to-indigo-400 tracking-tight">
          Admin Dashboard
        </h2>
        <p className="mt-1 text-sm text-gray-500">Overview of classes, students, teachers, and questions.</p>
      </div>

      {/* Loading State */}
      {(classesStatus === 'loading' || countsStatus === 'loading') && (
        <div className="flex justify-center items-center py-16 bg-white/50 backdrop-blur-sm rounded-xl shadow-lg">
          <div className="w-12 h-12 border-4 border-indigo-500 border-t-transparent rounded-full animate-spin"></div>
        </div>
      )}

      {/* Error State */}
      {(classesError || countsError) && (
        <div className="flex items-center p-4 mb-6 bg-red-50/80 backdrop-blur-sm rounded-xl shadow-sm border border-red-200">
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
          <div>
            <h3 className="text-sm font-semibold text-red-800">Error</h3>
            <p className="mt-1 text-sm text-red-700">{classesError || countsError}</p>
          </div>
        </div>
      )}

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-8">
        <div className="bg-white/90 backdrop-blur-sm rounded-2xl shadow-lg border border-gray-100 p-6 transition-all duration-300 hover:shadow-xl hover:-translate-y-1">
          <div className="flex items-center">
            <div className="flex-shrink-0 bg-indigo-600 rounded-lg p-3 shadow-sm">
              <AcademicCapIcon className="h-6 w-6 text-white" />
            </div>
            <div className="ml-5">
              <p className="text-sm font-medium text-gray-500">Total Classes</p>
              <p className="text-2xl font-semibold text-gray-900">{counts.classes}</p>
            </div>
          </div>
        </div>

        <div className="bg-white/90 backdrop-blur-sm rounded-2xl shadow-lg border border-gray-100 p-6 transition-all duration-300 hover:shadow-xl hover:-translate-y-1">
          <div className="flex items-center">
            <div className="flex-shrink-0 bg-green-600 rounded-lg p-3 shadow-sm">
              <UsersIcon className="h-6 w-6 text-white" />
            </div>
            <div className="ml-5">
              <p className="text-sm font-medium text-gray-500">Total Students</p>
              <p className="text-2xl font-semibold text-gray-900">{counts.students}</p>
            </div>
          </div>
        </div>

        <div className="bg-white/90 backdrop-blur-sm rounded-2xl shadow-lg border border-gray-100 p-6 transition-all duration-300 hover:shadow-xl hover:-translate-y-1">
          <div className="flex items-center">
            <div className="flex-shrink-0 bg-blue-600 rounded-lg p-3 shadow-sm">
              <ChartBarIcon className="h-6 w-6 text-white" />
            </div>
            <div className="ml-5">
              <p className="text-sm font-medium text-gray-500">Total Questions</p>
              <p className="text-2xl font-semibold text-gray-900">{counts.questions}</p>
            </div>
          </div>
        </div>

        <div className="bg-white/90 backdrop-blur-sm rounded-2xl shadow-lg border border-gray-100 p-6 transition-all duration-300 hover:shadow-xl hover:-translate-y-1">
          <div className="flex items-center">
            <div className="flex-shrink-0 bg-purple-600 rounded-lg p-3 shadow-sm">
              <UserGroupIcon className="h-6 w-6 text-white" />
            </div>
            <div className="ml-5">
              <p className="text-sm font-medium text-gray-500">Total Teachers</p>
              <p className="text-2xl font-semibold text-gray-900">{counts.teachers}</p>
            </div>
          </div>
        </div>
      </div>

      {/* Recent Activity */}
      
    </div>
  );
};

export default AdminDashboard;