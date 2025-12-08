import React, { useState, useEffect } from 'react';
import { useParams, useNavigate, useLocation } from 'react-router-dom';
import { getExamDetails, editExam, getAllQuestions } from '../../../common/services/api';

const EditExam = () => {
  const { examId, classId } = useParams();
  const navigate = useNavigate();
  const location = useLocation();
  
  // Detect if admin or teacher based on URL path
  const isAdmin = location.pathname.includes('/admin/');
  const basePath = isAdmin ? '/admin' : '/teacher';
  
  const [exam, setExam] = useState(null);
  const [formData, setFormData] = useState({
    title: '',
    description: '',
    questions: [],
    sections: [],
    proctoring: {
      durationMinutes: 60,
      startTime: '',
      endTime: '',
      autoSubmitOnEnd: true,
      tabSwitchLimit: 5,
      copyPasteDisabled: true,
      fullscreenRequired: true,
      internetRequired: true,
      allowRunCode: true
    },
    scoring: {
      immediateScoreRelease: false,
      gradingMode: 'auto'
    }
  });
  
  const [availableQuestions, setAvailableQuestions] = useState([]);
  const [selectedQuestions, setSelectedQuestions] = useState([]);
  const [questionSearchQuery, setQuestionSearchQuery] = useState('');
  const [questionTypeFilter, setQuestionTypeFilter] = useState('all');
  const [previewQuestion, setPreviewQuestion] = useState(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [step, setStep] = useState(1);

  useEffect(() => {
    const fetchData = async () => {
      try {
        setLoading(true);
        const [examRes, questionsRes] = await Promise.all([
          getExamDetails(examId),
          getAllQuestions()
        ]);
        
        const examData = examRes.data.exam;
        setExam(examData);
        setAvailableQuestions(questionsRes.data.questions || []);
        
        // Check if exam can be edited (only draft exams can be fully edited)
        if (examData.status !== 'draft') {
          alert('Only draft exams can be edited. This exam is in ' + examData.status + ' status.');
          // Still allow viewing but disable editing
        }
        
        // Populate form with existing exam data
        setFormData({
          title: examData.title || '',
          description: examData.description || '',
          questions: examData.questions || [],
          sections: examData.sections || [],
          proctoring: {
            durationMinutes: examData.proctoring?.durationMinutes || 60,
            startTime: examData.proctoring?.startTime ? new Date(examData.proctoring.startTime).toISOString().slice(0, 16) : '',
            endTime: examData.proctoring?.endTime ? new Date(examData.proctoring.endTime).toISOString().slice(0, 16) : '',
            autoSubmitOnEnd: examData.proctoring?.autoSubmitOnEnd ?? true,
            tabSwitchLimit: examData.proctoring?.tabSwitchLimit ?? 5,
            copyPasteDisabled: examData.proctoring?.copyPasteDisabled ?? true,
            fullscreenRequired: examData.proctoring?.fullscreenRequired ?? true,
            internetRequired: examData.proctoring?.internetRequired ?? true,
            allowRunCode: examData.proctoring?.allowRunCode ?? true
          },
          scoring: {
            immediateScoreRelease: examData.scoring?.immediateScoreRelease ?? false,
            gradingMode: examData.scoring?.gradingMode || 'auto'
          }
        });
        
        setSelectedQuestions(examData.questions || []);
        setLoading(false);
      } catch (error) {
        console.error('Failed to fetch data:', error);
        alert(error.response?.data?.error || 'Failed to load exam');
        navigate(-1);
      }
    };

    fetchData();
  }, [examId, navigate]);

  const handleInputChange = (field, value) => {
    if (field.includes('.')) {
      const [parent, child] = field.split('.');
      setFormData(prev => ({
        ...prev,
        [parent]: {
          ...prev[parent],
          [child]: value
        }
      }));
    } else {
      setFormData(prev => ({
        ...prev,
        [field]: value
      }));
    }
  };

  const handleAddQuestion = (question, sectionId = null) => {
    // Prevent duplicate question selection
    if (selectedQuestions.find(q => q.questionId === question._id)) {
      alert('This question is already added to the exam');
      return;
    }
    const questionMeta = {
      questionId: question._id,
      points: question.points || 10,
      order: selectedQuestions.length,
      sectionId: sectionId || formData.sections[0]?.sectionId || 'section-1',
      timeLimitSeconds: null
    };
    setSelectedQuestions([...selectedQuestions, questionMeta]);
  };

  const handleRemoveQuestion = (questionId) => {
    setSelectedQuestions(selectedQuestions.filter(q => q.questionId !== questionId));
  };

  const handleQuestionChange = (questionId, field, value) => {
    setSelectedQuestions(selectedQuestions.map(q => 
      q.questionId === questionId ? { ...q, [field]: value } : q
    ));
  };

  const handleMoveQuestion = (questionId, direction) => {
    const currentIndex = selectedQuestions.findIndex(q => q.questionId === questionId);
    if (currentIndex === -1) return;

    const newIndex = direction === 'up' ? currentIndex - 1 : currentIndex + 1;
    if (newIndex < 0 || newIndex >= selectedQuestions.length) return;

    const newQuestions = [...selectedQuestions];
    [newQuestions[currentIndex], newQuestions[newIndex]] = [newQuestions[newIndex], newQuestions[currentIndex]];
    
    // Update order values
    newQuestions.forEach((q, idx) => {
      q.order = idx;
    });
    
    setSelectedQuestions(newQuestions);
  };

  const handleAddSection = () => {
    const newSection = {
      sectionId: `section-${formData.sections.length + 1}`,
      title: `Section ${formData.sections.length + 1}`,
      description: '',
      durationSeconds: 0,
      allowRevisit: true,
      order: formData.sections.length
    };
    setFormData(prev => ({
      ...prev,
      sections: [...prev.sections, newSection]
    }));
  };

  const handleRemoveSection = (index) => {
    const updated = formData.sections.filter((_, i) => i !== index);
    setFormData(prev => ({ ...prev, sections: updated }));
  };

  const handleSectionChange = (index, field, value) => {
    const updated = [...formData.sections];
    updated[index] = { ...updated[index], [field]: value };
    setFormData(prev => ({ ...prev, sections: updated }));
  };

  const validateSectionDurations = () => {
    if (formData.sections.length === 0) return true;
    const totalSectionSeconds = formData.sections.reduce(
      (sum, s) => sum + (s.durationSeconds || 0), 
      0
    );
    const totalExamSeconds = (formData.proctoring.durationMinutes || 0) * 60;
    return totalSectionSeconds <= totalExamSeconds;
  };

  const handleSubmit = async () => {
    if (!formData.title) {
      alert('Please fill in all required fields');
      return;
    }

    if (selectedQuestions.length === 0) {
      alert('Please add at least one question');
      return;
    }

    try {
      setSaving(true);
      
      // Convert datetime-local strings to ISO strings for backend
      // datetime-local format: "YYYY-MM-DDTHH:mm"
      let startTimeISO = null;
      let endTimeISO = null;
      
      if (formData.proctoring.startTime && formData.proctoring.startTime.trim() !== '') {
        try {
          const startDate = new Date(formData.proctoring.startTime);
          if (!isNaN(startDate.getTime())) {
            startTimeISO = startDate.toISOString();
          }
        } catch (error) {
          console.error('Error parsing startTime:', error);
        }
      }
      
      if (formData.proctoring.endTime && formData.proctoring.endTime.trim() !== '') {
        try {
          const endDate = new Date(formData.proctoring.endTime);
          if (!isNaN(endDate.getTime())) {
            endTimeISO = endDate.toISOString();
          }
        } catch (error) {
          console.error('Error parsing endTime:', error);
        }
      }
      
      const processedProctoring = {
        ...formData.proctoring,
        startTime: startTimeISO,
        endTime: endTimeISO
      };
      
      console.log('Processed proctoring data for edit:', {
        startTime: startTimeISO,
        endTime: endTimeISO,
        originalStartTime: formData.proctoring.startTime,
        originalEndTime: formData.proctoring.endTime
      });
      
      const examData = {
        ...formData,
        proctoring: processedProctoring,
        questions: selectedQuestions
      };
      
      await editExam(examId, examData);
      alert('Exam updated successfully!');
      // Navigate back to exam management
      if (classId) {
        navigate(`${basePath}/classes/${classId}/exams`);
      } else {
        // If no classId, try to get it from exam data
        if (exam && exam.classId) {
          navigate(`${basePath}/classes/${exam.classId}/exams`);
        } else {
          navigate(-1);
        }
      }
    } catch (error) {
      console.error('Failed to update exam:', error);
      alert(error.response?.data?.error || 'Failed to update exam');
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-xl">Loading exam...</div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900 py-8">
      <div className="container mx-auto px-4 max-w-6xl">
        <div className="mb-6">
          <button
            onClick={() => {
              if (classId) {
                navigate(`${basePath}/classes/${classId}/exams`);
              } else if (exam && exam.classId) {
                navigate(`${basePath}/classes/${exam.classId}/exams`);
              } else {
                navigate(-1);
              }
            }}
            className="text-blue-500 hover:underline mb-4"
          >
            ← Back
          </button>
          <h1 className="text-3xl font-bold">Edit Exam</h1>
          {exam && exam.status !== 'draft' && (
            <div className="mt-2 p-3 bg-yellow-100 border border-yellow-400 text-yellow-700 rounded">
              ⚠️ Warning: Only draft exams can be fully edited. This exam is in <strong>{exam.status}</strong> status.
              {exam.status === 'scheduled' || exam.status === 'active' || exam.status === 'completed' ? 
                ' Editing is restricted to prevent changes to exams that students may have already started.' : ''}
            </div>
          )}
        </div>

        {/* Step Indicator */}
        <div className="mb-8">
          <div className="flex justify-between">
            {[1, 2, 3, 4].map(s => (
              <div key={s} className="flex-1">
                <div className={`h-2 rounded ${step >= s ? 'bg-blue-500' : 'bg-gray-300'}`} />
                <div className="mt-2 text-center text-sm">
                  {s === 1 && 'Basic Info'}
                  {s === 2 && 'Questions'}
                  {s === 3 && 'Sections'}
                  {s === 4 && 'Settings'}
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Step 1: Basic Info */}
        {step === 1 && (
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6">
            <h2 className="text-2xl font-bold mb-4">Basic Information</h2>
            
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium mb-2">Exam Title *</label>
                <input
                  type="text"
                  value={formData.title}
                  onChange={(e) => handleInputChange('title', e.target.value)}
                  className="w-full p-2 border rounded dark:bg-gray-700 dark:border-gray-600"
                  required
                />
              </div>

              <div>
                <label className="block text-sm font-medium mb-2">Description</label>
                <textarea
                  value={formData.description}
                  onChange={(e) => handleInputChange('description', e.target.value)}
                  className="w-full p-2 border rounded dark:bg-gray-700 dark:border-gray-600"
                  rows={4}
                />
              </div>

              <div>
                <label className="block text-sm font-medium mb-2">Total Duration (minutes) *</label>
                <input
                  type="number"
                  value={formData.proctoring.durationMinutes}
                  onChange={(e) => handleInputChange('proctoring.durationMinutes', parseInt(e.target.value))}
                  className="w-full p-2 border rounded dark:bg-gray-700 dark:border-gray-600"
                  min={1}
                  required
                />
              </div>
            </div>

            <div className="mt-6 flex justify-end">
              <button
                onClick={() => setStep(2)}
                className="px-6 py-2 bg-blue-500 text-white rounded hover:bg-blue-600"
              >
                Next: Questions
              </button>
            </div>
          </div>
        )}

        {/* Step 2: Questions */}
        {step === 2 && (
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6">
            <h2 className="text-2xl font-bold mb-4">Select Questions</h2>
            
            <div className="grid grid-cols-2 gap-6">
              {/* Available Questions */}
              <div>
                <h3 className="text-lg font-semibold mb-2">Available Questions</h3>
                {/* Search and Filter Inputs */}
                <div className="mb-3 space-y-2">
                  <input
                    type="text"
                    value={questionSearchQuery}
                    onChange={(e) => setQuestionSearchQuery(e.target.value)}
                    placeholder="Search questions by title, type, or tags..."
                    className="w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 dark:bg-gray-700 dark:border-gray-600 dark:text-white"
                  />
                  <select
                    value={questionTypeFilter}
                    onChange={(e) => setQuestionTypeFilter(e.target.value)}
                    className="w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 dark:bg-gray-700 dark:border-gray-600 dark:text-white"
                  >
                    <option value="all">All Types</option>
                    <option value="singleCorrectMcq">Single Choice MCQ</option>
                    <option value="multipleCorrectMcq">Multiple Choice MCQ</option>
                    <option value="fillInTheBlanks">Fill in the Blanks</option>
                    <option value="fillInTheBlanksCoding">Fill in the Blanks (Coding)</option>
                    <option value="coding">Coding</option>
                    <option value="codingWithDriver">Coding with Driver</option>
                  </select>
                </div>
                <div className="border rounded p-4 max-h-96 overflow-y-auto">
                  {(() => {
                    // Filter questions based on search query and type filter
                    let filteredQuestions = availableQuestions.filter(q => 
                      !selectedQuestions.find(sq => sq.questionId === q._id)
                    );

                    // Apply type filter
                    if (questionTypeFilter !== 'all') {
                      filteredQuestions = filteredQuestions.filter(q => q.type === questionTypeFilter);
                    }

                    // Apply search query
                    if (questionSearchQuery !== '') {
                      const searchLower = questionSearchQuery.toLowerCase();
                      filteredQuestions = filteredQuestions.filter(q => {
                        return (
                          q.title?.toLowerCase().includes(searchLower) ||
                          q.type?.toLowerCase().includes(searchLower) ||
                          q.tags?.some(tag => tag.toLowerCase().includes(searchLower)) ||
                          q.description?.toLowerCase().includes(searchLower)
                        );
                      });
                    }
                    
                    return filteredQuestions.length === 0 ? (
                      <div className="text-center py-8 text-gray-500 dark:text-gray-400">
                        {questionSearchQuery ? 'No questions found matching your search.' : 'No available questions.'}
                      </div>
                    ) : (
                      filteredQuestions.map(q => (
                        <div
                          key={q._id}
                          className="p-2 mb-2 border rounded hover:bg-gray-50 dark:hover:bg-gray-700"
                        >
                          <div className="flex justify-between items-start">
                            <div className="flex-1">
                              <div 
                                className="cursor-pointer"
                                onClick={() => handleAddQuestion(q)}
                              >
                                <div className="font-semibold">{q.title}</div>
                                <div className="text-sm text-gray-600 dark:text-gray-400">
                                  {q.type} • {q.points} points
                                </div>
                              </div>
                              {formData.sections.length > 0 && (
                                <div className="mt-2">
                                  <label className="text-xs text-gray-500">Add to section:</label>
                                  <select
                                    onClick={(e) => e.stopPropagation()}
                                    onChange={(e) => {
                                      e.stopPropagation();
                                      handleAddQuestion(q, e.target.value);
                                    }}
                                    className="mt-1 w-full text-xs p-1 border rounded dark:bg-gray-700 dark:border-gray-600"
                                    defaultValue={formData.sections[0]?.sectionId || 'section-1'}
                                  >
                                    {formData.sections.map(section => (
                                      <option key={section.sectionId} value={section.sectionId}>
                                        {section.title}
                                      </option>
                                    ))}
                                  </select>
                                </div>
                              )}
                            </div>
                            <div className="flex flex-col gap-1">
                              <button
                                onClick={(e) => {
                                  e.stopPropagation();
                                  setPreviewQuestion(q);
                                }}
                                className="px-2 py-1 text-xs bg-gray-200 dark:bg-gray-700 text-gray-700 dark:text-gray-300 rounded hover:bg-gray-300 dark:hover:bg-gray-600"
                              >
                                Preview
                              </button>
                              <button
                                onClick={(e) => {
                                  e.stopPropagation();
                                  handleAddQuestion(q);
                                }}
                                className="px-2 py-1 text-xs bg-blue-200 dark:bg-blue-900 text-blue-700 dark:text-blue-300 rounded hover:bg-blue-300 dark:hover:bg-blue-800"
                              >
                                Add
                              </button>
                            </div>
                          </div>
                        </div>
                      ))
                    );
                  })()}
                </div>
              </div>

              {/* Selected Questions */}
              <div>
                <h3 className="text-lg font-semibold mb-2">Selected Questions ({selectedQuestions.length})</h3>
                <div className="border rounded p-4 max-h-96 overflow-y-auto">
                  {selectedQuestions.length === 0 ? (
                    <div className="text-center py-8 text-gray-500 dark:text-gray-400">
                      No questions selected. Click on questions from the left to add them.
                    </div>
                  ) : (
                    selectedQuestions.map((q, idx) => {
                      const question = availableQuestions.find(aq => aq._id === q.questionId);
                      return (
                        <div key={q.questionId} className="p-2 mb-2 border rounded">
                          <div className="flex justify-between items-start mb-2">
                            <div className="flex-1">
                              <div className="font-semibold">{question?.title || 'Question'}</div>
                              <div className="text-sm text-gray-600 dark:text-gray-400">
                                {question?.type} • Order: {idx + 1}
                              </div>
                            </div>
                            <div className="flex gap-1">
                              <button
                                onClick={() => handleMoveQuestion(q.questionId, 'up')}
                                disabled={idx === 0}
                                className="px-2 py-1 text-xs bg-gray-200 dark:bg-gray-700 text-gray-700 dark:text-gray-300 rounded hover:bg-gray-300 dark:hover:bg-gray-600 disabled:opacity-50 disabled:cursor-not-allowed"
                                title="Move up"
                              >
                                ↑
                              </button>
                              <button
                                onClick={() => handleMoveQuestion(q.questionId, 'down')}
                                disabled={idx === selectedQuestions.length - 1}
                                className="px-2 py-1 text-xs bg-gray-200 dark:bg-gray-700 text-gray-700 dark:text-gray-300 rounded hover:bg-gray-300 dark:hover:bg-gray-600 disabled:opacity-50 disabled:cursor-not-allowed"
                                title="Move down"
                              >
                                ↓
                              </button>
                              <button
                                onClick={() => handleRemoveQuestion(q.questionId)}
                                className="px-2 py-1 text-xs bg-red-200 dark:bg-red-900 text-red-700 dark:text-red-300 rounded hover:bg-red-300 dark:hover:bg-red-800"
                                title="Remove"
                              >
                                ✕
                              </button>
                            </div>
                          </div>
                          <div className="space-y-2">
                            <div>
                              <label className="text-xs">Points:</label>
                              <input
                                type="number"
                                value={q.points}
                                onChange={(e) => {
                                  const value = parseInt(e.target.value);
                                  if (value > 0) {
                                    handleQuestionChange(q.questionId, 'points', value);
                                  }
                                }}
                                className="w-full p-1 border rounded text-sm"
                                min={1}
                              />
                            </div>
                            <div>
                              <label className="text-xs">Question Time Limit (seconds, optional):</label>
                              <input
                                type="number"
                                value={q.timeLimitSeconds || ''}
                                onChange={(e) => handleQuestionChange(q.questionId, 'timeLimitSeconds', e.target.value ? parseInt(e.target.value) : null)}
                                className="w-full p-1 border rounded text-sm"
                                min={0}
                              />
                            </div>
                            <div>
                              <label className="text-xs">Section:</label>
                              <select
                                value={q.sectionId || 'section-1'}
                                onChange={(e) => handleQuestionChange(q.questionId, 'sectionId', e.target.value)}
                                className="w-full p-1 border rounded text-sm"
                              >
                                {formData.sections.length === 0 ? (
                                  <option value="section-1">Default Section</option>
                                ) : (
                                  formData.sections.map(section => (
                                    <option key={section.sectionId} value={section.sectionId}>
                                      {section.title}
                                    </option>
                                  ))
                                )}
                              </select>
                            </div>
                          </div>
                        </div>
                      );
                    })
                  )}
                </div>
              </div>
            </div>

            <div className="mt-6 flex justify-between">
              <button
                onClick={() => setStep(1)}
                className="px-6 py-2 bg-gray-500 text-white rounded hover:bg-gray-600"
              >
                Back
              </button>
              <button
                onClick={() => setStep(3)}
                disabled={selectedQuestions.length === 0 || (exam && exam.status !== 'draft')}
                className="px-6 py-2 bg-blue-500 text-white rounded hover:bg-blue-600 disabled:opacity-50"
                title={exam && exam.status !== 'draft' ? 'Only draft exams can be edited' : ''}
              >
                Next: Sections
              </button>
            </div>
          </div>
        )}

        {/* Step 3: Sections */}
        {step === 3 && (
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6">
            <h2 className="text-2xl font-bold mb-4">Sections</h2>
            
            <div className="mb-4">
              <button
                onClick={handleAddSection}
                className="px-4 py-2 bg-green-500 text-white rounded hover:bg-green-600"
              >
                Add Section
              </button>
            </div>

            {formData.sections.length === 0 && (
              <div className="text-center py-8 text-gray-500">
                No sections added. Questions will be in a default section.
              </div>
            )}

            <div className="space-y-4">
              {formData.sections.map((section, idx) => (
                <div key={section.sectionId} className="border rounded p-4">
                  <div className="flex justify-between items-start mb-2">
                    <h3 className="font-semibold">Section {idx + 1}</h3>
                    <button
                      onClick={() => handleRemoveSection(idx)}
                      className="text-red-500 hover:text-red-700 text-sm"
                    >
                      Remove
                    </button>
                  </div>
                  <div className="space-y-2">
                    <div>
                      <label className="text-sm font-medium">Section Title:</label>
                      <input
                        type="text"
                        value={section.title}
                        onChange={(e) => handleSectionChange(idx, 'title', e.target.value)}
                        className="w-full p-2 border rounded dark:bg-gray-700 dark:border-gray-600"
                      />
                    </div>
                    <div>
                      <label className="text-sm font-medium">Description:</label>
                      <textarea
                        value={section.description}
                        onChange={(e) => handleSectionChange(idx, 'description', e.target.value)}
                        className="w-full p-2 border rounded dark:bg-gray-700 dark:border-gray-600"
                        rows={2}
                      />
                    </div>
                    <div className="grid grid-cols-2 gap-2">
                      <div>
                        <label className="text-sm font-medium">Duration (seconds):</label>
                        <input
                          type="number"
                          value={section.durationSeconds}
                          onChange={(e) => handleSectionChange(idx, 'durationSeconds', parseInt(e.target.value))}
                          className="w-full p-2 border rounded dark:bg-gray-700 dark:border-gray-600"
                          min={0}
                        />
                      </div>
                      <div>
                        <label className="text-sm font-medium">Allow Revisit:</label>
                        <select
                          value={section.allowRevisit}
                          onChange={(e) => handleSectionChange(idx, 'allowRevisit', e.target.value === 'true')}
                          className="w-full p-2 border rounded dark:bg-gray-700 dark:border-gray-600"
                        >
                          <option value="true">Yes</option>
                          <option value="false">No</option>
                        </select>
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>

            {formData.sections.length > 0 && !validateSectionDurations() && (
              <div className="mb-4 p-3 bg-red-100 border border-red-400 text-red-700 rounded">
                ⚠️ Warning: Total section durations ({Math.round(
                  formData.sections.reduce((sum, s) => sum + (s.durationSeconds || 0), 0) / 60
                )} minutes) exceed exam duration ({formData.proctoring.durationMinutes} minutes)
              </div>
            )}

            <div className="mt-6 flex justify-between">
              <button
                onClick={() => setStep(2)}
                className="px-6 py-2 bg-gray-500 text-white rounded hover:bg-gray-600"
              >
                Back
              </button>
              <button
                onClick={() => setStep(4)}
                disabled={exam && exam.status !== 'draft'}
                className="px-6 py-2 bg-blue-500 text-white rounded hover:bg-blue-600 disabled:opacity-50"
                title={exam && exam.status !== 'draft' ? 'Only draft exams can be edited' : ''}
              >
                Next: Settings
              </button>
            </div>
          </div>
        )}

        {/* Step 4: Settings */}
        {step === 4 && (
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6">
            <h2 className="text-2xl font-bold mb-4">Proctoring & Scoring Settings</h2>
            
            <div className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium mb-2 text-gray-900 dark:text-white">
                    Start Time (optional)
                  </label>
                  <p className="text-xs text-gray-500 dark:text-gray-400 mb-2">
                    When the exam becomes available to students
                  </p>
                  <div className="relative">
                    <input
                      type="datetime-local"
                      value={formData.proctoring.startTime}
                      onChange={(e) => handleInputChange('proctoring.startTime', e.target.value)}
                      className="w-full px-4 py-3 border-2 border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 dark:bg-gray-700 dark:border-gray-600 dark:text-white text-base"
                      style={{ 
                        minHeight: '44px',
                        colorScheme: 'light'
                      }}
                    />
                    {!formData.proctoring.startTime && (
                      <div className="absolute inset-0 flex items-center px-4 pointer-events-none">
                        <span className="text-sm text-gray-400 dark:text-gray-500">
                          Click to select date and time
                        </span>
                      </div>
                    )}
                  </div>
                  {formData.proctoring.startTime && (
                    <p className="mt-2 text-sm text-gray-700 dark:text-gray-300 font-medium">
                      📅 Scheduled: {new Date(formData.proctoring.startTime).toLocaleString('en-US', {
                        weekday: 'short',
                        year: 'numeric',
                        month: 'short',
                        day: 'numeric',
                        hour: '2-digit',
                        minute: '2-digit'
                      })}
                    </p>
                  )}
                </div>
                <div>
                  <label className="block text-sm font-medium mb-2 text-gray-900 dark:text-white">
                    End Time (optional)
                  </label>
                  <p className="text-xs text-gray-500 dark:text-gray-400 mb-2">
                    When the exam closes and becomes unavailable
                  </p>
                  <div className="relative">
                    <input
                      type="datetime-local"
                      value={formData.proctoring.endTime}
                      onChange={(e) => handleInputChange('proctoring.endTime', e.target.value)}
                      className="w-full px-4 py-3 border-2 border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 dark:bg-gray-700 dark:border-gray-600 dark:text-white text-base"
                      min={formData.proctoring.startTime || undefined}
                      style={{ 
                        minHeight: '44px',
                        colorScheme: 'light'
                      }}
                    />
                    {!formData.proctoring.endTime && (
                      <div className="absolute inset-0 flex items-center px-4 pointer-events-none">
                        <span className="text-sm text-gray-400 dark:text-gray-500">
                          Click to select date and time
                        </span>
                      </div>
                    )}
                  </div>
                  {formData.proctoring.endTime && (
                    <p className="mt-2 text-sm text-gray-700 dark:text-gray-300 font-medium">
                      📅 Scheduled: {new Date(formData.proctoring.endTime).toLocaleString('en-US', {
                        weekday: 'short',
                        year: 'numeric',
                        month: 'short',
                        day: 'numeric',
                        hour: '2-digit',
                        minute: '2-digit'
                      })}
                    </p>
                  )}
                  {formData.proctoring.startTime && formData.proctoring.endTime && 
                   new Date(formData.proctoring.endTime) <= new Date(formData.proctoring.startTime) && (
                    <p className="mt-2 text-sm text-red-600 dark:text-red-400 font-medium">
                      ⚠️ End time must be after start time
                    </p>
                  )}
                  {formData.proctoring.startTime && formData.proctoring.endTime && 
                   new Date(formData.proctoring.endTime) > new Date(formData.proctoring.startTime) && (
                    <p className="mt-2 text-sm text-green-600 dark:text-green-400 font-medium">
                      ✓ Duration: {Math.round((new Date(formData.proctoring.endTime) - new Date(formData.proctoring.startTime)) / (1000 * 60))} minutes
                    </p>
                  )}
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium mb-2">Tab Switch Limit</label>
                <input
                  type="number"
                  value={formData.proctoring.tabSwitchLimit}
                  onChange={(e) => handleInputChange('proctoring.tabSwitchLimit', parseInt(e.target.value))}
                  className="w-full p-2 border rounded dark:bg-gray-700 dark:border-gray-600"
                  min={0}
                />
              </div>

              <div className="space-y-2">
                <label className="flex items-center">
                  <input
                    type="checkbox"
                    checked={formData.proctoring.autoSubmitOnEnd}
                    onChange={(e) => handleInputChange('proctoring.autoSubmitOnEnd', e.target.checked)}
                    className="mr-2"
                  />
                  Auto-submit when time ends
                </label>
                <label className="flex items-center">
                  <input
                    type="checkbox"
                    checked={formData.proctoring.copyPasteDisabled}
                    onChange={(e) => handleInputChange('proctoring.copyPasteDisabled', e.target.checked)}
                    className="mr-2"
                  />
                  Disable copy/paste
                </label>
                <label className="flex items-center">
                  <input
                    type="checkbox"
                    checked={formData.proctoring.fullscreenRequired}
                    onChange={(e) => handleInputChange('proctoring.fullscreenRequired', e.target.checked)}
                    className="mr-2"
                  />
                  Require fullscreen
                </label>
                <label className="flex items-center">
                  <input
                    type="checkbox"
                    checked={formData.proctoring.internetRequired}
                    onChange={(e) => handleInputChange('proctoring.internetRequired', e.target.checked)}
                    className="mr-2"
                  />
                  Require internet connection
                </label>
                <label className="flex items-center">
                  <input
                    type="checkbox"
                    checked={formData.proctoring.allowRunCode}
                    onChange={(e) => handleInputChange('proctoring.allowRunCode', e.target.checked)}
                    className="mr-2"
                  />
                  Allow code execution during exam
                </label>
                <label className="flex items-center">
                  <input
                    type="checkbox"
                    checked={formData.scoring.immediateScoreRelease}
                    onChange={(e) => handleInputChange('scoring.immediateScoreRelease', e.target.checked)}
                    className="mr-2"
                  />
                  Release scores immediately after submission
                </label>
              </div>

              <div>
                <label className="block text-sm font-medium mb-2">Grading Mode</label>
                <select
                  value={formData.scoring.gradingMode}
                  onChange={(e) => handleInputChange('scoring.gradingMode', e.target.value)}
                  className="w-full p-2 border rounded dark:bg-gray-700 dark:border-gray-600"
                >
                  <option value="auto">Auto</option>
                  <option value="manual">Manual</option>
                  <option value="mixed">Mixed</option>
                </select>
              </div>
            </div>

            <div className="mt-6 flex justify-between">
              <button
                onClick={() => setStep(3)}
                className="px-6 py-2 bg-gray-500 text-white rounded hover:bg-gray-600"
              >
                Back
              </button>
              <button
                onClick={handleSubmit}
                disabled={saving || (exam && exam.status !== 'draft')}
                className="px-6 py-2 bg-green-500 text-white rounded hover:bg-green-600 disabled:opacity-50 disabled:cursor-not-allowed"
                title={exam && exam.status !== 'draft' ? 'Only draft exams can be edited' : 'Save changes'}
              >
                {saving ? 'Saving...' : 'Save Changes'}
              </button>
            </div>
          </div>
        )}

        {/* Question Preview Modal */}
        {previewQuestion && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
            <div className="bg-white dark:bg-gray-800 rounded-lg shadow-xl max-w-4xl w-full mx-4 max-h-[90vh] overflow-y-auto">
              <div className="p-6">
                <div className="flex justify-between items-start mb-4">
                  <h2 className="text-2xl font-bold">{previewQuestion.title}</h2>
                  <button
                    onClick={() => setPreviewQuestion(null)}
                    className="text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200"
                  >
                    ✕
                  </button>
                </div>
                
                <div className="space-y-4">
                  <div>
                    <span className="font-semibold">Type: </span>
                    <span className="px-2 py-1 bg-blue-100 dark:bg-blue-900 rounded text-sm">
                      {previewQuestion.type}
                    </span>
                    <span className="ml-4 font-semibold">Points: </span>
                    <span>{previewQuestion.points}</span>
                  </div>

                  {previewQuestion.description && (
                    <div>
                      <h3 className="font-semibold mb-2">Description:</h3>
                      <div 
                        className="prose dark:prose-invert max-w-none"
                        dangerouslySetInnerHTML={{ __html: previewQuestion.description }}
                      />
                    </div>
                  )}

                  {previewQuestion.tags && previewQuestion.tags.length > 0 && (
                    <div>
                      <h3 className="font-semibold mb-2">Tags:</h3>
                      <div className="flex flex-wrap gap-2">
                        {previewQuestion.tags.map((tag, idx) => (
                          <span key={idx} className="px-2 py-1 bg-gray-200 dark:bg-gray-700 rounded text-sm">
                            {tag}
                          </span>
                        ))}
                      </div>
                    </div>
                  )}

                  {previewQuestion.difficulty && (
                    <div>
                      <span className="font-semibold">Difficulty: </span>
                      <span className="px-2 py-1 bg-yellow-100 dark:bg-yellow-900 rounded text-sm">
                        {previewQuestion.difficulty}
                      </span>
                    </div>
                  )}

                  {previewQuestion.options && (
                    <div>
                      <h3 className="font-semibold mb-2">Options:</h3>
                      <ul className="list-disc list-inside space-y-1">
                        {previewQuestion.options.map((opt, idx) => (
                          <li key={idx} className={idx === previewQuestion.correctOption ? 'text-green-600 dark:text-green-400 font-semibold' : ''}>
                            {opt} {idx === previewQuestion.correctOption && '(Correct)'}
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}

                  {previewQuestion.starterCode && previewQuestion.starterCode.length > 0 && (
                    <div>
                      <h3 className="font-semibold mb-2">Starter Code:</h3>
                      <pre className="bg-gray-100 dark:bg-gray-900 p-4 rounded overflow-x-auto">
                        <code>{previewQuestion.starterCode[0]?.code || 'N/A'}</code>
                      </pre>
                    </div>
                  )}
                </div>

                <div className="mt-6 flex justify-end gap-2">
                  <button
                    onClick={() => {
                      handleAddQuestion(previewQuestion);
                      setPreviewQuestion(null);
                    }}
                    className="px-4 py-2 bg-blue-500 text-white rounded hover:bg-blue-600"
                  >
                    Add to Exam
                  </button>
                  <button
                    onClick={() => setPreviewQuestion(null)}
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

export default EditExam;
