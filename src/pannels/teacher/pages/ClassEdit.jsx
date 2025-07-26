import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { getClassTeachers, editClass, getAllQuestions } from '../../../common/services/api';

const ClassEdit = () => {
  const { classId } = useParams();
  const navigate = useNavigate();
  const [formData, setFormData] = useState({ name: '', description: '', questionIds: [] });
  const [questions, setQuestions] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    const fetchData = async () => {
      try {
        const classResponse = await getClassTeachers(classId);
        const cls = classResponse.data.class;
        setFormData({
          name: cls.name,
          description: cls.description,
          questionIds: cls.questions.map((q) => q._id),
        });
        const questionsResponse = await getAllQuestions();
        setQuestions(questionsResponse.data.questions);
      } catch (err) {
        setError('Failed to load class or questions');
      } finally {
        setIsLoading(false);
      }
    };
    fetchData();
  }, [classId]);

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
    try {
      await editClass(classId, formData);
      navigate(`/teacher/classes/${classId}`);
    } catch (err) {
      setError('Failed to update class');
    }
  };

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
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      <h2 className="text-3xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-indigo-600 to-indigo-400 tracking-tight mb-8">
        Edit Class
      </h2>
      <div className="bg-white/90 backdrop-blur-sm rounded-2xl shadow-lg p-6 border border-gray-100">
        <form onSubmit={handleSubmit} className="space-y-6">
          <div>
            <label className="block text-sm font-semibold text-gray-800">Name</label>
            <input
              type="text"
              value={formData.name}
              onChange={(e) => setFormData({ ...formData, name: e.target.value })}
              className="mt-1 block w-full rounded-lg border border-gray-200 shadow-sm focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm transition-all duration-200"
            />
          </div>
          <div>
            <label className="block text-sm font-semibold text-gray-800">Description</label>
            <textarea
              value={formData.description}
              onChange={(e) => setFormData({ ...formData, description: e.target.value })}
              rows={4}
              className="mt-1 block w-full rounded-lg border border-gray-200 shadow-sm focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm transition-all duration-200"
            />
          </div>
          <div>
            <label className="block text-sm font-semibold text-gray-800 mb-2">Assign Questions</label>
            <div className="space-y-2">
              {questions.map((q) => (
                <div key={q._id} className="flex items-center">
                  <input
                    type="checkbox"
                    checked={formData.questionIds.includes(q._id)}
                    onChange={() => handleQuestionToggle(q._id)}
                    className="h-4 w-4 text-indigo-600 focus:ring-indigo-500 border-gray-200 rounded"
                  />
                  <label className="ml-2 text-sm text-gray-800">
                    {q.title} {q.type === 'coding' && `(${q.languages.join(', ')})`}
                  </label>
                </div>
              ))}
            </div>
          </div>
          <div className="flex justify-end">
            <button
              type="submit"
              className="inline-flex items-center px-4 py-2 rounded-lg text-sm font-semibold text-white bg-indigo-600 hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2 transition-all duration-300"
            >
              Save Changes
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default ClassEdit;