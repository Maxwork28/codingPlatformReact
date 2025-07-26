import React, { useState, useEffect } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import { useSelector, useDispatch } from 'react-redux';
import { fetchClasses } from '../../../common/components/redux/classSlice';
import { assignQuestion } from '../../../common/services/api';
import QuestionForm from '../components/QuestionForm';

const CreateNewQuestion = () => {
  const { classId } = useParams();
  const navigate = useNavigate();
  const dispatch = useDispatch();
  const { classes, status: classStatus } = useSelector((state) => state.classes);
  const { user } = useSelector((state) => state.auth);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    if (classStatus === 'idle' && user) {
      console.log('%c[CreateNewQuestion] Dispatching fetchClasses', 'color: orange;');
      dispatch(fetchClasses());
    }
  }, [classStatus, dispatch, user]);

  const handleSubmit = async (data) => {
    setIsLoading(true);
    try {
      const classIds = data.classIds && data.classIds.length > 0 ? data.classIds : classId ? [classId] : [];
      await assignQuestion({ ...data, classIds });
      setMessage('Question created successfully!');
      setError('');
      setTimeout(() => navigate(classId ? `/teacher/classes/${classId}` : '/teacher/questions/manage'), 2000);
    } catch (err) {
      console.error('[CreateNewQuestion] Error submitting question:', err.message, err.response?.data);
      const errorMessage = err.response?.data?.error || err.message || 'Failed to create question';
      setError(errorMessage);
      setMessage('');
    } finally {
      setIsLoading(false);
    }
  };

  if (!user) {
    return (
      <div className="p-6 text-center">
        <p className="text-red-600 font-semibold text-lg">You must be logged in to view this page.</p>
      </div>
    );
  }

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
      {/* Header */}
      <div className="flex items-center mb-8 space-x-4">
        <Link
          to={classId ? `/teacher/classes/${classId}` : '/teacher/questions/manage'}
          className="p-2 rounded-full bg-gray-100 hover:bg-gray-200 transition-all duration-200"
          aria-label="Go back"
        >
          <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 text-gray-600" viewBox="0 0 20 20" fill="currentColor">
            <path fillRule="evenodd" d="M9.707 16.707a1 1 0 01-1.414 0l-6-6a1 1 0 010-1.414l6-6a1 1 0 011.414 1.414L5.414 9H17a1 1 0 110 2H5.414l4.293 4.293a1 1 0 010 1.414z" clipRule="evenodd" />
          </svg>
        </Link>
        <h2 className="text-3xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-indigo-600 to-purple-500 tracking-tight">
          Create New Question
        </h2>
      </div>

      {/* Loading Overlay */}
      {isLoading && (
        <div className="fixed inset-0 bg-gray-800 bg-opacity-75 flex items-center justify-center z-50">
          <div className="bg-white p-8 rounded-xl shadow-2xl flex items-center space-x-4">
            <svg className="animate-spin h-8 w-8 text-indigo-600" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
            </svg>
            <span className="text-lg font-semibold text-gray-800">Creating Question...</span>
          </div>
        </div>
      )}

      {/* Success Message */}
      {message && (
        <div className="mb-8 p-4 rounded-xl bg-green-100 border border-green-300 flex items-center space-x-3 animate-fade-in">
          <svg className="h-6 w-6 text-green-600" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor">
            <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
          </svg>
          <p className="text-sm font-semibold text-green-800">{message}</p>
        </div>
      )}

      {/* Error Message */}
      {error && (
        <div className="mb-8 p-4 rounded-xl bg-red-100 border border-red-300 flex items-center space-x-3 animate-fade-in">
          <svg className="h-6 w-6 text-red-600" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor">
            <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
          </svg>
          <p className="text-sm font-semibold text-red-800">{error}</p>
        </div>
      )}

      {/* Loading Classes */}
      {classStatus === 'loading' && (
        <div className="flex justify-center items-center py-16 bg-white rounded-xl shadow-lg">
          <div className="w-12 h-12 border-4 border-indigo-500 border-t-transparent rounded-full animate-spin"></div>
        </div>
      )}

      {/* Error Loading Classes */}
      {classStatus === 'failed' && (
        <div className="p-4 mb-8 bg-red-100 rounded-xl border border-red-300 flex items-center space-x-3">
          <svg className="h-6 w-6 text-red-600" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor">
            <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
          </svg>
          <div>
            <h3 className="text-sm font-semibold text-red-800">Error Loading Classes</h3>
            <p className="text-sm text-red-700">Failed to load classes. Please try again.</p>
          </div>
        </div>
      )}

      {/* Form */}
      {classStatus === 'succeeded' && (
        <div className="bg-white rounded-2xl shadow-lg p-8 border border-gray-100">
          <QuestionForm
            onSubmit={handleSubmit}
            initialData={null}
            classes={classes.filter(
              (cls) => cls.teachers.some((t) => t._id === user.id) || cls.createdBy._id === user.id
            )}
            defaultClassId={classId}
          />
        </div>
      )}
    </div>
  );
};

export default CreateNewQuestion;