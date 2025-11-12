import React, { useState, useEffect } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { adminSearchQuestionsById, adminEditQuestion, getDraftQuestion, updateDraftQuestion, publishDraftQuestion } from '../../../common/services/api';
import QuestionForm from '../components/AdminQuestionForm';

const AdminQuestionEdit = () => {
  const { questionId } = useParams();
  const navigate = useNavigate();
  const [initialData, setInitialData] = useState(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');
  const [isDraft, setIsDraft] = useState(false);

  console.log('[AdminQuestionEdit] Component mounted', { questionId });

  // Removed clipboard unlock handler - it was interfering with paste functionality
  // Native paste events work fine without this handler

  useEffect(() => {
    const fetchQuestion = async () => {
      try {
        setIsLoading(true);
        console.log('[AdminQuestionEdit] Fetching question with ID:', questionId);
        
        // Try to fetch as draft first
        let question = null;
        let draft = false;
        try {
          const draftResponse = await getDraftQuestion(questionId);
          question = draftResponse.data.question;
          draft = true;
          setIsDraft(true);
          console.log('[AdminQuestionEdit] Question fetched as draft');
        } catch (draftErr) {
          // If not a draft, fetch as regular question
          console.log('[AdminQuestionEdit] Not a draft, fetching as regular question');
          const response = await adminSearchQuestionsById(questionId);
          question = response.data.question;
          draft = false;
          setIsDraft(false);
        }
        
        console.log('[AdminQuestionEdit] Question fetched:', {
          id: question._id,
          title: question.title,
          description: question.description,
          options: question.options,
          tags: question.tags,
          tagsType: typeof question.tags,
          tagsIsArray: Array.isArray(question.tags),
          isDraft: draft,
        });

        // Prepare initialData for QuestionForm (strings or HTML, as AdminQuestionForm will deserialize)
        const preparedData = {
          _id: question._id, // Include _id for preview functionality
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
          classes: question.classes || [],
          solutionCode: question.solutionCode || '',
          solutionLanguage: question.solutionLanguage || question.languages?.[0] || 'javascript',
          status: question.status || (draft ? 'draft' : 'published'),
          isDraft: draft,
        };
        console.log('[AdminQuestionEdit] initialData set:', preparedData);
        setInitialData(preparedData);
      } catch (err) {
        console.error('[AdminQuestionEdit] Fetch error:', err.message, err.response?.data);
        setError(err.response?.data?.error || 'Failed to load question');
      } finally {
        setIsLoading(false);
      }
    };
    console.log('[AdminQuestionEdit] Initiating fetchQuestion');
    fetchQuestion();
  }, [questionId]);

  const handleSubmit = async (questionData) => {
    setIsLoading(true);
    setError('');
    setMessage('');
    try {
      console.log('[AdminQuestionEdit] Submitting updated question:', { questionId, data: questionData, isDraft });
      if (isDraft) {
        // Update draft
        await updateDraftQuestion(questionId, questionData);
        setMessage('Draft updated successfully!');
        console.log('[AdminQuestionEdit] Draft updated successfully, navigating to /admin/questions/drafts');
        setTimeout(() => navigate('/admin/questions/drafts'), 2000);
      } else {
        // Update published question
        await adminEditQuestion(questionId, questionData);
        setMessage('Question updated successfully!');
        console.log('[AdminQuestionEdit] Question updated successfully, navigating to /admin/questions');
        setTimeout(() => navigate('/admin/questions'), 2000);
      }
    } catch (err) {
      console.error('[AdminQuestionEdit] Update error:', err.message, err.response?.data);
      setError(err.response?.data?.error || 'Failed to update question');
    } finally {
      setIsLoading(false);
    }
  };

  const handlePublish = async () => {
    if (!window.confirm('Are you sure you want to publish this draft?')) {
      return;
    }
    setIsLoading(true);
    setError('');
    setMessage('');
    try {
      console.log('[AdminQuestionEdit] Publishing draft:', questionId);
      await publishDraftQuestion(questionId);
      setMessage('Draft published successfully!');
      setIsDraft(false);
      console.log('[AdminQuestionEdit] Draft published successfully, navigating to /admin/questions/drafts');
      setTimeout(() => navigate('/admin/questions/drafts'), 2000);
    } catch (err) {
      console.error('[AdminQuestionEdit] Publish error:', err.message, err.response?.data);
      setError(err.response?.data?.error || 'Failed to publish draft');
    } finally {
      setIsLoading(false);
    }
  };

  if (isLoading) {
    return (
      <div className="fixed inset-0 bg-gray-600 bg-opacity-60 flex items-center justify-center z-50">
        <div className="backdrop-blur-sm p-8 rounded-2xl shadow-xl max-w-sm w-full" style={{ backgroundColor: 'var(--card-white)' }}>
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
            <span className="ml-4 text-lg font-semibold" style={{ color: 'var(--text-primary)' }}>Loading...</span>
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

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      <div className="flex items-center justify-between mb-8">
        <div className="flex items-center">
          <Link
            to={isDraft ? "/admin/questions/drafts" : "/admin/questions"}
            className="mr-4 p-2 rounded-full transition-all duration-200"
            style={{ backgroundColor: 'var(--background-light)' }}
          >
            <svg
              xmlns="http://www.w3.org/2000/svg"
              className="h-5 w-5"
              style={{ color: 'var(--text-secondary)' }}
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
          <h2 className="text-3xl font-bold tracking-tight" style={{ color: 'var(--text-heading)' }}>
            {isDraft ? 'Edit Draft' : 'Edit Question'}
          </h2>
        </div>
        {isDraft && (
          <button
            onClick={handlePublish}
            className="inline-flex items-center px-4 py-2 rounded-lg text-sm font-semibold text-white bg-green-600 hover:bg-green-700 focus:outline-none focus:ring-2 focus:ring-green-500 focus:ring-offset-2 transition-all"
          >
            <svg className="h-4 w-4 mr-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
            </svg>
            Publish Draft
          </button>
        )}
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

      {initialData && (
        <div className="backdrop-blur-sm rounded-2xl shadow-lg p-6 border" style={{ backgroundColor: 'var(--card-white)', borderColor: 'var(--card-border)' }}>
          {isDraft && (
            <div className="mb-6 p-4 rounded-xl bg-yellow-50 border border-yellow-200 flex items-center">
              <svg className="h-5 w-5 text-yellow-600 mr-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
              </svg>
              <p className="text-sm font-semibold text-yellow-800">
                This is a draft question. Update it and publish when ready.
              </p>
            </div>
          )}
          <QuestionForm
            onSubmit={handleSubmit}
            initialData={initialData}
            classes={[]} // No classes for admin
            defaultClassId={null}
          />
        </div>
      )}
    </div>
  );
};

export default AdminQuestionEdit;