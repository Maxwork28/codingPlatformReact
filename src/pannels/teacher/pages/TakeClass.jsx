import React, { useState, useEffect, Fragment } from 'react';
import { useSelector } from 'react-redux';
import { useNavigate, useLocation } from 'react-router-dom';
import { ArrowLeftIcon } from '@heroicons/react/24/outline';
import { Menu, Transition, Portal } from '@headlessui/react';
import parse from 'html-react-parser';
import { io } from 'socket.io-client';
import { getQuestionsByClass, teacherTestQuestion, teacherTestWithCustomInput, publishQuestion, unpublishQuestion, disableQuestion, enableQuestion } from '../../../common/services/api';
import { API_BASE_URL } from '../../../common/constants';
import CodeEditor from '../../student/components/CodeEditor';
import TestCaseResultsList from '../../student/components/TestCaseResultsList';
import { DiJavascript } from "react-icons/di";
import { FaJava,  FaPython, FaDatabase, FaBookOpen } from "react-icons/fa";
import { GiNotebook } from "react-icons/gi";
import { MdDataObject, MdDataArray } from "react-icons/md";

const QUESTION_TYPE_LABELS = {
  singleCorrectMcq: 'Single choice',
  multipleCorrectMcq: 'Multiple choice',
  fillInTheBlanks: 'Fill in the blanks',
  fillInTheBlanksCoding: 'Fill in the blanks (code)',
  coding: 'Coding',
  codingWithDriver: 'Coding (LeetCode-style)',
};

const RUNNABLE_CODING_TYPES = ['coding', 'fillInTheBlanksCoding', 'codingWithDriver'];
const FULL_CODE_EDITOR_TYPES = ['coding', 'codingWithDriver'];

function stripHtml(html) {
  if (!html) return '';
  const doc = new DOMParser().parseFromString(html, 'text/html');
  return doc.body.textContent || '';
}

function getCodeTemplateForLanguage(question, lang) {
  if (!question || !lang) return '';
  const fromTemplate = question.templateCode?.find((tc) => tc.language === lang);
  if (fromTemplate?.code) return fromTemplate.code;
  const fromStarter = question.starterCode?.find((sc) => sc.language === lang);
  if (fromStarter?.code) return fromStarter.code;
  return '';
}

const TakeClass = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const { user } = useSelector((state) => state.auth);
  const { classes } = useSelector((state) => state.classes);
  
  // Main state
  const [selectedClass, setSelectedClass] = useState(null);
  const [selectedQuestion, setSelectedQuestion] = useState(null);
  const [questions, setQuestions] = useState([]);
  const [code, setCode] = useState('');
  const [fillInBlankLine, setFillInBlankLine] = useState('');
  const [selectedLanguage, setSelectedLanguage] = useState('javascript');
  const [loading, setLoading] = useState(false);
  
  // Layout states
  const [showQuestionsList, setShowQuestionsList] = useState(false);
  const [leftPanelWidth, setLeftPanelWidth] = useState(50);
  const [isDragging, setIsDragging] = useState(false);
  const [editorHeight, setEditorHeight] = useState(65);
  const [isDraggingVertical, setIsDraggingVertical] = useState(false);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(false);
  
  // Test data
  const [customInput, setCustomInput] = useState('');
  const [customOutput, setCustomOutput] = useState('');
  const [testResults, setTestResults] = useState(null);
  const [showResultsModal, setShowResultsModal] = useState(false);
  const [resultsModalKind, setResultsModalKind] = useState(null); // 'run'

  // Filter classes taught by the current teacher
  const myClasses = classes.filter(
    (cls) => cls.teachers?.some((t) => t._id === user?.id) || cls.createdBy?._id === user?.id
  );

  // Function to get appropriate icon and color based on class name
  const getClassIconAndColor = (className) => {
    const lowerName = className.toLowerCase();
    
    if (lowerName.includes('javascript') || lowerName.includes('js') || lowerName.includes('web development')) {
      return { icon: <DiJavascript className="w-6 h-6" style={{ color: 'var(--text-primary)' }} />, color: 'var(--python-blue)' };
    } else if (
      lowerName.includes('java') ||
      lowerName.includes('object-oriented programming') ||
      lowerName.includes('oop') ||
      lowerName.includes('object-oriented prog')
    ) {
      return { icon: <FaJava className="w-6 h-6" style={{ color: 'var(--text-primary)' }} />, color: 'var(--oop-amber)' };
    } else if (lowerName.includes('software engineering') || lowerName.includes('engineering')) {
      return { icon: <GiNotebook className="w-6 h-6" style={{ color: 'var(--text-primary)' }} />, color: 'var(--software-cyan)' };
    } else if (lowerName.includes('python') || lowerName.includes('introduction to progra')) {
      return { icon: <FaPython className="w-6 h-6" style={{ color: 'var(--text-primary)' }} />, color: 'var(--python-blue)' };
    } else if (lowerName.includes('database')) {
      return { icon: <FaDatabase className="w-6 h-6" style={{ color: 'var(--text-primary)' }} />, color: 'var(--database-violet)' };
    } else if (lowerName.includes('competitive programming')) {
      return { icon: <MdDataObject className="w-6 h-6" style={{ color: 'var(--text-primary)' }} />, color: 'var(--competition-red)' };
    } else if (lowerName.includes('data structure') || lowerName.includes('datastructure')) {
      return { icon: <MdDataArray className="w-6 h-6" style={{ color: 'var(--text-primary)' }} />, color: 'var(--data-emerald)' };
    } else if (lowerName.includes('demo')) {
      return { icon: <FaBookOpen className="w-6 h-6" style={{ color: 'var(--text-primary)' }} />, color: 'var(--python-blue)' };
    } else if (lowerName.includes('algorithm')) {
      return { icon: <MdDataObject className="w-6 h-6" style={{ color: 'var(--text-primary)' }} />, color: 'var(--competition-red)' };
    } else {
      return { 
        icon: <svg className="w-6 h-6" style={{ color: 'var(--text-primary)' }} fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" />
        </svg>, 
        color: 'var(--python-blue)' 
      };
    }
  };

  // Action handlers
  const handleBackToClassSelection = () => {
    setSelectedClass(null);
    setSelectedQuestion(null);
    setQuestions([]);
    setCode('');
    setFillInBlankLine('');
  };

  const toggleSidebar = () => {
    setIsSidebarCollapsed(!isSidebarCollapsed);
  };

  const toggleFullscreen = () => {
    setIsFullscreen(!isFullscreen);
  };

  const handleDividerMouseDown = (e) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const handleVerticalDividerMouseDown = (e) => {
    e.preventDefault();
    setIsDraggingVertical(true);
  };

  const handleCopyCode = () => {
    const text =
      selectedQuestion?.type === 'fillInTheBlanksCoding' ? fillInBlankLine : code;
    navigator.clipboard.writeText(text || '');
    alert(selectedQuestion?.type === 'fillInTheBlanksCoding' ? 'Blank line copied!' : 'Code copied to clipboard!');
  };

  const handleResetCode = () => {
    if (!selectedQuestion) return;
    const q = selectedQuestion;
    if (FULL_CODE_EDITOR_TYPES.includes(q.type)) {
      setCode(getCodeTemplateForLanguage(q, selectedLanguage));
    } else if (q.type === 'fillInTheBlanksCoding') {
      setFillInBlankLine('');
    }
  };

  const getTeacherTestAnswer = () => {
    if (!selectedQuestion) return '';
    if (selectedQuestion.type === 'fillInTheBlanksCoding') return fillInBlankLine;
    return code;
  };

  // Teacher-specific testing handlers
  const handleRunCode = async () => {
    if (!selectedQuestion) {
      alert('Please select a question first');
      return;
    }

    if (!RUNNABLE_CODING_TYPES.includes(selectedQuestion.type)) {
      alert('Run Code is only available for coding and fill-in-the-blanks (code) questions.');
      return;
    }

    const answerPayload = getTeacherTestAnswer();
    if (!answerPayload || answerPayload.trim() === '') {
      alert(
        selectedQuestion.type === 'fillInTheBlanksCoding'
          ? 'Enter the line of code for the blank'
          : 'Please write some code to test'
      );
      return;
    }

    try {
      setLoading(true);
      setTestResults(null);
      
      console.log('Teacher running code...', { 
        questionId: selectedQuestion._id, 
        classId: selectedClass._id,
        language: selectedLanguage 
      });

      const response = await teacherTestQuestion(
        selectedQuestion._id,
        answerPayload,
        selectedClass._id,
        selectedLanguage
      );

      console.log('Test results received:', response.data);
      
      // Set results with detailed information
      setTestResults({
        message: response.data.message,
        testResults: response.data.testResults,
        passedTestCases: response.data.passedTestCases,
        totalTestCases: response.data.totalTestCases,
        publicTestCases: response.data.publicTestCases,
        hiddenTestCases: response.data.hiddenTestCases,
        isCorrect: response.data.isCorrect,
        explanation: response.data.explanation
      });
      openResultsModal('run');

    } catch (err) {
      console.error('Failed to run code:', err);
      setTestResults({
        error: true,
        message: typeof err === 'string' ? err : 'Failed to execute code. Please try again.'
      });
      openResultsModal('run');
    } finally {
      setLoading(false);
    }
  };

  const handleRunWithCustomInput = async () => {
    if (!selectedQuestion) {
      alert('Please select a question first');
      return;
    }

    if (!RUNNABLE_CODING_TYPES.includes(selectedQuestion.type)) {
      alert('Custom run is only available for coding and fill-in-the-blanks (code) questions.');
      return;
    }

    const answerPayload = getTeacherTestAnswer();
    if (!answerPayload || answerPayload.trim() === '') {
      alert(
        selectedQuestion.type === 'fillInTheBlanksCoding'
          ? 'Enter the line of code for the blank'
          : 'Please write some code to test'
      );
      return;
    }

    if (!customInput || customInput.trim() === '') {
      alert('Please provide custom input');
      return;
    }

    try {
      setLoading(true);
      setTestResults(null);
      
      console.log('Teacher running with custom input...', { 
        questionId: selectedQuestion._id, 
        classId: selectedClass._id,
        language: selectedLanguage,
        customInput,
        expectedOutput: customOutput
      });

      const response = await teacherTestWithCustomInput(
        selectedQuestion._id,
        answerPayload,
        selectedClass._id,
        selectedLanguage,
        customInput,
        customOutput
      );

      console.log('Custom test result received:', response.data);
      
      // Set results with custom test information
      setTestResults({
        message: response.data.message,
        testResult: response.data.testResult,
        customInput: response.data.customInput,
        expectedOutput: response.data.expectedOutput,
        actualOutput: response.data.actualOutput,
        passed: response.data.passed,
        isCustomTest: true,
        explanation: response.data.explanation
      });
      openResultsModal('run');

    } catch (err) {
      console.error('Failed to run with custom input:', err);
      setTestResults({
        error: true,
        message: typeof err === 'string' ? err : 'Failed to execute code with custom input. Please try again.'
      });
      openResultsModal('run');
    } finally {
      setLoading(false);
    }
  };

  const handlePresentSolution = async () => {
    console.log('Presenting solution...', { questionId: selectedQuestion?._id, code });
    alert('Present Solution - Coming soon!\nThis will broadcast the solution to students in real-time via Socket.IO.');
  };

  const openResultsModal = (kind) => {
    setResultsModalKind(kind);
    setShowResultsModal(true);
  };

  const closeResultsModal = () => setShowResultsModal(false);

  const renderTestResultsBody = () => {
    if (!testResults) return null;

    if (testResults.error) {
      return (
        <div className="text-xs text-red-600 p-3 bg-red-100 rounded">
          {testResults.message}
        </div>
      );
    }

    if (testResults.isCustomTest) {
      return (
        <div className="space-y-2">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs">
            <div className="p-2 bg-white rounded border" style={{ borderColor: 'var(--card-border)' }}>
              <div className="font-medium mb-1" style={{ color: 'var(--text-secondary)' }}>Input</div>
              <pre className="whitespace-pre-wrap" style={{ color: 'var(--text-primary)' }}>
                {testResults.customInput}
              </pre>
            </div>
            <div className="p-2 bg-white rounded border" style={{ borderColor: 'var(--card-border)' }}>
              <div className="font-medium mb-1" style={{ color: 'var(--text-secondary)' }}>Actual Output</div>
              <pre className="whitespace-pre-wrap" style={{ color: 'var(--text-primary)' }}>
                {testResults.actualOutput}
              </pre>
            </div>
          </div>
          {testResults.expectedOutput && (
            <div className="p-2 bg-white rounded border" style={{ borderColor: 'var(--card-border)' }}>
              <div className="font-medium mb-1 text-xs" style={{ color: 'var(--text-secondary)' }}>Expected Output</div>
              <pre className="text-xs whitespace-pre-wrap" style={{ color: 'var(--text-primary)' }}>
                {testResults.expectedOutput}
              </pre>
              <div className={`mt-2 text-xs font-semibold ${testResults.passed ? 'text-green-600' : 'text-red-600'}`}>
                {testResults.passed ? 'Output matches expected' : 'Output does not match expected'}
              </div>
            </div>
          )}
        </div>
      );
    }

    return (
      <div className="space-y-2">
        <TestCaseResultsList
          results={testResults.testResults}
          className="p-2 bg-white rounded border"
        />
        {testResults.explanation && (
          <div className="mt-3 p-3 bg-blue-50 rounded border" style={{ borderColor: 'var(--card-border)' }}>
            <div className="text-xs font-semibold mb-1" style={{ color: 'var(--text-heading)' }}>
              Explanation:
            </div>
            <div className="text-xs" style={{ color: 'var(--text-primary)' }}>
              {stripHtml(testResults.explanation)}
            </div>
          </div>
        )}
      </div>
    );
  };

  const renderTestResultsCard = () => {
    if (!testResults) return null;

    return (
      <div
        className={`mt-4 p-4 rounded-lg border backdrop-blur-sm ${
          testResults.error ? 'bg-red-50/80' : testResults.isCorrect || testResults.passed ? 'bg-green-50/80' : 'bg-yellow-50/80'
        }`}
        style={{ borderColor: 'var(--card-border)' }}
      >
        <div className="flex items-center justify-between mb-3">
          <h4 className="text-sm font-semibold" style={{ color: 'var(--text-heading)' }}>
            {testResults.error ? 'Error' : testResults.isCustomTest ? 'Custom Test Results' : 'Test Results'}
          </h4>
          {!testResults.error && !testResults.isCustomTest && (
            <span
              className={`px-2.5 py-0.5 rounded-full text-xs font-semibold ${
                testResults.isCorrect ? 'bg-green-100 text-green-700' : 'bg-yellow-100 text-yellow-700'
              }`}
            >
              {testResults.passedTestCases}/{testResults.totalTestCases} Passed
            </span>
          )}
        </div>
        {renderTestResultsBody()}
      </div>
    );
  };

  const getClassNavigationState = () => (selectedClass?._id ? { classId: selectedClass._id } : undefined);

  const navigateWithClassContext = (path) => {
    const state = getClassNavigationState();
    navigate(path, state ? { state } : undefined);
  };

  // Menu action handlers
  const handleViewStatement = (questionId) => {
    navigateWithClassContext(`/teacher/questions/${questionId}/statement`);
  };

  const handleViewSolution = (questionId) => {
    navigateWithClassContext(`/teacher/questions/${questionId}/solution`);
  };

  const handleViewTestCases = (questionId) => {
    navigateWithClassContext(`/teacher/questions/${questionId}/test-cases`);
  };

  const handleEditQuestion = (questionId) => {
    navigateWithClassContext(`/teacher/questions/${questionId}/edit`);
  };

  const handlePreviewAsStudent = (questionId) => {
    navigateWithClassContext(`/teacher/questions/${questionId}/preview`);
  };

  const handleViewQuestionStatistics = () => {
    if (!selectedClass?._id || !selectedQuestion?._id) {
      alert('Please select a class and question first');
      return;
    }
    navigate(
      `/teacher/take-class/${selectedClass._id}/questions/${selectedQuestion._id}/statistics`,
      { state: { fromTakeClass: true } }
    );
  };

  const handlePublish = async (questionId) => {
    try {
      // Find the question to check current status
      const question = questions.find(q => q._id === questionId);
      if (!question) {
        alert('Question not found');
        return;
      }
      
      // Get class-specific settings
      const classEntry = question.classes?.find(
        (c) => c.classId?.toString() === selectedClass._id || c.classId?._id?.toString() === selectedClass._id
      );
      const isPublished = classEntry?.isPublished || false;
      
      setLoading(true);
      if (isPublished) {
        await unpublishQuestion(questionId, { classId: selectedClass._id });
      } else {
        await publishQuestion(questionId, { classId: selectedClass._id });
      }
      
      // Refresh questions list
      const response = await getQuestionsByClass(selectedClass._id);
      const updatedQuestions = response.data.questions || [];
      setQuestions(updatedQuestions);
      
      // Update selected question if it's the one that was modified
      if (selectedQuestion && selectedQuestion._id === questionId) {
        const updatedQuestion = updatedQuestions.find(q => q._id === questionId);
        if (updatedQuestion) {
          setSelectedQuestion(updatedQuestion);
        }
      }
    } catch (err) {
      console.error('Failed to toggle publish status:', err);
      const errorMsg =
        (typeof err === 'string' && err) ||
        err?.response?.data?.error ||
        err?.error ||
        'Failed to update publish status';
      alert(errorMsg);
    } finally {
      setLoading(false);
    }
  };

  const handleDisable = async (questionId) => {
    try {
      // Find the question to check current status
      const question = questions.find(q => q._id === questionId);
      if (!question) {
        alert('Question not found');
        return;
      }
      
      // Get class-specific settings
      const classEntry = question.classes?.find(
        (c) => c.classId?.toString() === selectedClass._id || c.classId?._id?.toString() === selectedClass._id
      );
      const isDisabled = classEntry?.isDisabled || false;
      
      setLoading(true);
      if (isDisabled) {
        await enableQuestion(questionId, { classId: selectedClass._id });
      } else {
        await disableQuestion(questionId, { classId: selectedClass._id });
      }
      
      // Refresh questions list
      const response = await getQuestionsByClass(selectedClass._id);
      const updatedQuestions = response.data.questions || [];
      setQuestions(updatedQuestions);
      
      // Update selected question if it's the one that was modified
      if (selectedQuestion && selectedQuestion._id === questionId) {
        const updatedQuestion = updatedQuestions.find(q => q._id === questionId);
        if (updatedQuestion) {
          setSelectedQuestion(updatedQuestion);
        }
      }
    } catch (err) {
      console.error('Failed to toggle disable status:', err);
      const errorMsg =
        (typeof err === 'string' && err) ||
        err?.response?.data?.error ||
        err?.error ||
        'Failed to update disable status';
      alert(errorMsg);
    } finally {
      setLoading(false);
    }
  };

  // Handle horizontal panel resizing
  useEffect(() => {
    const handleMouseMove = (e) => {
      if (!isDragging) return;
      
      const sidebarWidth = isSidebarCollapsed ? 0 : 256;
      const availableWidth = window.innerWidth - sidebarWidth;
      const mouseXRelative = e.clientX - sidebarWidth;
      const newLeftWidth = (mouseXRelative / availableWidth) * 100;
      
      if (newLeftWidth >= 20 && newLeftWidth <= 80) {
        setLeftPanelWidth(newLeftWidth);
      }
    };

    const handleMouseUp = () => {
      setIsDragging(false);
      document.body.style.cursor = '';
      document.body.style.userSelect = '';
    };

    if (isDragging) {
      document.body.style.cursor = 'col-resize';
      document.body.style.userSelect = 'none';
      document.addEventListener('mousemove', handleMouseMove);
      document.addEventListener('mouseup', handleMouseUp);
    }

    return () => {
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
    };
  }, [isDragging, isSidebarCollapsed]);

  // Handle vertical panel resizing (editor height)
  useEffect(() => {
    const handleMouseMove = (e) => {
      if (!isDraggingVertical) return;
      
      const split = document.getElementById('teacher-code-split');
      if (!split) return;

      const rect = split.getBoundingClientRect();
      const relativeY = e.clientY - rect.top;
      const newHeight = (relativeY / rect.height) * 100;
      
      if (newHeight >= 30 && newHeight <= 85) {
        setEditorHeight(newHeight);
      }
    };

    const handleMouseUp = () => {
      setIsDraggingVertical(false);
      document.body.style.cursor = '';
      document.body.style.userSelect = '';
    };

    if (isDraggingVertical) {
      document.body.style.cursor = 'row-resize';
      document.body.style.userSelect = 'none';
      document.addEventListener('mousemove', handleMouseMove);
      document.addEventListener('mouseup', handleMouseUp);
    }

    return () => {
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
    };
  }, [isDraggingVertical]);

  // Handle keyboard shortcuts for fullscreen
  useEffect(() => {
    const handleKeyboard = (e) => {
      if (e.key === 'Escape' && isFullscreen) {
        setIsFullscreen(false);
      }
      if (e.key === 'F11') {
        e.preventDefault();
        setIsFullscreen(!isFullscreen);
      }
    };

    document.addEventListener('keydown', handleKeyboard);
    return () => {
      document.removeEventListener('keydown', handleKeyboard);
    };
  }, [isFullscreen]);

  useEffect(() => {
    const state = location.state;
    if (state?.classId && myClasses.length && !selectedClass) {
      const cls = myClasses.find((c) => String(c._id) === String(state.classId));
      if (cls) setSelectedClass(cls);
    }
  }, [location.state, myClasses, selectedClass]);

  // Fetch questions when a class is selected
  useEffect(() => {
    if (selectedClass) {
      const fetchQuestions = async () => {
        try {
          setLoading(true);
          const response = await getQuestionsByClass(selectedClass._id);
          const fetchedQuestions = response.data.questions || [];
          setQuestions(fetchedQuestions);
          const restoreQuestionId = location.state?.questionId;
          if (restoreQuestionId) {
            const found = fetchedQuestions.find((q) => String(q._id) === String(restoreQuestionId));
            if (found) {
              setSelectedQuestion(found);
              setSelectedLanguage(found.languages?.[0] || 'javascript');
            } else if (fetchedQuestions.length > 0) {
              setSelectedQuestion(fetchedQuestions[0]);
              setSelectedLanguage(fetchedQuestions[0].languages?.[0] || 'javascript');
            }
          } else if (fetchedQuestions.length > 0) {
            setSelectedQuestion(fetchedQuestions[0]);
            setSelectedLanguage(fetchedQuestions[0].languages?.[0] || 'javascript');
          }
        } catch (err) {
          console.error('Failed to fetch questions:', err);
        } finally {
          setLoading(false);
        }
      };
      fetchQuestions();
    }
  }, [selectedClass, location.state?.questionId]);

  // Real-time: stay in sync when publish/disable changes (this teacher, co-teacher, or other clients)
  useEffect(() => {
    if (!selectedClass?._id) return undefined;
    const classId = selectedClass._id;
    const socket = io(`${API_BASE_URL}/`, { withCredentials: true });
    socket.emit('joinClass', classId);
    const refetchQuestions = async () => {
      try {
        const response = await getQuestionsByClass(classId);
        const updated = response.data.questions || [];
        setQuestions(updated);
        setSelectedQuestion((sel) => {
          if (!sel) return updated[0] || null;
          const found = updated.find((q) => q._id === sel._id);
          return found || updated[0] || null;
        });
      } catch (err) {
        console.error('[TakeClass] Socket refetch failed:', err);
      }
    };
    socket.on('questionPublished', refetchQuestions);
    socket.on('questionDisabled', refetchQuestions);
    socket.on('questionAssigned', refetchQuestions);
    return () => {
      socket.off('questionPublished', refetchQuestions);
      socket.off('questionDisabled', refetchQuestions);
      socket.off('questionAssigned', refetchQuestions);
      socket.disconnect();
    };
  }, [selectedClass?._id]);

  // Sync editor payload when question or language changes (type-aware)
  useEffect(() => {
    if (!selectedQuestion) return;
    const q = selectedQuestion;
    if (FULL_CODE_EDITOR_TYPES.includes(q.type)) {
      setCode(getCodeTemplateForLanguage(q, selectedLanguage));
    } else if (q.type === 'fillInTheBlanksCoding') {
      setFillInBlankLine('');
    } else {
      setCode('');
      setFillInBlankLine('');
    }
  }, [selectedQuestion, selectedLanguage]);

  useEffect(() => {
    if (selectedQuestion && !RUNNABLE_CODING_TYPES.includes(selectedQuestion.type) && isFullscreen) {
      setIsFullscreen(false);
    }
  }, [selectedQuestion, isFullscreen]);

  // If no class is selected, show class selection screen
  if (!selectedClass) {
    return (
      <div className="p-3 pt-6">
        <div className="mb-6">
          <h2 className="tracking-tight" style={{ 
            color: 'var(--text-heading)', 
            fontSize: '28px', 
            fontWeight: '700',
            fontFamily: "-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Oxygen, Ubuntu, Cantarell, sans-serif"
          }}>
            Take Class
          </h2>
          <p className="mt-1 text-sm" style={{ color: 'var(--text-secondary)' }}>
            Select a class to start teaching
          </p>
        </div>

        {myClasses.length === 0 ? (
          <div className="text-center py-12 backdrop-blur-sm rounded-2xl shadow-lg border" style={{ backgroundColor: 'var(--background-light)', borderColor: 'var(--card-border)' }}>
            <svg className="mx-auto h-14 w-14" style={{ color: 'var(--text-secondary)' }} fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" />
            </svg>
            <h3 className="mt-3 text-lg font-semibold" style={{ color: 'var(--text-primary)' }}>No classes found</h3>
            <p className="mt-1 text-sm" style={{ color: 'var(--text-secondary)' }}>You haven't been assigned to any classes yet.</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-2">
            {myClasses.map((cls) => (
              <button
                key={cls._id}
                onClick={() => setSelectedClass(cls)}
                className="rounded-xl shadow-md border overflow-hidden transition-all duration-300 hover:shadow-lg hover:-translate-y-1 hover:scale-[1.01] text-left"
                style={{ backgroundColor: 'var(--background-light)', borderColor: 'var(--card-border)' }}
              >
                <div className="p-3">
                  <div className="flex items-center">
                    {(() => {
                      const { icon } = getClassIconAndColor(cls.name);
                      return (
                        <div className="flex-shrink-0 rounded-lg p-2.5 shadow-sm" style={{ backgroundColor: 'var(--background-light)' }}>
                          {icon}
                        </div>
                      );
                    })()}
                    <div className="ml-3 w-0 flex-1">
                      <h3 className="truncate" style={{ color: 'var(--text-primary)', fontSize: '18px', fontWeight: '700' }}>{cls.name}</h3>
                      <p className="text-sm mt-0.5" style={{ color: 'var(--text-primary)' }}>{cls.students?.length || 0} students</p>
                    </div>
                  </div>
                  <div className="mt-1.5">
                    <p className="line-clamp-2" style={{ color: 'var(--text-primary)', fontSize: '14px', fontWeight: '400' }}>{cls.description}</p>
                  </div>
                  <div className="mt-1.5 flex justify-between items-center">
                    <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-semibold" style={{ backgroundColor: 'var(--badge-slate)', color: 'var(--text-primary)' }}>
                      {cls.questions?.length || 0} questions
                    </span>
                    <span style={{ color: 'var(--text-primary)', fontSize: '12px', fontWeight: '400' }}>Created by {cls.createdBy?.name || 'Unknown'}</span>
                  </div>
                </div>
              </button>
            ))}
          </div>
        )}
      </div>
    );
  }

  const questionType = selectedQuestion?.type;
  const isRunnableCoding = Boolean(questionType && RUNNABLE_CODING_TYPES.includes(questionType));
  const showFullCodeEditor = Boolean(questionType && FULL_CODE_EDITOR_TYPES.includes(questionType));
  const isFillInBlanksCoding = questionType === 'fillInTheBlanksCoding';

  // Main layout when class is selected
  // Height matches App <main> (navbar is h-16 = 4rem). h-screen/100vh was too tall and broke sidebar scroll.
  return (
    <div
      className="flex flex-col min-h-0 overflow-hidden w-full h-[calc(100vh-4rem)] max-h-[calc(100vh-4rem)]"
      style={{ backgroundColor: 'var(--background-content)' }}
    >
      {/* Top Bar */}
      <div className="border-b p-3 sm:p-4 flex-shrink-0" style={{ backgroundColor: 'var(--card-white)', borderColor: 'var(--card-border)' }}>
        <div className="max-w-full mx-auto flex items-center gap-2 sm:gap-4">
          <button
            onClick={handleBackToClassSelection}
            className="inline-flex items-center px-2 sm:px-3 py-1.5 sm:py-2 rounded-lg border transition-all duration-200 hover:shadow text-sm"
            style={{ 
              backgroundColor: 'var(--card-white)', 
              borderColor: 'var(--card-border)', 
              color: 'var(--text-primary)' 
            }}
          >
            <ArrowLeftIcon className="h-4 w-4 sm:mr-2" />
            <span className="hidden sm:inline">Back</span>
          </button>
          <div className="flex-1 min-w-0">
            <h2 className="text-base sm:text-lg font-semibold truncate" style={{ color: 'var(--text-heading)' }}>
              {selectedClass.name}
            </h2>
            <p className="text-xs" style={{ color: 'var(--text-secondary)' }}>
              {questions.length} Questions
            </p>
          </div>
          <button
            onClick={() => setShowQuestionsList(!showQuestionsList)}
            className="lg:hidden inline-flex items-center px-3 py-2 rounded-lg border transition-all duration-200"
            style={{ 
              backgroundColor: 'var(--card-white)', 
              borderColor: 'var(--card-border)', 
              color: 'var(--text-primary)' 
            }}
          >
            <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
            </svg>
          </button>
        </div>
      </div>

      {/* Mobile overlay */}
      {showQuestionsList && (
        <div 
          className="fixed inset-0 bg-black bg-opacity-50 z-30 lg:hidden"
          onClick={() => setShowQuestionsList(false)}
        />
      )}

      {/* Main Content — row height must stay within viewport; middle column needs min-h-0 or it expands the row and clips the sidebar */}
      <div
        className="flex-1 flex flex-col lg:flex-row min-h-0 items-stretch overflow-hidden"
        style={{ overflowX: 'visible' }}
      >
        {/* Questions Sidebar */}
        <div 
          className={`${
            showQuestionsList ? 'fixed inset-y-0 left-0 z-40 flex h-full max-h-dvh flex-col lg:relative lg:max-h-none' : 'hidden'
          } ${
            isSidebarCollapsed ? 'lg:hidden' : 'lg:flex lg:flex-col'
          } w-64 flex-shrink-0 border-r transition-all duration-300 lg:h-full lg:min-h-0 lg:self-stretch`} 
          style={{ 
            backgroundColor: 'var(--card-white)', 
            borderColor: 'var(--card-border)',
            zIndex: 100,
            overflow: 'hidden',
            minHeight: 0
          }}
        >
          {/* Header */}
          <div className="flex-shrink-0 flex justify-between items-center p-4 pb-3 border-b" style={{ borderColor: 'var(--card-border)' }}>
            <h3 className="text-sm font-semibold uppercase tracking-wide" style={{ color: 'var(--text-secondary)' }}>
              Questions
            </h3>
            <button
              onClick={() => {
                if (window.innerWidth < 1024) {
                  setShowQuestionsList(false);
                } else {
                  toggleSidebar();
                }
              }}
              className="p-1 rounded-lg transition-colors hover:bg-gray-100"
              title={window.innerWidth < 1024 ? 'Close' : 'Collapse sidebar'}
            >
              <svg className="h-5 w-5" style={{ color: 'var(--text-secondary)' }} fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d={window.innerWidth < 1024 ? "M6 18L18 6M6 6l12 12" : "M11 19l-7-7 7-7m8 14l-7-7 7-7"} />
              </svg>
            </button>
          </div>
          
          {/* relative + absolute inset-0: reliable scroll area (flex-1 alone often gets unbounded height in nested flex) */}
          <div className="relative min-h-0 flex-1 w-full" style={{ minHeight: 0 }}>
            <div
              className="absolute inset-0 overflow-y-scroll overflow-x-hidden overscroll-contain pr-1 touch-pan-y"
              style={{ WebkitOverflowScrolling: 'touch' }}
            >
            <div className="px-4 pb-4 pt-3">
              {loading ? (
                <div className="text-center py-8">
                  <div className="w-8 h-8 border-4 border-t-transparent rounded-full animate-spin mx-auto" style={{ borderColor: 'var(--text-primary)', borderTopColor: 'transparent' }}></div>
                </div>
              ) : questions.length === 0 ? (
                <p className="text-sm text-center py-8" style={{ color: 'var(--text-secondary)' }}>
                  No questions available
                </p>
              ) : (
                <div className="space-y-2">
                  {questions.map((q, idx) => (
                    <div
                      key={q._id}
                      className={`rounded-lg transition-all duration-200 hover:z-50 ${
                        selectedQuestion?._id === q._id ? 'shadow-lg z-50' : 'hover:shadow'
                      }`}
                      style={{ 
                        backgroundColor: selectedQuestion?._id === q._id ? 'var(--accent-indigo)' : 'var(--background-light)',
                        border: selectedQuestion?._id === q._id ? '2px solid var(--accent-indigo)' : '1px solid var(--card-border)',
                        position: 'relative'
                      }}
                    >
                      <div className="flex items-start gap-2 p-3">
                        <button
                          onClick={() => {
                            setSelectedQuestion(q);
                            setSelectedLanguage(q.languages?.[0] || 'javascript');
                            setShowQuestionsList(false);
                          }}
                          className="flex-1 flex items-start gap-2 text-left"
                        >
                          <span className="flex-shrink-0 flex h-6 w-6 items-center justify-center rounded-full bg-indigo-100 text-indigo-700 text-xs font-bold">
                            {idx + 1}
                          </span>
                          <div className="flex-1 min-w-0">
                            <p 
                              className="text-sm font-medium line-clamp-2 leading-tight" 
                              style={{ color: 'var(--text-primary)' }}
                              title={q.title?.replace(/<[^>]*>/g, '') || 'Untitled'}
                            >
                              {q.title?.replace(/<[^>]*>/g, '') || 'Untitled'}
                            </p>
                            <p className="text-xs mt-0.5 font-mono" style={{ color: 'var(--text-secondary)' }}>
                              ID: {q._id}
                            </p>
                            <p className="text-xs mt-1" style={{ color: 'var(--text-secondary)' }}>
                              {q.difficulty} • {QUESTION_TYPE_LABELS[q.type] || q.type}
                            </p>
                          </div>
                        </button>
                        
                        {/* Three-dot menu */}
                        <Menu as="div" style={{ position: 'relative', zIndex: 10000 }}>
                          {({ open }) => (
                            <>
                              <Menu.Button 
                                className="p-1.5 rounded-lg hover:bg-white/10 transition-colors flex-shrink-0"
                                onClick={(e) => e.stopPropagation()}
                              >
                                <svg
                                  className="h-4 w-4"
                                  style={{ color: 'var(--text-secondary)' }}
                                  xmlns="http://www.w3.org/2000/svg"
                                  viewBox="0 0 20 20"
                                  fill="currentColor"
                                >
                                  <path d="M10 6a2 2 0 110-4 2 2 0 010 4zM10 12a2 2 0 110-4 2 2 0 010 4zM10 18a2 2 0 110-4 2 2 0 010 4z" />
                                </svg>
                              </Menu.Button>
                              <Transition
                                as={Fragment}
                                enter="transition ease-out duration-100"
                                enterFrom="transform opacity-0 scale-95"
                                enterTo="transform opacity-100 scale-100"
                                leave="transition ease-in duration-75"
                                leaveFrom="transform opacity-100 scale-100"
                                leaveTo="transform opacity-0 scale-95"
                              >
                                <Portal>
                                  <Menu.Items 
                                    anchor="bottom"
                                    className="w-48 origin-top rounded-lg shadow-2xl ring-1 ring-black ring-opacity-5 focus:outline-none backdrop-blur-sm mt-2" 
                                    style={{ 
                                      backgroundColor: 'var(--card-white)', 
                                      border: '1px solid var(--card-border)',
                                      zIndex: 99999
                                    }}
                                  >
                                    <div className="py-1">
                                      <Menu.Item>
                                        {({ active }) => (
                                          <button
                                            onClick={(e) => {
                                              e.stopPropagation();
                                              handleViewStatement(q._id);
                                            }}
                                            className={`${
                                              active ? 'bg-indigo-50' : ''
                                            } group flex w-full items-center gap-2 px-3 py-2 text-xs transition-colors`}
                                            style={{ color: 'var(--text-primary)' }}
                                          >
                                            <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                                            </svg>
                                            View Statement
                                          </button>
                                        )}
                                      </Menu.Item>
                                      <Menu.Item>
                                        {({ active }) => (
                                          <button
                                            onClick={(e) => {
                                              e.stopPropagation();
                                              handleViewSolution(q._id);
                                            }}
                                            className={`${
                                              active ? 'bg-indigo-50' : ''
                                            } group flex w-full items-center gap-2 px-3 py-2 text-xs transition-colors`}
                                            style={{ color: 'var(--text-primary)' }}
                                          >
                                            <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4" />
                                            </svg>
                                            View Solution
                                          </button>
                                        )}
                                      </Menu.Item>
                                      <Menu.Item>
                                        {({ active }) => (
                                          <button
                                            onClick={(e) => {
                                              e.stopPropagation();
                                              handleViewTestCases(q._id);
                                            }}
                                            className={`${
                                              active ? 'bg-indigo-50' : ''
                                            } group flex w-full items-center gap-2 px-3 py-2 text-xs transition-colors`}
                                            style={{ color: 'var(--text-primary)' }}
                                          >
                                            <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
                                            </svg>
                                            View Test Cases
                                          </button>
                                        )}
                                      </Menu.Item>
                                      <div className="my-1 h-px" style={{ backgroundColor: 'var(--card-border)' }}></div>
                                      <Menu.Item>
                                        {({ active }) => (
                                          <button
                                            onClick={(e) => {
                                              e.stopPropagation();
                                              handleEditQuestion(q._id);
                                            }}
                                            className={`${
                                              active ? 'bg-indigo-50' : ''
                                            } group flex w-full items-center gap-2 px-3 py-2 text-xs transition-colors`}
                                            style={{ color: 'var(--text-primary)' }}
                                          >
                                            <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                                            </svg>
                                            Edit Question
                                          </button>
                                        )}
                                      </Menu.Item>
                                      <Menu.Item>
                                        {({ active }) => (
                                          <button
                                            onClick={(e) => {
                                              e.stopPropagation();
                                              handlePreviewAsStudent(q._id);
                                            }}
                                            className={`${
                                              active ? 'bg-indigo-50' : ''
                                            } group flex w-full items-center gap-2 px-3 py-2 text-xs transition-colors`}
                                            style={{ color: 'var(--text-primary)' }}
                                          >
                                            <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                                            </svg>
                                            Preview as Student
                                          </button>
                                        )}
                                      </Menu.Item>
                                      <div className="my-1 h-px" style={{ backgroundColor: 'var(--card-border)' }}></div>
                                      <Menu.Item>
                                        {({ active }) => {
                                          // Get class-specific settings
                                          const classEntry = q.classes?.find(
                                            (c) => c.classId?.toString() === selectedClass._id || c.classId?._id?.toString() === selectedClass._id
                                          );
                                          const isPublished = classEntry?.isPublished || false;
                                          
                                          return (
                                            <button
                                              onClick={(e) => {
                                                e.stopPropagation();
                                                handlePublish(q._id);
                                              }}
                                              className={`${
                                                active ? (isPublished ? 'bg-gray-50' : 'bg-green-50') : ''
                                              } group flex w-full items-center gap-2 px-3 py-2 text-xs transition-colors cursor-pointer`}
                                              style={{ color: '#16a34a' }}
                                            >
                                              <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                                              </svg>
                                              {isPublished ? 'Unpublish Question' : 'Publish Question'}
                                            </button>
                                          );
                                        }}
                                      </Menu.Item>
                                      <Menu.Item>
                                        {({ active }) => {
                                          // Get class-specific settings
                                          const classEntry = q.classes?.find(
                                            (c) => c.classId?.toString() === selectedClass._id || c.classId?._id?.toString() === selectedClass._id
                                          );
                                          const isDisabled = classEntry?.isDisabled || false;
                                          
                                          return (
                                            <button
                                              onClick={(e) => {
                                                e.stopPropagation();
                                                handleDisable(q._id);
                                              }}
                                              className={`${
                                                active ? (isDisabled ? 'bg-gray-50' : 'bg-red-50') : ''
                                              } group flex w-full items-center gap-2 px-3 py-2 text-xs transition-colors cursor-pointer`}
                                              style={{ color: '#dc2626' }}
                                            >
                                              <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M18.364 18.364A9 9 0 005.636 5.636m12.728 12.728A9 9 0 015.636 5.636m12.728 12.728L5.636 5.636" />
                                              </svg>
                                              {isDisabled ? 'Enable Question' : 'Disable Question'}
                                            </button>
                                          );
                                        }}
                                      </Menu.Item>
                                    </div>
                                  </Menu.Items>
                                </Portal>
                              </Transition>
                            </>
                          )}
                        </Menu>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
            </div>
          </div>
        </div>

        {/* Collapsed Sidebar Expand Button */}
        {isSidebarCollapsed && (
          <button
            onClick={toggleSidebar}
            className="hidden lg:flex items-center justify-center w-10 flex-shrink-0 border-r hover:bg-gray-50 transition-colors"
            style={{ backgroundColor: 'var(--card-white)', borderColor: 'var(--card-border)' }}
            title="Expand sidebar"
          >
            <svg className="h-5 w-5 transform rotate-180" style={{ color: 'var(--text-secondary)' }} fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 19l-7-7 7-7m8 14l-7-7 7-7" />
            </svg>
          </button>
        )}

        {/* Middle Column - Question Details */}
        {selectedQuestion ? (
          <>
            <div 
              className="min-h-0 min-w-0 overflow-y-auto p-4 sm:p-6 transition-all duration-150" 
              style={{ 
                width: `${leftPanelWidth}%`,
                backgroundColor: 'var(--background-content)'
              }}
            >
              <div className="max-w-3xl">
                <h1 
                  className="text-xl sm:text-2xl font-bold mb-3 sm:mb-4" 
                  style={{ color: 'var(--text-heading)' }}
                  dangerouslySetInnerHTML={{ __html: selectedQuestion.title }}
                />

                <div className="flex flex-wrap items-center gap-2 mb-6">
                  <button
                    type="button"
                    onClick={handleViewQuestionStatistics}
                    className="inline-flex items-center px-3 py-1.5 rounded-lg text-xs font-semibold text-white bg-indigo-600 hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  >
                    View question statistics
                  </button>
                  <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold ${
                    selectedQuestion.difficulty === 'easy' ? 'bg-green-100 text-green-700' :
                    selectedQuestion.difficulty === 'medium' ? 'bg-yellow-100 text-yellow-700' :
                    'bg-red-100 text-red-700'
                  }`}>
                    {selectedQuestion.difficulty}
                  </span>
                  <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold bg-purple-100 text-purple-700">
                    {selectedQuestion.maxPoints || 10} points
                  </span>
                  <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold bg-indigo-100 text-indigo-800">
                    {QUESTION_TYPE_LABELS[selectedQuestion.type] || selectedQuestion.type}
                  </span>
                  {(() => {
                    // Get class-specific settings
                    const classEntry = selectedQuestion.classes?.find(
                      (c) => c.classId?.toString() === selectedClass._id || c.classId?._id?.toString() === selectedClass._id
                    );
                    const isPublished = classEntry?.isPublished || false;
                    const isDisabled = classEntry?.isDisabled || false;
                    
                    return (
                      <>
                        <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold ${
                          isPublished ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-700'
                        }`}>
                          {isPublished ? 'Published' : 'Unpublished'}
                        </span>
                        <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold ${
                          isDisabled ? 'bg-red-100 text-red-700' : 'bg-blue-100 text-blue-700'
                        }`}>
                          {isDisabled ? 'Disabled' : 'Enabled'}
                        </span>
                      </>
                    );
                  })()}
                </div>

                <div className="mb-4 sm:mb-6">
                  <h3 className="text-base sm:text-lg font-semibold mb-2" style={{ color: 'var(--text-heading)' }}>
                    Problem Statement
                  </h3>
                  <div 
                    className="text-xs sm:text-sm leading-relaxed" 
                    style={{ color: 'var(--text-primary)' }}
                    dangerouslySetInnerHTML={{ __html: selectedQuestion.description }}
                  />
                </div>

                {['fillInTheBlanksCoding', 'coding', 'codingWithDriver'].includes(selectedQuestion.type) &&
                  selectedQuestion.inputFormat && (
                  <div className="mb-4 sm:mb-6">
                    <h3 className="text-base sm:text-lg font-semibold mb-2" style={{ color: 'var(--text-heading)' }}>
                      Input Format
                    </h3>
                    <div 
                      className="text-xs sm:text-sm leading-relaxed" 
                      style={{ color: 'var(--text-primary)' }}
                      dangerouslySetInnerHTML={{ __html: selectedQuestion.inputFormat }}
                    />
                  </div>
                )}

                {['fillInTheBlanksCoding', 'coding', 'codingWithDriver'].includes(selectedQuestion.type) &&
                  selectedQuestion.outputFormat && (
                  <div className="mb-4 sm:mb-6">
                    <h3 className="text-base sm:text-lg font-semibold mb-2" style={{ color: 'var(--text-heading)' }}>
                      Output Format
                    </h3>
                    <div 
                      className="text-xs sm:text-sm leading-relaxed" 
                      style={{ color: 'var(--text-primary)' }}
                      dangerouslySetInnerHTML={{ __html: selectedQuestion.outputFormat }}
                    />
                  </div>
                )}

                {selectedQuestion.explanation && (
                  <div className="mb-4 sm:mb-6">
                    <h3 className="text-base sm:text-lg font-semibold mb-2" style={{ color: 'var(--text-heading)' }}>
                      Explanation
                    </h3>
                    <div
                      className="text-xs sm:text-sm leading-relaxed"
                      style={{ color: 'var(--text-primary)' }}
                      dangerouslySetInnerHTML={{ __html: selectedQuestion.explanation }}
                    />
                  </div>
                )}

                {selectedQuestion.constraints && (
                  <div className="mb-4 sm:mb-6">
                    <h3 className="text-base sm:text-lg font-semibold mb-2" style={{ color: 'var(--text-heading)' }}>
                      Constraints
                    </h3>
                    <div 
                      className="text-xs sm:text-sm leading-relaxed" 
                      style={{ color: 'var(--text-primary)' }}
                      dangerouslySetInnerHTML={{ __html: selectedQuestion.constraints }}
                    />
                  </div>
                )}

                {['fillInTheBlanksCoding', 'coding', 'codingWithDriver'].includes(selectedQuestion.type) &&
                  selectedQuestion.sampleIo?.some((p) => (p.input || '').trim() || (p.output || '').trim()) && (
                  <div className="mb-4 sm:mb-6">
                    <h3 className="text-base sm:text-lg font-semibold mb-2" style={{ color: 'var(--text-heading)' }}>
                      Sample input / output
                    </h3>
                    <div className="space-y-2 sm:space-y-3">
                      {selectedQuestion.sampleIo
                        .filter((p) => (p.input || '').trim() || (p.output || '').trim())
                        .map((pair, index) => (
                        <div 
                          key={index} 
                          className="p-2 sm:p-3 rounded-lg border space-y-2" 
                          style={{ backgroundColor: 'var(--background-light)', borderColor: 'var(--card-border)' }}
                        >
                          <div>
                            <span className="text-xs font-semibold" style={{ color: 'var(--text-secondary)' }}>Input</span>
                            <pre 
                              className="text-xs sm:text-sm whitespace-pre-wrap mt-1" 
                              style={{ color: 'var(--text-primary)' }}
                            >
                              {pair.input || '—'}
                            </pre>
                          </div>
                          <div>
                            <span className="text-xs font-semibold" style={{ color: 'var(--text-secondary)' }}>Output</span>
                            <pre 
                              className="text-xs sm:text-sm whitespace-pre-wrap mt-1" 
                              style={{ color: 'var(--text-primary)' }}
                            >
                              {pair.output || '—'}
                            </pre>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            </div>

            {/* Horizontal Draggable Divider */}
            <div
              className="flex-shrink-0 relative group hidden lg:block"
              style={{ 
                width: '4px',
                cursor: 'col-resize',
                backgroundColor: isDragging ? 'var(--accent-indigo)' : 'var(--card-border)',
                transition: isDragging ? 'none' : 'background-color 0.2s'
              }}
              onMouseDown={handleDividerMouseDown}
            >
              <div 
                className="absolute inset-y-0 left-1/2 transform -translate-x-1/2 w-1 opacity-0 group-hover:opacity-100 transition-opacity"
                style={{ 
                  backgroundColor: 'var(--accent-indigo)',
                  width: '2px'
                }}
              />
              <div className="absolute inset-y-0 -left-1 -right-1" />
            </div>

            {/* Right Column - Code Editor */}
            <div 
              id="teacher-right-panel"
              className="w-full lg:flex-1 min-h-0 min-w-0 border-t lg:border-t-0 flex flex-col transition-all duration-150" 
              style={{ 
                width: !isSidebarCollapsed && selectedQuestion ? `${100 - leftPanelWidth}%` : 'auto',
                backgroundColor: 'var(--background-content)',
                borderColor: 'var(--card-border)'
              }}
            >
              {/* Editor Controls (type-aware) */}
              <div className="border-b p-3 sm:p-4 flex-shrink-0" style={{ backgroundColor: 'var(--card-white)', borderColor: 'var(--card-border)' }}>
                <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
                  <div className="flex flex-col sm:flex-row items-start sm:items-center gap-3 sm:gap-4 w-full sm:w-auto">
                    {isRunnableCoding && selectedQuestion.languages?.length > 0 ? (
                      <div className="w-full sm:w-auto">
                        <label className="block text-xs font-medium mb-1" style={{ color: 'var(--text-secondary)' }}>
                          Language
                        </label>
                        <select
                          value={selectedLanguage}
                          onChange={(e) => setSelectedLanguage(e.target.value)}
                          className="w-full sm:w-auto rounded-lg border shadow-sm focus:border-indigo-500 focus:ring-indigo-500 text-sm px-3 py-1.5"
                          style={{ 
                            borderColor: 'var(--card-border)', 
                            backgroundColor: 'var(--background-light)', 
                            color: 'var(--text-primary)' 
                          }}
                        >
                          {selectedQuestion.languages?.map((lang) => (
                            <option key={lang} value={lang}>
                              {lang.charAt(0).toUpperCase() + lang.slice(1)}
                            </option>
                          ))}
                        </select>
                      </div>
                    ) : !isRunnableCoding ? (
                      <div>
                        <p className="text-xs font-semibold" style={{ color: 'var(--text-heading)' }}>
                          {QUESTION_TYPE_LABELS[questionType] || questionType}
                        </p>
                        <p className="text-xs mt-0.5" style={{ color: 'var(--text-secondary)' }}>
                          Student-style preview — Run Code is only for coding questions
                        </p>
                      </div>
                    ) : null}
                    {isRunnableCoding && (
                      <div className="hidden sm:flex items-center gap-3">
                        <span className="text-xs font-medium" style={{ color: 'var(--text-secondary)' }}>
                          Time: {selectedQuestion.timeLimit ?? 2}s
                        </span>
                        <span className="text-xs font-medium" style={{ color: 'var(--text-secondary)' }}>
                          Memory: {selectedQuestion.memoryLimit ?? 256}MB
                        </span>
                      </div>
                    )}
                  </div>
                  <div className="flex items-center gap-2 w-full sm:w-auto justify-end">
                    {(showFullCodeEditor || isFillInBlanksCoding) && (
                      <button
                        type="button"
                        onClick={toggleFullscreen}
                        className="px-3 py-1.5 text-xs font-semibold rounded-lg border transition-all duration-200 hover:shadow"
                        style={{ 
                          backgroundColor: 'var(--card-white)', 
                          borderColor: 'var(--card-border)', 
                          color: 'var(--text-primary)' 
                        }}
                        title="Fullscreen (F11)"
                      >
                        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 8V4m0 0h4M4 4l5 5m11-1V4m0 0h-4m4 0l-5 5M4 16v4m0 0h4m-4 0l5-5m11 5l-5-5m5 5v-4m0 4h-4" />
                        </svg>
                      </button>
                    )}
                    {isRunnableCoding && (
                      <>
                        <button
                          type="button"
                          onClick={handleResetCode}
                          className="px-3 py-1.5 text-xs font-semibold rounded-lg border transition-all duration-200 hover:shadow"
                          style={{ 
                            backgroundColor: 'var(--card-white)', 
                            borderColor: 'var(--card-border)', 
                            color: 'var(--text-primary)' 
                          }}
                        >
                          Reset
                        </button>
                        <button
                          type="button"
                          onClick={handleCopyCode}
                          className="px-3 py-1.5 text-xs font-semibold rounded-lg border transition-all duration-200 hover:shadow"
                          style={{ 
                            backgroundColor: 'var(--card-white)', 
                            borderColor: 'var(--card-border)', 
                            color: 'var(--text-primary)' 
                          }}
                        >
                          Copy
                        </button>
                      </>
                    )}
                  </div>
                </div>
              </div>

              {/* Code / preview section — inner wrapper splits editor vs Test; id used for vertical drag */}
              <div className="flex-1 flex flex-col overflow-hidden p-4 min-h-0">
                <div
                  id={isRunnableCoding ? 'teacher-code-split' : undefined}
                  className="flex flex-col flex-1 min-h-0 min-w-0 overflow-hidden w-full"
                >
                {isRunnableCoding ? (
                  <>
                    {showFullCodeEditor && (
                      <>
                        {questionType === 'codingWithDriver' && (
                          <div
                            className="mb-3 text-xs rounded-lg px-3 py-2 border"
                            style={{
                              backgroundColor: 'rgba(139, 92, 246, 0.08)',
                              borderColor: 'var(--card-border)',
                              color: 'var(--text-primary)',
                            }}
                          >
                            <strong style={{ color: 'var(--text-heading)' }}>LeetCode-style:</strong>{' '}
                            Complete the stub below. Your solution is merged with the hidden driver for judging.
                          </div>
                        )}
                        <div
                          className="flex flex-col min-h-0 overflow-hidden transition-all duration-150"
                          style={{ flex: `${editorHeight} 1 0%`, minHeight: '8rem' }}
                        >
                          <CodeEditor
                            value={code}
                            onChange={setCode}
                            defaultValue={getCodeTemplateForLanguage(selectedQuestion, selectedLanguage)}
                            language={selectedLanguage}
                            disabled={false}
                            isFillInTheBlanks={false}
                            height="100%"
                          />
                        </div>
                        <div
                          className="flex-shrink-0 relative group"
                          style={{ 
                            height: '4px',
                            cursor: 'row-resize',
                            backgroundColor: isDraggingVertical ? 'var(--accent-indigo)' : 'var(--card-border)',
                            transition: isDraggingVertical ? 'none' : 'background-color 0.2s'
                          }}
                          onMouseDown={handleVerticalDividerMouseDown}
                        >
                          <div 
                            className="absolute inset-x-0 top-1/2 transform -translate-y-1/2 h-1 opacity-0 group-hover:opacity-100 transition-opacity"
                            style={{ 
                              backgroundColor: 'var(--accent-indigo)',
                              height: '2px'
                            }}
                          />
                          <div className="absolute inset-x-0 -top-1 -bottom-1" />
                        </div>
                      </>
                    )}
                    {isFillInBlanksCoding && (
                      <>
                        <div
                          className="flex flex-col min-h-0 overflow-hidden"
                          style={{ flex: `${editorHeight} 1 0%`, minHeight: '8rem' }}
                        >
                          <h4 className="text-xs font-semibold mb-2 shrink-0" style={{ color: 'var(--text-heading)' }}>
                            Template (line below replaces <code className="font-mono">// FILL_IN_THE_BLANK</code>)
                          </h4>
                          <pre
                            className="text-xs mb-3 p-3 rounded-lg overflow-auto shrink-0 max-h-[45%] font-mono border leading-relaxed"
                            style={{
                              backgroundColor: 'var(--background-light)',
                              borderColor: 'var(--card-border)',
                              color: 'var(--text-primary)',
                            }}
                          >
                            {stripHtml(selectedQuestion.codeSnippet || '') || '(No snippet)'}
                          </pre>
                          <label className="text-xs font-medium shrink-0" style={{ color: 'var(--text-secondary)' }}>
                            Line for the blank
                          </label>
                          <textarea
                            value={fillInBlankLine}
                            onChange={(e) => setFillInBlankLine(e.target.value)}
                            className="mt-1 flex-1 min-h-[96px] w-full rounded-lg border shadow-sm focus:ring-indigo-500 focus:border-indigo-500 text-xs p-2 font-mono"
                            style={{ 
                              borderColor: 'var(--card-border)', 
                              backgroundColor: 'var(--card-white)', 
                              color: 'var(--text-primary)' 
                            }}
                            placeholder="e.g. return a + b;"
                          />
                        </div>
                        <div
                          className="flex-shrink-0 relative group"
                          style={{ 
                            height: '4px',
                            cursor: 'row-resize',
                            backgroundColor: isDraggingVertical ? 'var(--accent-indigo)' : 'var(--card-border)',
                            transition: isDraggingVertical ? 'none' : 'background-color 0.2s'
                          }}
                          onMouseDown={handleVerticalDividerMouseDown}
                        >
                          <div 
                            className="absolute inset-x-0 top-1/2 transform -translate-y-1/2 h-1 opacity-0 group-hover:opacity-100 transition-opacity"
                            style={{ 
                              backgroundColor: 'var(--accent-indigo)',
                              height: '2px'
                            }}
                          />
                          <div className="absolute inset-x-0 -top-1 -bottom-1" />
                        </div>
                      </>
                    )}
                  </>
                ) : (
                  <div className="flex-1 overflow-y-auto space-y-4 pr-1">
                    <p className="text-sm" style={{ color: 'var(--text-secondary)' }}>
                      This question is not executed in the sandbox here. Use <strong>Preview as Student</strong> in the ⋮ menu for the full interactive view.
                    </p>
                    {questionType === 'singleCorrectMcq' && (
                      <div className="space-y-2">
                        <p className="text-xs font-semibold uppercase tracking-wide" style={{ color: 'var(--text-heading)' }}>
                          Options (single correct)
                        </p>
                        {selectedQuestion.options?.map((option, index) => (
                          <div
                            key={index}
                            className="flex items-start gap-3 p-3 rounded-lg border"
                            style={{ borderColor: 'var(--card-border)', backgroundColor: 'var(--card-white)' }}
                          >
                            <span className="text-sm font-semibold shrink-0" style={{ color: 'var(--text-primary)' }}>
                              {(index + 10).toString(36).toUpperCase()}.
                            </span>
                            <div className="text-sm prose prose-sm max-w-none flex-1" style={{ color: 'var(--text-primary)' }}>
                              {parse(option || '')}
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                    {questionType === 'multipleCorrectMcq' && (
                      <div className="space-y-2">
                        <p className="text-xs font-semibold uppercase tracking-wide" style={{ color: 'var(--text-heading)' }}>
                          Options (multiple correct)
                        </p>
                        {selectedQuestion.options?.map((option, index) => (
                          <div
                            key={index}
                            className="flex items-start gap-3 p-3 rounded-lg border"
                            style={{ borderColor: 'var(--card-border)', backgroundColor: 'var(--card-white)' }}
                          >
                            <span className="text-sm font-semibold shrink-0" style={{ color: 'var(--text-primary)' }}>
                              {(index + 10).toString(36).toUpperCase()}.
                            </span>
                            <div className="text-sm prose prose-sm max-w-none flex-1" style={{ color: 'var(--text-primary)' }}>
                              {parse(option || '')}
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                    {questionType === 'fillInTheBlanks' && (
                      <div
                        className="p-3 rounded-lg border text-sm"
                        style={{ borderColor: 'var(--card-border)', backgroundColor: 'var(--background-light)', color: 'var(--text-primary)' }}
                      >
                        Students type a short answer in a text field (no code execution).
                      </div>
                    )}
                  </div>
                )}

                {/* Custom Test & Actions */}
                <div
                  className={`overflow-y-auto border-t pt-3 space-y-3 ${isRunnableCoding ? 'min-h-0' : 'flex-shrink-0 mt-auto'}`}
                  style={{
                    borderColor: 'var(--card-border)',
                    ...(isRunnableCoding ? { flex: `${100 - editorHeight} 1 0%`, minHeight: 0 } : {}),
                  }}
                >
                  <h4 className="text-sm font-semibold" style={{ color: 'var(--text-heading)' }}>
                    {isRunnableCoding ? 'Test & Present' : 'Present'}
                  </h4>
                  {isRunnableCoding && (
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                    <div>
                      <label className="text-xs font-medium" style={{ color: 'var(--text-secondary)' }}>
                        Custom Input
                      </label>
                      <textarea
                        value={customInput}
                        onChange={(e) => setCustomInput(e.target.value)}
                        rows={2}
                        className="block w-full mt-1 rounded-lg border shadow-sm focus:ring-indigo-500 focus:border-indigo-500 text-xs p-2"
                        style={{ 
                          borderColor: 'var(--card-border)', 
                          backgroundColor: 'var(--card-white)', 
                          color: 'var(--text-primary)' 
                        }}
                        placeholder="e.g., [1, 5, 3, 9, 2]"
                      />
                    </div>
                    <div>
                      <label className="text-xs font-medium" style={{ color: 'var(--text-secondary)' }}>
                        Expected Output
                      </label>
                      <textarea
                        value={customOutput}
                        onChange={(e) => setCustomOutput(e.target.value)}
                        rows={2}
                        className="block w-full mt-1 rounded-lg border shadow-sm focus:ring-indigo-500 focus:border-indigo-500 text-xs p-2"
                        style={{ 
                          borderColor: 'var(--card-border)', 
                          backgroundColor: 'var(--card-white)', 
                          color: 'var(--text-primary)' 
                        }}
                        placeholder="e.g., 9"
                      />
                    </div>
                  </div>
                  )}

                  {/* Action Buttons */}
                  <div className="flex flex-wrap justify-end gap-2 border-t pt-3" style={{ borderColor: 'var(--card-border)' }}>
                    {isRunnableCoding && (
                      <>
                        <button
                          type="button"
                          onClick={handleRunCode}
                          disabled={loading}
                          className={`inline-flex items-center px-4 py-2 rounded-lg text-sm font-semibold text-white focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 transition-all duration-200 ${
                            loading ? 'bg-blue-400 cursor-not-allowed' : 'bg-blue-600 hover:bg-blue-700'
                          }`}
                        >
                          {loading ? (
                            <>
                              <svg className="animate-spin -ml-1 mr-2 h-4 w-4 text-white" fill="none" viewBox="0 0 24 24">
                                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                              </svg>
                              Running...
                            </>
                          ) : isFillInBlanksCoding ? 'Run tests' : 'Run Code'}
                        </button>
                        <button
                          type="button"
                          onClick={handleRunWithCustomInput}
                          disabled={!customInput.trim() || loading}
                          className={`inline-flex items-center px-4 py-2 rounded-lg text-sm font-semibold text-white focus:outline-none focus:ring-2 focus:ring-offset-2 transition-all duration-200 ${
                            customInput.trim() && !loading ? 'bg-green-600 hover:bg-green-700 focus:ring-green-500' : 'bg-gray-400 cursor-not-allowed'
                          }`}
                        >
                          {loading ? (
                            <>
                              <svg className="animate-spin -ml-1 mr-2 h-4 w-4 text-white" fill="none" viewBox="0 0 24 24">
                                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                              </svg>
                              Running...
                            </>
                          ) : 'Run Custom'}
                        </button>
                      </>
                    )}
                    <button
                      type="button"
                      onClick={handlePresentSolution}
                      disabled={loading}
                      className={`inline-flex items-center px-4 py-2 rounded-lg text-sm font-semibold text-white focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 transition-all duration-200 ${
                        loading ? 'bg-indigo-400 cursor-not-allowed' : 'bg-indigo-600 hover:bg-indigo-700'
                      }`}
                    >
                      Present Solution
                    </button>
                  </div>

                </div>
                </div>
              </div>
            </div>
          </>
        ) : (
          <div className="flex-1 flex items-center justify-center" style={{ backgroundColor: 'var(--background-content)' }}>
            <div className="text-center">
              <svg className="mx-auto h-16 w-16 mb-4" style={{ color: 'var(--text-secondary)' }} fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M8.228 9c.549-1.165 2.03-2 3.772-2 2.21 0 4 1.343 4 3 0 1.4-1.278 2.575-3.006 2.907-.542.104-.994.54-.994 1.093m0 3h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              <h3 className="text-lg font-semibold mb-2" style={{ color: 'var(--text-primary)' }}>
                Select a Question
              </h3>
              <p className="text-sm" style={{ color: 'var(--text-secondary)' }}>
                Choose a question from the left to start presenting
              </p>
            </div>
          </div>
        )}
      </div>

      {/* Fullscreen Editor Overlay (coding + fill-in-blanks coding only) */}
      {isFullscreen && selectedQuestion && (showFullCodeEditor || isFillInBlanksCoding) && (
        <div className="fixed inset-0 z-50 flex flex-col" style={{ backgroundColor: 'var(--background-content)' }}>
          <div className="flex-shrink-0 border-b p-4 flex items-center justify-between" style={{ backgroundColor: 'var(--card-white)', borderColor: 'var(--card-border)' }}>
            <div className="flex items-center gap-4 flex-wrap">
              <div>
                <h3 className="text-lg font-semibold" style={{ color: 'var(--text-heading)' }}>
                  {isFillInBlanksCoding ? 'Fill-in code — Fullscreen' : 'Code Editor — Fullscreen'}
                </h3>
                <p className="text-xs mt-1" style={{ color: 'var(--text-secondary)' }}>
                  Press <kbd className="px-1.5 py-0.5 bg-gray-100 rounded border border-gray-300 text-xs">ESC</kbd> or <kbd className="px-1.5 py-0.5 bg-gray-100 rounded border border-gray-300 text-xs">F11</kbd> to exit
                </p>
              </div>
              {isRunnableCoding && selectedQuestion.languages?.length > 0 && (
                <select
                  value={selectedLanguage}
                  onChange={(e) => setSelectedLanguage(e.target.value)}
                  className="rounded-lg border shadow-sm focus:border-indigo-500 focus:ring-indigo-500 text-sm px-3 py-1.5"
                  style={{ 
                    borderColor: 'var(--card-border)', 
                    backgroundColor: 'var(--background-light)', 
                    color: 'var(--text-primary)' 
                  }}
                >
                  {selectedQuestion.languages?.map((lang) => (
                    <option key={lang} value={lang}>
                      {lang.charAt(0).toUpperCase() + lang.slice(1)}
                    </option>
                  ))}
                </select>
              )}
            </div>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={handleRunCode}
                className="inline-flex items-center px-4 py-2 rounded-lg text-sm font-semibold text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
              >
                {isFillInBlanksCoding ? 'Run tests' : 'Run Code'}
              </button>
              <button
                type="button"
                onClick={handlePresentSolution}
                className="inline-flex items-center px-4 py-2 rounded-lg text-sm font-semibold text-white bg-indigo-600 hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500"
              >
                Present
              </button>
              <button
                type="button"
                onClick={toggleFullscreen}
                className="px-3 py-2 rounded-lg border transition-all duration-200 hover:shadow"
                style={{ 
                  backgroundColor: 'var(--card-white)', 
                  borderColor: 'var(--card-border)', 
                  color: 'var(--text-primary)' 
                }}
                title="Exit Fullscreen"
              >
                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
          </div>
          <div className="flex-1 overflow-hidden p-4 min-h-0 flex flex-col">
            {showFullCodeEditor && (
              <div className="flex-1 min-h-0 flex flex-col overflow-hidden">
                <CodeEditor
                  value={code}
                  onChange={setCode}
                  defaultValue={getCodeTemplateForLanguage(selectedQuestion, selectedLanguage)}
                  language={selectedLanguage}
                  disabled={false}
                  isFillInTheBlanks={false}
                  height="100%"
                />
              </div>
            )}
            {isFillInBlanksCoding && (
              <div className="flex flex-col flex-1 min-h-0 gap-3">
                <pre
                  className="text-xs p-3 rounded-lg overflow-auto font-mono border leading-relaxed shrink-0 max-h-[40%]"
                  style={{
                    backgroundColor: 'var(--background-light)',
                    borderColor: 'var(--card-border)',
                    color: 'var(--text-primary)',
                  }}
                >
                  {stripHtml(selectedQuestion.codeSnippet || '') || '(No snippet)'}
                </pre>
                <textarea
                  value={fillInBlankLine}
                  onChange={(e) => setFillInBlankLine(e.target.value)}
                  className="flex-1 min-h-[120px] w-full rounded-lg border shadow-sm focus:ring-indigo-500 focus:border-indigo-500 text-xs p-2 font-mono"
                  style={{ 
                    borderColor: 'var(--card-border)', 
                    backgroundColor: 'var(--card-white)', 
                    color: 'var(--text-primary)' 
                  }}
                  placeholder="Line for // FILL_IN_THE_BLANK"
                />
              </div>
            )}
          </div>
        </div>
      )}

      {showResultsModal && testResults && (
        <div
          className="fixed inset-0 z-[70] flex items-center justify-center p-4"
          role="dialog"
          aria-modal="true"
          aria-labelledby="results-modal-title"
        >
          <button
            type="button"
            className="absolute inset-0 bg-black/50 cursor-default"
            onClick={closeResultsModal}
            aria-label="Close results"
          />
          <div
            className="relative w-full max-w-lg max-h-[85vh] overflow-y-auto rounded-lg shadow-xl border p-5 z-10"
            style={{ backgroundColor: 'var(--card-white)', borderColor: 'var(--card-border)' }}
          >
            <div className="flex items-start justify-between gap-3 mb-4">
              <h2 id="results-modal-title" className="text-lg font-semibold" style={{ color: 'var(--text-heading)' }}>
                {testResults?.error
                  ? 'Error'
                  : testResults?.isCustomTest
                    ? 'Custom Test Results'
                    : 'Test Results'}
              </h2>
              <button
                type="button"
                onClick={closeResultsModal}
                className="shrink-0 p-1 rounded hover:opacity-70 text-lg leading-none"
                style={{ color: 'var(--text-secondary)' }}
                aria-label="Close"
              >
                ×
              </button>
            </div>
            {!testResults?.error && !testResults?.isCustomTest && testResults?.totalTestCases != null && (
              <div className="mb-3">
                <span
                  className={`px-2.5 py-0.5 rounded-full text-xs font-semibold ${
                    testResults.isCorrect ? 'bg-green-100 text-green-700' : 'bg-yellow-100 text-yellow-700'
                  }`}
                >
                  {testResults.passedTestCases}/{testResults.totalTestCases} Passed
                </span>
              </div>
            )}
            {renderTestResultsBody()}
          </div>
        </div>
      )}
    </div>
  );
};

export default TakeClass;
