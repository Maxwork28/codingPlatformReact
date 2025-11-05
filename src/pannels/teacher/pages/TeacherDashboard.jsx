import React, { useEffect } from 'react';
import { useSelector, useDispatch } from 'react-redux';
import { fetchClasses } from '../../../common/components/redux/classSlice';
import { FaBookOpen } from "react-icons/fa";

const TeacherDashboard = () => {
  const dispatch = useDispatch();
  const { classes, status, error } = useSelector((state) => state.classes);
  const { user } = useSelector((state) => state.auth);

  useEffect(() => {
    if (status === 'idle' && user) {
      console.log('%c[TeacherDashboard] Dispatching fetchClasses', 'color: orange;');
      dispatch(fetchClasses(''));
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
    <div className="p-3 pt-6">
      <div className="mb-6">
        <h2 className="tracking-tight" style={{ 
          color: 'var(--text-heading)', 
          fontSize: '28px', 
          fontWeight: '700',
          fontFamily: "-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Oxygen, Ubuntu, Cantarell, sans-serif"
        }}>
          Teacher Dashboard
        </h2>
      </div>
      {status === 'loading' && (
        <div className="flex justify-center items-center py-12 backdrop-blur-sm rounded-xl shadow-lg" style={{ backgroundColor: 'var(--background-light)' }}>
          <div className="w-12 h-12 border-4 border-t-transparent rounded-full animate-spin" style={{ borderColor: 'var(--python-blue)', borderTopColor: 'transparent' }}></div>
        </div>
      )}
      {error && (
        <div className="flex items-center p-4 mb-4 bg-red-50/80 backdrop-blur-sm rounded-xl shadow-sm border border-red-200">
          <svg className="h-6 w-6 text-red-500 mr-3" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor">
            <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
          </svg>
          <div>
            <h3 className="text-sm font-semibold text-red-800">Error loading classes</h3>
            <p className="mt-1 text-sm text-red-700">{error}</p>
          </div>
        </div>
      )}
      {status === 'succeeded' && (
        <div className="backdrop-blur-sm rounded-2xl shadow-lg border p-8 transition-all duration-300 hover:shadow-2xl" style={{ backgroundColor: 'var(--card-white)', borderColor: 'var(--card-border)' }}>
          <div className="flex items-center">
            <div className="flex-shrink-0 rounded-lg p-4 shadow-sm" style={{ backgroundColor: 'var(--background-light)' }}>
              <FaBookOpen className="h-8 w-8" style={{ color: 'var(--text-primary)' }} />
            </div>
            <div className="ml-5">
              <p className="text-sm font-medium" style={{ color: 'var(--text-secondary)' }}>Total Classes</p>
              <p className="text-3xl font-semibold" style={{ color: 'var(--text-primary)' }}>{myClasses.length}</p>
            </div>
          </div>
          {myClasses.length === 0 && (
            <p className="mt-4 text-sm text-center" style={{ color: 'var(--text-secondary)' }}>
              You haven't been assigned to any classes yet.
            </p>
          )}
        </div>
      )}
    </div>
  );
};

export default TeacherDashboard;