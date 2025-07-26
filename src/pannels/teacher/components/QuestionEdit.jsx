import React, { useState, useEffect } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { useSelector, useDispatch } from 'react-redux';
import { fetchClasses } from '../../../common/components/redux/classSlice';
import { getQuestion, editQuestion } from '../../../common/services/api';
import QuestionForm from './QuestionForm';

const QuestionEdit = () => {
  const { questionId } = useParams();
  const navigate = useNavigate();
  const dispatch = useDispatch();
  const { classes, status: classStatus } = useSelector((state) => state.classes);
  const { user } = useSelector((state) => state.auth);
  const [initialData, setInitialData] = useState(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');

  console.log('[QuestionEdit] Component mounted', { questionId });

  useEffect(() => {
    if (classStatus === 'idle' && user) {
      console.log('[QuestionEdit] Dispatching fetchClasses', { userId: user.id });
      dispatch(fetchClasses());
    }
  }, [classStatus, dispatch, user]);

  useEffect(() => {
    const fetchQuestion = async () => {
      try {
        setIsLoading(true);
        console.log('[QuestionEdit] Fetching question with ID:', questionId);
        const response = await getQuestion(questionId);
        const question = response.data.question || response.data;
        console.log('[QuestionEdit] Question fetched:', {
          id: question._id,
          title: question.title,
          description: question.description,
          options: question.options,
          classes: question.classes,
          tags: question.tags,
          tagsType: typeof question.tags,
          tagsIsArray: Array.isArray(question.tags),
        });

        // Extract classIds from question.classes array
        const classIds = question.classes?.map(cls => cls.classId?.toString()).filter(id => id) || [];
        // Removed strict class ID validation to allow questions without classes
        // if (classIds.length === 0) {
        //   console.warn('[QuestionEdit] No valid classIds found in question.classes:', question.classes);
        //   setError('No valid class IDs found in question data.');
        //   return;
        // }

        // Prepare initialData for QuestionForm
        const preparedData = {
          type: question.type || 'mcq',
          title: question.title || '',
          description: question.description || '',
          points: question.points || 10,
          difficulty: question.difficulty || 'easy',
          tags: Array.isArray(question.tags) ? question.tags.join(', ') : (typeof question.tags === 'string' ? question.tags : ''),
          constraints: question.constraints || '',
          examples: question.examples?.length > 0 ? question.examples : [''],
          functionSignature: question.functionSignature || '',
          languages: Array.isArray(question.languages) ? question.languages : (question.language ? [question.language] : ['javascript']),
          options: question.options?.length >= 2 ? question.options : ['', '', '', ''],
          correctOption: question.correctOption || 0,
          codeSnippet: question.codeSnippet || '',
          correctAnswer: question.correctAnswer || '',
          templateCode: Array.isArray(question.templateCode) ? question.templateCode : [],
          testCases: question.testCases?.length > 0 ? question.testCases : [{ input: '', expectedOutput: '', isPublic: true }],
          timeLimit: question.timeLimit || 2,
          memoryLimit: question.memoryLimit || 256,
          classIds, // Use array of class IDs
          classId: classIds[0] || defaultClassId, // For backward compatibility
        };
        console.log('[QuestionEdit] initialData set:', preparedData);
        setInitialData(preparedData);
      } catch (err) {
        console.error('[QuestionEdit] Fetch error:', err.message, err.response?.data);
        setError(err.response?.data?.error || 'Failed to load question');
      } finally {
        setIsLoading(false);
      }
    };
    console.log('[QuestionEdit] Initiating fetchQuestion');
    fetchQuestion();
  }, [questionId]);

  const handleSubmit = async (questionData) => {
    setIsLoading(true);
    setError('');
    setMessage('');
    try {
      console.log('[QuestionEdit] Submitting updated question:', {
        questionId,
        classIds: questionData.classIds,
        data: questionData,
      });
      await editQuestion(questionId, questionData);
      setMessage('Question updated successfully!');
      console.log('[QuestionEdit] Question updated successfully, navigating to:', `/teacher/classes/${questionData.classIds[0] || initialData.classId}`);
      setTimeout(() => navigate(`/teacher/classes/${questionData.classIds[0] || initialData.classId}`), 2000);
    } catch (err) {
      console.error('[QuestionEdit] Update error:', err.message, err.response?.data);
      setError(err.response?.data?.error || 'Failed to update question');
    } finally {
      setIsLoading(false);
    }
  };

  if (!user) {
    return (
      <div className="p-6">
        <p className="text-red-700 font-semibold text-center">You must be logged in to view this page.</p>
      </div>
    );
  }

  if (isLoading) {
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
    return (
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="mb-6 p-4 rounded-xl bg-red-50/80 backdrop-blur-sm border border-red-200 shadow-sm">
          <div className="flex items-center">
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
            <p className="ml-3 text-sm font-semibold text-red-800">{error}</p>
          </div>
        </div>
      </div>
    );
  }

  if (classStatus === 'loading') {
    return (
      <div className="flex justify-center items-center py-16 bg-white/50 backdrop-blur-sm rounded-xl shadow-lg">
        <div className="w-12 h-12 border-4 border-indigo-500 border-t-transparent rounded-full animate-spin"></div>
      </div>
    );
  }

  if (classStatus === 'failed') {
    return (
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
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
            <h3 className="text-sm font-semibold text-red-800">Error loading classes</h3>
            <p className="mt-1 text-sm text-red-700">Failed to load classes. Please try again.</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      <div className="flex items-center mb-8">
        <Link
          to={initialData?.classId ? `/teacher/classes/${initialData.classId}` : '/teacher/questions/manage'}
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
        </Link>
        <h2 className="text-3xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-indigo-600 to-indigo-400 tracking-tight">
          Edit Question
        </h2>
      </div>

      {message && (
        <div className="mb-6 p-4 rounded-xl bg-green-50/80 backdrop-blur-sm border border-green-200 shadow-sm">
          <div className="flex items-center">
            <svg
              className="h-6 w-6 text-green-500"
              xmlns="http://www.w3.org/2000/svg"
              viewBox="0 0 20 20"
              fill="currentColor"
            >
              <path
                fillRule="evenodd"
                d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z"
                clipRule="evenodd"
              />
            </svg>
            <p className="ml-3 text-sm font-semibold text-green-800">{message}</p>
          </div>
        </div>
      )}

      {classStatus === 'succeeded' && initialData && (
        <div className="bg-white/90 backdrop-blur-sm rounded-2xl shadow-lg p-6 border border-gray-100">
          <QuestionForm
            onSubmit={handleSubmit}
            initialData={initialData}
            classes={classes.filter(
              (cls) => cls.teachers.some((t) => t._id === user.id) || cls.createdBy._id === user.id
            )}
            defaultClassId={initialData?.classId}
          />
        </div>
      )}
    </div>
  );
};

export default QuestionEdit;