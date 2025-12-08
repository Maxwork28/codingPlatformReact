import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useSelector } from 'react-redux';
import CodeEditor from '../components/CodeEditor';
import { 
  startExam, 
  getExamAttempt, 
  submitExamAnswer, 
  submitExam, 
  logProctoringEvent,
  updateSectionTimer,
  updateQuestionTimer,
  autoSubmitExam
} from '../../../common/services/api';
import parse from 'html-react-parser';

const ExamTaking = () => {
  const { examId } = useParams();
  const navigate = useNavigate();
  const { user } = useSelector((state) => state.auth);
  
  const [exam, setExam] = useState(null);
  const [attempt, setAttempt] = useState(null);
  const [questions, setQuestions] = useState([]);
  const [currentQuestionIndex, setCurrentQuestionIndex] = useState(0);
  const [answers, setAnswers] = useState({});
  const [languages, setLanguages] = useState({});
  
  // Timers
  const [totalTimeRemaining, setTotalTimeRemaining] = useState(0);
  const [sectionTimeRemaining, setSectionTimeRemaining] = useState(0);
  const [questionTimeRemaining, setQuestionTimeRemaining] = useState(0);
  
  // Security
  const [tabSwitchCount, setTabSwitchCount] = useState(0);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [networkStatus, setNetworkStatus] = useState('online');
  const [violations, setViolations] = useState([]);
  
  // UI State
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [showSubmitConfirm, setShowSubmitConfirm] = useState(false);
  const [alerts, setAlerts] = useState([]);
  
  const heartbeatIntervalRef = useRef(null);
  const timerIntervalRef = useRef(null);
  const attemptIdRef = useRef(null);
  const isSubmittingRef = useRef(false);

  // Initialize exam
  useEffect(() => {
    const initializeExam = async () => {
      try {
        setLoading(true);
        const response = await startExam(examId);
        const { exam: examData, attempt: attemptData, questionDetails } = response.data;
        
        setExam(examData);
        setAttempt(attemptData);
        setQuestions(questionDetails);
        attemptIdRef.current = attemptData._id;
        
        // Initialize answers and languages
        const initialAnswers = {};
        const initialLanguages = {};
        questionDetails.forEach((q, idx) => {
          if (q.type === 'coding' || q.type === 'fillInTheBlanksCoding' || q.type === 'codingWithDriver') {
            initialLanguages[q._id] = q.languages?.[0] || 'javascript';
            initialAnswers[q._id] = q.starterCode?.find(sc => sc.language === initialLanguages[q._id])?.code || 
                                   q.templateCode?.find(tc => tc.language === initialLanguages[q._id])?.code || '';
          } else {
            initialAnswers[q._id] = '';
          }
        });
        setAnswers(initialAnswers);
        setLanguages(initialLanguages);
        
        // Initialize timers
        if (attemptData.endsAt) {
          const endsAt = new Date(attemptData.endsAt);
          const now = new Date();
          setTotalTimeRemaining(Math.max(0, Math.floor((endsAt - now) / 1000)));
        }
        
        // Start security features
        if (examData.proctoring?.fullscreenRequired) {
          requestFullscreen();
        }
        
        const copyPasteCleanup = disableCopyPaste();
        const tabSwitchCleanup = setupTabSwitchDetection();
        const networkCleanup = setupNetworkMonitoring();
        startHeartbeat();
        startTimers();
        
        // Store cleanup functions
        return () => {
          if (copyPasteCleanup) copyPasteCleanup();
          if (tabSwitchCleanup) tabSwitchCleanup();
          if (networkCleanup) networkCleanup();
          cleanup();
        };
        
        setLoading(false);
      } catch (error) {
        console.error('Failed to start exam:', error);
        alert(error.message || 'Failed to start exam');
        navigate(-1);
      }
    };

    initializeExam();

    return () => {
      cleanup();
    };
  }, [examId, navigate]);

  // Request fullscreen
  const requestFullscreen = () => {
    const element = document.documentElement;
    if (element.requestFullscreen) {
      element.requestFullscreen().then(() => {
        setIsFullscreen(true);
      }).catch(() => {
        addAlert('warning', 'Please enable fullscreen mode to continue');
      });
    }
  };

  // Disable copy/paste
  const disableCopyPaste = () => {
    if (!exam?.proctoring?.copyPasteDisabled) return;
    
    const handleCopy = (e) => {
      e.preventDefault();
      logViolation('copy_paste', { action: 'copy' });
      addAlert('warning', 'Copy is disabled during the exam');
    };
    
    const handlePaste = (e) => {
      e.preventDefault();
      logViolation('copy_paste', { action: 'paste' });
      addAlert('warning', 'Paste is disabled during the exam');
    };
    
    const handleCut = (e) => {
      e.preventDefault();
      logViolation('copy_paste', { action: 'cut' });
    };
    
    document.addEventListener('copy', handleCopy);
    document.addEventListener('paste', handlePaste);
    document.addEventListener('cut', handleCut);
    
    return () => {
      document.removeEventListener('copy', handleCopy);
      document.removeEventListener('paste', handlePaste);
      document.removeEventListener('cut', handleCut);
    };
  };

  // Tab switch detection
  const setupTabSwitchDetection = () => {
    const handleVisibilityChange = () => {
      if (document.hidden) {
        const newCount = tabSwitchCount + 1;
        setTabSwitchCount(newCount);
        logViolation('tab_switch', { count: newCount });
        
        if (newCount >= (exam?.proctoring?.tabSwitchLimit || 5)) {
          handleTermination('Maximum tab switches exceeded');
        } else {
          addAlert('warning', `Warning: Tab switch detected (${newCount}/${exam?.proctoring?.tabSwitchLimit || 5})`);
        }
      }
    };
    
    const handleBlur = () => {
      if (!document.hidden) {
        const newCount = tabSwitchCount + 1;
        setTabSwitchCount(newCount);
        logViolation('tab_switch', { count: newCount });
        
        if (newCount >= (exam?.proctoring?.tabSwitchLimit || 5)) {
          handleTermination('Maximum tab switches exceeded');
        }
      }
    };
    
    document.addEventListener('visibilitychange', handleVisibilityChange);
    window.addEventListener('blur', handleBlur);
    
    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      window.removeEventListener('blur', handleBlur);
    };
  };

  // Fullscreen exit detection
  useEffect(() => {
    const handleFullscreenChange = () => {
      const isCurrentlyFullscreen = !!(
        document.fullscreenElement ||
        document.webkitFullscreenElement ||
        document.mozFullScreenElement ||
        document.msFullscreenElement
      );
      
      if (!isCurrentlyFullscreen && exam?.proctoring?.fullscreenRequired) {
        setIsFullscreen(false);
        logViolation('fullscreen_exit', {});
        addAlert('error', 'Please return to fullscreen mode');
        requestFullscreen();
      } else {
        setIsFullscreen(isCurrentlyFullscreen);
      }
    };
    
    document.addEventListener('fullscreenchange', handleFullscreenChange);
    document.addEventListener('webkitfullscreenchange', handleFullscreenChange);
    document.addEventListener('mozfullscreenchange', handleFullscreenChange);
    document.addEventListener('MSFullscreenChange', handleFullscreenChange);
    
    return () => {
      document.removeEventListener('fullscreenchange', handleFullscreenChange);
      document.removeEventListener('webkitfullscreenchange', handleFullscreenChange);
      document.removeEventListener('mozfullscreenchange', handleFullscreenChange);
      document.removeEventListener('MSFullscreenChange', handleFullscreenChange);
    };
  }, [exam]);

  // Network monitoring
  const setupNetworkMonitoring = () => {
    const handleOnline = () => {
      setNetworkStatus('online');
    };
    
    const handleOffline = () => {
      setNetworkStatus('offline');
      logViolation('network_loss', {});
      addAlert('warning', 'Network connection lost');
    };
    
    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);
    
    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  };

  // Heartbeat
  const startHeartbeat = () => {
    heartbeatIntervalRef.current = setInterval(async () => {
      if (attemptIdRef.current && !isSubmittingRef.current) {
        try {
          await logProctoringEvent(examId, {
            attemptId: attemptIdRef.current,
            type: 'heartbeat',
            details: {}
          });
        } catch (error) {
          console.error('Heartbeat failed:', error);
        }
      }
    }, 30000); // Every 30 seconds
  };

  // Log violation
  const logViolation = async (type, details) => {
    if (!attemptIdRef.current) return;
    
    try {
      const response = await logProctoringEvent(examId, {
        attemptId: attemptIdRef.current,
        type,
        details
      });
      
      if (response.data.terminate) {
        handleTermination('Exam terminated due to violation');
      }
      
      setViolations(prev => [...prev, { type, details, timestamp: new Date() }]);
    } catch (error) {
      console.error('Failed to log violation:', error);
    }
  };

  // Timer management
  const startTimers = () => {
    timerIntervalRef.current = setInterval(() => {
      if (!attempt) return;
      
      // Update total timer
      if (attempt.endsAt) {
        const endsAt = new Date(attempt.endsAt);
        const now = new Date();
        const remaining = Math.max(0, Math.floor((endsAt - now) / 1000));
        setTotalTimeRemaining(remaining);
        
        if (remaining === 0 && !isSubmittingRef.current) {
          handleAutoSubmit();
        }
      }
      
      // Update section timer
      const currentSection = attempt.sectionTimers?.find(
        st => st.sectionId === attempt.currentSectionId
      );
      if (currentSection && currentSection.remainingSeconds !== null) {
        const remaining = Math.max(0, currentSection.remainingSeconds - 1);
        setSectionTimeRemaining(remaining);
        
        // Sync with backend every 30 seconds
        if (remaining % 30 === 0 && remaining > 0) {
          updateSectionTimer(examId, {
            attemptId: attemptIdRef.current,
            sectionId: currentSection.sectionId,
            remainingSeconds: remaining,
            completed: false
          }).catch(err => console.error('Failed to sync section timer:', err));
        }
        
        if (remaining === 0 && !currentSection.completed) {
          updateSectionTimer(examId, {
            attemptId: attemptIdRef.current,
            sectionId: currentSection.sectionId,
            remainingSeconds: 0,
            completed: true
          }).catch(err => console.error('Failed to update section timer:', err));
        }
      }
      
      // Update question timer
      const currentQ = questions[currentQuestionIndex];
      if (currentQ) {
        const questionTimer = attempt.questionTimers?.find(
          qt => String(qt.questionId) === String(currentQ._id)
        );
        if (questionTimer && questionTimer.remainingSeconds !== null) {
          const remaining = Math.max(0, questionTimer.remainingSeconds - 1);
          setQuestionTimeRemaining(remaining);
          
          // Sync with backend every 30 seconds
          if (remaining % 30 === 0 && remaining > 0) {
            updateQuestionTimer(examId, {
              attemptId: attemptIdRef.current,
              questionId: currentQ._id,
              remainingSeconds: remaining,
              completed: false
            }).catch(err => console.error('Failed to sync question timer:', err));
          }
          
          if (remaining === 0 && !questionTimer.completed) {
            updateQuestionTimer(examId, {
              attemptId: attemptIdRef.current,
              questionId: currentQ._id,
              remainingSeconds: 0,
              completed: true
            }).catch(err => console.error('Failed to update question timer:', err));
          }
        }
      }
    }, 1000);
  };

  // Format time
  const formatTime = (seconds) => {
    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    const secs = seconds % 60;
    return `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  // Handle answer change
  const handleAnswerChange = (questionId, value) => {
    setAnswers(prev => ({
      ...prev,
      [questionId]: value
    }));
  };

  // Handle language change
  const handleLanguageChange = (questionId, language) => {
    setLanguages(prev => ({
      ...prev,
      [questionId]: language
    }));
    
    const question = questions.find(q => q._id === questionId);
    if (question) {
      const newCode = question.starterCode?.find(sc => sc.language === language)?.code ||
                     question.templateCode?.find(tc => tc.language === language)?.code ||
                     '';
      handleAnswerChange(questionId, newCode);
    }
  };

  // Submit answer for current question
  const handleSubmitAnswer = async () => {
    const currentQ = questions[currentQuestionIndex];
    if (!currentQ || !attemptIdRef.current) return;
    
    try {
      setSubmitting(true);
      const answer = answers[currentQ._id] || '';
      const language = languages[currentQ._id];
      
      const response = await submitExamAnswer(examId, {
        attemptId: attemptIdRef.current,
        questionId: currentQ._id,
        answer,
        language
      });
      
      addAlert('success', 'Answer submitted successfully');
      
      // Update attempt with new answer data
      if (response.data.attempt) {
        setAttempt(response.data.attempt);
      }
    } catch (error) {
      console.error('Failed to submit answer:', error);
      addAlert('error', error.message || 'Failed to submit answer');
    } finally {
      setSubmitting(false);
    }
  };

  // Submit entire exam
  const handleSubmitExam = async () => {
    if (!attemptIdRef.current || isSubmittingRef.current) return;
    
    const confirmed = window.confirm('Are you sure you want to submit the exam? This action cannot be undone.');
    if (!confirmed) return;
    
    try {
      isSubmittingRef.current = true;
      setSubmitting(true);
      
      await submitExam(examId, attemptIdRef.current);
      
      addAlert('success', 'Exam submitted successfully');
      setTimeout(() => {
        navigate(`/student/exams/${examId}/results`);
      }, 2000);
    } catch (error) {
      console.error('Failed to submit exam:', error);
      addAlert('error', error.message || 'Failed to submit exam');
      isSubmittingRef.current = false;
      setSubmitting(false);
    }
  };

  // Auto submit
  const handleAutoSubmit = async () => {
    if (isSubmittingRef.current || !attemptIdRef.current) return;
    
    try {
      isSubmittingRef.current = true;
      addAlert('warning', 'Time is up! Auto-submitting exam...');
      
      await autoSubmitExam(examId, attemptIdRef.current);
      
      setTimeout(() => {
        navigate(`/student/exams/${examId}/results`);
      }, 2000);
    } catch (error) {
      console.error('Failed to auto submit:', error);
      addAlert('error', 'Failed to auto submit. Please contact administrator.');
    }
  };

  // Handle termination
  const handleTermination = (reason) => {
    alert(`Exam terminated: ${reason}`);
    handleAutoSubmit();
  };

  // Navigation
  const goToQuestion = (index) => {
    if (index >= 0 && index < questions.length) {
      setCurrentQuestionIndex(index);
      
      // Update current question in attempt
      const question = questions[index];
      if (question && attemptIdRef.current) {
        updateSectionTimer(examId, {
          attemptId: attemptIdRef.current,
          sectionId: question.sectionId,
          currentQuestionId: question._id
        });
      }
    }
  };

  // Add alert
  const addAlert = (type, message) => {
    const id = Date.now();
    setAlerts(prev => [...prev, { id, type, message }]);
    
    setTimeout(() => {
      setAlerts(prev => prev.filter(alert => alert.id !== id));
    }, 5000);
  };

  // Cleanup
  const cleanup = () => {
    if (heartbeatIntervalRef.current) {
      clearInterval(heartbeatIntervalRef.current);
    }
    if (timerIntervalRef.current) {
      clearInterval(timerIntervalRef.current);
    }
  };

  // Prevent navigation away
  useEffect(() => {
    const handleBeforeUnload = (e) => {
      if (!isSubmittingRef.current) {
        e.preventDefault();
        e.returnValue = 'Are you sure you want to leave? Your progress may be lost.';
        return e.returnValue;
      }
    };
    
    window.addEventListener('beforeunload', handleBeforeUnload);
    return () => window.removeEventListener('beforeunload', handleBeforeUnload);
  }, []);

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-xl">Loading exam...</div>
      </div>
    );
  }

  if (!exam || !attempt || questions.length === 0) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-xl text-red-500">Failed to load exam</div>
      </div>
    );
  }

  const currentQuestion = questions[currentQuestionIndex];
  const currentAnswer = answers[currentQuestion._id] || '';
  const currentLanguage = languages[currentQuestion._id] || currentQuestion.languages?.[0] || 'javascript';

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
      {/* Alert Container */}
      <div className="fixed top-4 right-4 z-50 space-y-2">
        {alerts.map(alert => (
          <div
            key={alert.id}
            className={`p-4 rounded-lg shadow-lg ${
              alert.type === 'success' ? 'bg-green-500' :
              alert.type === 'error' ? 'bg-red-500' :
              alert.type === 'warning' ? 'bg-yellow-500' :
              'bg-blue-500'
            } text-white`}
          >
            {alert.message}
          </div>
        ))}
      </div>

      {/* Header with Timers */}
      <div className="bg-white dark:bg-gray-800 shadow-md p-4 sticky top-0 z-40">
        <div className="flex justify-between items-center">
          <div>
            <h1 className="text-2xl font-bold">{exam.title}</h1>
            <p className="text-sm text-gray-600 dark:text-gray-400">{exam.description}</p>
          </div>
          
          <div className="flex gap-4 items-center">
            {/* Total Timer */}
            <div className={`px-4 py-2 rounded ${
              totalTimeRemaining < 300 ? 'bg-red-500 text-white' :
              totalTimeRemaining < 600 ? 'bg-yellow-500 text-white' :
              'bg-blue-500 text-white'
            }`}>
              <div className="text-xs">Total Time</div>
              <div className="text-xl font-bold">{formatTime(totalTimeRemaining)}</div>
            </div>
            
            {/* Section Timer */}
            {sectionTimeRemaining > 0 && (
              <div className="px-4 py-2 rounded bg-purple-500 text-white">
                <div className="text-xs">Section Time</div>
                <div className="text-xl font-bold">{formatTime(sectionTimeRemaining)}</div>
              </div>
            )}
            
            {/* Question Timer */}
            {questionTimeRemaining > 0 && (
              <div className="px-4 py-2 rounded bg-indigo-500 text-white">
                <div className="text-xs">Question Time</div>
                <div className="text-xl font-bold">{formatTime(questionTimeRemaining)}</div>
              </div>
            )}
            
            {/* Security Indicators */}
            <div className="flex gap-2">
              {!isFullscreen && exam.proctoring?.fullscreenRequired && (
                <div className="px-3 py-1 bg-red-500 text-white rounded text-sm">
                  Fullscreen Required
                </div>
              )}
              {networkStatus === 'offline' && (
                <div className="px-3 py-1 bg-red-500 text-white rounded text-sm">
                  Offline
                </div>
              )}
              {tabSwitchCount > 0 && (
                <div className="px-3 py-1 bg-yellow-500 text-white rounded text-sm">
                  Tab Switches: {tabSwitchCount}/{exam.proctoring?.tabSwitchLimit || 5}
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      <div className="container mx-auto px-4 py-6">
        <div className="grid grid-cols-12 gap-6">
          {/* Question List Sidebar */}
          <div className="col-span-3">
            <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-4 sticky top-24">
              <h2 className="text-lg font-bold mb-4">Questions</h2>
              <div className="space-y-2 max-h-96 overflow-y-auto">
                {questions.map((q, idx) => {
                  const isAnswered = answers[q._id] && answers[q._id].toString().trim() !== '';
                  const isCurrent = idx === currentQuestionIndex;
                  
                  return (
                    <button
                      key={q._id}
                      onClick={() => goToQuestion(idx)}
                      className={`w-full text-left p-2 rounded ${
                        isCurrent ? 'bg-blue-500 text-white' :
                        isAnswered ? 'bg-green-100 dark:bg-green-900' :
                        'bg-gray-100 dark:bg-gray-700'
                      }`}
                    >
                      <div className="flex justify-between items-center">
                        <span>Q{idx + 1}</span>
                        {isAnswered && <span className="text-xs">✓</span>}
                      </div>
                    </button>
                  );
                })}
              </div>
              
              <button
                onClick={() => setShowSubmitConfirm(true)}
                disabled={submitting || isSubmittingRef.current}
                className="mt-4 w-full bg-red-500 text-white py-2 rounded hover:bg-red-600 disabled:opacity-50"
              >
                Submit Exam
              </button>
            </div>
          </div>

          {/* Main Question Area */}
          <div className="col-span-9">
            <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6">
              {/* Question Header */}
              <div className="mb-6">
                <div className="flex justify-between items-start mb-4">
                  <h2 className="text-2xl font-bold">
                    Question {currentQuestionIndex + 1} of {questions.length}
                  </h2>
                  <div className="text-sm text-gray-600 dark:text-gray-400">
                    Points: {exam.questions.find(q => String(q.questionId) === String(currentQuestion._id))?.points || currentQuestion.points}
                  </div>
                </div>
                
                <h3 className="text-xl font-semibold mb-2">{currentQuestion.title}</h3>
                <div className="prose dark:prose-invert max-w-none">
                  {parse(currentQuestion.description || '')}
                </div>
              </div>

              {/* Answer Area */}
              <div className="mb-6">
                {currentQuestion.type === 'singleCorrectMcq' && (
                  <div className="space-y-2">
                    {currentQuestion.options?.map((option, idx) => (
                      <label key={idx} className="flex items-center p-3 border rounded cursor-pointer hover:bg-gray-50 dark:hover:bg-gray-700">
                        <input
                          type="radio"
                          name={`question-${currentQuestion._id}`}
                          value={idx}
                          checked={answers[currentQuestion._id] === idx.toString()}
                          onChange={(e) => handleAnswerChange(currentQuestion._id, e.target.value)}
                          className="mr-3"
                        />
                        <span>{option}</span>
                      </label>
                    ))}
                  </div>
                )}

                {currentQuestion.type === 'multipleCorrectMcq' && (
                  <div className="space-y-2">
                    {currentQuestion.options?.map((option, idx) => (
                      <label key={idx} className="flex items-center p-3 border rounded cursor-pointer hover:bg-gray-50 dark:hover:bg-gray-700">
                        <input
                          type="checkbox"
                          checked={Array.isArray(answers[currentQuestion._id]) && answers[currentQuestion._id].includes(idx.toString())}
                          onChange={(e) => {
                            const current = Array.isArray(answers[currentQuestion._id]) ? answers[currentQuestion._id] : [];
                            const updated = e.target.checked
                              ? [...current, idx.toString()]
                              : current.filter(v => v !== idx.toString());
                            handleAnswerChange(currentQuestion._id, updated);
                          }}
                          className="mr-3"
                        />
                        <span>{option}</span>
                      </label>
                    ))}
                  </div>
                )}

                {currentQuestion.type === 'fillInTheBlanks' && (
                  <input
                    type="text"
                    value={currentAnswer}
                    onChange={(e) => handleAnswerChange(currentQuestion._id, e.target.value)}
                    className="w-full p-3 border rounded dark:bg-gray-700 dark:border-gray-600"
                    placeholder="Enter your answer"
                  />
                )}

                {(currentQuestion.type === 'coding' || 
                  currentQuestion.type === 'fillInTheBlanksCoding' || 
                  currentQuestion.type === 'codingWithDriver') && (
                  <div>
                    {currentQuestion.languages && currentQuestion.languages.length > 1 && (
                      <select
                        value={currentLanguage}
                        onChange={(e) => handleLanguageChange(currentQuestion._id, e.target.value)}
                        className="mb-4 p-2 border rounded dark:bg-gray-700 dark:border-gray-600"
                      >
                        {currentQuestion.languages.map(lang => (
                          <option key={lang} value={lang}>{lang}</option>
                        ))}
                      </select>
                    )}
                    
                    {currentQuestion.type === 'codingWithDriver' && currentQuestion.driverCode && (
                      <div className="mb-4 p-4 bg-gray-100 dark:bg-gray-700 rounded-lg">
                        <h4 className="font-semibold mb-2">Driver Code (Read-only):</h4>
                        <pre className="text-sm overflow-x-auto">
                          <code>{currentQuestion.driverCode}</code>
                        </pre>
                        <p className="text-sm text-gray-600 dark:text-gray-400 mt-2">
                          Note: You need to write your solution that works with this driver code.
                        </p>
                      </div>
                    )}
                    
                    <CodeEditor
                      value={currentAnswer}
                      onChange={(value) => handleAnswerChange(currentQuestion._id, value)}
                      language={currentLanguage}
                      height="500px"
                      isFillInTheBlanks={currentQuestion.type === 'fillInTheBlanksCoding'}
                    />
                  </div>
                )}
              </div>

              {/* Navigation Buttons */}
              <div className="flex justify-between mt-6">
                <button
                  onClick={() => goToQuestion(currentQuestionIndex - 1)}
                  disabled={currentQuestionIndex === 0}
                  className="px-6 py-2 bg-gray-500 text-white rounded hover:bg-gray-600 disabled:opacity-50"
                >
                  Previous
                </button>
                
                <button
                  onClick={handleSubmitAnswer}
                  disabled={submitting}
                  className="px-6 py-2 bg-blue-500 text-white rounded hover:bg-blue-600 disabled:opacity-50"
                >
                  {submitting ? 'Submitting...' : 'Submit Answer'}
                </button>
                
                <button
                  onClick={() => goToQuestion(currentQuestionIndex + 1)}
                  disabled={currentQuestionIndex === questions.length - 1}
                  className="px-6 py-2 bg-gray-500 text-white rounded hover:bg-gray-600 disabled:opacity-50"
                >
                  Next
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Submit Confirmation Modal */}
      {showSubmitConfirm && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white dark:bg-gray-800 rounded-lg p-6 max-w-md">
            <h2 className="text-2xl font-bold mb-4">Confirm Submission</h2>
            <p className="mb-6">Are you sure you want to submit the exam? This action cannot be undone.</p>
            <div className="flex gap-4">
              <button
                onClick={() => setShowSubmitConfirm(false)}
                className="flex-1 px-4 py-2 bg-gray-500 text-white rounded hover:bg-gray-600"
              >
                Cancel
              </button>
              <button
                onClick={handleSubmitExam}
                className="flex-1 px-4 py-2 bg-red-500 text-white rounded hover:bg-red-600"
              >
                Submit Exam
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default ExamTaking;

