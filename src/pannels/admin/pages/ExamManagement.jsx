import React, { useState, useEffect } from 'react';
import { useNavigate, useParams, useLocation } from 'react-router-dom';
import { listClassExams, deleteExam, getExamReport } from '../../../common/services/api';
import { ChevronDownIcon, ChevronUpIcon } from '@heroicons/react/24/outline';

const ExamManagement = () => {
  const { classId } = useParams();
  const navigate = useNavigate();
  const location = useLocation();
  
  // Detect if admin or teacher based on URL path
  const isAdmin = location.pathname.includes('/admin/');
  const basePath = isAdmin ? '/admin' : '/teacher';
  
  const [exams, setExams] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [expandedExams, setExpandedExams] = useState(new Set());

  useEffect(() => {
    const fetchExams = async () => {
      try {
        setLoading(true);
        const response = await listClassExams(classId);
        setExams(response.data.exams || []);
        setLoading(false);
      } catch (err) {
        console.error('Failed to fetch exams:', err);
        setError(err.response?.data?.error || 'Failed to fetch exams');
        setLoading(false);
      }
    };

    if (classId) {
      fetchExams();
    }
  }, [classId]);

  const handleDelete = async (examId) => {
    if (!window.confirm('Are you sure you want to delete this exam?')) return;
    
    try {
      await deleteExam(examId);
      setExams(exams.filter(e => e._id !== examId));
    } catch (err) {
      alert(err.response?.data?.error || 'Failed to delete exam');
    }
  };

  const toggleExpand = (examId) => {
    setExpandedExams(prev => {
      const newSet = new Set(prev);
      if (newSet.has(examId)) {
        newSet.delete(examId);
      } else {
        newSet.add(examId);
      }
      return newSet;
    });
  };

  const getStatusBadge = (exam) => {
    if (exam.status === 'scheduled') {
      return <span className="px-2 py-1 bg-yellow-500 text-white rounded text-xs font-semibold">Scheduled</span>;
    } else if (exam.status === 'active') {
      return <span className="px-2 py-1 bg-green-500 text-white rounded text-xs font-semibold">Active</span>;
    } else if (exam.status === 'completed') {
      return <span className="px-2 py-1 bg-gray-500 text-white rounded text-xs font-semibold">Completed</span>;
    } else if (exam.status === 'draft') {
      return <span className="px-2 py-1 bg-blue-500 text-white rounded text-xs font-semibold">Draft</span>;
    }
    return <span className="px-2 py-1 bg-blue-500 text-white rounded text-xs font-semibold">{exam.status}</span>;
  };

  const calculateTotalPoints = (exam) => {
    return exam.questions?.reduce((sum, q) => sum + (q.points || 0), 0) || 0;
  };

  const formatDuration = (seconds) => {
    if (!seconds) return 'N/A';
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}m ${secs}s`;
  };

  const formatDate = (dateValue) => {
    if (!dateValue) return 'Not set';
    try {
      // Handle MongoDB date format with $date wrapper
      let dateString = dateValue;
      if (typeof dateValue === 'object' && dateValue.$date) {
        dateString = dateValue.$date;
      } else if (typeof dateValue === 'object' && dateValue.toString) {
        dateString = dateValue.toString();
      }
      
      const date = new Date(dateString);
      if (isNaN(date.getTime())) return 'Not set';
      
      return date.toLocaleString('en-US', {
        year: 'numeric',
        month: 'short',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
        hour12: true
      });
    } catch (error) {
      console.error('Date formatting error:', error, dateValue);
      return 'Not set';
    }
  };

  // Filter exams based on search and status
  const filteredExams = exams.filter(exam => {
    const matchesSearch = searchQuery === '' || 
      exam.title?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      exam.description?.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesStatus = statusFilter === 'all' || exam.status === statusFilter;
    return matchesSearch && matchesStatus;
  });

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-xl">Loading exams...</div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900 py-8">
      <div className="container mx-auto px-4">
        <div className="mb-6 flex justify-between items-center">
          <h1 className="text-3xl font-bold">Exam Management</h1>
          <button
            onClick={() => navigate(`${basePath}/classes/${classId}/exams/create`)}
            className="px-4 py-2 bg-blue-500 text-white rounded hover:bg-blue-600"
          >
            Create Exam
          </button>
        </div>

        {/* Search and Filter */}
        {exams.length > 0 && (
          <div className="mb-6 grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium mb-2">Search Exams</label>
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search by title or description..."
                className="w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 dark:bg-gray-700 dark:border-gray-600 dark:text-white"
              />
            </div>
            <div>
              <label className="block text-sm font-medium mb-2">Filter by Status</label>
              <select
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value)}
                className="w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 dark:bg-gray-700 dark:border-gray-600 dark:text-white"
              >
                <option value="all">All Statuses</option>
                <option value="draft">Draft</option>
                <option value="scheduled">Scheduled</option>
                <option value="active">Active</option>
                <option value="completed">Completed</option>
              </select>
            </div>
          </div>
        )}

        {exams.length === 0 ? (
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-8 text-center">
            <p className="text-gray-600 dark:text-gray-400">No exams available</p>
          </div>
        ) : filteredExams.length === 0 ? (
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-8 text-center">
            <p className="text-gray-600 dark:text-gray-400">
              No exams found matching your search criteria.
            </p>
          </div>
        ) : (
          <div className="grid gap-4">
            {filteredExams.map((exam) => {
              const isExpanded = expandedExams.has(exam._id);
              const totalPoints = calculateTotalPoints(exam);
              const sections = exam.sections || [];
              const questions = exam.questions || [];
              
              return (
                <div
                  key={exam._id}
                  className="bg-white dark:bg-gray-800 rounded-lg shadow-lg border border-gray-200 dark:border-gray-700 overflow-hidden"
                >
                  {/* Header Section */}
                  <div className="p-6 border-b border-gray-200 dark:border-gray-700">
                    <div className="flex justify-between items-start mb-4">
                      <div className="flex-1">
                        <div className="flex items-center gap-3 mb-2">
                          <h2 className="text-2xl font-bold text-gray-900 dark:text-white">{exam.title}</h2>
                          {exam.template?.baseTemplateId && (
                            <span className="px-2 py-1 bg-purple-100 text-purple-700 rounded text-xs font-semibold">
                              From Template
                            </span>
                          )}
                        </div>
                        {exam.description && (
                          <p className="text-gray-600 dark:text-gray-400 mb-3">{exam.description}</p>
                        )}
                      </div>
                      <button
                        onClick={() => toggleExpand(exam._id)}
                        className="p-2 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors"
                        title={isExpanded ? 'Collapse details' : 'Expand details'}
                      >
                        {isExpanded ? (
                          <ChevronUpIcon className="h-5 w-5 text-gray-600 dark:text-gray-400" />
                        ) : (
                          <ChevronDownIcon className="h-5 w-5 text-gray-600 dark:text-gray-400" />
                        )}
                      </button>
                    </div>

                    {/* Status and Dates Row */}
                    <div className="mb-4 p-3 bg-gray-50 dark:bg-gray-700/50 rounded-lg border border-gray-200 dark:border-gray-600">
                      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 text-sm">
                        <div>
                          <span className="text-gray-600 dark:text-gray-400 font-medium">Status:</span>{' '}
                          {getStatusBadge(exam)}
                        </div>
                        <div>
                          <span className="text-gray-600 dark:text-gray-400 font-medium">Created:</span>{' '}
                          <span className="text-gray-900 dark:text-white font-semibold">
                            {formatDate(exam.createdAt)}
                          </span>
                        </div>
                        <div>
                          <span className="text-gray-600 dark:text-gray-400 font-medium">Last Updated:</span>{' '}
                          <span className="text-gray-900 dark:text-white font-semibold">
                            {formatDate(exam.updatedAt)}
                          </span>
                        </div>
                        {exam.proctoring?.startTime && (
                          <div>
                            <span className="text-gray-600 dark:text-gray-400 font-medium">Scheduled Start:</span>{' '}
                            <span className="text-indigo-600 dark:text-indigo-400 font-semibold">
                              {formatDate(exam.proctoring.startTime)}
                            </span>
                          </div>
                        )}
                        {exam.proctoring?.endTime && (
                          <div>
                            <span className="text-gray-600 dark:text-gray-400 font-medium">Scheduled End:</span>{' '}
                            <span className="text-red-600 dark:text-red-400 font-semibold">
                              {formatDate(exam.proctoring.endTime)}
                            </span>
                          </div>
                        )}
                      </div>
                    </div>

                    {/* Quick Stats */}
                    <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-4 text-sm">
                      <div className="bg-blue-50 dark:bg-blue-900/20 p-3 rounded-lg">
                        <div className="text-gray-600 dark:text-gray-400 text-xs font-medium">Questions</div>
                        <div className="text-lg font-bold text-blue-600 dark:text-blue-400">{questions.length}</div>
                      </div>
                      <div className="bg-green-50 dark:bg-green-900/20 p-3 rounded-lg">
                        <div className="text-gray-600 dark:text-gray-400 text-xs font-medium">Total Points</div>
                        <div className="text-lg font-bold text-green-600 dark:text-green-400">{totalPoints}</div>
                      </div>
                      <div className="bg-purple-50 dark:bg-purple-900/20 p-3 rounded-lg">
                        <div className="text-gray-600 dark:text-gray-400 text-xs font-medium">Sections</div>
                        <div className="text-lg font-bold text-purple-600 dark:text-purple-400">{sections.length}</div>
                      </div>
                      <div className="bg-orange-50 dark:bg-orange-900/20 p-3 rounded-lg">
                        <div className="text-gray-600 dark:text-gray-400 text-xs font-medium">Duration</div>
                        <div className="text-lg font-bold text-orange-600 dark:text-orange-400">
                          {exam.proctoring?.durationMinutes || 0}m
                        </div>
                      </div>
                      {exam.proctoring?.startTime && (
                        <div className="bg-indigo-50 dark:bg-indigo-900/20 p-3 rounded-lg">
                          <div className="text-gray-600 dark:text-gray-400 text-xs font-medium">Start Date</div>
                          <div className="text-xs font-semibold text-indigo-600 dark:text-indigo-400">
                            {new Date(exam.proctoring.startTime).toLocaleDateString()}
                          </div>
                          <div className="text-xs text-indigo-600 dark:text-indigo-400">
                            {new Date(exam.proctoring.startTime).toLocaleTimeString()}
                          </div>
                        </div>
                      )}
                      {exam.proctoring?.endTime && (
                        <div className="bg-red-50 dark:bg-red-900/20 p-3 rounded-lg">
                          <div className="text-gray-600 dark:text-gray-400 text-xs font-medium">End Date</div>
                          <div className="text-xs font-semibold text-red-600 dark:text-red-400">
                            {new Date(exam.proctoring.endTime).toLocaleDateString()}
                          </div>
                          <div className="text-xs text-red-600 dark:text-red-400">
                            {new Date(exam.proctoring.endTime).toLocaleTimeString()}
                          </div>
                        </div>
                      )}
                    </div>

                    {/* Action Buttons */}
                    <div className="flex flex-wrap gap-3 mt-4">
                      <button
                        onClick={() => navigate(`${basePath}/classes/${classId}/exams/${exam._id}/report`)}
                        className="px-4 py-2 bg-green-500 text-white rounded-lg hover:bg-green-600 transition-colors text-sm font-semibold"
                      >
                        View Report
                      </button>
                      <button
                        onClick={() => navigate(`${basePath}/classes/${classId}/exams/${exam._id}/edit`)}
                        className="px-4 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600 transition-colors text-sm font-semibold"
                        title="Edit exam"
                      >
                        Edit
                      </button>
                      <button
                        onClick={() => handleDelete(exam._id)}
                        className="px-4 py-2 bg-red-500 text-white rounded-lg hover:bg-red-600 transition-colors text-sm font-semibold"
                      >
                        Delete
                      </button>
                    </div>
                  </div>

                  {/* Expanded Details */}
                  {isExpanded && (
                    <div className="p-6 bg-gray-50 dark:bg-gray-900/50 border-t border-gray-200 dark:border-gray-700">
                      <div className="space-y-6">
                        {/* Sections Details */}
                        {sections.length > 0 && (
                          <div>
                            <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-3">Sections</h3>
                            <div className="grid gap-3">
                              {sections.map((section, idx) => {
                                const sectionQuestions = questions.filter(q => q.sectionId === section.sectionId);
                                const sectionPoints = sectionQuestions.reduce((sum, q) => sum + (q.points || 0), 0);
                                return (
                                  <div key={section.sectionId} className="bg-white dark:bg-gray-800 p-4 rounded-lg border border-gray-200 dark:border-gray-700">
                                    <div className="flex justify-between items-start mb-2">
                                      <div>
                                        <h4 className="font-semibold text-gray-900 dark:text-white">
                                          {section.title || `Section ${idx + 1}`}
                                        </h4>
                                        {section.description && (
                                          <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">{section.description}</p>
                                        )}
                                      </div>
                                      <span className="px-2 py-1 bg-indigo-100 text-indigo-700 rounded text-xs font-semibold">
                                        Order: {section.order}
                                      </span>
                                    </div>
                                    <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mt-3 text-sm">
                                      <div>
                                        <span className="text-gray-600 dark:text-gray-400">Questions:</span>{' '}
                                        <span className="font-semibold">{sectionQuestions.length}</span>
                                      </div>
                                      <div>
                                        <span className="text-gray-600 dark:text-gray-400">Points:</span>{' '}
                                        <span className="font-semibold">{sectionPoints}</span>
                                      </div>
                                      <div>
                                        <span className="text-gray-600 dark:text-gray-400">Duration:</span>{' '}
                                        <span className="font-semibold">{formatDuration(section.durationSeconds)}</span>
                                      </div>
                                      <div>
                                        <span className="text-gray-600 dark:text-gray-400">Revisit:</span>{' '}
                                        <span className="font-semibold">{section.allowRevisit ? 'Yes' : 'No'}</span>
                                      </div>
                                    </div>
                                  </div>
                                );
                              })}
                            </div>
                          </div>
                        )}

                        {/* Questions Breakdown */}
                        {questions.length > 0 && (
                          <div>
                            <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-3">
                              Questions ({questions.length})
                            </h3>
                            <div className="bg-white dark:bg-gray-800 p-4 rounded-lg border border-gray-200 dark:border-gray-700">
                              <div className="space-y-2">
                                {questions.map((q, idx) => (
                                  <div key={idx} className="flex justify-between items-center py-2 border-b border-gray-100 dark:border-gray-700 last:border-0">
                                    <div className="flex items-center gap-3">
                                      <span className="font-semibold text-gray-700 dark:text-gray-300">Q{idx + 1}</span>
                                      <span className="text-sm text-gray-600 dark:text-gray-400">
                                        Section: {q.sectionId || 'N/A'}
                                      </span>
                                    </div>
                                    <div className="flex items-center gap-4 text-sm">
                                      <span className="text-gray-600 dark:text-gray-400">
                                        Points: <span className="font-semibold">{q.points || 0}</span>
                                      </span>
                                      {q.timeLimitSeconds && (
                                        <span className="text-gray-600 dark:text-gray-400">
                                          Timer: <span className="font-semibold">{formatDuration(q.timeLimitSeconds)}</span>
                                        </span>
                                      )}
                                      <span className="text-gray-600 dark:text-gray-400">
                                        Order: <span className="font-semibold">{q.order}</span>
                                      </span>
                                    </div>
                                  </div>
                                ))}
                              </div>
                            </div>
                          </div>
                        )}

                        {/* Proctoring Settings */}
                        <div>
                          <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-3">Proctoring Settings</h3>
                          <div className="bg-white dark:bg-gray-800 p-4 rounded-lg border border-gray-200 dark:border-gray-700">
                            <div className="grid grid-cols-2 md:grid-cols-3 gap-4 text-sm">
                              <div>
                                <span className="text-gray-600 dark:text-gray-400">Auto Submit:</span>{' '}
                                <span className={`font-semibold ${exam.proctoring?.autoSubmitOnEnd ? 'text-green-600' : 'text-red-600'}`}>
                                  {exam.proctoring?.autoSubmitOnEnd ? 'Yes' : 'No'}
                                </span>
                              </div>
                              <div>
                                <span className="text-gray-600 dark:text-gray-400">Tab Switch Limit:</span>{' '}
                                <span className="font-semibold">{exam.proctoring?.tabSwitchLimit || 'Unlimited'}</span>
                              </div>
                              <div>
                                <span className="text-gray-600 dark:text-gray-400">Copy/Paste:</span>{' '}
                                <span className={`font-semibold ${exam.proctoring?.copyPasteDisabled ? 'text-red-600' : 'text-green-600'}`}>
                                  {exam.proctoring?.copyPasteDisabled ? 'Disabled' : 'Enabled'}
                                </span>
                              </div>
                              <div>
                                <span className="text-gray-600 dark:text-gray-400">Fullscreen Required:</span>{' '}
                                <span className={`font-semibold ${exam.proctoring?.fullscreenRequired ? 'text-green-600' : 'text-gray-600'}`}>
                                  {exam.proctoring?.fullscreenRequired ? 'Yes' : 'No'}
                                </span>
                              </div>
                              <div>
                                <span className="text-gray-600 dark:text-gray-400">Internet Required:</span>{' '}
                                <span className={`font-semibold ${exam.proctoring?.internetRequired ? 'text-green-600' : 'text-gray-600'}`}>
                                  {exam.proctoring?.internetRequired ? 'Yes' : 'No'}
                                </span>
                              </div>
                              <div>
                                <span className="text-gray-600 dark:text-gray-400">Allow Run Code:</span>{' '}
                                <span className={`font-semibold ${exam.proctoring?.allowRunCode ? 'text-green-600' : 'text-red-600'}`}>
                                  {exam.proctoring?.allowRunCode ? 'Yes' : 'No'}
                                </span>
                              </div>
                            </div>
                          </div>
                        </div>

                        {/* Scoring Settings */}
                        <div>
                          <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-3">Scoring Settings</h3>
                          <div className="bg-white dark:bg-gray-800 p-4 rounded-lg border border-gray-200 dark:border-gray-700">
                            <div className="grid grid-cols-2 md:grid-cols-3 gap-4 text-sm">
                              <div>
                                <span className="text-gray-600 dark:text-gray-400">Grading Mode:</span>{' '}
                                <span className="font-semibold capitalize">{exam.scoring?.gradingMode || 'auto'}</span>
                              </div>
                              <div>
                                <span className="text-gray-600 dark:text-gray-400">Score Release:</span>{' '}
                                <span className={`font-semibold ${
                                  exam.scoring?.releaseStatus === 'released' ? 'text-green-600' : 'text-yellow-600'
                                }`}>
                                  {exam.scoring?.releaseStatus === 'released' ? 'Released' : 'Not Released'}
                                </span>
                              </div>
                              <div>
                                <span className="text-gray-600 dark:text-gray-400">Immediate Release:</span>{' '}
                                <span className={`font-semibold ${exam.scoring?.immediateScoreRelease ? 'text-green-600' : 'text-gray-600'}`}>
                                  {exam.scoring?.immediateScoreRelease ? 'Yes' : 'No'}
                                </span>
                              </div>
                            </div>
                          </div>
                        </div>

                        {/* Template Info */}
                        {exam.template?.baseTemplateId && (
                          <div>
                            <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-3">Template Information</h3>
                            <div className="bg-white dark:bg-gray-800 p-4 rounded-lg border border-gray-200 dark:border-gray-700">
                              <p className="text-sm text-gray-600 dark:text-gray-400">
                                This exam was created from a template.
                              </p>
                            </div>
                          </div>
                        )}

                        {/* Metadata */}
                        <div>
                          <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-3">Metadata</h3>
                          <div className="bg-white dark:bg-gray-800 p-4 rounded-lg border border-gray-200 dark:border-gray-700">
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
                              <div>
                                <span className="text-gray-600 dark:text-gray-400">Created:</span>{' '}
                                <span className="font-semibold">{formatDate(exam.createdAt)}</span>
                              </div>
                              <div>
                                <span className="text-gray-600 dark:text-gray-400">Last Updated:</span>{' '}
                                <span className="font-semibold">{formatDate(exam.updatedAt)}</span>
                              </div>
                            </div>
                          </div>
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
};

export default ExamManagement;

