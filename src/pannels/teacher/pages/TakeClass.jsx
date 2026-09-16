import React, { useState, useEffect, useRef, Fragment } from 'react';
import { useSelector } from 'react-redux';
import { useNavigate, useLocation } from 'react-router-dom';
import { ArrowLeftIcon, ClockIcon } from '@heroicons/react/24/outline';
import { Menu, Transition, Portal } from '@headlessui/react';
import parse from 'html-react-parser';
import { io } from 'socket.io-client';
import { getQuestionsByClass, getQuestion, teacherTestQuestion, teacherTestWithCustomInput, publishQuestion, unpublishQuestion, disableQuestion, enableQuestion, viewSolution } from '../../../common/services/api';
import { API_BASE_URL, CUSTOM_STDIN_PLACEHOLDER, CUSTOM_STDOUT_PLACEHOLDER } from '../../../common/constants';
import CodeEditor from '../../student/components/CodeEditor';
import TestCaseResultsList from '../../student/components/TestCaseResultsList';
import RunMetricsBadges, { summarizeRunMetrics } from '../../../common/components/RunMetricsBadges';
import { DiJavascript } from "react-icons/di";
import { FaJava,  FaPython, FaDatabase, FaBookOpen } from "react-icons/fa";
import { GiNotebook } from "react-icons/gi";
import { MdDataObject, MdDataArray } from "react-icons/md";
import QuestionHtml from '../../../common/components/QuestionHtml';
import { makeRunHistoryEntry, historyKindLabel, formatHistoryTime, loadRunHistory, saveRunHistory } from '../../../common/utils/runOutputHistory';

const ButtonSpinner = () => (
  <svg className="animate-spin -ml-1 mr-2 h-4 w-4 text-white" fill="none" viewBox="0 0 24 24" aria-hidden="true">
    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
  </svg>
);

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
  return question.codeSnippet || '';
}

function normalizeLang(lang) {
  return String(lang || '').trim().toLowerCase();
}

function getSolutionCodeForLanguage(question, lang) {
  if (!question) return '';
  const want = normalizeLang(lang);
  const fromList = (question.solutionCodes || []).find(
    (sc) => normalizeLang(sc.language) === want && String(sc.code || '').trim()
  );
  if (fromList?.code) return fromList.code;
  const legacy = String(question.solutionCode || '').trim();
  if (legacy && (!question.solutionLanguage || normalizeLang(question.solutionLanguage) === want)) {
    return question.solutionCode;
  }
  return '';
}

function pickSolutionForQuestion(question, preferredLang) {
  if (!question) return { code: '', language: preferredLang };
  const preferred = getSolutionCodeForLanguage(question, preferredLang);
  if (preferred) return { code: preferred, language: preferredLang };
  const firstSaved = (question.solutionCodes || []).find((sc) => String(sc.code || '').trim());
  if (firstSaved?.code) return { code: firstSaved.code, language: firstSaved.language || preferredLang };
  if (String(question.solutionCode || '').trim()) {
    return { code: question.solutionCode, language: question.solutionLanguage || preferredLang };
  }
  return { code: '', language: preferredLang };
}

function describeOfficialAnswer(question) {
  if (!question) return null;
  if (question.type === 'singleCorrectMcq') {
    const idx = Number(question.correctOption);
    const opt = question.options?.[idx];
    if (!Number.isInteger(idx) || idx < 0 || opt == null) return null;
    return {
      indexes: [idx],
      text: `Correct option: ${idx + 1}. ${stripHtml(opt)}`,
    };
  }
  if (question.type === 'multipleCorrectMcq') {
    const indexes = (question.correctOptions || []).map(Number).filter((idx) => Number.isInteger(idx) && idx >= 0);
    if (!indexes.length) return null;
    const lines = indexes.map((idx) => `${idx + 1}. ${stripHtml(question.options?.[idx] || '')}`);
    return {
      indexes,
      text: `Correct options: ${lines.join(' · ')}`,
    };
  }
  if (question.type === 'fillInTheBlanks' || question.type === 'fillInTheBlanksCoding') {
    const ans = stripHtml(question.correctAnswer || '');
    if (!ans) return null;
    return { indexes: [], text: `Correct answer: ${ans}`, blank: ans };
  }
  return null;
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
  const [questionsLoading, setQuestionsLoading] = useState(false);
  const [runBusy, setRunBusy] = useState(null);
  
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
  const [runHistory, setRunHistory] = useState([]);
  const [resultsView, setResultsView] = useState('detail');
  const [presentMsg, setPresentMsg] = useState('');
  const [presentedReveal, setPresentedReveal] = useState(null);
  const skipEditorResetRef = useRef(false);
  const selectedQuestionId = selectedQuestion?._id;

  useEffect(() => {
    setRunHistory(loadRunHistory('teacher', selectedClass?._id));
  }, [selectedClass?._id]);

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

  const openResultsModal = (kind) => {
    setResultsModalKind(kind);
    setShowResultsModal(true);
  };

  const closeResultsModal = () => setShowResultsModal(false);

  const recordAndShowResults = (kind, payload) => {
    setTestResults(payload);
    if (selectedQuestion?._id) {
      setRunHistory((prev) => {
        const next = [makeRunHistoryEntry(selectedQuestion._id, kind, payload), ...prev].slice(0, 30);
        saveRunHistory('teacher', selectedClass?._id, next);
        return next;
      });
    }
    setResultsView('detail');
    openResultsModal(kind === 'submit' ? 'submit' : 'run');
  };

  const questionRunHistory = runHistory.filter(
    (entry) => entry.questionId === String(selectedQuestion?._id || '')
  );

  const openRunHistory = () => {
    if (!questionRunHistory.length) return;
    setResultsView('list');
    setShowResultsModal(true);
  };

  const openHistoryEntry = (entry) => {
    setTestResults(entry.results);
    setResultsModalKind(entry.kind === 'submit' ? 'submit' : 'run');
    setResultsView('detail');
    setShowResultsModal(true);
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
      setRunBusy('run');
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
        selectedLanguage,
        { publicOnly: true }
      );

      console.log('Test results received:', response.data);
      recordAndShowResults('run', {
        message: response.data.message,
        testResults: response.data.testResults,
        passedTestCases: response.data.passedTestCases,
        totalTestCases: response.data.totalTestCases,
        publicTestCases: response.data.publicTestCases,
        hiddenTestCases: response.data.hiddenTestCases,
        isCorrect: response.data.isCorrect,
      });

    } catch (err) {
      console.error('Failed to run code:', err);
      recordAndShowResults('run', {
        error: true,
        message: typeof err === 'string' ? err : 'Failed to execute code. Please try again.'
      });
    } finally {
      setRunBusy(null);
    }
  };

  const handleSubmitCode = async () => {
    if (!selectedQuestion) {
      alert('Please select a question first');
      return;
    }

    if (!RUNNABLE_CODING_TYPES.includes(selectedQuestion.type)) {
      alert('Submit is only available for coding and fill-in-the-blanks (code) questions.');
      return;
    }

    const answerPayload = getTeacherTestAnswer();
    if (!answerPayload || answerPayload.trim() === '') {
      alert(
        selectedQuestion.type === 'fillInTheBlanksCoding'
          ? 'Enter the line of code for the blank'
          : 'Please write some code to submit'
      );
      return;
    }

    try {
      setRunBusy('submit');
      setTestResults(null);
      const response = await teacherTestQuestion(
        selectedQuestion._id,
        answerPayload,
        selectedClass._id,
        selectedLanguage,
        { publicOnly: false }
      );
      recordAndShowResults('submit', {
        message: response.data.message,
        testResults: response.data.testResults,
        passedTestCases: response.data.passedTestCases,
        totalTestCases: response.data.totalTestCases,
        publicTestCases: response.data.publicTestCases,
        hiddenTestCases: response.data.hiddenTestCases,
        isCorrect: response.data.isCorrect,
      });
    } catch (err) {
      console.error('Failed to submit code:', err);
      recordAndShowResults('submit', {
        error: true,
        message: typeof err === 'string' ? err : 'Failed to submit code. Please try again.'
      });
    } finally {
      setRunBusy(null);
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
      setRunBusy('custom');
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
      
      recordAndShowResults('custom', {
        message: response.data.message,
        testResult: response.data.testResult,
        customInput: response.data.customInput,
        expectedOutput: response.data.expectedOutput,
        actualOutput: response.data.actualOutput,
        passed: response.data.passed,
        timeMs: response.data.timeMs ?? response.data.testResult?.timeMs,
        memoryKb: response.data.memoryKb ?? response.data.testResult?.memoryKb,
        isCustomTest: true,
      });

    } catch (err) {
      console.error('Failed to run with custom input:', err);
      recordAndShowResults('custom', {
        error: true,
        message: typeof err === 'string' ? err : 'Failed to execute code with custom input. Please try again.'
      });
    } finally {
      setRunBusy(null);
    }
  };

  const handlePresentSolution = async () => {
    if (!selectedQuestion) {
      setPresentMsg('Select a question first.');
      return;
    }

    try {
      setRunBusy('present');
      setPresentMsg('');
      let source = selectedQuestion;
      if (selectedQuestion._id) {
        const [qRes, solRes] = await Promise.all([
          getQuestion(selectedQuestion._id, selectedClass?._id || null).catch(() => null),
          viewSolution(selectedQuestion._id).catch(() => null),
        ]);
        const fromGet = qRes?.data?.question || (qRes?.data && !qRes.data.solution ? qRes.data : {});
        const fromSol = solRes?.data?.solution || {};
        source = { ...selectedQuestion, ...fromGet, ...fromSol };
      }

      const official = describeOfficialAnswer(source);
      if (source.type === 'fillInTheBlanksCoding') {
        const picked = pickSolutionForQuestion(source, selectedLanguage);
        const blankSolution = official?.blank || picked.code;
        if (!blankSolution?.trim()) {
          setPresentedReveal(null);
          setPresentMsg('No solution saved for this question.');
          return;
        }
        skipEditorResetRef.current = true;
        setSelectedQuestion(source);
        setFillInBlankLine(blankSolution);
        setPresentedReveal(official);
        setPresentMsg('Solution loaded.');
        return;
      }

      if (FULL_CODE_EDITOR_TYPES.includes(source.type)) {
        const picked = pickSolutionForQuestion(source, selectedLanguage);
        if (!picked.code?.trim()) {
          setPresentedReveal(null);
          setPresentMsg('No solution code saved for this question. Add one under Edit → Test Solution.');
          return;
        }
        skipEditorResetRef.current = true;
        setSelectedQuestion(source);
        if (picked.language && normalizeLang(picked.language) !== normalizeLang(selectedLanguage)) {
          setSelectedLanguage(picked.language);
        }
        setCode(picked.code);
        setPresentedReveal(null);
        setPresentMsg('Solution loaded in the editor.');
        return;
      }

      if (official?.text) {
        setSelectedQuestion(source);
        setPresentedReveal(official);
        setPresentMsg(official.text);
        return;
      }

      setPresentedReveal(null);
      setPresentMsg('No solution saved for this question.');
    } catch (err) {
      setPresentMsg(typeof err === 'string' ? err : 'Failed to load solution.');
    } finally {
      setRunBusy(null);
    }
  };

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
          <RunMetricsBadges result={testResults} className="pt-1" />
        </div>
      );
    }

    return (
      <div className="space-y-2">
        <TestCaseResultsList
          results={testResults.testResults}
          className="p-2 bg-white rounded border"
          showHiddenDetails
        />
        {testResults.testResults && (
          <RunMetricsBadges
            timeMs={summarizeRunMetrics(testResults.testResults).maxTimeMs}
            memoryKb={summarizeRunMetrics(testResults.testResults).maxMemoryKb}
            className="pt-1"
          />
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
            {testResults.error ? 'Error' : testResults.isCustomTest ? 'Custom Test Results' : resultsModalKind === 'submit' ? 'Submit Results' : 'Test Results'}
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

  const getClassNavigationState = () =>
    selectedClass?._id ? { classId: selectedClass._id, fromTakeClass: true, questionId: selectedQuestion?._id } : undefined;

  const navigateWithClassContext = (path) => {
    const state = getClassNavigationState();
    navigate(path, state ? { state } : undefined);
  };

  // Menu action handlers
  const handleViewSolution = (questionId) => {
    navigateWithClassContext(`/teacher/questions/${questionId}/solution`);
  };

  const handleViewTestCases = (questionId) => {
    navigateWithClassContext(`/teacher/questions/${questionId}/test-cases`);
  };

  const handleViewQuestionStatistics = (questionOverrideId) => {
    const qId = questionOverrideId || selectedQuestion?._id;
    if (!selectedClass?._id || !qId) {
      alert('Please select a class and question first');
      return;
    }
    navigate(
      `/teacher/take-class/${selectedClass._id}/questions/${qId}/statistics`,
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
    }
  };

  // Handle horizontal panel resizing
  useEffect(() => {
    const handleMouseMove = (e) => {
      if (!isDragging) return;
      
      const sidebarWidth = isSidebarCollapsed ? 0 : 288;
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
          setQuestionsLoading(true);
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
          setQuestionsLoading(false);
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
    if (skipEditorResetRef.current) {
      skipEditorResetRef.current = false;
      return;
    }
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

  useEffect(() => {
    setPresentedReveal(null);
  }, [selectedQuestionId]);

  useEffect(() => {
    if (!presentMsg) return undefined;
    const t = setTimeout(() => setPresentMsg(''), 3500);
    return () => clearTimeout(t);
  }, [presentMsg]);

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
          } w-72 flex-shrink-0 border-r transition-all duration-300 lg:h-full lg:min-h-0 lg:self-stretch`} 
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
              className="absolute inset-0 overflow-y-auto overflow-x-hidden overscroll-contain touch-pan-y"
              style={{ WebkitOverflowScrolling: 'touch' }}
            >
            <div className="px-3 pb-4 pt-3">
              {questionsLoading ? (
                <div className="text-center py-8">
                  <div className="w-8 h-8 border-4 border-t-transparent rounded-full animate-spin mx-auto" style={{ borderColor: 'var(--text-primary)', borderTopColor: 'transparent' }}></div>
                </div>
              ) : questions.length === 0 ? (
                <p className="text-sm text-center py-8" style={{ color: 'var(--text-secondary)' }}>
                  No questions available
                </p>
              ) : (
                <div className="space-y-2">
                  {questions.map((q, idx) => {
                    const isSelected = selectedQuestion?._id === q._id;
                    const classEntry = q.classes?.find(
                      (c) => c.classId?.toString() === selectedClass._id || c.classId?._id?.toString() === selectedClass._id
                    );
                    const isPublished = classEntry?.isPublished || false;
                    const plainTitle = q.title?.replace(/<[^>]*>/g, '') || 'Untitled';
                    return (
                    <div
                      key={q._id}
                      className={`rounded-xl transition-all duration-200 ${
                        isSelected ? 'shadow-md' : 'hover:shadow-sm'
                      }`}
                      style={{ 
                        backgroundColor: isSelected ? 'var(--accent-indigo)' : 'var(--card-white)',
                        border: isSelected ? '1px solid var(--accent-indigo)' : '1px solid var(--card-border)',
                        position: 'relative'
                      }}
                    >
                      <div className="flex items-center gap-1 px-2 py-2">
                        <button
                          type="button"
                          onClick={() => {
                            setSelectedQuestion(q);
                            setSelectedLanguage(q.languages?.[0] || 'javascript');
                            setShowQuestionsList(false);
                          }}
                          className="flex-1 min-w-0 flex items-center gap-2.5 text-left px-1 py-0.5"
                        >
                          <span
                            className={`flex-shrink-0 flex h-7 w-7 items-center justify-center rounded-full text-xs font-bold ${
                              isSelected ? 'bg-white text-indigo-700' : 'bg-indigo-100 text-indigo-700'
                            }`}
                          >
                            {idx + 1}
                          </span>
                          <div className="flex-1 min-w-0">
                            <p
                              className="text-sm font-medium truncate leading-5"
                              style={{ color: isSelected ? '#ffffff' : 'var(--text-heading)' }}
                              title={plainTitle}
                            >
                              {plainTitle}
                            </p>
                            <p
                              className="text-[11px] truncate leading-4 mt-0.5"
                              style={{ color: isSelected ? 'rgba(255,255,255,0.8)' : 'var(--text-secondary)' }}
                            >
                              {isPublished ? 'Published' : 'Unpublished'}
                            </p>
                          </div>
                        </button>
                        <Menu as="div" className="relative flex-shrink-0">
                          {() => (
                            <>
                              <Menu.Button 
                                className={`p-1.5 rounded-lg transition-colors flex-shrink-0 ${
                                  isSelected ? 'hover:bg-white/15' : 'hover:bg-gray-100'
                                }`}
                                onClick={(e) => e.stopPropagation()}
                              >
                                <svg
                                  className="h-4 w-4"
                                  style={{ color: isSelected ? '#ffffff' : 'var(--text-secondary)' }}
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
                                              setSelectedQuestion(q);
                                              handleViewQuestionStatistics(q._id);
                                            }}
                                            className={`${
                                              active ? 'bg-indigo-50' : ''
                                            } group flex w-full items-center gap-2 px-3 py-2 text-xs transition-colors`}
                                            style={{ color: 'var(--text-primary)' }}
                                          >
                                            <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
                                            </svg>
                                            Question statistics
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
                    );
                  })}
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
                  <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold ${
                    selectedQuestion.difficulty === 'easy' ? 'bg-green-100 text-green-700' :
                    selectedQuestion.difficulty === 'medium' ? 'bg-yellow-100 text-yellow-700' :
                    'bg-red-100 text-red-700'
                  }`}>
                    {selectedQuestion.difficulty}
                  </span>
                  <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold bg-purple-100 text-purple-700">
                    {selectedQuestion.maxPoints != null && selectedQuestion.maxPoints !== '' ? `${selectedQuestion.maxPoints} points` : 'No points'}
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
                  <QuestionHtml
                    html={selectedQuestion.description}
                    className="text-xs sm:text-sm leading-relaxed"
                    style={{ color: 'var(--text-primary)' }}
                    empty={<span className="text-xs sm:text-sm">—</span>}
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
              <div className="border-b px-3 py-2.5 sm:px-4 flex-shrink-0" style={{ backgroundColor: 'var(--card-white)', borderColor: 'var(--card-border)' }}>
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div className="flex flex-wrap items-center gap-2 sm:gap-3 min-w-0">
                    {isRunnableCoding && selectedQuestion.languages?.length > 0 ? (
                      <div className="inline-flex items-center gap-2">
                        <label className="text-xs font-medium whitespace-nowrap" style={{ color: 'var(--text-secondary)' }}>
                          Language
                        </label>
                        <select
                          value={selectedLanguage}
                          onChange={(e) => setSelectedLanguage(e.target.value)}
                          className="rounded-lg border shadow-sm focus:border-indigo-500 focus:ring-indigo-500 text-sm px-3 py-1.5 min-w-[7.5rem]"
                          style={{
                            borderColor: 'var(--card-border)',
                            backgroundColor: 'var(--background-light)',
                            color: 'var(--text-primary)',
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
                      <div className="hidden sm:inline-flex items-center gap-3 text-xs font-medium" style={{ color: 'var(--text-secondary)' }}>
                        <span>Time: {selectedQuestion.timeLimit ?? 2}s</span>
                        <span>Memory: {selectedQuestion.memoryLimit ?? 256}MB</span>
                      </div>
                    )}
                  </div>
                  <div className="flex items-center gap-2 flex-wrap justify-end">
                    {(showFullCodeEditor || isFillInBlanksCoding) && (
                      <button
                        type="button"
                        onClick={toggleFullscreen}
                        className="inline-flex items-center justify-center h-8 w-8 rounded-lg border transition-all duration-200 hover:shadow"
                        style={{
                          backgroundColor: 'var(--card-white)',
                          borderColor: 'var(--card-border)',
                          color: 'var(--text-primary)',
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
                        {questionRunHistory.length > 0 && (
                          <button
                            type="button"
                            onClick={openRunHistory}
                            className="inline-flex items-center gap-1 h-8 px-3 text-xs font-semibold rounded-lg border transition-all duration-200 hover:shadow"
                            style={{
                              backgroundColor: 'var(--accent-indigo)',
                              borderColor: 'var(--accent-indigo)',
                              color: '#fff',
                            }}
                            title="Reopen past runs and outputs"
                          >
                            <ClockIcon className="w-4 h-4" />
                            History ({questionRunHistory.length})
                          </button>
                        )}
                        <button
                          type="button"
                          onClick={handleResetCode}
                          className="inline-flex items-center h-8 px-3 text-xs font-semibold rounded-lg border transition-all duration-200 hover:shadow"
                          style={{
                            backgroundColor: 'var(--card-white)',
                            borderColor: 'var(--card-border)',
                            color: 'var(--text-primary)',
                          }}
                        >
                          Reset
                        </button>
                        <button
                          type="button"
                          onClick={handleCopyCode}
                          className="inline-flex items-center h-8 px-3 text-xs font-semibold rounded-lg border transition-all duration-200 hover:shadow"
                          style={{
                            backgroundColor: 'var(--card-white)',
                            borderColor: 'var(--card-border)',
                            color: 'var(--text-primary)',
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
                    {showFullCodeEditor && !isFullscreen && (
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
                    {isFillInBlanksCoding && !isFullscreen && (
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
                      This question is not executed in the sandbox here. Select it to present the statement on the left.
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
                            style={{
                              borderColor: presentedReveal?.indexes?.includes(index) ? '#16a34a' : 'var(--card-border)',
                              backgroundColor: presentedReveal?.indexes?.includes(index) ? '#dcfce7' : 'var(--card-white)',
                            }}
                          >
                            <span className="text-sm font-semibold shrink-0" style={{ color: 'var(--text-primary)' }}>
                              {(index + 10).toString(36).toUpperCase()}.
                            </span>
                            <div className="text-sm prose prose-sm max-w-none flex-1" style={{ color: 'var(--text-primary)' }}>
                              {parse(option || '')}
                              {presentedReveal?.indexes?.includes(index) ? (
                                <span className="ml-2 text-xs font-semibold text-green-700">Correct</span>
                              ) : null}
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
                            style={{
                              borderColor: presentedReveal?.indexes?.includes(index) ? '#16a34a' : 'var(--card-border)',
                              backgroundColor: presentedReveal?.indexes?.includes(index) ? '#dcfce7' : 'var(--card-white)',
                            }}
                          >
                            <span className="text-sm font-semibold shrink-0" style={{ color: 'var(--text-primary)' }}>
                              {(index + 10).toString(36).toUpperCase()}.
                            </span>
                            <div className="text-sm prose prose-sm max-w-none flex-1" style={{ color: 'var(--text-primary)' }}>
                              {parse(option || '')}
                              {presentedReveal?.indexes?.includes(index) ? (
                                <span className="ml-2 text-xs font-semibold text-green-700">Correct</span>
                              ) : null}
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
                  {presentedReveal?.text && !isRunnableCoding && (
                    <div className="p-3 rounded-lg border text-sm font-medium bg-green-50 border-green-200 text-green-800 whitespace-pre-wrap">
                      {presentedReveal.text}
                    </div>
                  )}
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
                        placeholder={CUSTOM_STDIN_PLACEHOLDER}
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
                        placeholder={CUSTOM_STDOUT_PLACEHOLDER}
                      />
                    </div>
                  </div>
                  )}

                  {questionRunHistory.length > 0 && !showResultsModal && (
                    <button
                      type="button"
                      onClick={openRunHistory}
                      className="w-full flex items-center justify-between gap-2 rounded-lg border px-3 py-2 text-left"
                      style={{
                        borderColor: 'var(--card-border)',
                        backgroundColor: 'var(--background-light)',
                        color: 'var(--text-primary)',
                      }}
                    >
                      <span className="min-w-0">
                        <span className="block text-xs font-semibold uppercase tracking-wide" style={{ color: 'var(--text-secondary)' }}>
                          Last run / history
                        </span>
                        <span className={`block text-sm font-medium truncate ${questionRunHistory[0].failed ? 'text-rose-600' : 'text-emerald-600'}`}>
                          {historyKindLabel(questionRunHistory[0].kind)} · {questionRunHistory[0].summary}
                        </span>
                      </span>
                      <span className="shrink-0 inline-flex items-center text-xs font-semibold text-indigo-600">
                        <ClockIcon className="h-4 w-4 mr-1" />
                        Open
                      </span>
                    </button>
                  )}

                  {/* Action Buttons */}
                  <div className="flex flex-wrap justify-end gap-2 border-t pt-3" style={{ borderColor: 'var(--card-border)' }}>
                    {isRunnableCoding && (
                      <>
                        <button
                          type="button"
                          onClick={handleRunCode}
                          disabled={Boolean(runBusy)}
                          className={`inline-flex items-center px-4 py-2 rounded-lg text-sm font-semibold text-white focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 transition-all duration-200 ${
                            runBusy ? 'bg-blue-400 cursor-not-allowed' : 'bg-blue-600 hover:bg-blue-700'
                          }`}
                        >
                          {runBusy === 'run' ? (
                            <>
                              <ButtonSpinner />
                              Running...
                            </>
                          ) : isFillInBlanksCoding ? 'Run tests' : 'Run Code'}
                        </button>
                        <button
                          type="button"
                          onClick={handleSubmitCode}
                          disabled={Boolean(runBusy)}
                          className={`inline-flex items-center px-4 py-2 rounded-lg text-sm font-semibold text-white focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-emerald-500 transition-all duration-200 ${
                            runBusy ? 'bg-emerald-400 cursor-not-allowed' : 'bg-emerald-600 hover:bg-emerald-700'
                          }`}
                        >
                          {runBusy === 'submit' ? (
                            <>
                              <ButtonSpinner />
                              Submitting...
                            </>
                          ) : 'Submit'}
                        </button>
                        <button
                          type="button"
                          onClick={handleRunWithCustomInput}
                          disabled={!customInput.trim() || Boolean(runBusy)}
                          className={`inline-flex items-center px-4 py-2 rounded-lg text-sm font-semibold text-white focus:outline-none focus:ring-2 focus:ring-offset-2 transition-all duration-200 ${
                            customInput.trim() && !runBusy ? 'bg-green-600 hover:bg-green-700 focus:ring-green-500' : 'bg-gray-400 cursor-not-allowed'
                          }`}
                        >
                          {runBusy === 'custom' ? (
                            <>
                              <ButtonSpinner />
                              Running...
                            </>
                          ) : 'Run Custom'}
                        </button>
                      </>
                    )}
                    <button
                      type="button"
                      onClick={handlePresentSolution}
                      disabled={Boolean(runBusy)}
                      className={`inline-flex items-center px-4 py-2 rounded-lg text-sm font-semibold text-white focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 transition-all duration-200 ${
                        runBusy ? 'bg-indigo-400 cursor-not-allowed' : 'bg-indigo-600 hover:bg-indigo-700'
                      }`}
                    >
                      {runBusy === 'present' ? (
                        <>
                          <ButtonSpinner />
                          Loading...
                        </>
                      ) : 'Present Solution'}
                    </button>
                    {questionRunHistory.length > 0 && (
                      <button
                        type="button"
                        onClick={openRunHistory}
                        className="inline-flex items-center px-4 py-2 rounded-lg text-sm font-semibold border transition-all duration-200"
                        style={{
                          borderColor: 'var(--card-border)',
                          backgroundColor: 'var(--card-white)',
                          color: 'var(--text-primary)',
                        }}
                      >
                        <ClockIcon className="h-4 w-4 mr-1.5" />
                        Run history ({questionRunHistory.length})
                      </button>
                    )}
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
                disabled={Boolean(runBusy)}
                className="inline-flex items-center px-4 py-2 rounded-lg text-sm font-semibold text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 disabled:opacity-50"
              >
                {runBusy === 'run' ? (
                  <>
                    <ButtonSpinner />
                    Running...
                  </>
                ) : isFillInBlanksCoding ? 'Run tests' : 'Run Code'}
              </button>
              <button
                type="button"
                onClick={handleSubmitCode}
                disabled={Boolean(runBusy)}
                className={`inline-flex items-center px-4 py-2 rounded-lg text-sm font-semibold text-white focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-emerald-500 ${
                  runBusy ? 'bg-emerald-400 cursor-not-allowed' : 'bg-emerald-600 hover:bg-emerald-700'
                }`}
              >
                {runBusy === 'submit' ? (
                  <>
                    <ButtonSpinner />
                    Submitting...
                  </>
                ) : 'Submit'}
              </button>
              <button
                type="button"
                onClick={handlePresentSolution}
                disabled={Boolean(runBusy)}
                className={`inline-flex items-center px-4 py-2 rounded-lg text-sm font-semibold text-white focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 ${
                  runBusy ? 'bg-indigo-400 cursor-not-allowed' : 'bg-indigo-600 hover:bg-indigo-700'
                }`}
              >
                {runBusy === 'present' ? (
                  <>
                    <ButtonSpinner />
                    Loading...
                  </>
                ) : 'Present Solution'}
              </button>
              {questionRunHistory.length > 0 && (
                <button
                  type="button"
                  onClick={openRunHistory}
                  className="inline-flex items-center px-3 py-2 rounded-lg text-sm font-semibold border"
                  style={{ borderColor: 'var(--card-border)', backgroundColor: 'var(--card-white)', color: 'var(--text-primary)' }}
                >
                  <ClockIcon className="h-4 w-4 mr-1.5" />
                  History
                </button>
              )}
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

      {presentMsg && (
        <div className="fixed top-4 left-1/2 -translate-x-1/2 z-[100] max-w-md px-4 py-2 rounded-lg shadow-lg text-sm font-medium text-white bg-indigo-700">
          {presentMsg}
        </div>
      )}

      {showResultsModal && (resultsView === 'list' || testResults) && (
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
            {resultsView === 'list' ? (
              <>
                <div className="flex items-start justify-between gap-3 mb-4">
                  <h2 id="results-modal-title" className="text-lg font-semibold" style={{ color: 'var(--text-heading)' }}>
                    Run history
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
                <p className="text-xs mb-3" style={{ color: 'var(--text-secondary)' }}>
                  This session for the current question. Open a run to see failed cases and output.
                </p>
                {questionRunHistory.length === 0 ? (
                  <p className="text-sm" style={{ color: 'var(--text-secondary)' }}>No runs yet.</p>
                ) : (
                  <div className="space-y-2">
                    {questionRunHistory.map((entry) => (
                      <button
                        key={entry.id}
                        type="button"
                        onClick={() => openHistoryEntry(entry)}
                        className="w-full text-left rounded-lg border px-3 py-2 hover:border-indigo-400 transition-colors"
                        style={{ borderColor: 'var(--card-border)', backgroundColor: 'var(--background-light)' }}
                      >
                        <div className="flex items-center justify-between gap-2">
                          <span className="text-xs font-semibold uppercase tracking-wide" style={{ color: 'var(--text-secondary)' }}>
                            {historyKindLabel(entry.kind)}
                          </span>
                          <span className="text-xs" style={{ color: 'var(--text-secondary)' }}>
                            {formatHistoryTime(entry.at)}
                          </span>
                        </div>
                        <div className={`text-sm font-medium mt-0.5 ${entry.failed ? 'text-rose-600' : 'text-emerald-600'}`}>
                          {entry.summary}
                        </div>
                      </button>
                    ))}
                  </div>
                )}
              </>
            ) : (
              <>
                <div className="flex items-start justify-between gap-3 mb-4">
                  <h2 id="results-modal-title" className="text-lg font-semibold" style={{ color: 'var(--text-heading)' }}>
                    {testResults?.error
                      ? 'Error'
                      : testResults?.isCustomTest
                        ? 'Custom Test Results'
                        : resultsModalKind === 'submit'
                          ? 'Submit Results'
                          : 'Test Results'}
                  </h2>
                  <div className="flex items-center gap-2 shrink-0">
                    {questionRunHistory.length > 0 && (
                      <button
                        type="button"
                        onClick={() => setResultsView('list')}
                        className="inline-flex items-center px-2.5 py-1 rounded-lg text-xs font-semibold border"
                        style={{ borderColor: 'var(--card-border)', color: 'var(--text-primary)' }}
                      >
                        <ClockIcon className="h-3.5 w-3.5 mr-1" />
                        History
                      </button>
                    )}
                    <button
                      type="button"
                      onClick={closeResultsModal}
                      className="p-1 rounded hover:opacity-70 text-lg leading-none"
                      style={{ color: 'var(--text-secondary)' }}
                      aria-label="Close"
                    >
                      ×
                    </button>
                  </div>
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
              </>
            )}
          </div>
        </div>
      )}
    </div>
  );
};

export default TakeClass;
