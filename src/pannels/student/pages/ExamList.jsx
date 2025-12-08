import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { listClassExams, startExam } from '../../../common/services/api';

const ExamList = () => {
  const { classId } = useParams();
  const navigate = useNavigate();
  
  const [exams, setExams] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [selectedExam, setSelectedExam] = useState(null);
  const [showDetailsModal, setShowDetailsModal] = useState(false);

  useEffect(() => {
    const fetchExams = async () => {
      try {
        setLoading(true);
        const response = await listClassExams(classId);
        // Filter out draft exams - students shouldn't see them
        const allExams = response.data.exams || [];
        const visibleExams = allExams.filter(exam => 
          exam.status !== 'draft' && exam.status !== 'archived'
        );
        setExams(visibleExams);
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

  const handleStartExam = async (examId) => {
    try {
      await startExam(examId);
      navigate(`/student/exams/${examId}/take`);
    } catch (err) {
      alert(err.response?.data?.error || 'Failed to start exam');
    }
  };

  const getStatusBadge = (exam) => {
    if (exam.status === 'scheduled') {
      return <span className="px-2 py-1 bg-yellow-500 text-white rounded text-xs">Scheduled</span>;
    } else if (exam.status === 'active') {
      return <span className="px-2 py-1 bg-green-500 text-white rounded text-xs">Active</span>;
    } else if (exam.status === 'completed') {
      return <span className="px-2 py-1 bg-gray-500 text-white rounded text-xs">Completed</span>;
    }
    return <span className="px-2 py-1 bg-blue-500 text-white rounded text-xs">{exam.status}</span>;
  };

  const getAttemptStatusBadge = (status) => {
    if (!status) {
      return <span className="px-2 py-1 bg-gray-400 text-white rounded text-xs">Not Started</span>;
    } else if (status === 'in_progress') {
      return <span className="px-2 py-1 bg-yellow-500 text-white rounded text-xs">In Progress</span>;
    } else if (status === 'submitted' || status === 'auto_submitted') {
      return <span className="px-2 py-1 bg-green-500 text-white rounded text-xs">Submitted</span>;
    } else if (status === 'terminated') {
      return <span className="px-2 py-1 bg-red-500 text-white rounded text-xs">Terminated</span>;
    }
    return <span className="px-2 py-1 bg-gray-400 text-white rounded text-xs">{status}</span>;
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-xl">Loading exams...</div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-xl text-red-500">{error}</div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900 py-8">
      <div className="container mx-auto px-4">
        <div className="mb-6">
          <h1 className="text-3xl font-bold mb-2">Exams</h1>
          <button
            onClick={() => navigate(-1)}
            className="text-blue-500 hover:underline"
          >
            ← Back
          </button>
        </div>

        {exams.length === 0 ? (
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-8 text-center">
            <p className="text-gray-600 dark:text-gray-400">No exams available</p>
          </div>
        ) : (
          <div className="grid gap-4">
            {exams.map((exam) => (
              <div
                key={exam._id}
                className="bg-white dark:bg-gray-800 rounded-lg shadow p-6"
              >
                <div className="flex justify-between items-start mb-4">
                  <div>
                    <h2 className="text-2xl font-bold mb-2">{exam.title}</h2>
                    <p className="text-gray-600 dark:text-gray-400">{exam.description}</p>
                  </div>
                  <div className="flex gap-2">
                    {getStatusBadge(exam)}
                    {getAttemptStatusBadge(exam.studentAttemptStatus)}
                  </div>
                </div>

                <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-4 text-sm">
                  <div>
                    <span className="font-semibold">Duration:</span>{' '}
                    {exam.proctoring?.durationMinutes || 0} minutes
                  </div>
                  <div>
                    <span className="font-semibold">Questions:</span>{' '}
                    {exam.questions?.length || 0}
                  </div>
                  {exam.proctoring?.startTime && (
                    <div>
                      <span className="font-semibold">Start Time:</span>{' '}
                      {new Date(exam.proctoring.startTime).toLocaleString()}
                    </div>
                  )}
                  {exam.proctoring?.endTime && (
                    <div>
                      <span className="font-semibold">End Time:</span>{' '}
                      {new Date(exam.proctoring.endTime).toLocaleString()}
                    </div>
                  )}
                </div>

                <div className="flex gap-4">
                  <button
                    onClick={() => {
                      setSelectedExam(exam);
                      setShowDetailsModal(true);
                    }}
                    className="px-4 py-2 bg-gray-500 text-white rounded hover:bg-gray-600"
                  >
                    View Details
                  </button>
                  {exam.studentAttemptStatus === 'not_started' && (
                    (exam.status === 'active' || 
                     (exam.status === 'scheduled' && exam.proctoring?.startTime && 
                      new Date(exam.proctoring.startTime) <= new Date())) && (
                      <button
                        onClick={() => handleStartExam(exam._id)}
                        className="px-4 py-2 bg-blue-500 text-white rounded hover:bg-blue-600"
                      >
                        Start Exam
                      </button>
                    )
                  )}
                  {exam.studentAttemptStatus === 'in_progress' && (
                    <button
                      onClick={() => navigate(`/student/exams/${exam._id}/take`)}
                      className="px-4 py-2 bg-yellow-500 text-white rounded hover:bg-yellow-600"
                    >
                      Continue Exam
                    </button>
                  )}
                  {(exam.studentAttemptStatus === 'submitted' || 
                    exam.studentAttemptStatus === 'auto_submitted' ||
                    exam.studentAttemptStatus === 'terminated') && (
                    <button
                      onClick={() => navigate(`/student/exams/${exam._id}/results`)}
                      className="px-4 py-2 bg-green-500 text-white rounded hover:bg-green-600"
                    >
                      View Results
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Exam Details Modal */}
        {showDetailsModal && selectedExam && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
            <div className="bg-white dark:bg-gray-800 rounded-lg shadow-xl max-w-2xl w-full mx-4 max-h-[90vh] overflow-y-auto">
              <div className="p-6">
                <div className="flex justify-between items-start mb-4">
                  <h2 className="text-2xl font-bold">{selectedExam.title}</h2>
                  <button
                    onClick={() => setShowDetailsModal(false)}
                    className="text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200"
                  >
                    ✕
                  </button>
                </div>

                <div className="space-y-4">
                  {selectedExam.description && (
                    <div>
                      <h3 className="font-semibold mb-2">Description:</h3>
                      <p className="text-gray-600 dark:text-gray-400">{selectedExam.description}</p>
                    </div>
                  )}

                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <span className="font-semibold">Duration: </span>
                      <span>{selectedExam.proctoring?.durationMinutes || 0} minutes</span>
                    </div>
                    <div>
                      <span className="font-semibold">Total Questions: </span>
                      <span>{selectedExam.questions?.length || 0}</span>
                    </div>
                    {selectedExam.proctoring?.startTime && (
                      <div>
                        <span className="font-semibold">Start Time: </span>
                        <span>{new Date(selectedExam.proctoring.startTime).toLocaleString()}</span>
                      </div>
                    )}
                    {selectedExam.proctoring?.endTime && (
                      <div>
                        <span className="font-semibold">End Time: </span>
                        <span>{new Date(selectedExam.proctoring.endTime).toLocaleString()}</span>
                      </div>
                    )}
                  </div>

                  {selectedExam.sections && selectedExam.sections.length > 0 && (
                    <div>
                      <h3 className="font-semibold mb-2">Sections:</h3>
                      <ul className="list-disc list-inside space-y-1">
                        {selectedExam.sections.map((section, idx) => (
                          <li key={section.sectionId} className="text-sm">
                            {section.title} 
                            {section.durationSeconds > 0 && (
                              <span className="text-gray-500">
                                {' '}({Math.round(section.durationSeconds / 60)} minutes)
                              </span>
                            )}
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}

                  <div>
                    <h3 className="font-semibold mb-2">Instructions:</h3>
                    <ul className="list-disc list-inside space-y-1 text-sm text-gray-600 dark:text-gray-400">
                      {selectedExam.proctoring?.fullscreenRequired && (
                        <li>Exam must be taken in fullscreen mode</li>
                      )}
                      {selectedExam.proctoring?.copyPasteDisabled && (
                        <li>Copy and paste is disabled</li>
                      )}
                      {selectedExam.proctoring?.tabSwitchLimit && (
                        <li>Tab switching is limited to {selectedExam.proctoring.tabSwitchLimit} times</li>
                      )}
                      {selectedExam.proctoring?.autoSubmitOnEnd && (
                        <li>Exam will auto-submit when time ends</li>
                      )}
                      {selectedExam.proctoring?.allowRunCode && (
                        <li>You can run code during the exam</li>
                      )}
                    </ul>
                  </div>
                </div>

                <div className="mt-6 flex justify-end gap-2">
                  {selectedExam.studentAttemptStatus === 'not_started' && (
                    (selectedExam.status === 'active' || 
                     (selectedExam.status === 'scheduled' && selectedExam.proctoring?.startTime && 
                      new Date(selectedExam.proctoring.startTime) <= new Date())) && (
                      <button
                        onClick={() => {
                          setShowDetailsModal(false);
                          handleStartExam(selectedExam._id);
                        }}
                        className="px-4 py-2 bg-blue-500 text-white rounded hover:bg-blue-600"
                      >
                        Start Exam
                      </button>
                    )
                  )}
                  <button
                    onClick={() => setShowDetailsModal(false)}
                    className="px-4 py-2 bg-gray-500 text-white rounded hover:bg-gray-600"
                  >
                    Close
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default ExamList;

