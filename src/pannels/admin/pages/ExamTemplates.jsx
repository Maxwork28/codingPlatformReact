import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { listExamTemplates, createExamTemplate, deleteExam, getExamDetails } from '../../../common/services/api';

const ExamTemplates = () => {
  const navigate = useNavigate();
  const [templates, setTemplates] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showCreateModal, setShowCreateModal] = useState(false);

  useEffect(() => {
    fetchTemplates();
  }, []);

  const fetchTemplates = async () => {
    try {
      setLoading(true);
      const response = await listExamTemplates();
      setTemplates(response.data.templates || []);
      setLoading(false);
    } catch (error) {
      console.error('Failed to fetch templates:', error);
      setLoading(false);
    }
  };

  const handleDelete = async (templateId) => {
    if (!window.confirm('Are you sure you want to delete this template?')) return;
    
    try {
      await deleteExam(templateId);
      setTemplates(templates.filter(t => t._id !== templateId));
    } catch (error) {
      alert(error.response?.data?.error || 'Failed to delete template');
    }
  };

  const handleUseTemplate = (templateId) => {
    navigate(`/admin/exams/templates/${templateId}/use`);
  };

  const handleEditTemplate = async (templateId) => {
    try {
      // Fetch template details to get classId
      const response = await getExamDetails(templateId);
      const template = response.data.exam;
      if (template && template.classId) {
        // Templates can only be edited by admin (they're always in admin context)
        navigate(`/admin/classes/${template.classId}/exams/${templateId}/edit`);
      } else {
        alert('Template class information not found');
      }
    } catch (error) {
      console.error('Failed to fetch template details:', error);
      alert(error.response?.data?.error || 'Failed to load template details');
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-xl">Loading templates...</div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900 py-8">
      <div className="container mx-auto px-4">
        <div className="mb-6 flex justify-between items-center">
          <h1 className="text-3xl font-bold">Exam Templates</h1>
          <button
            onClick={() => navigate('/admin/exams/templates/create')}
            className="px-4 py-2 bg-blue-500 text-white rounded hover:bg-blue-600"
          >
            Create Template
          </button>
        </div>

        {templates.length === 0 ? (
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-8 text-center">
            <p className="text-gray-600 dark:text-gray-400">No templates available</p>
            <button
              onClick={() => navigate('/admin/exams/templates/create')}
              className="mt-4 px-4 py-2 bg-blue-500 text-white rounded hover:bg-blue-600"
            >
              Create Your First Template
            </button>
          </div>
        ) : (
          <div className="grid gap-4">
            {templates.map((template) => (
              <div
                key={template._id}
                className="bg-white dark:bg-gray-800 rounded-lg shadow p-6"
              >
                <div className="flex justify-between items-start mb-4">
                  <div>
                    <h2 className="text-2xl font-bold mb-2">{template.title}</h2>
                    <p className="text-gray-600 dark:text-gray-400">{template.description}</p>
                    {template.template?.templateDescription && (
                      <p className="text-sm text-gray-500 mt-2">{template.template.templateDescription}</p>
                    )}
                  </div>
                  <span className="px-2 py-1 bg-purple-500 text-white rounded text-xs">Template</span>
                </div>

                <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-4 text-sm">
                  <div>
                    <span className="font-semibold">Duration:</span>{' '}
                    {template.proctoring?.durationMinutes || 0} minutes
                  </div>
                  <div>
                    <span className="font-semibold">Questions:</span>{' '}
                    {template.questions?.length || 0}
                  </div>
                  <div>
                    <span className="font-semibold">Sections:</span>{' '}
                    {template.sections?.length || 0}
                  </div>
                  <div>
                    <span className="font-semibold">Created:</span>{' '}
                    {new Date(template.createdAt).toLocaleDateString()}
                  </div>
                </div>

                <div className="flex gap-4">
                  <button
                    onClick={() => handleUseTemplate(template._id)}
                    className="px-4 py-2 bg-green-500 text-white rounded hover:bg-green-600"
                  >
                    Use Template
                  </button>
                  <button
                    onClick={() => handleEditTemplate(template._id)}
                    className="px-4 py-2 bg-blue-500 text-white rounded hover:bg-blue-600"
                  >
                    Edit
                  </button>
                  <button
                    onClick={() => handleDelete(template._id)}
                    className="px-4 py-2 bg-red-500 text-white rounded hover:bg-red-600"
                  >
                    Delete
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

export default ExamTemplates;

