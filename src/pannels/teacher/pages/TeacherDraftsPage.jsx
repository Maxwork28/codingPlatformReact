import React, { useState, useEffect } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { getDrafts, publishDraftQuestion, deleteDraftQuestion } from '../../../common/services/api';
import { format } from 'date-fns';

const TeacherDraftsPage = () => {
  const navigate = useNavigate();
  const [drafts, setDrafts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedDrafts, setSelectedDrafts] = useState([]);
  const [pagination, setPagination] = useState({
    currentPage: 1,
    totalPages: 1,
    totalDrafts: 0,
    limit: 20
  });

  // Helper function to strip HTML tags and get plain text
  const stripHtml = (html) => {
    if (!html || typeof html !== 'string') return '';
    const div = document.createElement('div');
    div.innerHTML = html;
    const text = div.textContent || div.innerText || '';
    return text.trim();
  };

  useEffect(() => {
    fetchDrafts();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchQuery, pagination.currentPage]);

  const fetchDrafts = async () => {
    try {
      setLoading(true);
      setError('');
      const response = await getDrafts({
        page: pagination.currentPage,
        limit: pagination.limit,
        search: searchQuery
      });
      setDrafts(response.data.drafts || []);
      setPagination(response.data.pagination || pagination);
    } catch (err) {
      console.error('Failed to fetch drafts:', err);
      setError(err.message || 'Failed to fetch drafts');
    } finally {
      setLoading(false);
    }
  };

  const handlePublish = async (draftId) => {
    if (!window.confirm('Are you sure you want to publish this draft?')) {
      return;
    }
    try {
      setError('');
      setMessage('');
      await publishDraftQuestion(draftId);
      setMessage('Draft published successfully!');
      fetchDrafts();
      setTimeout(() => setMessage(''), 3000);
    } catch (err) {
      console.error('Failed to publish draft:', err);
      setError(err.message || 'Failed to publish draft');
      setTimeout(() => setError(''), 5000);
    }
  };

  const handleDelete = async (draftId) => {
    if (!window.confirm('Are you sure you want to delete this draft? This action cannot be undone.')) {
      return;
    }
    try {
      setError('');
      setMessage('');
      await deleteDraftQuestion(draftId);
      setMessage('Draft deleted successfully!');
      fetchDrafts();
      setTimeout(() => setMessage(''), 3000);
    } catch (err) {
      console.error('Failed to delete draft:', err);
      setError(err.message || 'Failed to delete draft');
      setTimeout(() => setError(''), 5000);
    }
  };

  const handleBulkPublish = async () => {
    if (selectedDrafts.length === 0) {
      setError('Please select at least one draft to publish');
      return;
    }
    if (!window.confirm(`Are you sure you want to publish ${selectedDrafts.length} draft(s)?`)) {
      return;
    }
    try {
      setError('');
      setMessage('');
      await Promise.all(selectedDrafts.map(id => publishDraftQuestion(id)));
      setMessage(`${selectedDrafts.length} draft(s) published successfully!`);
      setSelectedDrafts([]);
      fetchDrafts();
      setTimeout(() => setMessage(''), 3000);
    } catch (err) {
      console.error('Failed to publish drafts:', err);
      setError(err.message || 'Failed to publish drafts');
      setTimeout(() => setError(''), 5000);
    }
  };

  const handleSelectAll = (e) => {
    if (e.target.checked) {
      setSelectedDrafts(drafts.map(draft => draft._id));
    } else {
      setSelectedDrafts([]);
    }
  };

  const handleSelectDraft = (draftId, selected) => {
    if (selected) {
      setSelectedDrafts([...selectedDrafts, draftId]);
    } else {
      setSelectedDrafts(selectedDrafts.filter(id => id !== draftId));
    }
  };

  const getQuestionTypeLabel = (type) => {
    const typeMap = {
      'singleCorrectMcq': 'Single Choice MCQ',
      'multipleCorrectMcq': 'Multiple Choice MCQ',
      'fillInTheBlanks': 'Fill in the Blanks',
      'fillInTheBlanksCoding': 'Fill in the Blanks Coding',
      'coding': 'Coding'
    };
    return typeMap[type] || type;
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-indigo-600"></div>
      </div>
    );
  }

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      {/* Header */}
      <div className="flex items-center justify-between mb-8">
        <div className="flex items-center">
          <Link
            to="/teacher/questions"
            className="mr-4 p-2 rounded-full bg-gray-100 hover:bg-gray-200 transition-all duration-200"
          >
            <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 text-gray-600" viewBox="0 0 20 20" fill="currentColor">
              <path fillRule="evenodd" d="M9.707 16.707a1 1 0 01-1.414 0l-6-6a1 1 0 010-1.414l6-6a1 1 0 011.414 1.414L5.414 9H17a1 1 0 110 2H5.414l4.293 4.293a1 1 0 010 1.414z" clipRule="evenodd" />
            </svg>
          </Link>
          <h1 className="text-3xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-indigo-600 to-indigo-400 tracking-tight">
            Draft Questions
          </h1>
        </div>
        <div className="flex items-center gap-3">
          {selectedDrafts.length > 0 && (
            <button
              onClick={handleBulkPublish}
              className="inline-flex items-center px-4 py-2 rounded-lg text-sm font-semibold text-white bg-green-600 hover:bg-green-700 focus:outline-none focus:ring-2 focus:ring-green-500 focus:ring-offset-2 transition-all"
            >
              <svg className="h-4 w-4 mr-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
              </svg>
              Publish Selected ({selectedDrafts.length})
            </button>
          )}
          <Link
            to="/teacher/questions/create"
            className="inline-flex items-center px-4 py-2 rounded-lg text-sm font-semibold text-white bg-indigo-600 hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2 transition-all"
          >
            <svg className="h-4 w-4 mr-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
            </svg>
            Create New Draft
          </Link>
        </div>
      </div>

      {/* Messages */}
      {message && (
        <div className="mb-6 p-4 rounded-xl bg-green-50 border border-green-200 flex items-center">
          <svg className="h-5 w-5 text-green-600 mr-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
          </svg>
          <p className="text-sm font-semibold text-green-800">{message}</p>
        </div>
      )}

      {error && (
        <div className="mb-6 p-4 rounded-xl bg-red-50 border border-red-200 flex items-center">
          <svg className="h-5 w-5 text-red-600 mr-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
          </svg>
          <p className="text-sm font-semibold text-red-800">{error}</p>
        </div>
      )}

      {/* Search */}
      <div className="mb-6">
        <div className="relative">
          <input
            type="text"
            placeholder="Search drafts by title or tags..."
            value={searchQuery}
            onChange={(e) => {
              setSearchQuery(e.target.value);
              setPagination({ ...pagination, currentPage: 1 }); // Reset to first page on search
            }}
            className="w-full px-4 py-2 pl-10 rounded-lg border border-gray-300 focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 transition-all"
          />
          <svg className="absolute left-3 top-2.5 h-5 w-5 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
          </svg>
        </div>
      </div>

      {/* Drafts List */}
      {drafts.length === 0 ? (
        <div className="bg-white/90 backdrop-blur-sm rounded-2xl shadow-lg p-12 border border-gray-100 text-center">
          <svg className="h-16 w-16 text-gray-400 mx-auto mb-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
          </svg>
          <p className="text-lg font-semibold text-gray-800 mb-2">No drafts found</p>
          <p className="text-sm text-gray-600 mb-6">Create your first draft question to get started</p>
          <Link
            to="/teacher/questions/create"
            className="inline-flex items-center px-4 py-2 rounded-lg text-sm font-semibold text-white bg-indigo-600 hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2 transition-all"
          >
            <svg className="h-4 w-4 mr-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
            </svg>
            Create New Draft
          </Link>
        </div>
      ) : (
        <div className="bg-white/90 backdrop-blur-sm rounded-2xl shadow-lg border border-gray-100 overflow-hidden">
          {/* Select All Checkbox */}
          <div className="p-4 border-b border-gray-200 bg-gray-50">
            <label className="flex items-center cursor-pointer">
              <input
                type="checkbox"
                checked={selectedDrafts.length === drafts.length && drafts.length > 0}
                onChange={handleSelectAll}
                className="h-4 w-4 text-indigo-600 focus:ring-indigo-500 border-gray-300 rounded"
              />
              <span className="ml-2 text-sm font-medium text-gray-700">
                Select All ({selectedDrafts.length} selected)
              </span>
            </label>
          </div>

          {/* Drafts Grid */}
          <div className="divide-y divide-gray-200">
            {drafts.map((draft) => (
              <div
                key={draft._id}
                className="p-6 hover:bg-gray-50 transition-colors duration-200"
              >
                <div className="flex items-start gap-4">
                  {/* Checkbox */}
                  <input
                    type="checkbox"
                    checked={selectedDrafts.includes(draft._id)}
                    onChange={(e) => handleSelectDraft(draft._id, e.target.checked)}
                    className="mt-1 h-4 w-4 text-indigo-600 focus:ring-indigo-500 border-gray-300 rounded"
                  />

                  {/* Draft Info */}
                  <div className="flex-1 min-w-0">
                    <h3 className="text-lg font-semibold text-gray-900 mb-2">
                      {stripHtml(draft.title) || 'Untitled Question'}
                    </h3>
                    <p className="text-sm text-gray-600 mb-3 line-clamp-2">
                      {stripHtml(draft.description) || 'No description'}
                    </p>
                    <div className="flex items-center gap-4 text-xs text-gray-500">
                      <span className="inline-flex items-center px-2 py-1 rounded-full bg-indigo-100 text-indigo-800 font-medium">
                        {getQuestionTypeLabel(draft.type)}
                      </span>
                      <span className="inline-flex items-center px-2 py-1 rounded-full bg-gray-100 text-gray-800 font-medium">
                        {draft.difficulty || 'easy'}
                      </span>
                      <span className="inline-flex items-center">
                        <svg className="h-4 w-4 mr-1" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                        </svg>
                        Created: {format(new Date(draft.createdAt), 'MMM dd, yyyy')}
                      </span>
                      <span className="inline-flex items-center">
                        <svg className="h-4 w-4 mr-1" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                        </svg>
                        Updated: {format(new Date(draft.updatedAt), 'MMM dd, yyyy')}
                      </span>
                    </div>
                  </div>

                  {/* Actions */}
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => navigate(`/teacher/questions/${draft._id}/edit`)}
                      className="px-3 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2 transition-all"
                    >
                      Edit
                    </button>
                    <button
                      onClick={() => navigate(`/teacher/questions/${draft._id}/preview`)}
                      className="px-3 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2 transition-all"
                    >
                      Preview
                    </button>
                    <button
                      onClick={() => handlePublish(draft._id)}
                      className="px-3 py-2 text-sm font-medium text-white bg-green-600 rounded-lg hover:bg-green-700 focus:outline-none focus:ring-2 focus:ring-green-500 focus:ring-offset-2 transition-all"
                    >
                      Publish
                    </button>
                    <button
                      onClick={() => handleDelete(draft._id)}
                      className="px-3 py-2 text-sm font-medium text-white bg-red-600 rounded-lg hover:bg-red-700 focus:outline-none focus:ring-2 focus:ring-red-500 focus:ring-offset-2 transition-all"
                    >
                      Delete
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>

          {/* Pagination */}
          {pagination.totalPages > 1 && (
            <div className="p-4 border-t border-gray-200 bg-gray-50 flex items-center justify-between">
              <p className="text-sm text-gray-700">
                Showing {((pagination.currentPage - 1) * pagination.limit) + 1} to {Math.min(pagination.currentPage * pagination.limit, pagination.totalDrafts)} of {pagination.totalDrafts} drafts
              </p>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => {
                    const newPage = pagination.currentPage - 1;
                    setPagination({ ...pagination, currentPage: newPage });
                  }}
                  disabled={pagination.currentPage === 1}
                  className="px-3 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  Previous
                </button>
                <span className="px-4 py-2 text-sm text-gray-700">
                  Page {pagination.currentPage} of {pagination.totalPages}
                </span>
                <button
                  onClick={() => {
                    const newPage = pagination.currentPage + 1;
                    setPagination({ ...pagination, currentPage: newPage });
                  }}
                  disabled={pagination.currentPage === pagination.totalPages}
                  className="px-3 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  Next
                </button>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default TeacherDraftsPage;

