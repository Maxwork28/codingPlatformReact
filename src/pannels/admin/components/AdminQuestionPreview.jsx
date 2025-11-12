import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { adminSearchQuestionsById, getDraftQuestion } from '../../../common/services/api';
import QuestionStatement from '../../teacher/components/QuestionStatement';

const AdminQuestionPreview = () => {
  const { questionId } = useParams();
  const navigate = useNavigate();
  const [question, setQuestion] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    console.log('[AdminQuestionPreview] Component mounted/updated', { 
      questionId, 
      questionIdType: typeof questionId,
      questionIdLength: questionId?.length,
      questionIdValid: questionId && questionId !== 'undefined' && questionId !== 'null',
      urlParams: window.location.pathname
    });
    
    const fetchQuestion = async () => {
      // Validate questionId - check for undefined, null, empty string, or literal "undefined"/"null" strings
      if (!questionId || 
          questionId === 'undefined' || 
          questionId === 'null' || 
          (typeof questionId === 'string' && questionId.trim() === '') ||
          questionId === undefined ||
          questionId === null) {
        console.error('[AdminQuestionPreview] Invalid questionId:', { 
          questionId, 
          type: typeof questionId,
          pathname: window.location.pathname 
        });
        setError('Question ID is required. Please navigate from the question edit page.');
        setLoading(false);
        return;
      }
      
      // Check if questionId is a valid MongoDB ObjectId format (24 hex characters)
      const objectIdPattern = /^[0-9a-fA-F]{24}$/;
      if (!objectIdPattern.test(questionId)) {
        console.error('[AdminQuestionPreview] Invalid questionId format:', questionId);
        setError(`Invalid question ID format: ${questionId}. Please check the URL and try again.`);
        setLoading(false);
        return;
      }
      
      console.log('[AdminQuestionPreview] Valid questionId received:', questionId);

      try {
        setLoading(true);
        setError('');
        console.log('[AdminQuestionPreview] Calling API with:', questionId);
        
        // Try to fetch as draft first
        let fetchedQuestion = null;
        try {
          const draftResponse = await getDraftQuestion(questionId);
          fetchedQuestion = draftResponse.data.question;
          console.log('[AdminQuestionPreview] Fetched as draft');
        } catch (draftErr) {
          // If not a draft, fetch as regular question
          console.log('[AdminQuestionPreview] Not a draft, fetching as regular question');
          const response = await adminSearchQuestionsById(questionId);
          fetchedQuestion = response?.data?.question;
        }
        
        console.log('[AdminQuestionPreview] Fetched question:', fetchedQuestion);
        
        if (fetchedQuestion) {
          setQuestion(fetchedQuestion);
          setError('');
        } else {
          console.warn('[AdminQuestionPreview] No question in response');
          setError('Question not found in response');
        }
      } catch (err) {
        console.error('[AdminQuestionPreview] Fetch error:', err);
        console.error('[AdminQuestionPreview] Error type:', typeof err);
        console.error('[AdminQuestionPreview] Error details:', {
          message: err?.message,
          response: err?.response?.data,
          status: err?.response?.status,
          statusText: err?.response?.statusText,
          error: err?.error
        });
        
        // Handle error message extraction
        let errorMessage = 'Failed to fetch question';
        try {
          if (typeof err === 'string') {
            errorMessage = err;
          } else if (err?.message) {
            errorMessage = err.message;
          } else if (err?.response?.data?.error) {
            errorMessage = err.response.data.error;
          } else if (err?.response?.data?.message) {
            errorMessage = err.response.data.message;
          } else if (err?.error) {
            errorMessage = typeof err.error === 'string' ? err.error : 'Failed to fetch question';
          } else if (err?.response?.statusText) {
            errorMessage = `${err.response.status}: ${err.response.statusText}`;
          }
        } catch (parseErr) {
          console.error('[AdminQuestionPreview] Error parsing error message:', parseErr);
          errorMessage = 'Failed to fetch question. Please check the console for details.';
        }
        
        console.error('[AdminQuestionPreview] Setting error message:', errorMessage);
        setError(errorMessage);
      } finally {
        setLoading(false);
      }
    };
    
    fetchQuestion();
  }, [questionId]);

  if (loading) {
    console.log('[AdminQuestionPreview] Rendering loading state');
    return (
      <div className="fixed inset-0 bg-gray-600 bg-opacity-60 flex items-center justify-center z-50">
        <div className="bg-white/90 backdrop-blur-sm p-8 rounded-2xl shadow-xl max-w-sm w-full">
          <div className="flex items-center justify-center">
            <svg
              className="animate-spin h-10 w-10 text-indigo-600"
              xmlns="http://www.w3.org/2000/svg"
              fill="none"
              viewBox="0 0 24 24"
            >
              <circle
                className="opacity-25"
                cx="12"
                cy="12"
                r="10"
                stroke="currentColor"
                strokeWidth="4"
              ></circle>
              <path
                className="opacity-75"
                fill="currentColor"
                d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
              ></path>
            </svg>
            <span className="ml-4 text-lg font-semibold text-gray-800">Loading...</span>
          </div>
        </div>
      </div>
    );
  }

  if (error) {
    console.log('[AdminQuestionPreview] Rendering error state:', error);
    return (
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="mb-6 p-4 rounded-xl bg-red-50/80 backdrop-blur-sm border border-red-200 shadow-sm">
          <div className="flex items-center">
            <div className="flex-shrink-0">
              <svg
                className="h-6 w-6 text-red-500"
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
            </div>
            <div className="ml-3">
              <p className="text-sm font-semibold text-red-800">{error}</p>
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (!question) {
    console.log('[AdminQuestionPreview] Rendering question not found state');
    return (
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="bg-white/90 backdrop-blur-sm rounded-2xl shadow-lg p-6 border border-gray-100">
          <p className="text-center text-gray-800 font-semibold">Question not found</p>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      <div className="flex items-center mb-8">
        <button
          onClick={() => navigate('/admin/questions')}
          className="mr-4 p-2 rounded-full bg-gray-100 hover:bg-gray-200 transition-all duration-200"
        >
          <svg
            xmlns="http://www.w3.org/2000/svg"
            className="h-5 w-5 text-gray-600"
            viewBox="0 0 20 20"
            fill="currentColor"
          >
            <path
              fillRule="evenodd"
              d="M9.707 16.707a1 1 0 01-1.414 0l-6-6a1 1 0 010-1.414l6-6a1 1 0 011.414 1.414L5.414 9H17a1 1 0 110 2H5.414l4.293 4.293a1 1 0 010 1.414z"
              clipRule="evenodd"
            />
          </svg>
        </button>
        <h1 className="text-3xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-indigo-600 to-indigo-400 tracking-tight">
          Student Preview
        </h1>
      </div>
      
      <div className="bg-white/90 backdrop-blur-sm rounded-2xl shadow-lg p-6 border border-gray-100">
        <div className="mb-4 p-3 bg-blue-50 rounded-lg border border-blue-200">
          <p className="text-sm text-blue-800">
            <strong>Preview Mode:</strong> This is how students will see this question. You can test the interface but submissions are disabled.
          </p>
        </div>
        <QuestionStatement isPreview={true} question={question} />
      </div>
    </div>
  );
};

export default AdminQuestionPreview;

