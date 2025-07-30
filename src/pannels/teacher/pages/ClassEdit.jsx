import React, { useState, useEffect } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { useSelector } from 'react-redux';
import { getClassDetails, editClass, getAllQuestions } from '../../../common/services/api';

const ClassEdit = () => {
  const { classId } = useParams();
  const navigate = useNavigate();
  const { user } = useSelector((state) => state.auth);
  const [formData, setFormData] = useState({ name: '', description: '', questionIds: [] });
  const [questions, setQuestions] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    const fetchData = async () => {
      if (!user) {
        setError('You must be logged in to view this page.');
        setIsLoading(false);
        return;
      }

      try {
        setIsLoading(true);
        setError('');
        
        console.log('[ClassEdit] Fetching class details:', { classId, userId: user.id });
        const classResponse = await getClassDetails(classId);
        const cls = classResponse.data.class;
        
        // Check if user is authorized to edit this class
        if (!cls.teachers.some(t => t._id === user.id) && cls.createdBy._id !== user.id) {
          setError('You are not authorized to edit this class.');
          setIsLoading(false);
          return;
        }

        console.log('[ClassEdit] Class data loaded:', cls);
        setFormData({
          name: cls.name,
          description: cls.description,
          questionIds: cls.questions.map((q) => q._id),
        });

        // Fetch all questions for the teacher
        const questionsResponse = await getAllQuestions();
        const userQuestions = questionsResponse.data.questions.filter(q => q.createdBy._id === user.id);
        console.log('[ClassEdit] User questions loaded:', userQuestions.length);
        setQuestions(userQuestions);
        
      } catch (err) {
        console.error('[ClassEdit] Error fetching data:', err);
        setError(err.response?.data?.error || 'Failed to load class or questions');
      } finally {
        setIsLoading(false);
      }
    };

    fetchData();
  }, [classId, user]);

  const handleQuestionToggle = (questionId) => {
    setFormData((prev) => ({
      ...prev,
      questionIds: prev.questionIds.includes(questionId)
        ? prev.questionIds.filter((id) => id !== questionId)
        : [...prev.questionIds, questionId],
    }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    
    if (!formData.name.trim()) {
      setError('Class name is required.');
      return;
    }

    try {
      setIsSubmitting(true);
      setError('');
      
      console.log('[ClassEdit] Submitting form data:', formData);
      await editClass(classId, formData);
      
      console.log('[ClassEdit] Class updated successfully');
      navigate(`/teacher/classes/${classId}`);
    } catch (err) {
      console.error('[ClassEdit] Error updating class:', err);
      setError(err.response?.data?.error || 'Failed to update class');
    } finally {
      setIsSubmitting(false);
    }
  };

  if (!user) {
    return (
      <div className="max-w-4xl mx-auto p-6">
        <div className="flex items-center p-4 bg-red-50/80 backdrop-blur-sm rounded-xl shadow-sm border border-red-200">
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
          <p className="text-sm text-red-700 font-semibold">You must be logged in to view this page.</p>
        </div>
      </div>
    );
  }

  if (isLoading) {
    return (
      <div className="flex justify-center items-center h-64">
        <div className="w-12 h-12 border-4 border-indigo-500 border-t-transparent rounded-full animate-spin"></div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="max-w-4xl mx-auto p-6">
        <div className="flex items-center p-4 bg-red-50/80 backdrop-blur-sm rounded-xl shadow-sm border border-red-200">
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
          <p className="text-sm text-red-700 font-semibold">{error}</p>
        </div>
        <div className="mt-4">
          <Link
            to="/teacher/classes"
            className="inline-flex items-center px-4 py-2 rounded-lg text-sm font-semibold text-gray-700 bg-white border border-gray-200 shadow-sm hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2 transition-all duration-300"
          >
            Back to Classes
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      <div className="flex items-center justify-between mb-8">
        <h2 className="text-3xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-indigo-600 to-indigo-400 tracking-tight">
          Edit Class
        </h2>
        <Link
          to={`/teacher/classes/${classId}`}
          className="inline-flex items-center px-4 py-2 rounded-lg text-sm font-semibold text-gray-700 bg-white border border-gray-200 shadow-sm hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2 transition-all duration-300"
        >
          Back to Class
        </Link>
      </div>
      
      <div className="bg-white/90 backdrop-blur-sm rounded-2xl shadow-lg p-6 border border-gray-100">
        <form onSubmit={handleSubmit} className="space-y-6">
          <div>
            <label className="block text-sm font-semibold text-gray-800 mb-2">Class Name</label>
            <input
              type="text"
              value={formData.name}
              onChange={(e) => setFormData({ ...formData, name: e.target.value })}
              className="mt-1 block w-full rounded-lg border border-gray-200 shadow-sm focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm transition-all duration-200 px-4 py-2"
              placeholder="Enter class name"
              required
            />
          </div>
          
          <div>
            <label className="block text-sm font-semibold text-gray-800 mb-2">Description</label>
            <textarea
              value={formData.description}
              onChange={(e) => setFormData({ ...formData, description: e.target.value })}
              rows={4}
              className="mt-1 block w-full rounded-lg border border-gray-200 shadow-sm focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm transition-all duration-200 px-4 py-2"
              placeholder="Enter class description"
            />
          </div>
          
          <div>
            <label className="block text-sm font-semibold text-gray-800 mb-4">Assign Questions</label>
            {questions.length === 0 ? (
              <div className="text-sm text-gray-500 p-4 bg-gray-50 rounded-lg">
                <p>You haven't created any questions yet.</p>
                <Link
                  to="/teacher/questions/new"
                  className="text-indigo-600 hover:text-indigo-800 font-medium"
                >
                  Create your first question
                </Link>
              </div>
            ) : (
              <div className="space-y-3 max-h-64 overflow-y-auto p-4 bg-gray-50 rounded-lg">
                {questions.map((q) => (
                  <div key={q._id} className="flex items-center">
                    <input
                      type="checkbox"
                      checked={formData.questionIds.includes(q._id)}
                      onChange={() => handleQuestionToggle(q._id)}
                      className="h-4 w-4 text-indigo-600 focus:ring-indigo-500 border-gray-200 rounded"
                    />
                    <label className="ml-3 text-sm text-gray-800 flex-1">
                      <span className="font-medium">{q.title}</span>
                      {q.type === 'coding' && (
                        <span className="ml-2 text-xs text-gray-500">
                          ({q.languages?.join(', ') || 'No languages'})
                        </span>
                      )}
                    </label>
                  </div>
                ))}
              </div>
            )}
          </div>
          
          <div className="flex justify-end space-x-4 pt-6 border-t border-gray-200">
            <Link
              to={`/teacher/classes/${classId}`}
              className="inline-flex items-center px-4 py-2 rounded-lg text-sm font-semibold text-gray-700 bg-white border border-gray-200 shadow-sm hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2 transition-all duration-300"
            >
              Cancel
            </Link>
            <button
              type="submit"
              disabled={isSubmitting}
              className="inline-flex items-center px-4 py-2 rounded-lg text-sm font-semibold text-white bg-indigo-600 hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2 transition-all duration-300 disabled:bg-gray-400 disabled:cursor-not-allowed"
            >
              {isSubmitting ? 'Saving...' : 'Save Changes'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default ClassEdit;