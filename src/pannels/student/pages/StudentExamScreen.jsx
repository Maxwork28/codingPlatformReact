import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useLocation, useNavigate, useParams } from 'react-router-dom';
import { useSelector } from 'react-redux';
import {
  autoSubmitExam,
  getExamAttempt,
  logProctoringEvent,
  startExam,
  submitExam,
  updateSectionTimer,
  updateQuestionTimer,
  submitAnswer,
  runCode,
  runCodeWithCustomInput
} from '../../../common/services/api';
import ExamPrompt from '../../../common/components/ExamPrompt';
import QuestionWorkspace from '../components/QuestionWorkspace';

const formatDurationMs = (ms) => {
  if (ms <= 0) return '00:00';
  const totalSeconds = Math.floor(ms / 1000);
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
};

const formatSeconds = (seconds) => {
  if (seconds === null || seconds === undefined) return '∞';
  if (seconds <= 0) return '00:00';
  const mins = Math.floor(seconds / 60);
  const secs = seconds % 60;
  return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
};

const StudentExamScreen = () => {
  const { examId } = useParams();
  const navigate = useNavigate();
  const location = useLocation();
  const classIdFromState = location.state?.classId;
  const { classes } = useSelector((state) => state.classes);

  const [exam, setExam] = useState(null);
  const [attempt, setAttempt] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [totalTimerMs, setTotalTimerMs] = useState(0);
  const [offline, setOffline] = useState(!navigator.onLine);
  const [violationPrompt, setViolationPrompt] = useState(null);
  const [infoPrompt, setInfoPrompt] = useState(null);
  const [report, setReport] = useState(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isFullscreen, setIsFullscreen] = useState(() => document.fullscreenElement != null);
  const [activeSectionId, setActiveSectionId] = useState(null);
  const [activeQuestionId, setActiveQuestionId] = useState(null);
  const [questionDetails, setQuestionDetails] = useState([]);
  const [workspaceState, setWorkspaceState] = useState({
    answer: '',
    customInput: '',
    expectedOutput: '',
    showHints: false,
    showSolution: false,
    selectedLanguage: 'javascript',
    statusMessage: ''
  });
  const [workspaceBusyState, setWorkspaceBusyState] = useState({
    isSubmitting: false,
    isRunning: false,
    isRunningCustom: false
  });
  const [sectionState, setSectionState] = useState({});
  const [questionState, setQuestionState] = useState({});

  const heartbeatIntervalRef = useRef(null);
  const totalTimerIntervalRef = useRef(null);
  const countdownIntervalRef = useRef(null);
  const pendingSectionSyncRef = useRef([]);
  const pendingQuestionSyncRef = useRef([]);
  const fullscreenRequiredRef = useRef(false);
  const workspaceCacheRef = useRef(new Map());
  const totalTimerMsRef = useRef(0);
  const activeSectionIdRef = useRef(null);
  const activeQuestionIdRef = useRef(null);
  const initializationRef = useRef(false);

  const examContext = useMemo(() => ({ examId, examAttemptId: attempt?._id }), [examId, attempt?._id]);

  const classId = useMemo(() => {
    if (classIdFromState) return classIdFromState;
    if (exam?.classId) return exam.classId;
    return null;
  }, [classIdFromState, exam]);

  const classMeta = useMemo(() => classes.find((cls) => cls._id === classId), [classes, classId]);

  const sections = useMemo(() => {
    if (exam?.sections?.length) {
      return [...exam.sections].sort((a, b) => (a.order ?? 0) - (b.order ?? 0));
    }
    if (exam) {
      return [{
        sectionId: 'section-1',
        title: 'Section 1',
        description: '',
        durationSeconds: (exam.proctoring?.durationMinutes || 60) * 60,
        allowRevisit: true,
        order: 0
      }];
    }
    return [];
  }, [exam]);

  const questions = useMemo(() => (
    exam?.questions?.length
      ? [...exam.questions].sort((a, b) => (a.order ?? 0) - (b.order ?? 0))
      : []
  ), [exam]);

  const questionsBySection = useMemo(() => {
    const map = {};
    sections.forEach((section) => {
      map[section.sectionId] = [];
    });
    questions.forEach((question) => {
      const sectionId = question.sectionId && map[question.sectionId] !== undefined
        ? question.sectionId
        : sections[0]?.sectionId;
      if (sectionId) {
        map[sectionId].push(question);
      }
    });
    return map;
  }, [sections, questions]);

  const answeredQuestions = useMemo(() => {
    if (!attempt?.answers) return new Set();
    return new Set(attempt.answers.filter((ans) => ans.submissionId).map((ans) => ans.questionId.toString()));
  }, [attempt?.answers]);

  const activeSection = useMemo(() => sections.find((section) => section.sectionId === activeSectionId), [sections, activeSectionId]);
  const activeQuestion = useMemo(() => questions.find((question) => question.questionId === activeQuestionId), [questions, activeQuestionId]);
  const sectionTimer = activeSectionId ? sectionState[activeSectionId] : undefined;
  const questionTimer = activeQuestionId ? questionState[activeQuestionId] : undefined;
  const questionLocked = questionTimer && questionTimer.remainingSeconds === 0;

  const exitFullscreen = useCallback(() => {
    if (document.fullscreenElement) {
      document.exitFullscreen().catch(() => {});
    }
  }, []);

  const syncAttempt = useCallback(async () => {
    try {
      const attemptRes = await getExamAttempt(examId);
      setAttempt(attemptRes.data.attempt);
      return attemptRes.data.attempt;
    } catch (err) {
      console.error('[ExamScreen] syncAttempt error', err);
      return null;
    }
  }, [examId]);

  const handleProctorEvent = useCallback(async (type, details = {}) => {
    if (!attempt?._id) return;
    try {
      const response = await logProctoringEvent(examId, attempt._id, type, details);
      if (response.data?.terminate) {
        setViolationPrompt({
          title: 'Exam Locked',
          message: 'The exam has been locked due to repeated violations. Please contact your instructor.',
          variant: 'danger'
        });
        setAttempt((prev) => (prev ? { ...prev, status: 'terminated' } : prev));
        exitFullscreen();
      }
    } catch (err) {
      console.error('[ExamScreen] logProctoringEvent error', err);
    }
  }, [attempt?._id, examId, exitFullscreen]);

  const requestFullscreen = useCallback(async () => {
    const el = document.documentElement;
    if (el.requestFullscreen) {
      try {
        await el.requestFullscreen();
      } catch (err) {
        console.warn('[ExamScreen] Fullscreen request failed', err);
        setInfoPrompt({
          title: 'Fullscreen Required',
          message: 'Unable to enter fullscreen mode. Please use your browser\'s fullscreen option or click the fullscreen button.',
          variant: 'warning'
        });
      }
    }
  }, []);

  const initializeExam = useCallback(async () => {
    // Prevent multiple initializations
    if (initializationRef.current) return;
    if (exam && attempt) {
      initializationRef.current = true;
      return;
    }
    
    initializationRef.current = true;
    setLoading(true);
    setError(null);
    setInfoPrompt(null);
    try {
      const startRes = await startExam(examId);
      setExam(startRes.data.exam);
      setAttempt(startRes.data.attempt);
      setQuestionDetails(startRes.data.questionDetails || []);
      const remaining = new Date(startRes.data.attempt.endsAt).getTime() - Date.now();
      const totalMs = Math.max(remaining, 0);
      setTotalTimerMs(totalMs);
      totalTimerMsRef.current = totalMs;
      fullscreenRequiredRef.current = !!startRes.data.exam.proctoring?.fullscreenRequired;
      if (fullscreenRequiredRef.current && !document.fullscreenElement) {
        await requestFullscreen();
      }
      setInfoPrompt({
        title: 'Exam Started',
        message: 'The exam has begun. Please remain in fullscreen and monitor your timers carefully.',
        variant: 'info'
      });
    } catch (err) {
      console.error('[ExamScreen] initializeExam error', err);
      const message = err.response?.data?.error || 'Unable to start exam';
      setError(message);
      setInfoPrompt({
        title: 'Unable to Start Exam',
        message,
        variant: 'danger'
      });
      initializationRef.current = false; // Allow retry on error
    } finally {
      setLoading(false);
    }
  }, [examId, requestFullscreen, exam, attempt]);

  useEffect(() => {
    if (!exam || !attempt) {
      initializeExam();
    }
  }, [initializeExam, exam, attempt]);

  useEffect(() => {
    if (!attempt?.endsAt) return;
    totalTimerIntervalRef.current && clearInterval(totalTimerIntervalRef.current);

    const tick = () => {
      const remaining = new Date(attempt.endsAt).getTime() - Date.now();
      const newTotalMs = Math.max(remaining, 0);
      setTotalTimerMs(newTotalMs);
      totalTimerMsRef.current = newTotalMs;
      if (remaining <= 0) {
        clearInterval(totalTimerIntervalRef.current);
        handleAutoSubmit();
      }
    };

    tick();
    totalTimerIntervalRef.current = window.setInterval(tick, 1000);

    return () => {
      clearInterval(totalTimerIntervalRef.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [attempt?.endsAt]);

  const handleAutoSubmit = useCallback(async () => {
    if (!attempt || ['submitted', 'auto_submitted', 'terminated'].includes(attempt.status)) return;
    setIsSubmitting(true);
    try {
      await autoSubmitExam(examId, attempt._id);
      const updated = await syncAttempt();
      setAttempt(updated);
      exitFullscreen();
      // Navigate directly to exam list without showing popup
      navigate('/student/exams');
    } catch (err) {
      console.error('[ExamScreen] handleAutoSubmit error', err);
      setError(err.response?.data?.error || 'Failed to auto submit exam');
      exitFullscreen();
      navigate('/student/exams');
    } finally {
      setIsSubmitting(false);
    }
  }, [attempt, examId, exitFullscreen, navigate]);

  const handleManualSubmit = useCallback(async () => {
    if (!attempt || ['submitted', 'auto_submitted', 'terminated'].includes(attempt.status)) return;
    setIsSubmitting(true);
    try {
      await submitExam(examId, attempt._id);
      const updated = await syncAttempt();
      setAttempt(updated);
      setInfoPrompt({
        title: 'Exam Submitted',
        message: 'Your exam was submitted successfully.',
        variant: 'success'
      });
      exitFullscreen();
      if (exam?.scoring?.immediateScoreRelease || exam?.scoring?.releaseStatus === 'released') {
        setReport({ attempts: [updated] });
      }
    } catch (err) {
      console.error('[ExamScreen] handleManualSubmit error', err);
      setError(err.response?.data?.error || 'Failed to submit exam');
    } finally {
      setIsSubmitting(false);
    }
  }, [attempt, examId, exam?.scoring, exitFullscreen, syncAttempt]);

  const handleCopyEvent = useCallback((event) => {
    if (exam?.proctoring?.copyPasteDisabled) {
      event.preventDefault();
      handleProctorEvent('copy_paste');
    }
  }, [exam?.proctoring?.copyPasteDisabled, handleProctorEvent]);

  const handleVisibilityChange = useCallback(() => {
    if (document.hidden) {
      handleProctorEvent('tab_switch');
      setInfoPrompt({
        title: 'Tab Switch Detected',
        message: 'You have switched to another tab. This is a violation of exam rules. Please return to the exam immediately.',
        variant: 'warning'
      });
    } else {
      syncAttempt();
    }
  }, [handleProctorEvent, syncAttempt]);

  const handleFullscreenChange = useCallback(() => {
    const active = document.fullscreenElement != null;
    setIsFullscreen(active);
    if (!active && fullscreenRequiredRef.current) {
      handleProctorEvent('fullscreen_exit');
      setInfoPrompt({
        title: 'Fullscreen Required',
        message: 'You have exited fullscreen mode. You must attempt the exam in fullscreen mode, otherwise the test will be terminated. Please click the fullscreen button below to re-enter fullscreen.',
        variant: 'warning'
      });
    }
  }, [handleProctorEvent]);

  const handleOnlineStatus = useCallback(() => {
    const isOffline = !navigator.onLine;
    setOffline(isOffline);
    handleProctorEvent(isOffline ? 'network_loss' : 'heartbeat');
  }, [handleProctorEvent]);

  useEffect(() => {
    document.addEventListener('visibilitychange', handleVisibilityChange);
    document.addEventListener('copy', handleCopyEvent, true);
    document.addEventListener('cut', handleCopyEvent, true);
    document.addEventListener('paste', handleCopyEvent, true);
    document.addEventListener('fullscreenchange', handleFullscreenChange);
    window.addEventListener('online', handleOnlineStatus);
    window.addEventListener('offline', handleOnlineStatus);

    heartbeatIntervalRef.current = window.setInterval(() => {
      handleProctorEvent('heartbeat');
    }, 30000);

    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      document.removeEventListener('copy', handleCopyEvent, true);
      document.removeEventListener('cut', handleCopyEvent, true);
      document.removeEventListener('paste', handleCopyEvent, true);
      document.removeEventListener('fullscreenchange', handleFullscreenChange);
      window.removeEventListener('online', handleOnlineStatus);
      window.removeEventListener('offline', handleOnlineStatus);
      heartbeatIntervalRef.current && clearInterval(heartbeatIntervalRef.current);
    };
  }, [handleCopyEvent, handleFullscreenChange, handleOnlineStatus, handleProctorEvent, handleVisibilityChange]);

  useEffect(() => {
    const beforeUnloadHandler = (event) => {
      if (attempt && attempt.status === 'in_progress') {
        event.preventDefault();
        event.returnValue = 'Are you sure you want to leave? Your exam is still active.';
        return event.returnValue;
      }
    };
    window.addEventListener('beforeunload', beforeUnloadHandler);
    return () => window.removeEventListener('beforeunload', beforeUnloadHandler);
  }, [attempt]);

  useEffect(() => {
    const handleKeyDown = (event) => {
      if (event.key === 'Escape' && fullscreenRequiredRef.current && !document.fullscreenElement) {
        event.preventDefault();
        setInfoPrompt({
          title: 'Fullscreen Required',
          message: 'You must attempt the exam in fullscreen mode, otherwise the test will be terminated. Please click the fullscreen button to enter fullscreen.',
          variant: 'warning'
        });
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  useEffect(() => {
    return () => {
      countdownIntervalRef.current && clearInterval(countdownIntervalRef.current);
      if (document.fullscreenElement) {
        document.exitFullscreen().catch(() => {});
      }
    };
  }, []);

  // Initialize timers only once when exam/attempt changes, not on every totalTimerMs update
  useEffect(() => {
    if (!exam || !attempt) return;
    // Ensure sections and questions are available before initializing timers
    if (!sections.length || !questions.length) return;

    const sectionTimers = {};
    const questionTimers = {};

    const attemptSectionTimers = attempt.sectionTimers || [];
    sections.forEach((section) => {
      const existing = attemptSectionTimers.find((timer) => timer.sectionId === section.sectionId);
      const remainingSeconds = existing?.remainingSeconds ?? section.durationSeconds ?? null;
      
      const isCompleted = Boolean(existing?.completed) || (remainingSeconds !== null && remainingSeconds <= 0);
      sectionTimers[section.sectionId] = {
        remainingSeconds,
        completed: isCompleted
      };
    });

    const attemptQuestionTimers = attempt.questionTimers || [];
    questions.forEach((question) => {
      const existing = attemptQuestionTimers.find((timer) => String(timer.questionId) === String(question.questionId));
      const remainingSeconds = existing?.remainingSeconds ?? question.timeLimitSeconds ?? null;
      
      const isCompleted = Boolean(existing?.completed) || (remainingSeconds !== null && remainingSeconds <= 0);
      questionTimers[question.questionId] = {
        remainingSeconds,
        completed: isCompleted
      };
    });

    setSectionState(sectionTimers);
    setQuestionState(questionTimers);

    const newSectionId = activeSectionId || attempt.currentSectionId || sections[0]?.sectionId || null;
    const newQuestionId = activeQuestionId || attempt.currentQuestionId || questions[0]?.questionId || null;
    
    if (newSectionId && newSectionId !== activeSectionId) {
      setActiveSectionId(newSectionId);
      activeSectionIdRef.current = newSectionId;
    }
    if (newQuestionId && newQuestionId !== activeQuestionId) {
      setActiveQuestionId(newQuestionId);
      activeQuestionIdRef.current = newQuestionId;
    }
  }, [exam, attempt, sections, questions, activeSectionId, activeQuestionId]);

  // Update refs when activeSectionId/activeQuestionId change
  useEffect(() => {
    activeSectionIdRef.current = activeSectionId;
  }, [activeSectionId]);

  useEffect(() => {
    activeQuestionIdRef.current = activeQuestionId;
  }, [activeQuestionId]);

  useEffect(() => {
    if (!attempt || ['submitted', 'auto_submitted', 'terminated'].includes(attempt.status)) {
      countdownIntervalRef.current && clearInterval(countdownIntervalRef.current);
      return;
    }
    // Ensure sections and questions are available before starting countdown
    if (!sections.length || !questions.length) {
      countdownIntervalRef.current && clearInterval(countdownIntervalRef.current);
      return;
    }
    if (!activeSectionId && sections[0]) {
      const firstSectionId = sections[0].sectionId;
      setActiveSectionId(firstSectionId);
      activeSectionIdRef.current = firstSectionId;
    }
    if (!activeQuestionId && questions[0]) {
      const firstQuestionId = questions[0].questionId;
      setActiveQuestionId(firstQuestionId);
      activeQuestionIdRef.current = firstQuestionId;
    }

    countdownIntervalRef.current && clearInterval(countdownIntervalRef.current);
    countdownIntervalRef.current = window.setInterval(() => {
      // Get current total remaining seconds from ref (always up-to-date)
      const totalRemainingSeconds = totalTimerMsRef.current > 0 ? Math.floor(totalTimerMsRef.current / 1000) : 0;
      const currentSectionId = activeSectionIdRef.current;
      const currentQuestionId = activeQuestionIdRef.current;
      
      // Guard: ensure we have valid section/question IDs
      if (!currentSectionId || !currentQuestionId) return;
      
      setSectionState((prev) => {
        if (!currentSectionId || !prev[currentSectionId]) return prev;
        const current = prev[currentSectionId];
        if (current.completed || current.remainingSeconds === null) return prev;
        
        // If total time expired, expire section timer too
        if (totalRemainingSeconds <= 0) {
          return {
            ...prev,
            [currentSectionId]: {
              ...current,
              remainingSeconds: 0,
              completed: true
            }
          };
        }
        
        if (current.remainingSeconds <= 0) return prev;
        
        // Decrement normally, but cap to total remaining time
        let newRemaining = current.remainingSeconds - 1;
        if (newRemaining > totalRemainingSeconds) {
          newRemaining = totalRemainingSeconds;
        }
        
        const updated = {
          ...prev,
          [currentSectionId]: {
            ...current,
            remainingSeconds: Math.max(newRemaining, 0),
            completed: newRemaining <= 0 ? true : current.completed
          }
        };
        if (newRemaining <= 0 || newRemaining % 15 === 0) {
          pendingSectionSyncRef.current.push({
            sectionId: currentSectionId,
            remainingSeconds: Math.max(newRemaining, 0),
            completed: newRemaining <= 0 ? true : current.completed
          });
        }
        return updated;
      });

      setQuestionState((prev) => {
        if (!currentQuestionId || !prev[currentQuestionId]) return prev;
        const current = prev[currentQuestionId];
        if (current.completed || current.remainingSeconds === null) return prev;
        
        // If total time expired, expire question timer too
        if (totalRemainingSeconds <= 0) {
          return {
            ...prev,
            [currentQuestionId]: {
              ...current,
              remainingSeconds: 0,
              completed: true
            }
          };
        }
        
        if (current.remainingSeconds <= 0) return prev;
        
        // Decrement normally, but cap to total remaining time
        let newRemaining = current.remainingSeconds - 1;
        if (newRemaining > totalRemainingSeconds) {
          newRemaining = totalRemainingSeconds;
        }
        
        const updated = {
          ...prev,
          [currentQuestionId]: {
            ...current,
            remainingSeconds: Math.max(newRemaining, 0),
            completed: newRemaining <= 0 ? true : current.completed
          }
        };
        if (newRemaining <= 0 || newRemaining % 15 === 0) {
          pendingQuestionSyncRef.current.push({
            questionId: currentQuestionId,
            remainingSeconds: Math.max(newRemaining, 0),
            completed: newRemaining <= 0 ? true : current.completed
          });
        }
        return updated;
      });
    }, 1000);

    return () => {
      clearInterval(countdownIntervalRef.current);
    };
  }, [attempt, activeSectionId, activeQuestionId, sections]);

  useEffect(() => {
    if (!attempt) return;
    if (!pendingSectionSyncRef.current.length) return;
    const updates = pendingSectionSyncRef.current.splice(0);
    updates.forEach(({ sectionId, remainingSeconds, completed }) => {
      updateSectionTimer(examId, {
        attemptId: attempt._id,
        sectionId,
        remainingSeconds,
        completed
      }).catch((err) => console.error('[ExamScreen] updateSectionTimer error', err));
    });
  }, [sectionState, attempt, examId]);

  useEffect(() => {
    if (!attempt) return;
    if (!pendingQuestionSyncRef.current.length) return;
    const updates = pendingQuestionSyncRef.current.splice(0);
    updates.forEach(({ questionId, remainingSeconds, completed }) => {
      updateQuestionTimer(examId, {
        attemptId: attempt._id,
        questionId,
        remainingSeconds,
        completed
      }).catch((err) => console.error('[ExamScreen] updateQuestionTimer error', err));
    });
  }, [questionState, attempt, examId]);

  useEffect(() => {
    if (!activeSectionId) return;
    const timer = sectionState[activeSectionId];
    if (timer && timer.remainingSeconds === 0) {
      const nextSection = sections.find((section) => sectionState[section.sectionId]?.remainingSeconds > 0);
      if (nextSection && nextSection.sectionId !== activeSectionId) {
        setActiveSectionId(nextSection.sectionId);
        const nextQuestion = (questionsBySection[nextSection.sectionId] || []).find((question) => {
          const state = questionState[question.questionId];
          return !state || state.remainingSeconds === null || state.remainingSeconds > 0;
        });
        if (nextQuestion) {
          setActiveQuestionId(nextQuestion.questionId);
        }
      }
    }
  }, [activeSectionId, sectionState, sections, questionsBySection, questionState]);

  const isClosed = useMemo(() => ['submitted', 'auto_submitted', 'terminated', 'expired'].includes(attempt?.status), [attempt?.status]);

  const handleSelectSection = (section) => {
    const timer = sectionState[section.sectionId];
    if (timer && timer.remainingSeconds === 0 && !section.allowRevisit) {
      setInfoPrompt({
        title: 'Section Locked',
        message: 'You have exhausted the time for this section.',
        variant: 'warning'
      });
      return;
    }
    setActiveSectionId(section.sectionId);
    const firstQuestion = (questionsBySection[section.sectionId] || []).find((question) => {
      const state = questionState[question.questionId];
      return !state || state.remainingSeconds === null || state.remainingSeconds > 0;
    });
    if (firstQuestion) {
      setActiveQuestionId(firstQuestion.questionId);
    }
  };

  const handleSelectQuestion = (question) => {
    const state = questionState[question.questionId];
    if (state && state.remainingSeconds === 0) {
      setInfoPrompt({
        title: 'Time Elapsed',
        message: 'The allotted time for this question has expired.',
        variant: 'warning'
      });
      return;
    }
    setActiveSectionId(question.sectionId);
    setActiveQuestionId(question.questionId);
    if (attempt?._id) {
      updateSectionTimer(examId, {
        attemptId: attempt._id,
        sectionId: question.sectionId,
        remainingSeconds: sectionState[question.sectionId]?.remainingSeconds ?? null,
        currentQuestionId: question.questionId
      }).catch((err) => console.error('[ExamScreen] handleSelectQuestion updateSectionTimer', err));
    }
  };

  const handleViewQuestion = (question) => {
    if (activeQuestionId) {
      workspaceCacheRef.current.set(activeQuestionId, workspaceState);
    }

    const state = questionState[question.questionId];
    if (state && state.remainingSeconds === 0) {
      setInfoPrompt({
        title: 'Time Elapsed',
        message: 'You cannot open this question because its timer has expired.',
        variant: 'warning'
      });
      return;
    }
    setActiveSectionId(question.sectionId);
    setActiveQuestionId(question.questionId);
    if (attempt?._id) {
      updateSectionTimer(examId, {
        attemptId: attempt._id,
        sectionId: question.sectionId,
        remainingSeconds: sectionState[question.sectionId]?.remainingSeconds ?? null,
        currentQuestionId: question.questionId
      }).catch((err) => console.error('[ExamScreen] handleViewQuestion updateSectionTimer', err));
    }

    const detail = questionMap.get(question.questionId);
    if (detail) {
      const cached = workspaceCacheRef.current.get(question.questionId);
      if (cached) {
        setWorkspaceState((prev) => ({ ...cached }));
      } else {
        setWorkspaceState(buildInitialWorkspaceState(detail));
      }
    }
  };

  const questionMap = useMemo(() => {
    const map = new Map();
    questionDetails.forEach((detail) => {
      map.set(detail._id, detail);
    });
    if (classMeta?.questions) {
      classMeta.questions.forEach((clsQuestion) => {
        if (map.has(clsQuestion._id)) {
          map.set(clsQuestion._id, { ...map.get(clsQuestion._id), ...clsQuestion });
        } else {
          map.set(clsQuestion._id, clsQuestion);
        }
      });
    }
    return map;
  }, [questionDetails, classMeta?.questions]);

  const handleWorkspaceSubmit = useCallback(async (questionDetail) => {
    if (!questionDetail || !attempt?._id || questionLocked || isClosed) return;

    let payloadAnswer;
    try {
      switch (questionDetail.type) {
        case 'singleCorrectMcq':
          if (workspaceState.answer === null || workspaceState.answer === undefined) {
            throw new Error('Please select an option before submitting');
          }
          payloadAnswer = parseInt(workspaceState.answer, 10);
          break;
        case 'multipleCorrectMcq':
          if (!Array.isArray(workspaceState.answer) || workspaceState.answer.length === 0) {
            throw new Error('Please select at least one option');
          }
          payloadAnswer = workspaceState.answer.map((optionIdx) => parseInt(optionIdx, 10));
          break;
        case 'fillInTheBlanks':
        case 'fillInTheBlanksCoding':
        case 'codingWithDriver':
        case 'coding':
          if (!workspaceState.answer || (typeof workspaceState.answer === 'string' && !workspaceState.answer.trim())) {
            throw new Error('Answer cannot be empty');
          }
          payloadAnswer = workspaceState.answer;
          break;
        default:
          payloadAnswer = workspaceState.answer;
      }
    } catch (validationError) {
      setWorkspaceState((prev) => ({ ...prev, statusMessage: validationError.message }));
      return;
    }

    const language = ['coding', 'fillInTheBlanksCoding', 'codingWithDriver'].includes(questionDetail.type)
      ? workspaceState.selectedLanguage
      : undefined;

    setWorkspaceBusyState((prev) => ({ ...prev, isSubmitting: true }));
    try {
      const response = await submitAnswer(
        questionDetail._id,
        payloadAnswer,
        classId,
        language,
        false,
        examContext
      );
      const passed = response.data.submission?.passedTestCases ?? response.data.passedTestCases ?? 0;
      const total = response.data.submission?.totalTestCases ?? response.data.totalTestCases ?? 0;
      setWorkspaceState((prev) => ({
        ...prev,
        statusMessage: `Submission completed: ${passed}/${total} test cases passed`
      }));
      const updated = await syncAttempt();
      if (updated) setAttempt(updated);
    } catch (err) {
      const message = err.response?.data?.error || err.message || 'Failed to submit answer';
      setWorkspaceState((prev) => ({ ...prev, statusMessage: `Submission failed: ${message}` }));
    } finally {
      setWorkspaceBusyState((prev) => ({ ...prev, isSubmitting: false }));
    }
  }, [attempt?._id, questionLocked, isClosed, workspaceState.answer, workspaceState.selectedLanguage, classId, examContext, syncAttempt]);

  const handleWorkspaceRun = useCallback(async (questionDetail) => {
    if (!questionDetail || !attempt?._id || questionLocked || isClosed) return;
    if (!['coding', 'fillInTheBlanksCoding', 'codingWithDriver'].includes(questionDetail.type)) return;

    setWorkspaceBusyState((prev) => ({ ...prev, isRunning: true }));
    try {
      const response = await runCode(
        questionDetail._id,
        workspaceState.answer,
        classId,
        workspaceState.selectedLanguage,
        examContext
      );
      const publicResults = response.data.testResults || [];
      const passed = publicResults.filter((test) => test.passed).length;
      const total = publicResults.length;
      setWorkspaceState((prev) => ({
        ...prev,
        statusMessage: `Run completed: ${passed}/${total} public test cases passed`
      }));
    } catch (err) {
      const message = err.response?.data?.error || err.message || 'Failed to run code';
      setWorkspaceState((prev) => ({ ...prev, statusMessage: `Run failed: ${message}` }));
    } finally {
      setWorkspaceBusyState((prev) => ({ ...prev, isRunning: false }));
    }
  }, [attempt?._id, questionLocked, isClosed, workspaceState.answer, workspaceState.selectedLanguage, classId, examContext]);

  const handleWorkspaceRunCustom = useCallback(async (questionDetail) => {
    if (!questionDetail || !attempt?._id || questionLocked || isClosed) return;
    if (!['coding', 'fillInTheBlanksCoding', 'codingWithDriver'].includes(questionDetail.type)) return;

    setWorkspaceBusyState((prev) => ({ ...prev, isRunningCustom: true }));
    try {
      const response = await runCodeWithCustomInput(
        questionDetail._id,
        workspaceState.answer,
        classId,
        workspaceState.selectedLanguage,
        workspaceState.customInput,
        workspaceState.expectedOutput,
        examContext
      );
      const message = response.data?.resultMessage || 'Custom input run completed';
      setWorkspaceState((prev) => ({ ...prev, statusMessage: message }));
    } catch (err) {
      const message = err.response?.data?.error || err.message || 'Failed to run code with custom input';
      setWorkspaceState((prev) => ({ ...prev, statusMessage: `Custom run failed: ${message}` }));
    } finally {
      setWorkspaceBusyState((prev) => ({ ...prev, isRunningCustom: false }));
    }
  }, [attempt?._id, questionLocked, isClosed, workspaceState.answer, workspaceState.selectedLanguage, workspaceState.customInput, workspaceState.expectedOutput, classId, examContext]);

  const getInitialAnswer = useCallback((questionDetail, language) => {
    if (!questionDetail) return '';
    switch (questionDetail.type) {
      case 'fillInTheBlanks':
        return '';
      case 'multipleCorrectMcq':
        return Array.isArray(questionDetail.correctOptions) ? [] : [];
      case 'singleCorrectMcq':
        return null;
      case 'fillInTheBlanksCoding':
      case 'coding':
      case 'codingWithDriver': {
        const starter = Array.isArray(questionDetail.starterCode)
          ? questionDetail.starterCode.find((entry) => entry.language === language) || questionDetail.starterCode[0]
          : null;
        if (starter?.code) return starter.code;
        if (questionDetail.codeSnippet) return questionDetail.codeSnippet;
        return '';
      }
      default:
        return '';
    }
  }, []);

  const handleWorkspaceLanguageChange = useCallback((questionDetail, language) => {
    if (!questionDetail) return;
    setWorkspaceState((prev) => ({
      ...prev,
      selectedLanguage: language,
      answer: ['coding', 'fillInTheBlanksCoding', 'codingWithDriver'].includes(questionDetail.type)
        ? getInitialAnswer(questionDetail, language)
        : prev.answer
    }));
  }, [getInitialAnswer]);

  const buildInitialWorkspaceState = useCallback((questionDetail) => {
    if (!questionDetail) {
      return {
        answer: '',
        customInput: '',
        expectedOutput: '',
        showHints: false,
        showSolution: false,
        selectedLanguage: 'javascript',
        statusMessage: ''
      };
    }
    const defaultLanguage = questionDetail.languages?.[0] || 'javascript';
    return {
      answer: getInitialAnswer(questionDetail, defaultLanguage),
      customInput: '',
      expectedOutput: '',
      showHints: false,
      showSolution: false,
      selectedLanguage: defaultLanguage,
      statusMessage: ''
    };
  }, [getInitialAnswer]);

  useEffect(() => {
    if (!questions.length || !questionDetails.length) return;
    if (activeQuestionId) return;
    const first = questions[0];
    const detail = questionMap.get(first.questionId);
    if (!detail) return;
    setActiveSectionId(first.sectionId);
    setActiveQuestionId(first.questionId);
    setWorkspaceState(buildInitialWorkspaceState(detail));
  }, [questions, questionDetails, questionMap, activeQuestionId, buildInitialWorkspaceState]);

  useEffect(() => {
    if (!activeQuestionId) return;
    workspaceCacheRef.current.set(activeQuestionId, workspaceState);
  }, [workspaceState, activeQuestionId]);

  useEffect(() => {
    if (!workspaceState.statusMessage) return;
    const timer = setTimeout(() => {
      setWorkspaceState((prev) => ({ ...prev, statusMessage: '' }));
    }, 4000);
    return () => clearTimeout(timer);
  }, [workspaceState.statusMessage]);

  if (loading) {
    return (
      <div className="rounded-xl border border-gray-200 bg-white p-6 text-center text-sm text-gray-500">
        Preparing your exam...
      </div>
    );
  }

  if (error) {
    return (
      <div className="space-y-4">
        <div className="rounded-xl border border-red-200 bg-red-50 p-6 text-red-700">
          {error}
        </div>
        <button
          onClick={() => navigate(-1)}
          className="rounded-md border border-gray-300 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50"
        >
          Go Back
        </button>
      </div>
    );
  }

  if (!exam || !attempt) {
    return null;
  }

  const displayedQuestions = questionsBySection[activeSectionId] || [];
  const totalTimerLabel = formatDurationMs(totalTimerMs);
  const sectionTimerLabel = formatSeconds(sectionTimer?.remainingSeconds);
  const questionTimerLabel = formatSeconds(questionTimer?.remainingSeconds);

  return (
    <div className="space-y-6">
      {offline && (
        <div className="rounded-lg border border-yellow-200 bg-yellow-50 p-4 text-sm text-yellow-800">
          Connection lost. Changes will sync once your internet is restored.
        </div>
      )}

      <header className="rounded-xl border border-gray-200 bg-white p-6 shadow-sm">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">{exam.title}</h1>
            {classMeta && <p className="text-sm text-gray-500">{classMeta.name}</p>}
          </div>
          <div className="flex flex-col items-end gap-2">
            <span className="text-sm text-gray-500">Status: {attempt.status.replace('_', ' ')}</span>
            {!isFullscreen && fullscreenRequiredRef.current && (
              <button
                onClick={requestFullscreen}
                className="flex items-center gap-2 rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 transition"
                title="Enter Fullscreen Mode"
              >
                <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 8V4m0 0h4M4 4l5 5m11-1V4m0 0h-4m4 0l-5 5M4 16v4m0 0h4m-4 0l5-5m11 5l-5-5m5 5v-4m0 4h-4" />
                </svg>
                Enter Fullscreen
              </button>
            )}
          </div>
        </div>
        <div className="mt-4 grid gap-4 text-center md:grid-cols-3">
          <div className="rounded-lg bg-blue-50 px-4 py-3">
            <div className="text-xs font-semibold uppercase tracking-wide text-blue-700">Total Remaining</div>
            <div className="text-xl font-bold text-blue-900">{totalTimerLabel}</div>
          </div>
          <div className="rounded-lg bg-purple-50 px-4 py-3">
            <div className="text-xs font-semibold uppercase tracking-wide text-purple-700">Section Remaining</div>
            <div className="text-xl font-bold text-purple-900">{sectionTimerLabel}</div>
          </div>
          <div className="rounded-lg bg-green-50 px-4 py-3">
            <div className="text-xs font-semibold uppercase tracking-wide text-green-700">Question Remaining</div>
            <div className="text-xl font-bold text-green-900">{questionTimerLabel}</div>
          </div>
        </div>
      </header>

      <section className="rounded-xl border border-gray-200 bg-white p-6 shadow-sm">
        <h2 className="text-lg font-semibold text-gray-900">Exam Instructions</h2>
        <ul className="mt-3 list-disc space-y-2 pl-6 text-sm text-gray-600">
          <li>Stay in fullscreen mode throughout the exam.</li>
          <li>Tab switching is limited to {exam.proctoring?.tabSwitchLimit ?? 5} times.</li>
          {exam.proctoring?.copyPasteDisabled && <li>Copy, paste and cut actions are disabled.</li>}
          <li>Ensure a stable internet connection. Disconnects are monitored.</li>
          {exam.proctoring?.autoSubmitOnEnd && <li>The exam will auto-submit when time runs out.</li>}
          <li>You may revisit questions only while their individual timer still has time remaining.</li>
        </ul>
      </section>

      <section className="rounded-xl border border-gray-200 bg-white p-6 shadow-sm">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h2 className="text-lg font-semibold text-gray-900">Sections</h2>
          <div className="flex flex-wrap gap-2">
            {sections.map((section) => {
              const timer = sectionState[section.sectionId];
              const disabled = timer && timer.remainingSeconds === 0 && !section.allowRevisit;
              const isActive = section.sectionId === activeSectionId;
              return (
                <button
                  key={section.sectionId}
                  onClick={() => handleSelectSection(section)}
                  disabled={disabled || isClosed}
                  className={`rounded-full px-4 py-2 text-sm font-medium transition ${
                    isActive
                      ? 'bg-blue-600 text-white shadow'
                      : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                  } ${disabled ? 'cursor-not-allowed opacity-60' : ''}`}
                >
                  {section.title}
                  <span className="ml-2 text-xs text-gray-500">{formatSeconds(timer?.remainingSeconds)}</span>
                </button>
              );
            })}
          </div>
        </div>
      </section>

      <section className="space-y-4 rounded-xl border border-gray-200 bg-white p-6 shadow-sm">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-semibold text-gray-900">Questions</h2>
          <span className="text-sm text-gray-500">{answeredQuestions.size}/{questions.length} answered</span>
        </div>
        {displayedQuestions.length === 0 ? (
          <div className="rounded-lg border border-dashed border-gray-300 bg-gray-50 p-6 text-center text-sm text-gray-500">
            No questions assigned to this section.
          </div>
        ) : (
          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
            {displayedQuestions.map((question, idx) => {
              const timer = questionState[question.questionId];
              const isAnswered = answeredQuestions.has(question.questionId.toString());
              const locked = timer && timer.remainingSeconds === 0;
              const fullQuestion = questionMap.get(question.questionId);
              const title = fullQuestion?.title || `Question ${idx + 1}`;
              const displayPoints = fullQuestion?.points ?? question.points;
              return (
                <div
                  key={question.questionId}
                  className={`rounded-lg border p-4 shadow-sm ${
                    locked
                      ? 'border-red-200 bg-red-50'
                      : isAnswered
                        ? 'border-green-300 bg-green-50'
                        : 'border-gray-200 bg-white'
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <div className="text-sm font-semibold text-gray-700" dangerouslySetInnerHTML={{ __html: title }} />
                    <div className="text-xs text-gray-500">{displayPoints} pts</div>
                  </div>
                  <div className="mt-2 text-xs text-gray-500">
                    Time left: {formatSeconds(timer?.remainingSeconds)}
                  </div>
                  <div className="mt-3 flex flex-wrap items-center justify-between gap-2">
                    <button
                      onClick={() => handleViewQuestion(question)}
                      className="rounded-md bg-blue-600 px-3 py-2 text-sm font-semibold text-white hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-60"
                      disabled={locked || isClosed}
                    >
                      {isClosed ? 'View Response' : locked ? 'Time Expired' : 'Open Question'}
                    </button>
                    <span className={`text-xs font-medium ${locked ? 'text-red-600' : isAnswered ? 'text-green-700' : 'text-gray-400'}`}>
                      {locked ? 'Locked' : isAnswered ? 'Answered' : 'Pending'}
                    </span>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </section>

      {activeQuestion && questionMap.has(activeQuestion.questionId) && (
        <section className="rounded-xl border border-gray-200 bg-white shadow-sm">
          <QuestionWorkspace
            question={questionMap.get(activeQuestion.questionId)}
            answer={workspaceState.answer}
            setAnswer={(value) => setWorkspaceState((prev) => ({ ...prev, answer: value }))}
            selectedLanguage={workspaceState.selectedLanguage}
            customInput={workspaceState.customInput}
            setCustomInput={(value) => setWorkspaceState((prev) => ({ ...prev, customInput: value }))}
            expectedOutput={workspaceState.expectedOutput}
            setExpectedOutput={(value) => setWorkspaceState((prev) => ({ ...prev, expectedOutput: value }))}
            isQuestionActive={!questionLocked && !isClosed}
            questionLocked={questionLocked}
            questionTimerLabel={questionTimerLabel}
            sectionTimerLabel={sectionTimerLabel}
            totalTimerLabel={totalTimerLabel}
            statusMessage={workspaceState.statusMessage}
            isSubmitting={workspaceBusyState.isSubmitting}
            isRunning={workspaceBusyState.isRunning}
            isRunningCustom={workspaceBusyState.isRunningCustom}
            onSubmit={() => handleWorkspaceSubmit(questionMap.get(activeQuestion.questionId))}
            onRun={() => handleWorkspaceRun(questionMap.get(activeQuestion.questionId))}
            onRunCustom={() => handleWorkspaceRunCustom(questionMap.get(activeQuestion.questionId))}
            onLanguageChange={(value) => handleWorkspaceLanguageChange(questionMap.get(activeQuestion.questionId), value)}
            onToggleHint={() => setWorkspaceState((prev) => ({ ...prev, showHints: !prev.showHints }))}
            showHints={workspaceState.showHints}
            onToggleSolution={() => setWorkspaceState((prev) => ({ ...prev, showSolution: !prev.showSolution }))}
            showSolution={workspaceState.showSolution}
            copyPasteDisabled={exam?.proctoring?.copyPasteDisabled || false}
          />
        </section>
      )}

      <section className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-gray-200 bg-white p-6 shadow-sm">
        <div className="text-sm text-gray-500">
          Review your answers before submitting. Once submitted, you cannot make changes.
        </div>
        <div className="flex gap-3">
          {!isClosed && (
            <button
              onClick={handleManualSubmit}
              disabled={isSubmitting}
              className="rounded-md bg-green-600 px-4 py-2 text-sm font-semibold text-white hover:bg-green-700 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {isSubmitting ? 'Submitting...' : 'Submit Exam'}
            </button>
          )}
          <button
            onClick={() => {
              exitFullscreen();
              navigate(-1);
            }}
            className="rounded-md border border-gray-300 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50"
          >
            Leave Exam
          </button>
        </div>
      </section>

      {report && (
        <section className="rounded-xl border border-gray-200 bg-white p-6 shadow-sm">
          <h2 className="text-lg font-semibold text-gray-900">Score Summary</h2>
          <div className="mt-3 text-sm text-gray-600">
            <div>Total Score: <span className="font-semibold text-gray-900">{report.attempts[0]?.totalScore || 0}</span></div>
            <div>Maximum Score: <span className="font-semibold text-gray-900">{report.attempts[0]?.maxScore || 0}</span></div>
          </div>
        </section>
      )}

      <ExamPrompt
        open={!!violationPrompt}
        title={violationPrompt?.title}
        message={violationPrompt?.message}
        variant={violationPrompt?.variant || 'danger'}
        confirmText="Exit Exam"
        onConfirm={() => {
          setViolationPrompt(null);
          exitFullscreen();
          navigate('/student/exams');
        }}
      />

      <ExamPrompt
        open={!!infoPrompt}
        title={infoPrompt?.title}
        message={infoPrompt?.message}
        variant={infoPrompt?.variant || 'info'}
        confirmText={infoPrompt?.title === 'Fullscreen Required' ? 'Enter Fullscreen' : 'OK'}
        onConfirm={() => {
          if (infoPrompt?.title === 'Fullscreen Required') {
            requestFullscreen();
          }
          setInfoPrompt(null);
        }}
      />
    </div>
  );
};

export default StudentExamScreen;
