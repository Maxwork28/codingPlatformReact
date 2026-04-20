import React, { useState, useEffect, useRef } from 'react';
import { useSelector } from 'react-redux';
import { ArrowLeftIcon } from '@heroicons/react/24/outline';
import { getQuestionsByClass, runCode, runCodeWithCustomInput, submitAnswer } from '../../../common/services/api';
import CodeEditor from '../components/CodeEditor';
import { DiJavascript } from "react-icons/di";
import { FaJava, FaPython, FaDatabase, FaBookOpen } from "react-icons/fa";
import { GiNotebook } from "react-icons/gi";
import { MdDataObject, MdDataArray } from "react-icons/md";

/** Plain text only — avoids showing raw tags like &lt;p&gt;1&lt;/p&gt; in the UI */
const stripHtml = (html) => {
  if (html == null || html === "") return "";
  const str = typeof html === "string" ? html : String(html);
  try {
    const tmp = document.createElement("div");
    tmp.innerHTML = str;
    const text = tmp.textContent || tmp.innerText || "";
    return text.replace(/\s+/g, " ").trim();
  } catch {
    return str.replace(/<[^>]*>/g, "").trim();
  }
};

const StudentTakeClass = () => {
  const { user } = useSelector((state) => state.auth);
  const { classes } = useSelector((state) => state.classes);
  
  // Main state
  const [selectedClass, setSelectedClass] = useState(null);
  const [selectedQuestion, setSelectedQuestion] = useState(null);
  const [questions, setQuestions] = useState([]);
  const [loading, setLoading] = useState(false);
  const [code, setCode] = useState('');
  const [selectedLanguage, setSelectedLanguage] = useState('javascript');
  
  // Layout states
  const [showQuestionsList, setShowQuestionsList] = useState(false);
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(false);
  const [leftPanelWidth, setLeftPanelWidth] = useState(50);
  const [isDragging, setIsDragging] = useState(false);
  const [editorHeight, setEditorHeight] = useState(70);
  const [isDraggingVertical, setIsDraggingVertical] = useState(false);
  const [isFullscreen, setIsFullscreen] = useState(false);
  
  // Test and submission states
  const [customInput, setCustomInput] = useState('');
  const [customOutput, setCustomOutput] = useState('');
  const [testResults, setTestResults] = useState(null);
  const [isRunning, setIsRunning] = useState(false);
  const [isRunningCustom, setIsRunningCustom] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  /** Only load starter when question or language changes — not when `selectedQuestion` object reference is replaced. */
  const lastCodeInitKeyRef = useRef(null);

  // Helper function to get available languages from question
  const getAvailableLanguages = (question) => {
    if (!question) return [];
    
    // First try the languages array
    if (question.languages && question.languages.length > 0) {
      return question.languages;
    }
    
    // Fallback to extracting languages from starterCode
    if (question.starterCode && question.starterCode.length > 0) {
      return question.starterCode.map(sc => sc.language).filter(Boolean);
    }
    
    // Default fallback for coding questions
    return ['javascript'];
  };

  // Check if question is a coding question
  const isCodingQuestion = (question) => {
    if (!question) return false;
    return ['coding', 'fillInTheBlanksCoding', 'codingWithDriver'].includes(question.type);
  };

  // Fetch questions when a class is selected
  useEffect(() => {
    if (selectedClass) {
      const fetchQuestions = async () => {
        try {
          setLoading(true);
          const response = await getQuestionsByClass(selectedClass._id);
          const fetchedQuestions = response.data.questions || [];
          
          // Filter to show only published and enabled questions for students
          const availableQuestions = fetchedQuestions.filter((q) => {
            const classEntry = q.classes?.find(
              (c) => c.classId?.toString() === selectedClass._id || c.classId?._id?.toString() === selectedClass._id
            );
            return classEntry?.isPublished && !classEntry?.isDisabled;
          });
          
          setQuestions(availableQuestions);
          if (availableQuestions.length > 0) {
            const firstQuestion = availableQuestions[0];
            setSelectedQuestion(firstQuestion);
            
            // Get available languages (from languages array or starterCode)
            const availableLanguages = getAvailableLanguages(firstQuestion);
            setSelectedLanguage(availableLanguages[0] || 'javascript');
          }
        } catch (err) {
          console.error('Failed to fetch questions:', err);
        } finally {
          setLoading(false);
        }
      };
      fetchQuestions();
    }
  }, [selectedClass]);

  // Update code when question or language changes (not on every parent re-fetch of the same question)
  useEffect(() => {
    if (selectedQuestion && isCodingQuestion(selectedQuestion)) {
      const availableLanguages = getAvailableLanguages(selectedQuestion);

      if (availableLanguages.length > 0 && !availableLanguages.includes(selectedLanguage)) {
        setSelectedLanguage(availableLanguages[0]);
        return;
      }

      const qid = selectedQuestion._id?.toString() ?? '';
      const codingKey = `${qid}:${selectedLanguage}`;
      if (lastCodeInitKeyRef.current !== codingKey) {
        lastCodeInitKeyRef.current = codingKey;
        const starterCode = selectedQuestion.starterCode?.find((sc) => sc.language === selectedLanguage);
        setCode(starterCode?.code || selectedQuestion.codeSnippet || '// Write your code here...');
      }
    } else {
      lastCodeInitKeyRef.current = null;
      setCode('');
    }
  }, [selectedQuestion, selectedLanguage]);

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
      
      const split = document.getElementById('student-code-split');
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

  // Filter classes where student is enrolled
  const enrolledClasses = classes.filter(
    (cls) => cls.students?.some((s) => s._id === user?.id)
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
            Practice Class
          </h2>
          <p className="mt-1 text-sm" style={{ color: 'var(--text-secondary)' }}>
            Select a class to start practicing
          </p>
        </div>

        {enrolledClasses.length === 0 ? (
          <div className="text-center py-12 backdrop-blur-sm rounded-2xl shadow-lg border" style={{ backgroundColor: 'var(--background-light)', borderColor: 'var(--card-border)' }}>
            <svg className="mx-auto h-14 w-14" style={{ color: 'var(--text-secondary)' }} fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" />
            </svg>
            <h3 className="mt-3 text-lg font-semibold" style={{ color: 'var(--text-primary)' }}>No classes found</h3>
            <p className="mt-1 text-sm" style={{ color: 'var(--text-secondary)' }}>You haven't enrolled in any classes yet.</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-2">
            {enrolledClasses.map((cls) => (
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

  const handleBackToClassSelection = () => {
    setSelectedClass(null);
    setSelectedQuestion(null);
    setQuestions([]);
  };

  const toggleSidebar = () => {
    setIsSidebarCollapsed(!isSidebarCollapsed);
  };

  const toggleFullscreen = () => {
    setIsFullscreen(!isFullscreen);
  };

  const handleResetCode = () => {
    if (selectedQuestion) {
      const starterCode = selectedQuestion.starterCode?.find((sc) => sc.language === selectedLanguage);
      setCode(starterCode?.code || selectedQuestion.codeSnippet || '// Write your code here...');
    }
  };

  const handleCopyCode = () => {
    navigator.clipboard.writeText(code);
    alert('Code copied to clipboard!');
  };

  const handleRunCode = async () => {
    if (!selectedQuestion || !selectedClass) {
      alert('Please select a question first');
      return;
    }

    if (!code || code.trim() === '') {
      alert('Please write some code to test');
      return;
    }

    try {
      setIsRunning(true);
      setTestResults(null);
      
      const response = await runCode(
        selectedQuestion._id,
        code,
        selectedClass._id,
        selectedLanguage
      );

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
    } catch (err) {
      console.error('Failed to run code:', err);
      setTestResults({
        error: true,
        message: typeof err === 'string' ? err : err.response?.data?.error || 'Failed to execute code. Please try again.'
      });
    } finally {
      setIsRunning(false);
    }
  };

  const handleRunWithCustomInput = async () => {
    if (!selectedQuestion || !selectedClass) {
      alert('Please select a question first');
      return;
    }

    if (!code || code.trim() === '') {
      alert('Please write some code to test');
      return;
    }

    if (!customInput || customInput.trim() === '') {
      alert('Please provide custom input');
      return;
    }

    try {
      setIsRunningCustom(true);
      setTestResults(null);
      
      const response = await runCodeWithCustomInput(
        selectedQuestion._id,
        code,
        selectedClass._id,
        selectedLanguage,
        customInput,
        customOutput
      );

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
    } catch (err) {
      console.error('Failed to run with custom input:', err);
      setTestResults({
        error: true,
        message: typeof err === 'string' ? err : err.response?.data?.error || 'Failed to execute code with custom input. Please try again.'
      });
    } finally {
      setIsRunningCustom(false);
    }
  };

  const handleSubmitSolution = async () => {
    if (!selectedQuestion || !selectedClass) {
      alert('Please select a question first');
      return;
    }

    if (!code || code.trim() === '') {
      alert('Please write some code to submit');
      return;
    }

    if (!window.confirm('Are you sure you want to submit this solution? This will count as a submission attempt.')) {
      return;
    }

    try {
      setIsSubmitting(true);
      
      const response = await submitAnswer(
        selectedQuestion._id,
        code,
        selectedClass._id,
        selectedLanguage
      );

      alert('Solution submitted successfully!');
      
      // Refresh questions to update submission status
      const questionsResponse = await getQuestionsByClass(selectedClass._id);
      const fetchedQuestions = questionsResponse.data.questions || [];
      const availableQuestions = fetchedQuestions.filter((q) => {
        const classEntry = q.classes?.find(
          (c) => c.classId?.toString() === selectedClass._id || c.classId?._id?.toString() === selectedClass._id
        );
        return classEntry?.isPublished && !classEntry?.isDisabled;
      });
      setQuestions(availableQuestions);
      
      // Update selected question
      const updatedQuestion = availableQuestions.find(q => q._id === selectedQuestion._id);
      if (updatedQuestion) {
        setSelectedQuestion(updatedQuestion);
      }
    } catch (err) {
      console.error('Failed to submit solution:', err);
      const errorMsg = typeof err === 'string' ? err : err.response?.data?.error || 'Failed to submit solution. Please try again.';
      alert(errorMsg);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDividerMouseDown = (e) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const handleVerticalDividerMouseDown = (e) => {
    e.preventDefault();
    setIsDraggingVertical(true);
  };

  // Main layout — height matches App <main> (navbar h-16); min-h-0 chain enables nested scroll (sidebar + panels)
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
              {questions.length} Questions Available
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

      {/* Main Content — row height bounded; middle column needs min-h-0 */}
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
          
          {/* Scroll shell: relative + absolute inset-0 so list scrolls inside flex column */}
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
                      <button
                        onClick={() => {
                          setSelectedQuestion(q);
                          setShowQuestionsList(false);
                        }}
                        className="flex-1 flex items-start gap-2 p-3 text-left w-full"
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
                            {q.difficulty} • {q.type}
                          </p>
                        </div>
                      </button>
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
                width: isCodingQuestion(selectedQuestion) ? `${leftPanelWidth}%` : '100%',
                backgroundColor: 'var(--background-content)'
              }}
            >
              <div className="max-w-3xl">
                <h1 
                  className="text-xl sm:text-2xl font-bold mb-3 sm:mb-4" 
                  style={{ color: 'var(--text-heading)' }}
                >
                  {stripHtml(selectedQuestion.title) || "Untitled"}
                </h1>

                <div className="flex flex-wrap gap-2 mb-6">
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
                  <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold bg-blue-100 text-blue-700">
                    {selectedQuestion.type}
                  </span>
                </div>

                <div className="mb-4 sm:mb-6">
                  <h3 className="text-base sm:text-lg font-semibold mb-2" style={{ color: 'var(--text-heading)' }}>
                    Problem Statement
                  </h3>
                  <div 
                    className="text-xs sm:text-sm leading-relaxed whitespace-pre-wrap" 
                    style={{ color: 'var(--text-primary)' }}
                  >
                    {stripHtml(selectedQuestion.description) || "—"}
                  </div>
                </div>

                {selectedQuestion.inputFormat && (
                  <div className="mb-4 sm:mb-6">
                    <h3 className="text-base sm:text-lg font-semibold mb-2" style={{ color: 'var(--text-heading)' }}>
                      Input Format
                    </h3>
                    <div 
                      className="text-xs sm:text-sm leading-relaxed whitespace-pre-wrap" 
                      style={{ color: 'var(--text-primary)' }}
                    >
                      {stripHtml(selectedQuestion.inputFormat)}
                    </div>
                  </div>
                )}

                {selectedQuestion.outputFormat && (
                  <div className="mb-4 sm:mb-6">
                    <h3 className="text-base sm:text-lg font-semibold mb-2" style={{ color: 'var(--text-heading)' }}>
                      Output Format
                    </h3>
                    <div 
                      className="text-xs sm:text-sm leading-relaxed whitespace-pre-wrap" 
                      style={{ color: 'var(--text-primary)' }}
                    >
                      {stripHtml(selectedQuestion.outputFormat)}
                    </div>
                  </div>
                )}

                {selectedQuestion.constraints && (
                  <div className="mb-4 sm:mb-6">
                    <h3 className="text-base sm:text-lg font-semibold mb-2" style={{ color: 'var(--text-heading)' }}>
                      Constraints
                    </h3>
                    <div 
                      className="text-xs sm:text-sm leading-relaxed whitespace-pre-wrap" 
                      style={{ color: 'var(--text-primary)' }}
                    >
                      {stripHtml(selectedQuestion.constraints)}
                    </div>
                  </div>
                )}

                {selectedQuestion.examples && selectedQuestion.examples.length > 0 && (
                  <div className="mb-4 sm:mb-6">
                    <h3 className="text-base sm:text-lg font-semibold mb-2" style={{ color: 'var(--text-heading)' }}>
                      Sample Input
                    </h3>
                    <div className="space-y-2 sm:space-y-3">
                      {selectedQuestion.examples.map((example, index) => (
                        <div 
                          key={index} 
                          className="p-2 sm:p-3 rounded-lg border" 
                          style={{ backgroundColor: 'var(--background-light)', borderColor: 'var(--card-border)' }}
                        >
                          <pre 
                            className="text-xs sm:text-sm whitespace-pre-wrap" 
                            style={{ color: 'var(--text-primary)' }}
                          >
                            {stripHtml(example)}
                          </pre>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* MCQ Options - Display below question details */}
                {(selectedQuestion.type === 'singleCorrectMcq' || selectedQuestion.type === 'multipleCorrectMcq') && (
                  <div className="mb-4 sm:mb-6">
                    <h3 className="text-base sm:text-lg font-semibold mb-3" style={{ color: 'var(--text-heading)' }}>
                      Options
                    </h3>
                    {selectedQuestion.options && selectedQuestion.options.length > 0 ? (
                      <div className="space-y-2">
                        {selectedQuestion.options.map((option, idx) => (
                          <div
                            key={idx}
                            className="p-3 rounded-lg border"
                            style={{ 
                              backgroundColor: 'var(--card-white)', 
                              borderColor: 'var(--card-border)' 
                            }}
                          >
                            <label className="flex items-start gap-3 cursor-pointer">
                              <input
                                type={selectedQuestion.type === 'multipleCorrectMcq' ? 'checkbox' : 'radio'}
                                name="mcq-answer"
                                value={idx}
                                className="mt-1"
                                disabled
                              />
                              <span className="text-sm flex-1" style={{ color: 'var(--text-primary)' }}>
                                {stripHtml(option)}
                              </span>
                            </label>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <p className="text-sm" style={{ color: 'var(--text-secondary)' }}>
                        No options available for this question.
                      </p>
                    )}
                    <p className="text-xs mt-4 italic" style={{ color: 'var(--text-secondary)' }}>
                      Note: MCQ questions cannot be answered in the practice class view. Please use the class view to submit answers.
                    </p>
                  </div>
                )}

                {/* Fill in the Blanks Message */}
                {selectedQuestion.type === 'fillInTheBlanks' && (
                  <div className="mb-4 sm:mb-6">
                    <div className="p-4 rounded-lg border" style={{ backgroundColor: 'var(--card-white)', borderColor: 'var(--card-border)' }}>
                      <p className="text-sm" style={{ color: 'var(--text-secondary)' }}>
                        This question requires a text answer. Please use the class view to submit your answer.
                      </p>
                    </div>
                  </div>
                )}
              </div>
            </div>

            {/* Horizontal Draggable Divider - Only for coding questions */}
            {isCodingQuestion(selectedQuestion) && (
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
            )}

            {/* Right Column - Code Editor (Only for coding questions) */}
            {isCodingQuestion(selectedQuestion) ? (
              <div 
                id="student-right-panel"
                className="w-full lg:flex-1 min-h-0 min-w-0 border-t lg:border-t-0 flex flex-col transition-all duration-150" 
                style={{ 
                  width: !isSidebarCollapsed && selectedQuestion ? `${100 - leftPanelWidth}%` : 'auto',
                  backgroundColor: 'var(--background-content)',
                  borderColor: 'var(--card-border)'
                }}
              >
              {/* Editor Controls */}
              <div className="border-b p-3 sm:p-4 flex-shrink-0" style={{ backgroundColor: 'var(--card-white)', borderColor: 'var(--card-border)' }}>
                <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
                  <div className="flex flex-col sm:flex-row items-start sm:items-center gap-3 sm:gap-4 w-full sm:w-auto">
                     <div className="w-full sm:w-auto">
                       <label className="block text-xs font-medium mb-1" style={{ color: 'var(--text-secondary)' }}>
                         Language
                       </label>
                       {(() => {
                         const availableLanguages = getAvailableLanguages(selectedQuestion);
                         return availableLanguages.length > 0 ? (
                           <select
                             value={selectedLanguage || availableLanguages[0] || ''}
                             onChange={(e) => {
                               const newLanguage = e.target.value;
                               if (newLanguage) {
                                 setSelectedLanguage(newLanguage);
                               }
                             }}
                             className="w-full sm:w-auto rounded-lg border shadow-sm focus:border-indigo-500 focus:ring-indigo-500 text-sm px-3 py-1.5"
                             style={{ 
                               borderColor: 'var(--card-border)', 
                               backgroundColor: 'var(--background-light)', 
                               color: 'var(--text-primary)',
                               cursor: 'pointer',
                               minWidth: '120px'
                             }}
                           >
                             {availableLanguages.map((lang) => (
                               <option key={lang} value={lang}>
                                 {lang.charAt(0).toUpperCase() + lang.slice(1)}
                               </option>
                             ))}
                           </select>
                         ) : (
                           <div className="text-xs text-gray-500 px-3 py-1.5">
                             No languages available
                           </div>
                         );
                       })()}
                     </div>
                    <div className="hidden sm:flex items-center gap-3">
                      <span className="text-xs font-medium" style={{ color: 'var(--text-secondary)' }}>
                        Time: 2s
                      </span>
                      <span className="text-xs font-medium" style={{ color: 'var(--text-secondary)' }}>
                        Memory: 256MB
                      </span>
                    </div>
                  </div>
                  <div className="flex items-center gap-2 w-full sm:w-auto justify-end">
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
                    <button
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
                  </div>
                </div>
              </div>

              {/* Code / test split — id used for vertical drag */}
              <div className="flex-1 flex flex-col overflow-hidden p-4 min-h-0">
                <div
                  id="student-code-split"
                  className="flex flex-col flex-1 min-h-0 min-w-0 overflow-hidden w-full"
                >
                <div
                  className="flex flex-col min-h-0 overflow-hidden transition-all duration-150"
                  style={{ flex: `${editorHeight} 1 0%`, minHeight: '8rem' }}
                >
                  <CodeEditor
                    value={code}
                    onChange={setCode}
                    defaultValue={selectedQuestion.starterCode?.find((sc) => sc.language === selectedLanguage)?.code || ''}
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

                <div
                  className="overflow-y-auto border-t pt-3 space-y-3 min-h-0"
                  style={{
                    borderColor: 'var(--card-border)',
                    flex: `${100 - editorHeight} 1 0%`,
                    minHeight: 0,
                  }}
                >
                  <h4 className="text-sm font-semibold" style={{ color: 'var(--text-heading)' }}>
                    Test & Submit
                  </h4>
                  
                  {/* Custom Input Section */}
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                    <div>
                      <label className="text-xs font-medium" style={{ color: 'var(--text-secondary)' }}>
                        Custom Input (Optional)
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
                        Expected Output (Optional)
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

                  {/* Action Buttons */}
                  <div className="flex flex-wrap gap-2">
                    <button
                      type="button"
                      onClick={handleRunCode}
                      disabled={isRunning || isSubmitting}
                      className={`inline-flex items-center px-4 py-2 rounded-lg text-sm font-semibold text-white focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 transition-all duration-200 ${
                        isRunning || isSubmitting ? 'bg-blue-400 cursor-not-allowed' : 'bg-blue-600 hover:bg-blue-700'
                      }`}
                    >
                      {isRunning ? (
                        <>
                          <svg className="animate-spin -ml-1 mr-2 h-4 w-4 text-white" fill="none" viewBox="0 0 24 24">
                            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                          </svg>
                          Running...
                        </>
                      ) : 'Run Code'}
                    </button>
                    <button
                      type="button"
                      onClick={handleRunWithCustomInput}
                      disabled={!customInput.trim() || isRunningCustom || isSubmitting}
                      className={`inline-flex items-center px-4 py-2 rounded-lg text-sm font-semibold text-white focus:outline-none focus:ring-2 focus:ring-offset-2 transition-all duration-200 ${
                        customInput.trim() && !isRunningCustom && !isSubmitting ? 'bg-green-600 hover:bg-green-700 focus:ring-green-500' : 'bg-gray-400 cursor-not-allowed'
                      }`}
                    >
                      {isRunningCustom ? (
                        <>
                          <svg className="animate-spin -ml-1 mr-2 h-4 w-4 text-white" fill="none" viewBox="0 0 24 24">
                            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                          </svg>
                          Running...
                        </>
                      ) : 'Run Custom'}
                    </button>
                    <button
                      type="button"
                      onClick={handleSubmitSolution}
                      disabled={isSubmitting || isRunning || isRunningCustom}
                      className={`inline-flex items-center px-4 py-2 rounded-lg text-sm font-semibold text-white focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 transition-all duration-200 ${
                        isSubmitting || isRunning || isRunningCustom ? 'bg-indigo-400 cursor-not-allowed' : 'bg-indigo-600 hover:bg-indigo-700'
                      }`}
                    >
                      {isSubmitting ? (
                        <>
                          <svg className="animate-spin -ml-1 mr-2 h-4 w-4 text-white" fill="none" viewBox="0 0 24 24">
                            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                          </svg>
                          Submitting...
                        </>
                      ) : 'Submit Solution'}
                    </button>
                  </div>

                  {/* Test Results */}
                  {testResults && (
                    <div className={`mt-4 p-4 rounded-lg border backdrop-blur-sm ${
                      testResults.error ? 'bg-red-50/80' : testResults.isCorrect || testResults.passed ? 'bg-green-50/80' : 'bg-yellow-50/80'
                    }`} style={{ borderColor: 'var(--card-border)' }}>
                      <div className="flex items-center justify-between mb-3">
                        <h4 className="text-sm font-semibold" style={{ color: 'var(--text-heading)' }}>
                          {testResults.error ? '❌ Error' : testResults.isCustomTest ? '🧪 Custom Test Results' : '🔬 Test Results'}
                        </h4>
                        {!testResults.error && !testResults.isCustomTest && (
                          <span className={`px-2.5 py-0.5 rounded-full text-xs font-semibold ${
                            testResults.isCorrect ? 'bg-green-100 text-green-700' : 'bg-yellow-100 text-yellow-700'
                          }`}>
                            {testResults.passedTestCases}/{testResults.totalTestCases} Passed
                          </span>
                        )}
                      </div>

                      {testResults.error ? (
                        <div className="text-xs text-red-600 p-3 bg-red-100 rounded">
                          {testResults.message}
                        </div>
                      ) : testResults.isCustomTest ? (
                        <div className="space-y-2">
                          <div className="grid grid-cols-2 gap-2 text-xs">
                            <div className="p-2 bg-white rounded border" style={{ borderColor: 'var(--card-border)' }}>
                              <div className="font-medium mb-1" style={{ color: 'var(--text-secondary)' }}>Input:</div>
                              <pre className="whitespace-pre-wrap" style={{ color: 'var(--text-primary)' }}>
                                {testResults.customInput}
                              </pre>
                            </div>
                            <div className="p-2 bg-white rounded border" style={{ borderColor: 'var(--card-border)' }}>
                              <div className="font-medium mb-1" style={{ color: 'var(--text-secondary)' }}>Actual Output:</div>
                              <pre className="whitespace-pre-wrap" style={{ color: 'var(--text-primary)' }}>
                                {testResults.actualOutput}
                              </pre>
                            </div>
                          </div>
                          {testResults.expectedOutput && (
                            <div className="p-2 bg-white rounded border" style={{ borderColor: 'var(--card-border)' }}>
                              <div className="font-medium mb-1 text-xs" style={{ color: 'var(--text-secondary)' }}>Expected Output:</div>
                              <pre className="text-xs whitespace-pre-wrap" style={{ color: 'var(--text-primary)' }}>
                                {testResults.expectedOutput}
                              </pre>
                              <div className={`mt-2 text-xs font-semibold ${testResults.passed ? 'text-green-600' : 'text-red-600'}`}>
                                {testResults.passed ? '✅ Output matches expected' : '❌ Output does not match expected'}
                              </div>
                            </div>
                          )}
                        </div>
                      ) : (
                        <div className="space-y-2">
                          <div className="flex items-center justify-between text-xs p-2 bg-white rounded">
                            <span style={{ color: 'var(--text-secondary)' }}>Public Test Cases:</span>
                            <span className="font-semibold" style={{ color: 'var(--text-primary)' }}>{testResults.publicTestCases}</span>
                          </div>
                          <div className="flex items-center justify-between text-xs p-2 bg-white rounded">
                            <span style={{ color: 'var(--text-secondary)' }}>Hidden Test Cases:</span>
                            <span className="font-semibold" style={{ color: 'var(--text-primary)' }}>{testResults.hiddenTestCases}</span>
                          </div>
                          
                          {testResults.testResults && testResults.testResults.length > 0 && (
                            <div className="mt-3 space-y-2">
                              <div className="text-xs font-semibold mb-2" style={{ color: 'var(--text-heading)' }}>
                                Test Case Details:
                              </div>
                              {testResults.testResults.map((result, idx) => (
                                <div 
                                  key={idx} 
                                  className={`p-2 rounded border ${result.passed ? 'bg-green-50' : 'bg-red-50'}`}
                                  style={{ borderColor: result.passed ? '#86efac' : '#fca5a5' }}
                                >
                                  <div className="flex items-center justify-between mb-1">
                                    <span className="text-xs font-semibold" style={{ color: 'var(--text-primary)' }}>
                                      Test Case #{idx + 1} {result.isPublic ? '(Public)' : '(Hidden)'}
                                    </span>
                                    <span className={`text-xs font-bold ${result.passed ? 'text-green-600' : 'text-red-600'}`}>
                                      {result.passed ? '✅ PASS' : '❌ FAIL'}
                                    </span>
                                  </div>
                                  {result.error && (
                                    <div className="mt-2 p-2 bg-red-100 rounded text-xs text-red-600">
                                      Error: {result.error}
                                    </div>
                                  )}
                                </div>
                              ))}
                            </div>
                          )}

                          {testResults.explanation && (
                            <div className="mt-3 p-3 bg-blue-50 rounded border" style={{ borderColor: 'var(--card-border)' }}>
                              <div className="text-xs font-semibold mb-1" style={{ color: 'var(--text-heading)' }}>
                                💡 Explanation:
                              </div>
                              <div className="text-xs" style={{ color: 'var(--text-primary)' }}>
                                {testResults.explanation}
                              </div>
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  )}
                </div>
                </div>
              </div>
            </div>
            ) : null}
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
                Choose a question from the left to start practicing
              </p>
            </div>
          </div>
        )}
      </div>

      {/* Fullscreen Editor Overlay - Only for coding questions */}
      {isFullscreen && selectedQuestion && isCodingQuestion(selectedQuestion) && (
        <div className="fixed inset-0 z-50 flex flex-col" style={{ backgroundColor: 'var(--background-content)' }}>
          <div className="flex-shrink-0 border-b p-4 flex items-center justify-between" style={{ backgroundColor: 'var(--card-white)', borderColor: 'var(--card-border)' }}>
            <div className="flex items-center gap-4">
              <div>
                <h3 className="text-lg font-semibold" style={{ color: 'var(--text-heading)' }}>
                  Code Editor - Fullscreen
                </h3>
                <p className="text-xs mt-1" style={{ color: 'var(--text-secondary)' }}>
                  Press <kbd className="px-1.5 py-0.5 bg-gray-100 rounded border border-gray-300 text-xs">ESC</kbd> or <kbd className="px-1.5 py-0.5 bg-gray-100 rounded border border-gray-300 text-xs">F11</kbd> to exit
                </p>
              </div>
              <select
                value={selectedLanguage || ''}
                onChange={(e) => {
                  const newLanguage = e.target.value;
                  if (newLanguage) {
                    setSelectedLanguage(newLanguage);
                  }
                }}
                className="rounded-lg border shadow-sm focus:border-indigo-500 focus:ring-indigo-500 text-sm px-3 py-1.5"
                style={{ 
                  borderColor: 'var(--card-border)', 
                  backgroundColor: 'var(--background-light)', 
                  color: 'var(--text-primary)',
                  cursor: 'pointer'
                }}
                disabled={!selectedQuestion || getAvailableLanguages(selectedQuestion).length === 0}
              >
                {(() => {
                  const availableLanguages = getAvailableLanguages(selectedQuestion);
                  return availableLanguages.length > 0 ? (
                    availableLanguages.map((lang) => (
                      <option key={lang} value={lang}>
                        {lang.charAt(0).toUpperCase() + lang.slice(1)}
                      </option>
                    ))
                  ) : (
                    <option value="">No languages available</option>
                  );
                })()}
              </select>
            </div>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={handleRunCode}
                disabled={isRunning || isSubmitting}
                className={`inline-flex items-center px-4 py-2 rounded-lg text-sm font-semibold text-white focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 transition-all duration-200 ${
                  isRunning || isSubmitting ? 'bg-blue-400 cursor-not-allowed' : 'bg-blue-600 hover:bg-blue-700'
                }`}
              >
                {isRunning ? (
                  <>
                    <svg className="animate-spin -ml-1 mr-2 h-4 w-4 text-white" fill="none" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                    </svg>
                    Running...
                  </>
                ) : 'Run Code'}
              </button>
              <button
                type="button"
                onClick={handleSubmitSolution}
                disabled={isSubmitting || isRunning || isRunningCustom}
                className={`inline-flex items-center px-4 py-2 rounded-lg text-sm font-semibold text-white focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 transition-all duration-200 ${
                  isSubmitting || isRunning || isRunningCustom ? 'bg-indigo-400 cursor-not-allowed' : 'bg-indigo-600 hover:bg-indigo-700'
                }`}
              >
                {isSubmitting ? (
                  <>
                    <svg className="animate-spin -ml-1 mr-2 h-4 w-4 text-white" fill="none" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                    </svg>
                    Submitting...
                  </>
                ) : 'Submit Solution'}
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
            <div className="flex-1 min-h-0 flex flex-col overflow-hidden">
              <CodeEditor
                value={code}
                onChange={setCode}
                defaultValue={selectedQuestion.starterCode?.find((sc) => sc.language === selectedLanguage)?.code || ''}
                language={selectedLanguage}
                disabled={false}
                isFillInTheBlanks={false}
                height="100%"
              />
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default StudentTakeClass;

