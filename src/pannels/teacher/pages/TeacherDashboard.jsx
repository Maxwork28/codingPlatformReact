import React, { useEffect } from 'react';
import { useSelector, useDispatch } from 'react-redux';
import { fetchClasses } from '../../../common/components/redux/classSlice';
import { Link } from 'react-router-dom';

const TeacherDashboard = () => {
  const dispatch = useDispatch();
  const { classes, status, error } = useSelector((state) => state.classes);
  const { user } = useSelector((state) => state.auth);

  useEffect(() => {
    if (status === 'idle' && user) {
      console.log('%c[TeacherDashboard] Dispatching fetchClasses', 'color: orange;');
      dispatch(fetchClasses());
    }
  }, [status, dispatch, user]);

  if (!user) {
    return (
      <div className="p-6">
        <p className="text-red-700 font-semibold text-center">You must be logged in to view this page.</p>
      </div>
    );
  }

  const myClasses = classes.filter(
    (cls) => cls.teachers.some((t) => t._id === user.id) || cls.createdBy._id === user.id
  );

  console.log('%c[TeacherDashboard]', 'color: blue;');
  console.log('User:', user);
  console.log('Classes:', classes);
  console.log('My Classes:', myClasses);
  console.log('Status:', status);
  console.log('Error:', error);

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      <div className="flex justify-between items-center mb-10">
        <h2 className="text-3xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-indigo-600 to-indigo-400 tracking-tight">
          Teacher Dashboard
        </h2>
        {/* <Link
          to="/teacher/classes/new"
          className="inline-flex items-center px-4 py-2 rounded-lg text-sm font-semibold text-white bg-indigo-600 hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2 transition-all duration-300"
        >
          Create New Class
        </Link> */}
      </div>

      {status === 'loading' && (
        <div className="flex justify-center items-center py-16 bg-white/50 backdrop-blur-sm rounded-xl shadow-lg">
          <div className="w-12 h-12 border-4 border-indigo-500 border-t-transparent rounded-full animate-spin"></div>
        </div>
      )}

      {error && (
        <div className="flex items-center p-4 mb-6 bg-red-50/80 backdrop-blur-sm rounded-xl shadow-sm border border-red-200">
          <svg className="h-6 w-6 text-red-500 mr-3" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor">
            <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
          </svg>
          <div>
            <h3 className="text-sm font-semibold text-red-800">Error loading classes</h3>
            <p className="mt-1 text-sm text-red-700">{error}</p>
          </div>
        </div>
      )}

      {status === 'succeeded' && myClasses.length === 0 && (
        <div className="text-center py-16 bg-white/90 backdrop-blur-sm rounded-2xl shadow-lg border border-gray-100">
          <svg className="mx-auto h-14 w-14 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9.172 16.172a4 4 0 015.656 0M9 10h.01M15 10h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
          <h3 className="mt-3 text-lg font-semibold text-gray-800">No classes found</h3>
          <p className="mt-1 text-sm text-gray-500">You haven't been assigned to any classes yet.</p>
          <div className="mt-6">
            <Link
              to="/teacher/classes/new"
              className="inline-flex items-center px-4 py-2 rounded-lg text-sm font-semibold text-white bg-indigo-600 hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2 transition-all duration-300"
            >
              Create New Class
            </Link>
          </div>
        </div>
      )}

      {status === 'succeeded' && myClasses.length > 0 && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {myClasses.map((cls) => (
            <Link
              key={cls._id}
              to={`/teacher/classes/${cls._id}`}
              className="bg-white/90 backdrop-blur-sm rounded-2xl shadow-lg border border-gray-100 overflow-hidden transition-all duration-300 hover:shadow-xl hover:-translate-y-1"
            >
              <div className="px-4 py-5 sm:p-6">
                <div className="flex items-center">
                  <div className="flex-shrink-0 bg-indigo-600 rounded-lg p-3 shadow-sm">
                    <svg className="h-6 w-6 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" />
                    </svg>
                  </div>
                  <div className="ml-5 w-0 flex-1">
                    <h3 className="text-lg font-semibold text-gray-800 truncate">{cls.name}</h3>
                    <p className="text-sm text-gray-500">{cls.students?.length || 0} students</p>
                  </div>
                </div>
                <div className="mt-4">
                  <p className="text-sm text-gray-600 line-clamp-2">{cls.description}</p>
                </div>
                <div className="mt-4 flex justify-between items-center">
                  <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold bg-indigo-100 text-indigo-700 shadow-sm">
                    {cls.questions?.length || 0} questions
                  </span>
                  <span className="text-xs text-gray-500">Created by {cls.createdBy?.name || 'Unknown'}</span>
                </div>
              </div>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
};

export default TeacherDashboard;