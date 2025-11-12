import React, { useState, useEffect } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import { useSelector, useDispatch } from 'react-redux';
import { fetchClasses } from '../../../common/components/redux/classSlice';
import { createDraftQuestion } from '../../../common/services/api';
import QuestionForm from '../components/QuestionForm';
import { ArrowLeftIcon, CheckCircleIcon, ExclamationTriangleIcon } from '@heroicons/react/24/outline';

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
      dispatch(fetchClasses(''));
    }
  }, [classStatus, dispatch, user]);

  const handleSubmit = async (data) => {
    setIsLoading(true);
    try {
      // Remove classIds since we're creating a draft (not publishing yet)
      const { classIds, ...questionData } = data;
      // Save as draft
      await createDraftQuestion({
        ...questionData,
        status: 'draft',
        isDraft: true
      });
      setMessage('Draft saved successfully! Redirecting to drafts page...');
      setError('');
      setTimeout(() => navigate('/teacher/questions/drafts'), 1500);
    } catch (err) {
      console.error('[CreateNewQuestion] Error submitting draft:', err.message, err.response?.data);
      const errorMessage = err.response?.data?.error || err.message || 'Failed to create draft';
      setError(errorMessage);
      setMessage('');
    } finally {
      setIsLoading(false);
    }
  };

  if (!user) {
    return (
      <div className="p-6 backdrop-blur-sm rounded-2xl shadow-lg border" style={{ backgroundColor: 'var(--card-white)', borderColor: 'var(--card-border)' }}>
        <p className="text-red-700 font-semibold text-center">You must be logged in to view this page.</p>
      </div>
    );
  }

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
      {/* Enhanced Header */}
      <div className="flex items-center mb-8 space-x-4">
        <Link
          to={classId ? `/teacher/classes/${classId}` : '/teacher/questions/manage'}
          className="p-3 rounded-xl transition-all duration-200 shadow-sm hover:shadow-md"
          style={{ backgroundColor: 'var(--background-light)', color: 'var(--text-primary)' }}
          aria-label="Go back"
        >
          <ArrowLeftIcon className="h-5 w-5" />
        </Link>
        <div>
          <h2 className="text-3xl font-bold tracking-tight" style={{ color: 'var(--text-heading)' }}>
            Create New Draft
          </h2>
          <p className="text-sm mt-1" style={{ color: 'var(--text-secondary)' }}>Build engaging questions for your students</p>
        </div>
      </div>

      {/* Loading Overlay */}
      {isLoading && (
        <div className="fixed inset-0 bg-gray-800 bg-opacity-75 flex items-center justify-center z-50">
          <div className="p-8 rounded-xl shadow-2xl flex items-center space-x-4" style={{ backgroundColor: 'var(--card-white)' }}>
            <svg className="animate-spin h-8 w-8 text-indigo-600" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
            </svg>
            <span className="text-lg font-semibold" style={{ color: 'var(--text-primary)' }}>Saving Draft...</span>
          </div>
        </div>
      )}

      {/* Enhanced Success Message */}
      {message && (
        <div className="mb-8 p-6 rounded-xl bg-green-50/80 backdrop-blur-sm border border-green-200 shadow-sm flex items-center space-x-3 animate-fade-in">
          <CheckCircleIcon className="h-6 w-6 text-green-600 flex-shrink-0" />
          <p className="text-sm font-semibold text-green-800">{message}</p>
        </div>
      )}

      {/* Enhanced Error Message */}
      {error && (
        <div className="mb-8 p-6 rounded-xl bg-red-50/80 backdrop-blur-sm border border-red-200 shadow-sm flex items-center space-x-3 animate-fade-in">
          <ExclamationTriangleIcon className="h-6 w-6 text-red-600 flex-shrink-0" />
          <p className="text-sm font-semibold text-red-800">{error}</p>
        </div>
      )}

      {/* Loading Classes */}
      {classStatus === 'loading' && (
        <div className="flex justify-center items-center py-16 backdrop-blur-sm rounded-2xl shadow-lg border" style={{ backgroundColor: 'var(--background-light)', borderColor: 'var(--card-border)' }}>
          <div className="w-12 h-12 border-4 border-indigo-500 border-t-transparent rounded-full animate-spin"></div>
        </div>
      )}

      {/* Error Loading Classes */}
      {classStatus === 'failed' && (
        <div className="p-6 mb-8 bg-red-50/80 backdrop-blur-sm rounded-xl border border-red-200 shadow-sm flex items-center space-x-3">
          <ExclamationTriangleIcon className="h-6 w-6 text-red-600 flex-shrink-0" />
          <div>
            <h3 className="text-sm font-semibold text-red-800">Error Loading Classes</h3>
            <p className="text-sm text-red-700">Failed to load classes. Please try again.</p>
          </div>
        </div>
      )}

      {/* Enhanced Form Container */}
      {classStatus === 'succeeded' && (
        <div className="backdrop-blur-sm rounded-2xl shadow-lg p-8 border hover:shadow-xl transition-all duration-300" style={{ backgroundColor: 'var(--background-light)', borderColor: 'var(--card-border)' }}>
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