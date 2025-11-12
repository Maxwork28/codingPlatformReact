import React, { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useSelector } from 'react-redux';
import { adminCreateQuestion } from '../../../common/services/api';
import QuestionForm from '../components/AdminQuestionForm';

const AdminCreateNewQuestion = () => {
  const navigate = useNavigate();
  const { user } = useSelector((state) => state.auth);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  // Removed clipboard unlock handler - it was interfering with paste functionality
  // Native paste events work fine without this handler

  console.log('%c[AdminCreateNewQuestion] Component mounted, user state:', { user, role: user?.role }, 'color: orange;');

  const handleSubmit = async (data) => {
    setIsLoading(true);
    console.log('[AdminCreateNewQuestion] Submitting question as draft:', data);
    try {
      // Remove classIds since admin creates questions globally
      const { classIds, ...questionData } = data;
      // Save as draft
      await adminCreateQuestion({
        ...questionData,
        status: 'draft',
        isDraft: true
      });
      setMessage('Draft saved successfully! Redirecting to drafts page...');
      setError('');
      console.log('[AdminCreateNewQuestion] Draft saved successfully');
      setTimeout(() => {
        console.log('[AdminCreateNewQuestion] Navigating to /admin/questions/drafts');
        navigate('/admin/questions/drafts');
      }, 1500);
    } catch (err) {
      console.error('[AdminCreateNewQuestion] Error submitting draft:', err.message, err.response?.data);
      const errorMessage = err.response?.data?.error || err.message || 'Failed to save draft';
      setError(errorMessage);
      setMessage('');
    } finally {
      setIsLoading(false);
      console.log('[AdminCreateNewQuestion] Loading state set to false');
    }
  };

  if (!user) {
    console.log('[AdminCreateNewQuestion] User not logged in');
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
          to="/admin/questions"
          className="p-2 rounded-full bg-gray-100 hover:bg-gray-200 transition-all duration-200"
          aria-label="Go back"
        >
          <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 text-gray-600" viewBox="0 0 20 20" fill="currentColor">
            <path fillRule="evenodd" d="M9.707 16.707a1 1 0 01-1.414 0l-6-6a1 1 0 010-1.414l6-6a1 1 0 011.414 1.414L5.414 9H17a1 1 0 110 2H5.414l4.293 4.293a1 1 0 010 1.414z" clipRule="evenodd" />
          </svg>
        </Link>
        <h2 className="text-3xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-indigo-600 to-purple-500 tracking-tight">
          Create New Draft
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
            <span className="text-lg font-semibold text-gray-800">Saving Draft...</span>
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

      {/* Form */}
      <div className="bg-white rounded-2xl shadow-lg p-8 border border-gray-100">
        <QuestionForm
          onSubmit={handleSubmit}
          initialData={null}
          classes={[]} // Admins don't assign to classes
          defaultClassId={null}
        />
      </div>
    </div>
  );
};

export default AdminCreateNewQuestion;