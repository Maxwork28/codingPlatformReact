import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useSelector } from 'react-redux';
import { useLocation } from 'react-router-dom';
import { io } from 'socket.io-client';
import { GraduationCap, List } from 'lucide-react';
import { getQuestionsByClass, runCode, runCodeWithCustomInput, submitAnswer } from '../../../common/services/api';
import { API_BASE_URL } from '../../../common/constants';
import { loadRunHistory, makeRunHistoryEntry, saveRunHistory } from '../../../common/utils/runOutputHistory';
import { notify } from '../../../common/ui/Toast';
import { Button, EmptyState, StatusChip } from '../../../common/ui/primitives';
import { type } from '../../../common/ui/format';
import ClassPicker from '../../admin/components/ClassPicker';
import ResultsModal from '../../teacher/pages/takeClass/ResultsModal';
import PracticeWorkspace from './takeClass/PracticeWorkspace';
import QuestionRail from './takeClass/QuestionRail';
import {
  RUNNABLE_CODING_TYPES,
  availableLanguages,
  getCodeTemplateForLanguage,
  interactionLock,
  isEnrolledStudent,
  publishedForClass,
} from './takeClass/helpers';

const StudentTakeClass = () => {
  const location = useLocation();
  const { user } = useSelector((state) => state.auth);
  const { classes } = useSelector((state) => state.classes);

  const [selectedClass, setSelectedClass] = useState(null);
  const [selectedQuestion, setSelectedQuestion] = useState(null);
  const [questions, setQuestions] = useState([]);
  const [questionsLoading, setQuestionsLoading] = useState(false);
  const [code, setCode] = useState('');
  const [fillInBlankLine, setFillInBlankLine] = useState('');
  const [selectedLanguage, setSelectedLanguage] = useState('javascript');
  const [mcqSingleIndex, setMcqSingleIndex] = useState(null);
  const [mcqMultipleIndices, setMcqMultipleIndices] = useState([]);
  const [fillInBlanksAnswer, setFillInBlanksAnswer] = useState('');
  const [customInput, setCustomInput] = useState('');
  const [customOutput, setCustomOutput] = useState('');
  const [runBusy, setRunBusy] = useState(null);
  const [showQuestionsList, setShowQuestionsList] = useState(false);
  const [leftPanelWidth, setLeftPanelWidth] = useState(50);
  const [isDragging, setIsDragging] = useState(false);
  const [editorHeight, setEditorHeight] = useState(65);
  const [isDraggingVertical, setIsDraggingVertical] = useState(false);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(false);
  const [testResults, setTestResults] = useState(null);
  const [showResultsModal, setShowResultsModal] = useState(false);
  const [resultsModalKind, setResultsModalKind] = useState(null);
  const [runHistory, setRunHistory] = useState([]);
  const [resultsView, setResultsView] = useState('detail');
  const [submissionFeedback, setSubmissionFeedback] = useState(null);
  const lastCodeInitKeyRef = useRef(null);
  const lastAnswerInitRef = useRef(null);

  const myClasses = useMemo(
    () => (classes || []).filter((cls) => isEnrolledStudent(cls, user?.id || user?._id)),
    [classes, user?.id, user?._id],
  );
  const enrolledFilter = useCallback((cls) => isEnrolledStudent(cls, user?.id || user?._id), [user?.id, user?._id]);

  const lock = useMemo(
    () => interactionLock(selectedQuestion, selectedClass?._id),
    [selectedQuestion, selectedClass?._id],
  );

  useEffect(() => {
    setRunHistory(loadRunHistory('student', selectedClass?._id));
  }, [selectedClass?._id]);

  useEffect(() => {
    const state = location.state;
    if (!state?.classId || !myClasses.length || selectedClass) return;
    const found = myClasses.find((cls) => String(cls._id) === String(state.classId));
    if (found) setSelectedClass(found);
  }, [location.state, myClasses, selectedClass]);

  useEffect(() => {
    const handleMouseMove = (e) => {
      if (!isDragging) return;
      const container = document.getElementById('student-workspace');
      if (!container) return;
      const rect = container.getBoundingClientRect();
      const next = ((e.clientX - rect.left) / rect.width) * 100;
      if (next >= 25 && next <= 75) setLeftPanelWidth(next);
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
  }, [isDragging]);

  useEffect(() => {
    const handleMouseMove = (e) => {
      if (!isDraggingVertical) return;
      const split = document.getElementById('student-code-split');
      if (!split) return;
      const rect = split.getBoundingClientRect();
      const next = ((e.clientY - rect.top) / rect.height) * 100;
      if (next >= 30 && next <= 85) setEditorHeight(next);
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

  useEffect(() => {
    const onKey = (e) => {
      if (e.key === 'Escape' && isFullscreen) setIsFullscreen(false);
      if (e.key === 'F11') {
        e.preventDefault();
        if (!isFullscreen && lock.locked) return;
        setIsFullscreen((v) => !v);
      }
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [isFullscreen, lock.locked]);

  const applyQuestionList = useCallback((list, keepId) => {
    const published = (list || []).filter((q) => publishedForClass(q, selectedClass?._id));
    setQuestions(published);
    setSelectedQuestion((sel) => {
      const id = keepId || sel?._id;
      if (id) {
        const updated = published.find((q) => q._id === id);
        if (updated) return updated;
      }
      return published[0] ?? null;
    });
    return published;
  }, [selectedClass?._id]);

  const refreshQuestions = useCallback(async () => {
    if (!selectedClass?._id) return [];
    const response = await getQuestionsByClass(selectedClass._id);
    return applyQuestionList(response.data.questions || []);
  }, [applyQuestionList, selectedClass?._id]);

  useEffect(() => {
    if (!selectedClass) return undefined;
    let cancelled = false;
    const load = async () => {
      try {
        setQuestionsLoading(true);
        const response = await getQuestionsByClass(selectedClass._id);
        if (cancelled) return;
        applyQuestionList(response.data.questions || []);
      } catch (err) {
        if (!cancelled) notify(typeof err === 'string' ? err : 'Failed to load questions');
      } finally {
        if (!cancelled) setQuestionsLoading(false);
      }
    };
    load();
    return () => {
      cancelled = true;
    };
  }, [applyQuestionList, selectedClass]);

  useEffect(() => {
    if (!selectedClass?._id) return undefined;
    const socket = io(`${API_BASE_URL}/`, { withCredentials: true });
    socket.emit('joinClass', selectedClass._id);
    const sync = () => {
      void refreshQuestions();
    };
    socket.on('questionPublished', sync);
    socket.on('questionDisabled', sync);
    socket.on('questionAssigned', sync);
    return () => {
      socket.off('questionPublished', sync);
      socket.off('questionDisabled', sync);
      socket.off('questionAssigned', sync);
      socket.disconnect();
    };
  }, [refreshQuestions, selectedClass?._id]);

  useEffect(() => {
    if (!selectedQuestion || !RUNNABLE_CODING_TYPES.includes(selectedQuestion.type)) {
      lastCodeInitKeyRef.current = null;
      return;
    }
    const langs = availableLanguages(selectedQuestion);
    if (langs.length && !langs.includes(selectedLanguage)) {
      setSelectedLanguage(langs[0]);
      return;
    }
    const key = `${selectedQuestion._id}:${selectedLanguage}`;
    if (lastCodeInitKeyRef.current === key) return;
    lastCodeInitKeyRef.current = key;
    setCode(getCodeTemplateForLanguage(selectedQuestion, selectedLanguage) || '// Write your code here...');
    setFillInBlankLine('');
  }, [selectedLanguage, selectedQuestion]);

  useEffect(() => {
    const qid = selectedQuestion?._id?.toString() ?? '';
    if (!qid || lastAnswerInitRef.current === qid) return;
    lastAnswerInitRef.current = qid;
    setMcqSingleIndex(null);
    setMcqMultipleIndices([]);
    setFillInBlanksAnswer('');
    setSubmissionFeedback(null);
    setCustomInput('');
    setCustomOutput('');
    setTestResults(null);
    setShowResultsModal(false);
  }, [selectedQuestion?._id]);

  const codingAnswer = () =>
    selectedQuestion?.type === 'fillInTheBlanksCoding' ? fillInBlankLine : code;

  const recordAndShowResults = (kind, payload) => {
    setTestResults(payload);
    if (kind === 'submit') setSubmissionFeedback(payload);
    if (selectedQuestion?._id) {
      setRunHistory((prev) => {
        const next = [makeRunHistoryEntry(selectedQuestion._id, kind, payload), ...prev].slice(0, 30);
        saveRunHistory('student', selectedClass?._id, next);
        return next;
      });
    }
    setResultsView('detail');
    setResultsModalKind(kind === 'submit' ? 'submit' : 'run');
    setShowResultsModal(true);
  };

  const handleRun = async () => {
    if (lock.locked) return notify('Answers are disabled for this question right now.');
    const answer = codingAnswer();
    if (!answer?.trim()) return notify('Write some code first');
    try {
      setRunBusy('run');
      const response = await runCode(selectedQuestion._id, answer, selectedClass._id, selectedLanguage);
      const tr = response.data.testResults || [];
      const sub = response.data.submission || {};
      recordAndShowResults('run', {
        message: response.data.message,
        testResults: tr,
        passedTestCases: response.data.passedTestCases ?? sub.passedTestCases ?? tr.filter((t) => t.passed).length,
        totalTestCases: response.data.totalTestCases ?? sub.totalTestCases ?? tr.length,
        isCorrect: response.data.isCorrect ?? (tr.length > 0 && tr.every((t) => t.passed)),
        explanation: response.data.explanation,
      });
    } catch (err) {
      recordAndShowResults('run', { error: true, message: typeof err === 'string' ? err : 'Failed to run code' });
    } finally {
      setRunBusy(null);
    }
  };

  const handleRunCustom = async () => {
    if (lock.locked) return notify('Answers are disabled for this question right now.');
    const answer = codingAnswer();
    if (!answer?.trim()) return notify('Write some code first');
    if (!customInput.trim()) return notify('Provide custom input');
    try {
      setRunBusy('custom');
      const response = await runCodeWithCustomInput(
        selectedQuestion._id,
        answer,
        selectedClass._id,
        selectedLanguage,
        customInput,
        customOutput,
      );
      const customRow = response.data.testResult || response.data.testResults;
      recordAndShowResults('custom', {
        message: response.data.message,
        customInput: response.data.customInput ?? customInput,
        expectedOutput: response.data.expectedOutput,
        actualOutput: response.data.actualOutput ?? customRow?.output,
        passed: response.data.passed ?? customRow?.passed,
        timeMs: response.data.timeMs ?? customRow?.timeMs,
        memoryKb: response.data.memoryKb ?? customRow?.memoryKb,
        isCustomTest: true,
      });
    } catch (err) {
      recordAndShowResults('custom', { error: true, message: typeof err === 'string' ? err : 'Failed to run custom input' });
    } finally {
      setRunBusy(null);
    }
  };

  const handleSubmit = async () => {
    if (!selectedQuestion || !selectedClass) return notify('Select a question first');
    if (lock.locked) return notify('Answers are disabled for this question right now.');
    const qType = selectedQuestion.type;
    let payload;
    let language;
    if (RUNNABLE_CODING_TYPES.includes(qType)) {
      payload = codingAnswer();
      language = selectedLanguage;
      if (!String(payload || '').trim()) return notify('Write some code to submit');
    } else if (qType === 'singleCorrectMcq') {
      if (mcqSingleIndex == null) return notify('Select an option');
      payload = mcqSingleIndex;
    } else if (qType === 'multipleCorrectMcq') {
      if (!mcqMultipleIndices.length) return notify('Select at least one option');
      payload = mcqMultipleIndices.map((i) => parseInt(String(i), 10));
    } else if (qType === 'fillInTheBlanks') {
      if (!fillInBlanksAnswer.trim()) return notify('Enter your answer');
      payload = fillInBlanksAnswer;
    } else {
      return;
    }
    try {
      setRunBusy('submit');
      const response = await submitAnswer(selectedQuestion._id, payload, selectedClass._id, language);
      const data = response?.data ?? {};
      const sub = data.submission ?? {};
      const tr = data.testResults ?? [];
      recordAndShowResults('submit', {
        isCorrect: Boolean(sub.isCorrect ?? data.isCorrect),
        explanation: data.explanation ?? sub.explanation,
        passedTestCases: data.passedTestCases ?? sub.passedTestCases,
        totalTestCases: data.totalTestCases ?? sub.totalTestCases,
        testResults: tr,
      });
      await refreshQuestions();
    } catch (err) {
      notify(typeof err === 'string' ? err : err.response?.data?.error || 'Failed to submit');
    } finally {
      setRunBusy(null);
    }
  };

  const questionRunHistory = runHistory.filter((entry) => entry.questionId === String(selectedQuestion?._id || ''));
  const solvedCount = questions.filter((q) => q.studentAttemptStatus === 'attempted').length;

  return (
    <div className="flex flex-col min-h-0 overflow-hidden w-full h-[calc(100vh-4rem)] max-h-[calc(100vh-4rem)] bg-page">
      <header className="shrink-0 h-14 px-4 sm:px-5 border-b border-line bg-surface flex items-center gap-3">
        <h1 className={`${type.pageTitle} text-xl! shrink-0`}>Practice Class</h1>
        <div className="w-64 sm:w-80 min-w-0">
          <ClassPicker
            value={selectedClass}
            filter={enrolledFilter}
            onChange={(cls) => {
              if (cls && !isEnrolledStudent(cls, user?.id || user?._id)) {
                notify('You can only practice classes you are enrolled in');
                return;
              }
              setSelectedClass(cls);
              setSelectedQuestion(null);
              setQuestions([]);
            }}
          />
        </div>
        {selectedClass && (
          <>
            <StatusChip kind="neutral">{questions.length} live</StatusChip>
            <StatusChip kind={solvedCount ? 'ok' : 'neutral'}>{solvedCount} solved</StatusChip>
            <Button variant="secondary" icon={List} className="lg:hidden ml-auto h-9" onClick={() => setShowQuestionsList(true)}>
              Questions
            </Button>
          </>
        )}
      </header>

      {!selectedClass ? (
        <div className="flex-1 min-h-0 flex items-center justify-center p-6">
          <EmptyState
            icon={GraduationCap}
            title={myClasses.length ? 'Select a class' : 'No classes yet'}
            message={
              myClasses.length
                ? 'Choose a class above to practice published questions.'
                : 'When you are enrolled in a class, it appears here.'
            }
          />
        </div>
      ) : (
        <div className="flex-1 min-h-0 flex overflow-hidden">
          <QuestionRail
            questions={questions}
            loading={questionsLoading}
            selectedQuestion={selectedQuestion}
            classId={selectedClass._id}
            collapsed={isSidebarCollapsed}
            mobileOpen={showQuestionsList}
            onToggle={() => setIsSidebarCollapsed((v) => !v)}
            onCloseMobile={() => setShowQuestionsList(false)}
            onSelect={(question) => {
              setSelectedQuestion(question);
              setShowQuestionsList(false);
            }}
          />
          <PracticeWorkspace
            selectedQuestion={selectedQuestion}
            selectedLanguage={selectedLanguage}
            onLanguageChange={setSelectedLanguage}
            code={code}
            onCodeChange={setCode}
            fillInBlankLine={fillInBlankLine}
            onFillChange={setFillInBlankLine}
            mcqSingleIndex={mcqSingleIndex}
            mcqMultipleIndices={mcqMultipleIndices}
            onMcqSingle={setMcqSingleIndex}
            onMcqToggle={(idx) =>
              setMcqMultipleIndices((prev) => (prev.includes(idx) ? prev.filter((i) => i !== idx) : [...prev, idx].sort((a, b) => a - b)))
            }
            fillInBlanksAnswer={fillInBlanksAnswer}
            onFillBlanksChange={setFillInBlanksAnswer}
            customInput={customInput}
            customOutput={customOutput}
            onCustomInput={setCustomInput}
            onCustomOutput={setCustomOutput}
            leftPanelWidth={leftPanelWidth}
            editorHeight={editorHeight}
            isDragging={isDragging}
            isDraggingVertical={isDraggingVertical}
            onHorizontalDragStart={(e) => {
              e.preventDefault();
              setIsDragging(true);
            }}
            onVerticalDragStart={(e) => {
              e.preventDefault();
              setIsDraggingVertical(true);
            }}
            isFullscreen={isFullscreen}
            onToggleFullscreen={() => setIsFullscreen((v) => !v)}
            locked={lock.locked}
            lockBanner={lock.banner}
            runBusy={runBusy}
            questionRunHistory={questionRunHistory}
            onRun={handleRun}
            onRunCustom={handleRunCustom}
            onSubmit={handleSubmit}
            onReset={() => {
              if (selectedQuestion?.type === 'fillInTheBlanksCoding') setFillInBlankLine('');
              else setCode(getCodeTemplateForLanguage(selectedQuestion, selectedLanguage) || '// Write your code here...');
            }}
            onCopy={() => {
              const text = selectedQuestion?.type === 'fillInTheBlanksCoding' ? fillInBlankLine : code;
              navigator.clipboard.writeText(text || '');
              notify('Copied to clipboard');
            }}
            onOpenHistory={() => {
              setResultsView('list');
              setShowResultsModal(true);
            }}
            submissionFeedback={submissionFeedback}
          />
        </div>
      )}

      <ResultsModal
        open={showResultsModal}
        view={resultsView}
        history={questionRunHistory}
        testResults={testResults}
        kind={resultsModalKind}
        onClose={() => setShowResultsModal(false)}
        onOpenHistory={() => setResultsView('list')}
        onOpenEntry={(entry) => {
          setTestResults(entry.results);
          setResultsModalKind(entry.kind === 'submit' ? 'submit' : 'run');
          setResultsView('detail');
        }}
      />
    </div>
  );
};

export default StudentTakeClass;
