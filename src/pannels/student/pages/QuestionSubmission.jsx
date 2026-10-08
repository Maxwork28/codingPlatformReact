import React, { useEffect, useMemo, useRef, useState } from 'react';
import { useLocation, useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { ArrowLeft } from 'lucide-react';
import { getQuestion, runCode, runCodeWithCustomInput, submitAnswer } from '../../../common/services/api';
import { getSocket, joinClassRoom, leaveClassRoom } from '../../../common/services/socket';
import { loadRunHistory, makeRunHistoryEntry, saveRunHistory } from '../../../common/utils/runOutputHistory';
import { notify } from '../../../common/ui/Toast';
import { Button, EmptyState } from '../../../common/ui/primitives';
import { type } from '../../../common/ui/format';
import ResultsModal from '../../teacher/pages/takeClass/ResultsModal';
import PracticeWorkspace from './takeClass/PracticeWorkspace';
import {
  RUNNABLE_CODING_TYPES,
  availableLanguages,
  getCodeTemplateForLanguage,
  interactionLock,
  stripHtml,
} from './takeClass/helpers';

const QuestionSubmission = () => {
  const { questionId } = useParams();
  const location = useLocation();
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const [question, setQuestion] = useState(null);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);
  const [code, setCode] = useState('');
  const [fillInBlankLine, setFillInBlankLine] = useState('');
  const [selectedLanguage, setSelectedLanguage] = useState('javascript');
  const [mcqSingleIndex, setMcqSingleIndex] = useState(null);
  const [mcqMultipleIndices, setMcqMultipleIndices] = useState([]);
  const [fillInBlanksAnswer, setFillInBlanksAnswer] = useState('');
  const [customInput, setCustomInput] = useState('');
  const [customOutput, setCustomOutput] = useState('');
  const [runBusy, setRunBusy] = useState(null);
  const [leftPanelWidth, setLeftPanelWidth] = useState(50);
  const [isDragging, setIsDragging] = useState(false);
  const [editorHeight, setEditorHeight] = useState(65);
  const [isDraggingVertical, setIsDraggingVertical] = useState(false);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [testResults, setTestResults] = useState(null);
  const [showResultsModal, setShowResultsModal] = useState(false);
  const [resultsModalKind, setResultsModalKind] = useState(null);
  const [runHistory, setRunHistory] = useState([]);
  const [resultsView, setResultsView] = useState('detail');
  const [submissionFeedback, setSubmissionFeedback] = useState(null);
  const lastCodeInitKeyRef = useRef(null);
  // Question whose default language has been applied; the student's own pick is kept until the question changes.
  const languageQuestionIdRef = useRef(null);

  const classId = useMemo(() => {
    const fromState = location.state?.classId;
    const fromQuery = params.get('classId');
    if (fromState) return String(fromState);
    if (fromQuery) return String(fromQuery);
    const entries = question?.classes || [];
    const pick = entries.find((entry) => entry.isPublished) || entries[0];
    const raw = pick?.classId?._id || pick?.classId;
    return raw ? String(raw) : null;
  }, [location.state, params, question]);

  const lock = useMemo(() => interactionLock(question, classId), [question, classId]);

  useEffect(() => {
    document.body.classList.add('hide-sidebar');
    return () => document.body.classList.remove('hide-sidebar');
  }, []);

  useEffect(() => {
    setRunHistory(loadRunHistory('student-submit', classId));
  }, [classId]);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    getQuestion(questionId, classId)
      .then((res) => {
        if (!cancelled) setQuestion(res.data.question || res.data);
      })
      .catch((err) => {
        if (!cancelled) setError(typeof err === 'string' ? err : 'Failed to load question');
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [classId, questionId]);

  useEffect(() => {
    if (!classId) return undefined;
    const socket = getSocket();
    joinClassRoom(classId);
    const applyEntry = (patch) => {
      setQuestion((prev) => {
        if (!prev || String(prev._id) !== String(questionId)) return prev;
        const classes = (prev.classes || []).map((entry) =>
          String(entry.classId?._id || entry.classId) === String(classId) ? { ...entry, ...patch } : entry,
        );
        return { ...prev, classes };
      });
    };
    const onPublished = ({ questionId: id, isPublished }) => {
      if (String(id) === String(questionId)) applyEntry({ isPublished });
    };
    const onDisabled = ({ questionId: id, isDisabled }) => {
      if (String(id) === String(questionId)) applyEntry({ isDisabled });
    };
    socket.on('questionPublished', onPublished);
    socket.on('questionDisabled', onDisabled);
    return () => {
      socket.off('questionPublished', onPublished);
      socket.off('questionDisabled', onDisabled);
      leaveClassRoom(classId);
    };
  }, [classId, questionId]);

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
        setIsFullscreen((v) => !v);
      }
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [isFullscreen]);

  useEffect(() => {
    if (!question || !RUNNABLE_CODING_TYPES.includes(question.type)) {
      lastCodeInitKeyRef.current = null;
      languageQuestionIdRef.current = null;
      return;
    }
    const langs = availableLanguages(question);
    // A newly loaded question opens in the first language the teacher listed.
    if (languageQuestionIdRef.current !== question._id) {
      languageQuestionIdRef.current = question._id;
      if (langs.length && selectedLanguage !== langs[0]) {
        setSelectedLanguage(langs[0]);
        return;
      }
    }
    if (langs.length && !langs.includes(selectedLanguage)) {
      setSelectedLanguage(langs[0]);
      return;
    }
    const key = `${question._id}:${selectedLanguage}`;
    if (lastCodeInitKeyRef.current === key) return;
    lastCodeInitKeyRef.current = key;
    setCode(getCodeTemplateForLanguage(question, selectedLanguage) || '// Write your code here...');
  }, [question, selectedLanguage]);

  const codingAnswer = () => (question?.type === 'fillInTheBlanksCoding' ? fillInBlankLine : code);

  const recordAndShowResults = (kind, payload) => {
    setTestResults(payload);
    if (kind === 'submit') setSubmissionFeedback(payload);
    if (question?._id) {
      setRunHistory((prev) => {
        const next = [makeRunHistoryEntry(question._id, kind, payload), ...prev].slice(0, 30);
        saveRunHistory('student-submit', classId, next);
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
      const response = await runCode(question._id, answer, classId, selectedLanguage);
      const tr = response.data.testResults || [];
      const sub = response.data.submission || {};
      recordAndShowResults('run', {
        testResults: tr,
        passedTestCases: response.data.passedTestCases ?? sub.passedTestCases ?? tr.filter((t) => t.passed).length,
        totalTestCases: response.data.totalTestCases ?? sub.totalTestCases ?? tr.length,
        isCorrect: response.data.isCorrect ?? (tr.length > 0 && tr.every((t) => t.passed)),
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
      const response = await runCodeWithCustomInput(question._id, answer, classId, selectedLanguage, customInput, customOutput);
      const customRow = response.data.testResult || response.data.testResults;
      recordAndShowResults('custom', {
        customInput: response.data.customInput ?? customInput,
        expectedOutput: response.data.expectedOutput,
        actualOutput: response.data.actualOutput ?? customRow?.output,
        passed: response.data.passed ?? customRow?.passed,
        isCustomTest: true,
      });
    } catch (err) {
      recordAndShowResults('custom', { error: true, message: typeof err === 'string' ? err : 'Failed to run custom input' });
    } finally {
      setRunBusy(null);
    }
  };

  const handleSubmit = async () => {
    if (!question || !classId) return notify('Question is not linked to a class');
    if (lock.locked) return notify('Answers are disabled for this question right now.');
    const qType = question.type;
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
      const response = await submitAnswer(question._id, payload, classId, language);
      const data = response?.data ?? {};
      const sub = data.submission ?? {};
      recordAndShowResults('submit', {
        isCorrect: Boolean(sub.isCorrect ?? data.isCorrect),
        explanation: data.explanation ?? sub.explanation,
        passedTestCases: data.passedTestCases ?? sub.passedTestCases,
        totalTestCases: data.totalTestCases ?? sub.totalTestCases,
        testResults: data.testResults ?? [],
      });
    } catch (err) {
      notify(typeof err === 'string' ? err : err.response?.data?.error || 'Failed to submit');
    } finally {
      setRunBusy(null);
    }
  };

  const backTo = classId ? `/student/classes/${classId}` : '/student';
  const questionRunHistory = runHistory.filter((entry) => entry.questionId === String(question?._id || ''));

  if (loading) {
    return (
      <div className="h-[calc(100vh-4rem)] grid place-items-center bg-page">
        <div className="w-8 h-8 border-2 border-accent border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  if (error || !question) {
    return (
      <div className="px-4 sm:px-5 py-6">
        <EmptyState title="Question unavailable" message={error || 'This question could not be loaded.'} action={<Button variant="secondary" onClick={() => navigate(backTo)}>Back</Button>} />
      </div>
    );
  }

  return (
    <div className="flex flex-col min-h-0 overflow-hidden w-full h-[calc(100vh-4rem)] max-h-[calc(100vh-4rem)] bg-page">
      <header className="shrink-0 h-14 px-4 sm:px-5 border-b border-line bg-surface flex items-center gap-3">
        <Button variant="ghost" icon={ArrowLeft} className="h-9 w-9 justify-center p-0!" onClick={() => navigate(backTo)} aria-label="Back" />
        <h1 className={`${type.pageTitle} text-xl! truncate`}>{stripHtml(question.title) || 'Question'}</h1>
      </header>
      <PracticeWorkspace
        selectedQuestion={question}
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
          if (question.type === 'fillInTheBlanksCoding') setFillInBlankLine('');
          else setCode(getCodeTemplateForLanguage(question, selectedLanguage) || '// Write your code here...');
        }}
        onCopy={() => {
          navigator.clipboard.writeText((question.type === 'fillInTheBlanksCoding' ? fillInBlankLine : code) || '');
          notify('Copied to clipboard');
        }}
        onOpenHistory={() => {
          setResultsView('list');
          setShowResultsModal(true);
        }}
        submissionFeedback={submissionFeedback}
      />
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

export default QuestionSubmission;
