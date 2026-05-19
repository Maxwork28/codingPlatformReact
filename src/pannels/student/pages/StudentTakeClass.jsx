import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { useSelector } from 'react-redux';
import { ArrowLeftIcon } from '@heroicons/react/24/outline';
import { io } from 'socket.io-client';
import { getQuestionsByClass, runCode, runCodeWithCustomInput, submitAnswer } from '../../../common/services/api';
import { API_BASE_URL } from '../../../common/constants';
import CodeEditor from '../components/CodeEditor';
import TestCaseResultsList from '../components/TestCaseResultsList';
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

/** `classes[]` entry for this class (id may be string or populated doc). */
const getClassEntryForQuestion = (question, classId) => {
  if (!question?.classes || !classId) return null;
  const cid = String(classId);
  return (
    question.classes.find(
      (c) => String(c.classId?._id ?? c.classId) === cid
    ) || null
  );
};

/** Student can see the question in the list while it is published (including when disabled). */
const filterPublishedQuestionsForClass = (fetchedQuestions, classId) => {
  const cid = String(classId);
  return (fetchedQuestions || []).filter((q) => {
    const classEntry = getClassEntryForQuestion(q, cid);
    return Boolean(classEntry?.isPublished);
  });
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
  const [showResultsModal, setShowResultsModal] = useState(false);
  const [resultsModalKind, setResultsModalKind] = useState(null); // 'run' | 'submit'
  const [isRunning, setIsRunning] = useState(false);
  const [isRunningCustom, setIsRunningCustom] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  /** MCQ / fill-in-the-blanks answers in practice view (coding uses `code`). */
  const [mcqSingleIndex, setMcqSingleIndex] = useState(null);
  const [mcqMultipleIndices, setMcqMultipleIndices] = useState([]);
  const [fillInBlanksAnswer, setFillInBlanksAnswer] = useState('');
  /** Shown after submit (MCQ, fill-in-the-blanks, coding) — cleared when switching question. */
  const [submissionFeedback, setSubmissionFeedback] = useState(null);

  /** Only load starter when question or language changes — not when `selectedQuestion` object reference is replaced. */
  const lastCodeInitKeyRef = useRef(null);
  const lastNonCodingAnswerInitRef = useRef(null);

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
          const availableQuestions = filterPublishedQuestionsForClass(
            fetchedQuestions,
            selectedClass._id
          );
          
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

  // Reset non-coding answer UI when the student switches to another question (same id after refresh keeps draft).
  useEffect(() => {
    const qid = selectedQuestion?._id?.toString() ?? '';
    if (!qid) return;
    if (lastNonCodingAnswerInitRef.current === qid) return;
    lastNonCodingAnswerInitRef.current = qid;
    setMcqSingleIndex(null);
    setMcqMultipleIndices([]);
    setFillInBlanksAnswer('');
    setSubmissionFeedback(null);
    setTestResults(null);
    setShowResultsModal(false);
    setResultsModalKind(null);
  }, [selectedQuestion?._id]);

  const reloadQuestionsForClass = useCallback(async () => {
    if (!selectedClass) return;
    const questionsResponse = await getQuestionsByClass(selectedClass._id);
    const fetchedQuestions = questionsResponse.data.questions || [];
    const availableQuestions = filterPublishedQuestionsForClass(
      fetchedQuestions,
      selectedClass._id
    );
    setQuestions(availableQuestions);
    setSelectedQuestion((sel) => {
      const keepId = sel?._id;
      if (keepId) {
        const updated = availableQuestions.find((q) => q._id === keepId);
        if (updated) return updated;
      }
      return availableQuestions[0] ?? null;
    });
  }, [selectedClass]);

  useEffect(() => {
    if (!selectedClass?._id) return undefined;
    const classId = selectedClass._id;
    const socket = io(`${API_BASE_URL}/`, { withCredentials: true });
    socket.emit('joinClass', classId);
    const syncFromTeacher = () => {
      void reloadQuestionsForClass();
    };
    socket.on('questionPublished', syncFromTeacher);
    socket.on('questionDisabled', syncFromTeacher);
    socket.on('questionAssigned', syncFromTeacher);
    return () => {
      socket.off('questionPublished', syncFromTeacher);
      socket.off('questionDisabled', syncFromTeacher);
      socket.off('questionAssigned', syncFromTeacher);
      socket.disconnect();
    };
  }, [selectedClass?._id, reloadQuestionsForClass]);

  const toggleMcqMultiple = (idx) => {
    setMcqMultipleIndices((prev) =>
      prev.includes(idx) ? prev.filter((i) => i !== idx) : [...prev, idx].sort((a, b) => a - b)
    );
  };

  const { questionInteractionLocked, interactionLockBanner } = useMemo(() => {
    if (!selectedClass || !selectedQuestion) {
      return { questionInteractionLocked: false, interactionLockBanner: null };
    }
    const e = getClassEntryForQuestion(selectedQuestion, selectedClass._id);
    if (!e?.isPublished) {
      return {
        questionInteractionLocked: true,
        interactionLockBanner:
          'This question is not available for this class. Select another question from the list.',
      };
    }
    if (e?.isDisabled) {
      return {
        questionInteractionLocked: true,
        interactionLockBanner:
          'Your teacher has disabled answers for this question. You can read the problem, but the editor, options, and submit are turned off until it is enabled again.',
      };
    }
    return { questionInteractionLocked: false, interactionLockBanner: null };
  }, [selectedClass, selectedQuestion]);

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
        if (!isFullscreen && questionInteractionLocked) return;
        setIsFullscreen(!isFullscreen);
      }
    };

    document.addEventListener('keydown', handleKeyboard);
    return () => {
      document.removeEventListener('keydown', handleKeyboard);
    };
  }, [isFullscreen, questionInteractionLocked]);

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
              💡 Explanation:
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
            {testResults.error ? '❌ Error' : testResults.isCustomTest ? '🧪 Custom Test Results' : '🔬 Test Results'}
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

  const renderSubmissionFeedbackBody = (isCoding) => {
    if (!submissionFeedback) return null;

    if (isCoding) {
      return (
        <>
          <TestCaseResultsList
            results={submissionFeedback.testResults}
            className="mb-2"
          />
          {typeof submissionFeedback.passedTestCases === 'number' &&
          typeof submissionFeedback.totalTestCases === 'number' &&
          submissionFeedback.totalTestCases > 0 ? (
            <p className="text-xs font-semibold mb-2" style={{ color: 'var(--text-secondary)' }}>
              {submissionFeedback.passedTestCases}/{submissionFeedback.totalTestCases} test cases passed
            </p>
          ) : null}
          {submissionFeedback.explanation ? (
            <div className="text-xs sm:text-sm mt-2 leading-relaxed" style={{ color: 'var(--text-primary)' }}>
              {stripHtml(submissionFeedback.explanation)}
            </div>
          ) : null}
        </>
      );
    }

    return (
      <>
        <p
          className={`text-sm font-semibold ${submissionFeedback.isCorrect ? 'text-green-800' : 'text-red-800'}`}
        >
          {submissionFeedback.isCorrect ? 'Correct' : 'Incorrect'}
        </p>
        {submissionFeedback.explanation ? (
          <div className="text-xs sm:text-sm mt-2 leading-relaxed" style={{ color: 'var(--text-primary)' }}>
            {stripHtml(submissionFeedback.explanation)}
          </div>
        ) : null}
      </>
    );
  };

  const renderSubmissionFeedbackCard = (isCoding) => {
    if (!submissionFeedback) return null;

    const codingStyles = isCoding
      ? submissionFeedback.isCorrect
        ? { bg: 'bg-green-50/90', border: '#86efac' }
        : { bg: 'bg-amber-50/90', border: '#fcd34d' }
      : submissionFeedback.isCorrect
        ? { bg: 'bg-green-50/90', border: '#86efac' }
        : { bg: 'bg-red-50/90', border: '#fca5a5' };

    return (
      <div
        className={`${isCoding ? 'mt-4' : 'mt-6'} p-4 rounded-lg border ${codingStyles.bg}`}
        style={{ borderColor: codingStyles.border }}
        role="status"
      >
        {renderSubmissionFeedbackBody(isCoding)}
      </div>
    );
  };

  const handleRunCode = async () => {
    if (!selectedQuestion || !selectedClass) {
      alert('Please select a question first');
      return;
    }

    if (questionInteractionLocked) {
      alert('Your teacher has disabled answers for this question right now.');
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

      const tr = response.data.testResults || [];
      const sub = response.data.submission || {};
      setTestResults({
        message: response.data.message,
        testResults: tr,
        passedTestCases: response.data.passedTestCases ?? sub.passedTestCases ?? tr.filter((t) => t.passed).length,
        totalTestCases: response.data.totalTestCases ?? sub.totalTestCases ?? tr.length,
        publicTestCases: response.data.publicTestCases ?? tr.filter((t) => t.isPublic).length,
        hiddenTestCases: response.data.hiddenTestCases ?? tr.filter((t) => !t.isPublic).length,
        isCorrect: response.data.isCorrect ?? (tr.length > 0 && tr.every((t) => t.passed)),
        explanation: response.data.explanation,
      });
      openResultsModal('run');
    } catch (err) {
      console.error('Failed to run code:', err);
      setTestResults({
        error: true,
        message: typeof err === 'string' ? err : err.response?.data?.error || 'Failed to execute code. Please try again.',
      });
      openResultsModal('run');
    } finally {
      setIsRunning(false);
    }
  };

  const handleRunWithCustomInput = async () => {
    if (!selectedQuestion || !selectedClass) {
      alert('Please select a question first');
      return;
    }

    if (questionInteractionLocked) {
      alert('Your teacher has disabled answers for this question right now.');
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
        explanation: response.data.explanation,
      });
      openResultsModal('run');
    } catch (err) {
      console.error('Failed to run with custom input:', err);
      setTestResults({
        error: true,
        message: typeof err === 'string' ? err : err.response?.data?.error || 'Failed to execute code with custom input. Please try again.',
      });
      openResultsModal('run');
    } finally {
      setIsRunningCustom(false);
    }
  };

  const handleSubmitSolution = async () => {
    if (!selectedQuestion || !selectedClass) {
      alert('Please select a question first');
      return;
    }

    if (questionInteractionLocked) {
      alert('Your teacher has disabled answers for this question right now.');
      return;
    }

    if (!code || code.trim() === '') {
      alert('Please write some code to submit');
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

      const data = response?.data ?? {};
      const sub = data.submission ?? {};
      const tr = data.testResults ?? [];
      setSubmissionFeedback({
        isCorrect: Boolean(sub.isCorrect ?? data.isCorrect),
        explanation: data.explanation ?? sub.explanation,
        passedTestCases: data.passedTestCases ?? sub.passedTestCases,
        totalTestCases: data.totalTestCases ?? sub.totalTestCases,
        testResults: tr,
      });
      setTestResults(null);
      openResultsModal('submit');
      await reloadQuestionsForClass();
    } catch (err) {
      console.error('Failed to submit solution:', err);
      const errorMsg = typeof err === 'string' ? err : err.response?.data?.error || 'Failed to submit solution. Please try again.';
      alert(errorMsg);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleSubmitNonCodingAnswer = async () => {
    if (!selectedQuestion || !selectedClass) {
      alert('Please select a question first');
      return;
    }

    if (questionInteractionLocked) {
      alert('Your teacher has disabled answers for this question right now.');
      return;
    }

    const { type } = selectedQuestion;
    let payload;

    if (type === 'singleCorrectMcq') {
      if (mcqSingleIndex === null || mcqSingleIndex === undefined) {
        alert('Please select an option');
        return;
      }
      payload = mcqSingleIndex;
    } else if (type === 'multipleCorrectMcq') {
      if (!mcqMultipleIndices.length) {
        alert('Please select at least one option');
        return;
      }
      payload = mcqMultipleIndices.map((i) => parseInt(String(i), 10));
    } else if (type === 'fillInTheBlanks') {
      if (!fillInBlanksAnswer.trim()) {
        alert('Please enter your answer');
        return;
      }
      payload = fillInBlanksAnswer;
    } else {
      return;
    }

    try {
      setIsSubmitting(true);
      const response = await submitAnswer(selectedQuestion._id, payload, selectedClass._id, undefined);
      const data = response?.data ?? {};
      const sub = data.submission ?? {};
      setSubmissionFeedback({
        isCorrect: Boolean(sub.isCorrect ?? data.isCorrect),
        explanation: data.explanation ?? sub.explanation,
        passedTestCases: data.passedTestCases ?? sub.passedTestCases,
        totalTestCases: data.totalTestCases ?? sub.totalTestCases,
      });
      openResultsModal('submit');
      await reloadQuestionsForClass();
    } catch (err) {
      console.error('Failed to submit answer:', err);
      const errorMsg =
        typeof err === 'string' ? err : err.response?.data?.error || 'Failed to submit answer. Please try again.';
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
      <div className="border-b px-2 py-1.5 flex-shrink-0" style={{ backgroundColor: 'var(--card-white)', borderColor: 'var(--card-border)' }}>
        <div className="max-w-full mx-auto flex items-center gap-1.5 min-h-[1.75rem]">
          <button
            type="button"
            onClick={handleBackToClassSelection}
            className="inline-flex items-center gap-0.5 shrink-0 px-1 py-0.5 rounded border transition-colors hover:opacity-80 text-[10px] leading-none"
            style={{ 
              backgroundColor: 'var(--card-white)', 
              borderColor: 'var(--card-border)', 
              color: 'var(--text-primary)' 
            }}
          >
            <ArrowLeftIcon className="h-3 w-3" />
            <span>Back</span>
          </button>
          <span className="shrink-0 text-[10px] leading-none" style={{ color: 'var(--text-secondary)' }} aria-hidden>
            |
          </span>
          <h2
            className="flex-1 min-w-0 truncate text-[11px] font-medium leading-none"
            style={{ color: 'var(--text-heading)' }}
            title={selectedClass.name}
          >
            {selectedClass.name}
          </h2>
          <span
            className="hidden sm:inline shrink-0 text-[10px] leading-none whitespace-nowrap"
            style={{ color: 'var(--text-secondary)' }}
          >
            {questions.length} Q
          </span>
          <button
            type="button"
            onClick={() => setShowQuestionsList(!showQuestionsList)}
            className="lg:hidden inline-flex items-center p-1 rounded border transition-all duration-200 shrink-0"
            style={{ 
              backgroundColor: 'var(--card-white)', 
              borderColor: 'var(--card-border)', 
              color: 'var(--text-primary)' 
            }}
          >
            <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
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
                            {getClassEntryForQuestion(q, selectedClass._id)?.isDisabled ? (
                              <span className="ml-1 font-semibold text-amber-700">(answers off)</span>
                            ) : null}
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

                {interactionLockBanner && (
                  <div
                    className="mb-4 p-3 rounded-lg border text-sm"
                    style={{
                      backgroundColor: 'rgba(251, 191, 36, 0.15)',
                      borderColor: '#fcd34d',
                      color: 'var(--text-primary)',
                    }}
                    role="status"
                  >
                    {interactionLockBanner}
                  </div>
                )}

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

                {['fillInTheBlanksCoding', 'coding', 'codingWithDriver'].includes(selectedQuestion.type) &&
                  selectedQuestion.inputFormat && (
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

                {['fillInTheBlanksCoding', 'coding', 'codingWithDriver'].includes(selectedQuestion.type) &&
                  selectedQuestion.outputFormat && (
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
                      className="text-xs sm:text-sm leading-relaxed prose prose-sm max-w-none"
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
                            <pre className="text-xs sm:text-sm whitespace-pre-wrap mt-1" style={{ color: 'var(--text-primary)' }}>
                              {pair.input || '—'}
                            </pre>
                          </div>
                          <div>
                            <span className="text-xs font-semibold" style={{ color: 'var(--text-secondary)' }}>Output</span>
                            <pre className="text-xs sm:text-sm whitespace-pre-wrap mt-1" style={{ color: 'var(--text-primary)' }}>
                              {pair.output || '—'}
                            </pre>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {['fillInTheBlanksCoding', 'coding', 'codingWithDriver'].includes(selectedQuestion.type) &&
                  selectedQuestion.explanation && (
                  <div className="mb-4 sm:mb-6">
                    <h3 className="text-base sm:text-lg font-semibold mb-2" style={{ color: 'var(--text-heading)' }}>
                      Explanation
                    </h3>
                    <div
                      className="text-xs sm:text-sm leading-relaxed whitespace-pre-wrap"
                      style={{ color: 'var(--text-primary)' }}
                    >
                      {stripHtml(selectedQuestion.explanation)}
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
                            <label
                              className={`flex items-start gap-3 ${
                                questionInteractionLocked ? 'cursor-not-allowed opacity-75' : 'cursor-pointer'
                              }`}
                            >
                              {selectedQuestion.type === 'multipleCorrectMcq' ? (
                                <input
                                  type="checkbox"
                                  className="mt-1"
                                  checked={mcqMultipleIndices.includes(idx)}
                                  onChange={() => toggleMcqMultiple(idx)}
                                  disabled={isSubmitting || questionInteractionLocked}
                                />
                              ) : (
                                <input
                                  type="radio"
                                  name={`mcq-single-${selectedQuestion._id}`}
                                  className="mt-1"
                                  checked={mcqSingleIndex === idx}
                                  onChange={() => setMcqSingleIndex(idx)}
                                  disabled={isSubmitting || questionInteractionLocked}
                                />
                              )}
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
                    <div className="mt-4">
                      <button
                        type="button"
                        onClick={handleSubmitNonCodingAnswer}
                        disabled={isSubmitting || questionInteractionLocked}
                        className={`inline-flex items-center px-4 py-2 rounded-lg text-sm font-semibold text-white focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 transition-all duration-200 ${
                          isSubmitting || questionInteractionLocked ? 'bg-indigo-400 cursor-not-allowed' : 'bg-indigo-600 hover:bg-indigo-700'
                        }`}
                      >
                        {isSubmitting ? 'Submitting...' : 'Submit answer'}
                      </button>
                    </div>
                  </div>
                )}

                {selectedQuestion.type === 'fillInTheBlanks' && (
                  <div className="mb-4 sm:mb-6">
                    <h3 className="text-base sm:text-lg font-semibold mb-2" style={{ color: 'var(--text-heading)' }}>
                      Your answer
                    </h3>
                    <textarea
                      value={fillInBlanksAnswer}
                      onChange={(e) => setFillInBlanksAnswer(e.target.value)}
                      rows={5}
                      disabled={isSubmitting || questionInteractionLocked}
                      className="block w-full rounded-lg border shadow-sm focus:ring-indigo-500 focus:border-indigo-500 text-sm p-3"
                      style={{
                        borderColor: 'var(--card-border)',
                        backgroundColor: 'var(--card-white)',
                        color: 'var(--text-primary)',
                      }}
                      placeholder="Type your answer here…"
                    />
                    <div className="mt-3">
                      <button
                        type="button"
                        onClick={handleSubmitNonCodingAnswer}
                        disabled={isSubmitting || questionInteractionLocked}
                        className={`inline-flex items-center px-4 py-2 rounded-lg text-sm font-semibold text-white focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 transition-all duration-200 ${
                          isSubmitting || questionInteractionLocked ? 'bg-indigo-400 cursor-not-allowed' : 'bg-indigo-600 hover:bg-indigo-700'
                        }`}
                      >
                        {isSubmitting ? 'Submitting...' : 'Submit answer'}
                      </button>
                    </div>
                  </div>
                )}

                {submissionFeedback && !isCodingQuestion(selectedQuestion) && renderSubmissionFeedbackCard(false)}
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
                             disabled={questionInteractionLocked}
                             className="w-full sm:w-auto rounded-lg border shadow-sm focus:border-indigo-500 focus:ring-indigo-500 text-sm px-3 py-1.5"
                             style={{ 
                               borderColor: 'var(--card-border)', 
                               backgroundColor: 'var(--background-light)', 
                               color: 'var(--text-primary)',
                               cursor: questionInteractionLocked ? 'not-allowed' : 'pointer',
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
                      disabled={questionInteractionLocked && !isFullscreen}
                      className="px-3 py-1.5 text-xs font-semibold rounded-lg border transition-all duration-200 hover:shadow disabled:opacity-50 disabled:cursor-not-allowed"
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
                      type="button"
                      onClick={handleResetCode}
                      disabled={questionInteractionLocked}
                      className="px-3 py-1.5 text-xs font-semibold rounded-lg border transition-all duration-200 hover:shadow disabled:opacity-50 disabled:cursor-not-allowed"
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
                    disabled={questionInteractionLocked}
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
                        disabled={questionInteractionLocked}
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
                        disabled={questionInteractionLocked}
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
                      disabled={isRunning || isSubmitting || questionInteractionLocked}
                      className={`inline-flex items-center px-4 py-2 rounded-lg text-sm font-semibold text-white focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 transition-all duration-200 ${
                        isRunning || isSubmitting || questionInteractionLocked ? 'bg-blue-400 cursor-not-allowed' : 'bg-blue-600 hover:bg-blue-700'
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
                      disabled={!customInput.trim() || isRunningCustom || isSubmitting || questionInteractionLocked}
                      className={`inline-flex items-center px-4 py-2 rounded-lg text-sm font-semibold text-white focus:outline-none focus:ring-2 focus:ring-offset-2 transition-all duration-200 ${
                        customInput.trim() && !isRunningCustom && !isSubmitting && !questionInteractionLocked ? 'bg-green-600 hover:bg-green-700 focus:ring-green-500' : 'bg-gray-400 cursor-not-allowed'
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
                      disabled={isSubmitting || isRunning || isRunningCustom || questionInteractionLocked}
                      className={`inline-flex items-center px-4 py-2 rounded-lg text-sm font-semibold text-white focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 transition-all duration-200 ${
                        isSubmitting || isRunning || isRunningCustom || questionInteractionLocked ? 'bg-indigo-400 cursor-not-allowed' : 'bg-indigo-600 hover:bg-indigo-700'
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

                  {submissionFeedback && isCodingQuestion(selectedQuestion) && renderSubmissionFeedbackCard(true)}

                  {renderTestResultsCard()}
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
                disabled={
                  !selectedQuestion ||
                  getAvailableLanguages(selectedQuestion).length === 0 ||
                  questionInteractionLocked
                }
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
                disabled={isRunning || isSubmitting || questionInteractionLocked}
                className={`inline-flex items-center px-4 py-2 rounded-lg text-sm font-semibold text-white focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 transition-all duration-200 ${
                  isRunning || isSubmitting || questionInteractionLocked ? 'bg-blue-400 cursor-not-allowed' : 'bg-blue-600 hover:bg-blue-700'
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
                disabled={isSubmitting || isRunning || isRunningCustom || questionInteractionLocked}
                className={`inline-flex items-center px-4 py-2 rounded-lg text-sm font-semibold text-white focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 transition-all duration-200 ${
                  isSubmitting || isRunning || isRunningCustom || questionInteractionLocked ? 'bg-indigo-400 cursor-not-allowed' : 'bg-indigo-600 hover:bg-indigo-700'
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
          {submissionFeedback && (
            <div
              className={`flex-shrink-0 px-4 py-2 border-b text-xs sm:text-sm ${
                submissionFeedback.isCorrect ? 'bg-green-50 text-green-900' : 'bg-amber-50 text-amber-900'
              }`}
              style={{ borderColor: 'var(--card-border)' }}
              role="status"
            >
              <span className="font-semibold">
                {submissionFeedback.isCorrect ? 'All tests passed' : 'Not all tests passed'}
              </span>
              {typeof submissionFeedback.passedTestCases === 'number' &&
              typeof submissionFeedback.totalTestCases === 'number' &&
              submissionFeedback.totalTestCases > 0 ? (
                <span className="ml-2 opacity-90">
                  ({submissionFeedback.passedTestCases}/{submissionFeedback.totalTestCases} passed)
                </span>
              ) : null}
            </div>
          )}
          <div className="flex-1 overflow-hidden p-4 min-h-0 flex flex-col">
            <div className="flex-1 min-h-0 flex flex-col overflow-hidden">
              <CodeEditor
                value={code}
                onChange={setCode}
                defaultValue={selectedQuestion.starterCode?.find((sc) => sc.language === selectedLanguage)?.code || ''}
                language={selectedLanguage}
                disabled={questionInteractionLocked}
                isFillInTheBlanks={false}
                height="100%"
              />
            </div>
          </div>
        </div>
      )}

      {showResultsModal && (resultsModalKind === 'submit' ? submissionFeedback : testResults) && (
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
                {resultsModalKind === 'submit'
                  ? 'Submission Result'
                  : testResults?.error
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
            {resultsModalKind === 'submit' ? (
              renderSubmissionFeedbackBody(Boolean(selectedQuestion && isCodingQuestion(selectedQuestion)))
            ) : (
              <>
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
              </>
            )}
          </div>
        </div>
      )}
    </div>
  );
};

export default StudentTakeClass;

