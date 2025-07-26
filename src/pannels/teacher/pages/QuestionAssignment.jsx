import React, { useState, useEffect } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import { useSelector } from 'react-redux';
import { getQuestion, editQuestion, assignQuestion } from '../../../common/services/api';
import QuestionForm from '../components/QuestionForm';

const QuestionAssignment = () => {
  const { classId, questionId } = useParams();
  const navigate = useNavigate();
  const { classes } = useSelector((state) => state.classes);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [initialData, setInitialData] = useState(null);

  useEffect(() => {
    if (questionId) {
      const fetchQuestion = async () => {
        try {
          setIsLoading(true);
          const response = await getQuestion(questionId, classId);
          setInitialData(response.data.question);
        } catch (err) {
          console.error('[QuestionAssignment] Error fetching question:', err);
          setError(err.response?.data?.error || 'Failed to load question');
        } finally {
          setIsLoading(false);
        }
      };
      fetchQuestion();
    }
  }, [questionId, classId]);

  const handleSubmit = async (data) => {
    setIsLoading(true);
    try {
      if (questionId) {
        await editQuestion(questionId, data);
        setMessage('Question updated successfully!');
      } else {
        const classIds = data.classIds && data.classIds.length > 0 ? data.classIds : classId ? [classId] : [];
        await assignQuestion({ ...data, classIds });
        setMessage('Question created successfully!');
      }
      setError('');
      setTimeout(() => navigate(classId ? `/teacher/classes/${  classId}` : '/teacher/questions/manage'), 2000);
    } catch (err) {
      console.error('[QuestionAssignment] Error submitting question:', err);
      setError(err.response?.data?.error || 'Failed to save question');
      setMessage('');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      <div className="flex items-center mb-8">
        <Link
          to={classId ? `/teacher/classes/${classId}` : '/teacher/questions/manage'}
          className="mr-4 p-2 rounded-full bg-gray-100 hover:bg-gray-200 transition-all duration-200"
        >
          <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 text-gray-600" viewBox="0 0 20 20" fill="currentColor">
            <path fillRule="evenodd" d="M9.707 16.707a1 1 0 01-1.414 0l-6-6a1 1 0 010-1.414l6-6a1 1 0 011.414 1.414L5.414 9H17a1 1 0 110 2H5.414l4.293 4.293a1 1 0 010 1.414z" clipRule="evenodd" />
          </svg>
        </Link>
        <h2 className="text-3xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-indigo-600 to-indigo-400 tracking-tight">
          {questionId ? 'Edit Question' : 'Create New Question'}
        </h2>
      </div>

      {isLoading && (
        <div className="fixed inset-0 bg-gray-600 bg-opacity-60 flex items-center justify-center z-50">
          <div className="bg-white/90 backdrop-blur-sm p-8 rounded-2xl shadow-xl max-w-sm w-full">
            <div className="flex items-center justify-center">
              <svg className="animate-spin h-10 w-10 text-indigo-600" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
              </svg>
              <span className="ml-4 text-lg font-semibold text-gray-800">Processing...</span>
            </div>
          </div>
        </div>
      )}

      {message && (
        <div className="mb-6 p-4 rounded-xl bg-green-50/80 backdrop-blur-sm border border-green-200 shadow-sm">
          <div className="flex items-center">
            <div className="flex-shrink-0">
              <svg className="h-6 w-6 text-green-500" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor">
                <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
              </svg>
            </div>
            <div className="ml-3">
              <p className="text-sm font-semibold text-green-800">{message}</p>
            </div>
          </div>
        </div>
      )}

      {error && (
        <div className="mb-6 p-4 rounded-xl bg-red-50/80 backdrop-blur-sm border border-red-200 shadow-sm">
          <div className="flex items-center">
            <div className="flex-shrink-0">
              <svg className="h-6 w-6 text-red-500" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor">
                <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
              </svg>
            </div>
            <div className="ml-3">
              <p className="text-sm font-semibold text-red-800">{error}</p>
            </div>
          </div>
        </div>
      )}

      <div className="bg-white/90 backdrop-blur-sm rounded-2xl shadow-lg p-6 border border-gray-100">
        <QuestionForm
          onSubmit={handleSubmit}
          initialData={initialData}
          classes={classes}
          defaultClassId={classId}
        />
      </div>
    </div>
  );
};

export default QuestionAssignment;