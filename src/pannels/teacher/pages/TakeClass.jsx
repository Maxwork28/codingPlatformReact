import React, { useEffect, useRef, useState } from 'react';
import { useSelector } from 'react-redux';
import { useLocation, useNavigate } from 'react-router-dom';
import { GraduationCap, List } from 'lucide-react';
import {
  disableQuestion,
  enableQuestion,
  getQuestion,
  getQuestionsByClass,
  publishQuestion,
  teacherTestQuestion,
  unpublishQuestion,
  viewSolution,
} from '../../../common/services/api';
import { getSocket, joinClassRoom, leaveClassRoom } from '../../../common/services/socket';
import { loadRunHistory, makeRunHistoryEntry, saveRunHistory } from '../../../common/utils/runOutputHistory';
import { confirmAction, notify } from '../../../common/ui/Toast';
import { Button, EmptyState, StatusChip } from '../../../common/ui/primitives';
import { type } from '../../../common/ui/format';
import ClassPicker from '../../admin/components/ClassPicker';
import ClassroomWorkspace from './takeClass/ClassroomWorkspace';
import QuestionRail from './takeClass/QuestionRail';
import ResultsModal from './takeClass/ResultsModal';
import {
  FULL_CODE_EDITOR_TYPES,
  RUNNABLE_CODING_TYPES,
  classEntryFor,
  describeOfficialAnswer,
  getCodeTemplateForLanguage,
  isTeacherClass,
  pickSolutionForQuestion,
} from './takeClass/helpers';

const TakeClass = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const { user } = useSelector((state) => state.auth);
  const { classes } = useSelector((state) => state.classes);

  const [selectedClass, setSelectedClass] = useState(null);
  const [selectedQuestion, setSelectedQuestion] = useState(null);
  const [questions, setQuestions] = useState([]);
  const [code, setCode] = useState('');
  const [fillInBlankLine, setFillInBlankLine] = useState('');
  const [selectedLanguage, setSelectedLanguage] = useState('javascript');
  const [questionsLoading, setQuestionsLoading] = useState(false);
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
  const [presentedReveal, setPresentedReveal] = useState(null);
  const skipEditorResetRef = useRef(false);
  const selectedQuestionId = selectedQuestion?._id;

  const myClasses = classes.filter((cls) => isTeacherClass(cls, user?.id || user?._id));

  useEffect(() => {
    setRunHistory(loadRunHistory('teacher', selectedClass?._id));
  }, [selectedClass?._id]);

  useEffect(() => {
    const handleMouseMove = (e) => {
      if (!isDragging) return;
      const container = document.getElementById('teacher-workspace');
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
      const split = document.getElementById('teacher-code-split');
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
    const state = location.state;
    if (!state?.classId || !myClasses.length || selectedClass) return;
    const found = myClasses.find((cls) => String(cls._id) === String(state.classId));
    if (found) setSelectedClass(found);
  }, [location.state, myClasses, selectedClass]);

  useEffect(() => {
    if (!selectedClass) return undefined;
    let cancelled = false;
    const load = async () => {
      try {
        setQuestionsLoading(true);
        const response = await getQuestionsByClass(selectedClass._id);
        const fetched = response.data.questions || [];
        if (cancelled) return;
        setQuestions(fetched);
        const restoreId = location.state?.questionId;
        const pick =
          (restoreId && fetched.find((q) => String(q._id) === String(restoreId))) || fetched[0] || null;
        setSelectedQuestion(pick);
        setSelectedLanguage(pick?.languages?.[0] || 'javascript');
      } catch (err) {
        if (!cancelled) notify(typeof err === 'string' ? err : 'Failed to load class questions');
      } finally {
        if (!cancelled) setQuestionsLoading(false);
      }
    };
    load();
    return () => {
      cancelled = true;
    };
  }, [selectedClass, location.state?.questionId]);

  useEffect(() => {
    if (!selectedClass?._id) return undefined;
    const classId = selectedClass._id;
    const socket = getSocket();
    joinClassRoom(classId);
    const refetch = async () => {
      try {
        const response = await getQuestionsByClass(classId);
        const updated = response.data.questions || [];
        setQuestions(updated);
        setSelectedQuestion((sel) => {
          if (!sel) return updated[0] || null;
          return updated.find((q) => q._id === sel._id) || updated[0] || null;
        });
      } catch {
        /* keep current list */
      }
    };
    socket.on('questionPublished', refetch);
    socket.on('questionDisabled', refetch);
    socket.on('questionAssigned', refetch);
    return () => {
      socket.off('questionPublished', refetch);
      socket.off('questionDisabled', refetch);
      socket.off('questionAssigned', refetch);
      leaveClassRoom(classId);
    };
  }, [selectedClass?._id]);

  useEffect(() => {
    if (!selectedQuestion) return;
    if (skipEditorResetRef.current) {
      skipEditorResetRef.current = false;
      return;
    }
    if (FULL_CODE_EDITOR_TYPES.includes(selectedQuestion.type)) {
      setCode(getCodeTemplateForLanguage(selectedQuestion, selectedLanguage));
    } else if (selectedQuestion.type === 'fillInTheBlanksCoding') {
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

  const applyQuestionList = (updated, questionId) => {
    setQuestions(updated);
    if (selectedQuestion?._id === questionId) {
      setSelectedQuestion(updated.find((q) => q._id === questionId) || selectedQuestion);
    }
  };

  const refreshQuestions = async () => {
    const response = await getQuestionsByClass(selectedClass._id);
    return response.data.questions || [];
  };

  const selectQuestion = (question) => {
    setSelectedQuestion(question);
    setSelectedLanguage(question.languages?.[0] || 'javascript');
    setShowQuestionsList(false);
  };

  const getTeacherTestAnswer = () => {
    if (!selectedQuestion) return '';
    return selectedQuestion.type === 'fillInTheBlanksCoding' ? fillInBlankLine : code;
  };

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
    setResultsModalKind(kind === 'submit' ? 'submit' : 'run');
    setShowResultsModal(true);
  };

  const questionRunHistory = runHistory.filter((entry) => entry.questionId === String(selectedQuestion?._id || ''));

  const runTeacherTest = async (kind, publicOnly) => {
    if (!selectedQuestion) {
      notify('Select a question first');
      return;
    }
    if (!RUNNABLE_CODING_TYPES.includes(selectedQuestion.type)) {
      notify('Run is only available for coding questions.');
      return;
    }
    const answer = getTeacherTestAnswer();
    if (!answer?.trim()) {
      notify(selectedQuestion.type === 'fillInTheBlanksCoding' ? 'Enter the line of code for the blank' : 'Write some code first');
      return;
    }
    try {
      setRunBusy(kind);
      setTestResults(null);
      const response = await teacherTestQuestion(
        selectedQuestion._id,
        answer,
        selectedClass._id,
        selectedLanguage,
        { publicOnly }
      );
      recordAndShowResults(kind, {
        message: response.data.message,
        testResults: response.data.testResults,
        passedTestCases: response.data.passedTestCases,
        totalTestCases: response.data.totalTestCases,
        publicTestCases: response.data.publicTestCases,
        hiddenTestCases: response.data.hiddenTestCases,
        isCorrect: response.data.isCorrect,
      });
    } catch (err) {
      recordAndShowResults(kind, {
        error: true,
        message: typeof err === 'string' ? err : `Failed to ${kind} code.`,
      });
    } finally {
      setRunBusy(null);
    }
  };

  const handlePresentSolution = async () => {
    if (!selectedQuestion) {
      notify('Select a question first');
      return;
    }
    try {
      setRunBusy('present');
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
          notify('No solution saved for this question.');
          return;
        }
        skipEditorResetRef.current = true;
        setSelectedQuestion(source);
        setFillInBlankLine(blankSolution);
        setPresentedReveal(official);
        notify('Solution loaded.');
        return;
      }
      if (FULL_CODE_EDITOR_TYPES.includes(source.type)) {
        const picked = pickSolutionForQuestion(source, selectedLanguage);
        if (!picked.code?.trim()) {
          setPresentedReveal(null);
          notify('No solution code saved. Add one under Edit → Test Solution.');
          return;
        }
        skipEditorResetRef.current = true;
        setSelectedQuestion(source);
        if (picked.language && String(picked.language).toLowerCase() !== String(selectedLanguage).toLowerCase()) {
          setSelectedLanguage(picked.language);
        }
        setCode(picked.code);
        setPresentedReveal(null);
        notify('Solution loaded in the editor.');
        return;
      }
      if (official?.text) {
        setSelectedQuestion(source);
        setPresentedReveal(official);
        notify(official.text);
        return;
      }
      setPresentedReveal(null);
      notify('No solution saved for this question.');
    } catch (err) {
      notify(typeof err === 'string' ? err : 'Failed to load solution.');
    } finally {
      setRunBusy(null);
    }
  };

  const takeClassState = selectedClass?._id
    ? { classId: selectedClass._id, fromTakeClass: true, questionId: selectedQuestion?._id }
    : undefined;

  const handleViewQuestionStatistics = (questionId) => {
    const qId = questionId || selectedQuestion?._id;
    if (!selectedClass?._id || !qId) {
      notify('Select a class and question first');
      return;
    }
    navigate(`/teacher/take-class/${selectedClass._id}/questions/${qId}/statistics`, {
      state: { fromTakeClass: true },
    });
  };

  const handlePublish = async (questionId) => {
    const question = questions.find((q) => q._id === questionId);
    if (!question) {
      notify('Question not found');
      return;
    }
    const published = Boolean(classEntryFor(question, selectedClass._id)?.isPublished);
    try {
      if (published) await unpublishQuestion(questionId, selectedClass._id);
      else await publishQuestion(questionId, selectedClass._id);
      applyQuestionList(await refreshQuestions(), questionId);
      notify(published ? 'Question unpublished' : 'Question published');
    } catch (err) {
      notify(typeof err === 'string' ? err : 'Failed to update publish status');
    }
  };

  const handleDisable = async (questionId) => {
    const question = questions.find((q) => q._id === questionId);
    if (!question) {
      notify('Question not found');
      return;
    }
    const disabled = Boolean(classEntryFor(question, selectedClass._id)?.isDisabled);
    const ok = await confirmAction(
      disabled
        ? 'Enable this question for the class?'
        : 'Disable this question? Students will not be able to work on it.'
    );
    if (!ok) return;
    try {
      if (disabled) await enableQuestion(questionId, selectedClass._id);
      else await disableQuestion(questionId, selectedClass._id);
      applyQuestionList(await refreshQuestions(), questionId);
      notify(disabled ? 'Question enabled' : 'Question disabled');
    } catch (err) {
      notify(typeof err === 'string' ? err : 'Failed to update question status');
    }
  };

  const publishedCount = questions.filter((q) => classEntryFor(q, selectedClass?._id)?.isPublished).length;

  return (
    <div className="flex flex-col min-h-0 overflow-hidden w-full h-[calc(100vh-4rem)] max-h-[calc(100vh-4rem)] bg-page">
      <header className="shrink-0 h-14 px-4 sm:px-5 border-b border-line bg-surface flex items-center gap-3">
        <h1 className={`${type.pageTitle} text-xl! shrink-0`}>Take Class</h1>
        <div className="w-64 sm:w-80 min-w-0">
          <ClassPicker
            value={selectedClass}
            onChange={(cls) => {
              if (cls && !isTeacherClass(cls, user?.id || user?._id)) {
                notify('You can only take classes you teach');
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
            <StatusChip kind="neutral">{questions.length} questions</StatusChip>
            <StatusChip kind={publishedCount ? 'ok' : 'neutral'}>{publishedCount} live</StatusChip>
            <Button
              variant="secondary"
              icon={List}
              className="lg:hidden ml-auto h-9"
              onClick={() => setShowQuestionsList(true)}
            >
              Questions
            </Button>
          </>
        )}
      </header>

      {!selectedClass ? (
        <div className="flex-1 min-h-0 flex items-center justify-center p-6">
          <EmptyState
            icon={GraduationCap}
            title={myClasses.length ? 'Select a class' : 'No classes assigned'}
            message={
              myClasses.length
                ? 'Choose a class above to present questions, run code, and watch live progress.'
                : 'You have not been assigned to any classes yet.'
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
            onSelect={selectQuestion}
            onStats={handleViewQuestionStatistics}
            onSolution={(id) => navigate(`/teacher/questions/${id}/solution`, { state: takeClassState })}
            onTestCases={(id) => navigate(`/teacher/questions/${id}/test-cases`, { state: takeClassState })}
            onPublish={handlePublish}
            onDisable={handleDisable}
          />
          <ClassroomWorkspace
            selectedClass={selectedClass}
            selectedQuestion={selectedQuestion}
            selectedLanguage={selectedLanguage}
            onLanguageChange={setSelectedLanguage}
            code={code}
            onCodeChange={setCode}
            fillInBlankLine={fillInBlankLine}
            onFillChange={setFillInBlankLine}
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
            runBusy={runBusy}
            presentedReveal={presentedReveal}
            questionRunHistory={questionRunHistory}
            onRun={() => runTeacherTest('run', true)}
            onSubmit={() => runTeacherTest('submit', false)}
            onPresent={handlePresentSolution}
            onReset={() => {
              if (!selectedQuestion) return;
              if (FULL_CODE_EDITOR_TYPES.includes(selectedQuestion.type)) {
                setCode(getCodeTemplateForLanguage(selectedQuestion, selectedLanguage));
              } else if (selectedQuestion.type === 'fillInTheBlanksCoding') {
                setFillInBlankLine('');
              }
            }}
            onCopy={() => {
              const text = selectedQuestion?.type === 'fillInTheBlanksCoding' ? fillInBlankLine : code;
              navigator.clipboard.writeText(text || '');
              notify(selectedQuestion?.type === 'fillInTheBlanksCoding' ? 'Blank line copied' : 'Code copied');
            }}
            onOpenHistory={() => {
              if (!questionRunHistory.length) return;
              setResultsView('list');
              setShowResultsModal(true);
            }}
          />
        </div>
      )}

      <ResultsModal
        open={showResultsModal && (resultsView === 'list' || Boolean(testResults))}
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

export default TakeClass;
