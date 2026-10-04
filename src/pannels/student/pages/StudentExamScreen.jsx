import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { AlertTriangle, CheckCircle2, ClipboardList, Clock, LogOut, Maximize, Send, WifiOff, X } from 'lucide-react';
import {
  autoSubmitExam,
  getExamAttempt,
  getStudentExamSummary,
  logProctoringEvent,
  runExamCode,
  startExam,
  submitExam,
  submitExamAnswer,
  updateQuestionTimer,
  updateSectionTimer,
} from '../../../common/services/api';
import { Button, EmptyState } from '../../../common/ui/primitives';
import { confirmAction } from '../../../common/ui/Toast';
import ExamLobby from '../components/exam/ExamLobby';
import ExamQuestionView from '../components/exam/ExamQuestionView';
import QuestionPalette from '../components/exam/QuestionPalette';
import SubmitExamModal from '../components/exam/SubmitExamModal';
import {
  formatClock,
  hasAnswer,
  initialDraft,
  isClosedAttempt,
  isCoding,
  isDirty,
  payloadAnswer,
  readStored,
  storageKey,
  writeStored,
} from '../components/exam/examUtils';

const AUTOSAVE_MS = 700;
const TIMER_SYNC_TICKS = 15;
const HEARTBEAT_MS = 30000;

const timerMap = (list, key) =>
  Object.fromEntries((list || []).map((t) => [String(t[key]), typeof t.remainingSeconds === 'number' ? t.remainingSeconds : null]));

const savedMap = (answers) =>
  Object.fromEntries(
    (answers || []).map((a) => [
      String(a.questionId),
      { answer: a.answer, language: a.language, savedAt: a.savedAt, passedTestCases: a.passedTestCases, totalTestCases: a.totalTestCases },
    ]),
  );

const CLOSED_COPY = {
  terminated: { title: 'Your exam was locked', message: 'You left the exam window too many times. Your saved answers have been submitted.' },
  auto_submitted: { title: 'Your exam was submitted', message: 'Time ran out, or your instructor closed the exam. Your saved answers have been submitted.' },
  submitted: { title: 'Exam submitted', message: 'Your answers have been submitted.' },
};

const StudentExamScreen = () => {
  const { examId } = useParams();
  const navigate = useNavigate();

  const [view, setView] = useState('loading');
  const [loadError, setLoadError] = useState('');
  const [summary, setSummary] = useState(null);
  const [starting, setStarting] = useState(false);
  const [startError, setStartError] = useState('');
  const [clockOffset, setClockOffset] = useState(0);
  const [nowMs, setNowMs] = useState(() => Date.now());

  const [exam, setExam] = useState(null);
  const [attempt, setAttempt] = useState(null);
  const [questions, setQuestions] = useState([]);
  const [activeId, setActiveId] = useState(null);
  const [drafts, setDrafts] = useState({});
  const [saved, setSaved] = useState({});
  const [saveState, setSaveState] = useState({});
  const [runState, setRunState] = useState({});
  const [flagged, setFlagged] = useState(() => new Set());
  const [timers, setTimers] = useState({ sections: {}, questions: {} });
  const [submitOpen, setSubmitOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [closed, setClosed] = useState(null);
  const [warning, setWarning] = useState(null);
  const [offline, setOffline] = useState(() => !navigator.onLine);
  const [isFullscreen, setIsFullscreen] = useState(() => Boolean(document.fullscreenElement));
  const [paletteOpen, setPaletteOpen] = useState(false);

  const draftsRef = useRef(drafts);
  const timersRef = useRef(timers);
  const activeIdRef = useRef(activeId);
  const attemptRef = useRef(attempt);
  const autosaveRef = useRef({});
  const saveSeqRef = useRef({});
  const tickRef = useRef(0);
  const timeUpRef = useRef(false);
  const leavingRef = useRef(false);
  const lastCopyLogRef = useRef(0);
  draftsRef.current = drafts;
  timersRef.current = timers;
  activeIdRef.current = activeId;
  attemptRef.current = attempt;

  const running = view === 'running' && !closed;
  const proctoring = exam?.proctoring || {};

  // ---------------------------------------------------------------- loading
  const loadSummary = useCallback(async () => {
    try {
      const res = await getStudentExamSummary(examId);
      setSummary(res.data);
      setClockOffset(new Date(res.data.serverTime).getTime() - Date.now());
      setView('lobby');
    } catch (err) {
      setLoadError(typeof err === 'string' ? err : 'Failed to load exam');
      setView('error');
    }
  }, [examId]);

  useEffect(() => {
    loadSummary();
  }, [loadSummary]);

  useEffect(() => {
    const id = setInterval(() => setNowMs(Date.now() + clockOffset), 1000);
    return () => clearInterval(id);
  }, [clockOffset]);

  // ---------------------------------------------------------------- structure
  const questionById = useMemo(() => new Map(questions.map((q) => [String(q._id), q])), [questions]);
  const sections = useMemo(() => {
    const list = [...(exam?.sections || [])].sort((a, b) => (a.order ?? 0) - (b.order ?? 0));
    return list.length ? list : [{ sectionId: 'section-1', title: 'Questions', durationSeconds: 0, allowRevisit: true }];
  }, [exam]);
  const sectionOf = useMemo(() => {
    const ids = new Set(sections.map((s) => s.sectionId));
    return new Map(questions.map((q) => [String(q._id), ids.has(q.sectionId) ? q.sectionId : sections[0].sectionId]));
  }, [questions, sections]);
  const ordered = useMemo(() => {
    const rows = [];
    sections.forEach((section) => {
      questions.forEach((q) => {
        if (sectionOf.get(String(q._id)) === section.sectionId) rows.push({ id: String(q._id), section, number: rows.length + 1, title: q.title });
      });
    });
    return rows;
  }, [sections, questions, sectionOf]);
  const sectionOfRef = useRef(sectionOf);
  sectionOfRef.current = sectionOf;

  const lockReasonFor = useCallback(
    (id) => {
      const sectionId = sectionOf.get(id);
      if (typeof timers.sections[sectionId] === 'number' && timers.sections[sectionId] === 0) return 'Time for this section is over. Your saved answer stands.';
      if (typeof timers.questions[id] === 'number' && timers.questions[id] === 0) return 'Time for this question is over. Your saved answer stands.';
      return null;
    },
    [sectionOf, timers],
  );

  const stateOf = useCallback(
    (id) => {
      const q = questionById.get(id);
      if (!q) return 'empty';
      if (lockReasonFor(id)) return saved[id] ? 'saved' : 'locked';
      if (isDirty(q, drafts[id], saved[id])) return 'dirty';
      return saved[id] ? 'saved' : 'empty';
    },
    [questionById, lockReasonFor, drafts, saved],
  );

  // ---------------------------------------------------------------- closing
  const exitFullscreen = useCallback(() => {
    leavingRef.current = true;
    if (document.fullscreenElement) document.exitFullscreen().catch(() => {});
  }, []);

  const clearStorage = useCallback(() => {
    const id = attemptRef.current?._id;
    if (!id) return;
    localStorage.removeItem(storageKey(id, 'drafts'));
    localStorage.removeItem(storageKey(id, 'flags'));
  }, []);

  const closeOut = useCallback(
    (status) => {
      setClosed(CLOSED_COPY[status] || CLOSED_COPY.auto_submitted);
      setAttempt((prev) => (prev ? { ...prev, status } : prev));
      setSubmitOpen(false);
      clearStorage();
      exitFullscreen();
    },
    [clearStorage, exitFullscreen],
  );

  const checkClosed = useCallback(async () => {
    try {
      const res = await getExamAttempt(examId);
      if (isClosedAttempt(res.data.attempt)) closeOut(res.data.attempt.status);
      else if (res.data.attempt?.endsAt) setAttempt((prev) => (prev ? { ...prev, endsAt: res.data.attempt.endsAt } : prev));
    } catch {
      /* the next heartbeat retries */
    }
  }, [examId, closeOut]);

  // ---------------------------------------------------------------- start
  const requestFullscreen = useCallback(async () => {
    if (document.fullscreenElement || !document.documentElement.requestFullscreen) return;
    try {
      await document.documentElement.requestFullscreen();
    } catch {
      /* the overlay offers another try */
    }
  }, []);

  const handleStart = async () => {
    setStarting(true);
    setStartError('');
    if (summary?.exam?.proctoring?.fullscreenRequired) await requestFullscreen();
    try {
      const res = await startExam(examId);
      const { exam: startedExam, attempt: startedAttempt, questions: list } = res.data;
      setClockOffset(new Date(res.data.serverTime).getTime() - Date.now());
      const savedAnswers = savedMap(startedAttempt.answers);
      const storedDrafts = readStored(storageKey(startedAttempt._id, 'drafts'), {});
      const initial = {};
      list.forEach((q) => {
        const id = String(q._id);
        const stored = storedDrafts[id];
        initial[id] = stored && stored.answer !== undefined ? stored : initialDraft(q, savedAnswers[id]);
      });
      const ids = new Set(list.map((q) => String(q._id)));
      const resumeId = startedAttempt.currentQuestionId && ids.has(String(startedAttempt.currentQuestionId)) ? String(startedAttempt.currentQuestionId) : null;

      setExam(startedExam);
      setAttempt(startedAttempt);
      setQuestions(list);
      setSaved(savedAnswers);
      setDrafts(initial);
      setFlagged(new Set(readStored(storageKey(startedAttempt._id, 'flags'), [])));
      setTimers({ sections: timerMap(startedAttempt.sectionTimers, 'sectionId'), questions: timerMap(startedAttempt.questionTimers, 'questionId') });
      setActiveId(resumeId || (list[0] ? String(list[0]._id) : null));
      leavingRef.current = false;
      timeUpRef.current = false;
      setView('running');
    } catch (err) {
      setStartError(typeof err === 'string' ? err : 'Failed to start exam');
      if (document.fullscreenElement) document.exitFullscreen().catch(() => {});
      loadSummary();
    } finally {
      setStarting(false);
    }
  };

  // ---------------------------------------------------------------- saving
  const saveAnswer = useCallback(
    async (id) => {
      const q = questionById.get(id);
      const draft = draftsRef.current[id];
      const att = attemptRef.current;
      if (!q || !draft || !att || !hasAnswer(q, draft)) return false;
      const seq = (saveSeqRef.current[id] || 0) + 1;
      saveSeqRef.current[id] = seq;
      const coding = isCoding(q);
      setSaveState((s) => ({ ...s, [id]: { ...s[id], saving: true, error: null } }));
      try {
        const res = await submitExamAnswer(examId, {
          attemptId: att._id,
          questionId: id,
          answer: payloadAnswer(q, draft),
          language: coding ? draft.language : undefined,
        });
        if (saveSeqRef.current[id] !== seq) return true;
        const d = res.data;
        setSaved((s) => ({
          ...s,
          [id]: { answer: payloadAnswer(q, draft), language: draft.language, savedAt: d.savedAt, passedTestCases: d.passedTestCases, totalTestCases: d.totalTestCases },
        }));
        setSaveState((s) => ({
          ...s,
          [id]: {
            saving: false,
            savedAt: d.savedAt,
            result: coding
              ? { passedTestCases: d.passedTestCases, totalTestCases: d.totalTestCases, testResults: d.testResults, executionError: d.executionError }
              : null,
          },
        }));
        if (coding) setRunState((s) => ({ ...s, [id]: { running: false, result: null } }));
        return true;
    } catch (err) {
        if (saveSeqRef.current[id] === seq) {
          setSaveState((s) => ({ ...s, [id]: { ...s[id], saving: false, error: typeof err === 'string' ? err : 'Could not save' } }));
        }
        checkClosed();
        return false;
      }
    },
    [examId, questionById, checkClosed],
  );

  const changeDraft = (id, next) => {
    setDrafts((prev) => ({ ...prev, [id]: next }));
    const q = questionById.get(id);
    if (q && !isCoding(q)) {
      clearTimeout(autosaveRef.current[id]);
      autosaveRef.current[id] = setTimeout(() => saveAnswer(id), AUTOSAVE_MS);
    }
  };

  useEffect(() => {
    const id = attempt?._id;
    if (!id || closed) return undefined;
    const t = setTimeout(() => writeStored(storageKey(id, 'drafts'), drafts), 400);
    return () => clearTimeout(t);
  }, [drafts, attempt?._id, closed]);

  useEffect(() => {
    if (attempt?._id && !closed) writeStored(storageKey(attempt._id, 'flags'), [...flagged]);
  }, [flagged, attempt?._id, closed]);

  useEffect(() => {
    const pending = autosaveRef.current;
    return () => Object.values(pending).forEach(clearTimeout);
  }, []);

  const saveAllDirty = useCallback(async () => {
    const ids = ordered.map((r) => r.id).filter((id) => {
      const q = questionById.get(id);
      return q && !lockReasonFor(id) && isDirty(q, draftsRef.current[id], saved[id]);
    });
    await Promise.allSettled(ids.map((id) => saveAnswer(id)));
  }, [ordered, questionById, lockReasonFor, saved, saveAnswer]);

  // ---------------------------------------------------------------- running code
  const runCode = async (id, { customInput, expectedOutput } = {}) => {
    const q = questionById.get(id);
    const draft = draftsRef.current[id];
    if (!q || !draft) return;
    const custom = Boolean(customInput && customInput.trim());
    setRunState((s) => ({ ...s, [id]: { running: true, result: s[id]?.result } }));
    try {
      const res = await runExamCode(examId, {
        attemptId: attempt._id,
        questionId: id,
        answer: draft.answer,
        language: draft.language,
        customInput: custom ? customInput : undefined,
        expectedOutput: custom ? expectedOutput : undefined,
      });
      setRunState((s) => ({ ...s, [id]: { running: false, result: { custom: res.data.custom, testResults: res.data.testResults } } }));
    } catch (err) {
      setRunState((s) => ({ ...s, [id]: { running: false, result: { custom, error: typeof err === 'string' ? err : 'Run failed' } } }));
      checkClosed();
    }
  };

  // ---------------------------------------------------------------- timers
  const syncTimers = useCallback(() => {
    const att = attemptRef.current;
    const id = activeIdRef.current;
    if (!att || !id) return;
    const sectionId = sectionOfRef.current.get(id);
    const t = timersRef.current;
    updateSectionTimer(examId, {
      attemptId: att._id,
      sectionId,
      remainingSeconds: t.sections[sectionId] ?? undefined,
      currentQuestionId: id,
    }).catch(() => {});
    if (typeof t.questions[id] === 'number') {
      updateQuestionTimer(examId, { attemptId: att._id, questionId: id, remainingSeconds: t.questions[id] }).catch(() => {});
    }
  }, [examId]);

  useEffect(() => {
    if (!running) return undefined;
    const tick = setInterval(() => {
      const id = activeIdRef.current;
      if (!id) return;
      const sectionId = sectionOfRef.current.get(id);
      const t = timersRef.current;
      let hitZero = false;
      const next = { sections: { ...t.sections }, questions: { ...t.questions } };
      if (typeof next.sections[sectionId] === 'number' && next.sections[sectionId] > 0) {
        next.sections[sectionId] -= 1;
        hitZero = hitZero || next.sections[sectionId] === 0;
      }
      if (typeof next.questions[id] === 'number' && next.questions[id] > 0) {
        next.questions[id] -= 1;
        hitZero = hitZero || next.questions[id] === 0;
      }
      timersRef.current = next;
      setTimers(next);
      tickRef.current += 1;
      if (hitZero || tickRef.current % TIMER_SYNC_TICKS === 0) syncTimers();
    }, 1000);
    return () => clearInterval(tick);
  }, [running, syncTimers]);

  const remainingSeconds = attempt?.endsAt ? Math.max(0, Math.floor((new Date(attempt.endsAt).getTime() - nowMs) / 1000)) : null;

  useEffect(() => {
    if (!running || remainingSeconds === null || remainingSeconds > 0 || timeUpRef.current) return;
    timeUpRef.current = true;
    (async () => {
      await saveAllDirty();
      try {
        const res = await autoSubmitExam(examId, attemptRef.current._id);
        closeOut(res.data.attempt?.status || 'auto_submitted');
      } catch {
        checkClosed();
        timeUpRef.current = false;
      }
    })();
  }, [running, remainingSeconds, saveAllDirty, examId, closeOut, checkClosed]);

  // ---------------------------------------------------------------- proctoring
  const logEvent = useCallback(
    async (eventType, details) => {
      const att = attemptRef.current;
      if (!att) return null;
      try {
        const res = await logProctoringEvent(examId, att._id, eventType, details);
        const d = res.data;
        if (d.status && isClosedAttempt(d)) closeOut(d.status);
        else if (d.endsAt) setAttempt((prev) => (prev && prev.endsAt !== d.endsAt ? { ...prev, endsAt: d.endsAt } : prev));
        return d;
      } catch {
        return null;
      }
    },
    [examId, closeOut],
  );

  useEffect(() => {
    if (!running) return undefined;
    const onVisibility = async () => {
      if (!document.hidden) return;
      const d = await logEvent('tab_switch');
      if (d && !d.terminate) {
        const limit = d.tabSwitchLimit > 0 ? ` (${d.tabSwitchCount} of ${d.tabSwitchLimit})` : '';
        setWarning({
          title: 'You left the exam window',
          message: `This has been recorded${limit}.${d.tabSwitchLimit > 0 ? ' Reaching the limit locks and submits your exam.' : ''}`,
        });
      }
    };
    const onFullscreen = () => {
      const active = Boolean(document.fullscreenElement);
      setIsFullscreen(active);
      if (!active && proctoring.fullscreenRequired && !leavingRef.current) logEvent('fullscreen_exit');
    };
    const onClipboard = (e) => {
      if (!proctoring.copyPasteDisabled) return;
      e.preventDefault();
      if (Date.now() - lastCopyLogRef.current > 5000) {
        lastCopyLogRef.current = Date.now();
        logEvent('copy_paste', { action: e.type });
      }
    };
    const onContextMenu = (e) => proctoring.copyPasteDisabled && e.preventDefault();
    const onOnline = () => {
      setOffline(false);
      logEvent('network_loss');
    };
    const onOffline = () => setOffline(true);
    const onBeforeUnload = (e) => {
      e.preventDefault();
      e.returnValue = '';
    };
    const heartbeat = setInterval(() => logEvent('heartbeat'), HEARTBEAT_MS);

    document.addEventListener('visibilitychange', onVisibility);
    document.addEventListener('fullscreenchange', onFullscreen);
    ['copy', 'cut', 'paste'].forEach((t) => document.addEventListener(t, onClipboard, true));
    document.addEventListener('contextmenu', onContextMenu);
    window.addEventListener('online', onOnline);
    window.addEventListener('offline', onOffline);
    window.addEventListener('beforeunload', onBeforeUnload);
    return () => {
      clearInterval(heartbeat);
      document.removeEventListener('visibilitychange', onVisibility);
      document.removeEventListener('fullscreenchange', onFullscreen);
      ['copy', 'cut', 'paste'].forEach((t) => document.removeEventListener(t, onClipboard, true));
      document.removeEventListener('contextmenu', onContextMenu);
      window.removeEventListener('online', onOnline);
      window.removeEventListener('offline', onOffline);
      window.removeEventListener('beforeunload', onBeforeUnload);
    };
  }, [running, logEvent, proctoring.fullscreenRequired, proctoring.copyPasteDisabled]);

  useEffect(() => () => {
    if (document.fullscreenElement) document.exitFullscreen().catch(() => {});
  }, []);

  // ---------------------------------------------------------------- navigation
  const goTo = (id) => {
    if (!id || id === activeId) return;
    syncTimers();
    setActiveId(id);
    setPaletteOpen(false);
  };
  const activeIndex = ordered.findIndex((r) => r.id === activeId);
  const toggleFlag = () =>
    setFlagged((prev) => {
      const next = new Set(prev);
      if (next.has(activeId)) next.delete(activeId);
      else next.add(activeId);
      return next;
    });

  const handleSubmit = async () => {
    setSubmitting(true);
    await saveAllDirty();
    try {
      await submitExam(examId, attempt._id);
      clearStorage();
      exitFullscreen();
      navigate(`/student/exams/${examId}/results`, { replace: true });
    } catch (err) {
      setWarning({ title: 'Could not submit', message: typeof err === 'string' ? err : 'Please try again.' });
      checkClosed();
    } finally {
      setSubmitting(false);
    }
  };

  const handleLeave = async () => {
    const ok = await confirmAction('Your timer keeps running while you are away. You can come back and resume until it runs out.', {
      title: 'Leave the exam?',
      confirmLabel: 'Leave',
    });
    if (!ok) return;
    syncTimers();
    exitFullscreen();
    navigate('/student/exams');
  };

  // ---------------------------------------------------------------- render
  if (view === 'loading') {
    return (
      <div className="h-full flex items-center justify-center">
        <div className="w-8 h-8 border-4 border-accent border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  if (view === 'error') {
    return (
      <div className="h-full flex items-center justify-center p-6">
        <EmptyState
          icon={ClipboardList}
          title="Exam unavailable"
          message={loadError}
          action={<Button variant="secondary" onClick={() => navigate('/student/exams')}>Back to exams</Button>}
        />
      </div>
    );
  }

  if (view === 'lobby') {
      return (
      <div className="h-full overflow-y-auto">
        <ExamLobby
          exam={summary.exam}
          attempt={summary.attempt}
          nowMs={nowMs}
          starting={starting}
          error={startError}
          onStart={handleStart}
          onBack={() => navigate('/student/exams')}
          onResults={() => navigate(`/student/exams/${examId}/results`)}
        />
        </div>
      );
    }

  if (closed) {
      return (
      <div className="h-full flex items-center justify-center p-6">
        <div className="max-w-md w-full bg-surface border border-line rounded-2xl p-6 text-center space-y-3">
          <CheckCircle2 className="w-10 h-10 text-ok mx-auto" />
          <h1 className="text-lg font-bold text-fg">{closed.title}</h1>
          <p className="text-sm text-muted">{closed.message}</p>
          <div className="flex justify-center gap-2 pt-2">
            <Button variant="secondary" onClick={() => navigate('/student/exams')}>
              Back to exams
            </Button>
            <Button onClick={() => navigate(`/student/exams/${examId}/results`, { replace: true })}>View submission</Button>
          </div>
        </div>
      </div>
    );
  }

  const activeQuestion = questionById.get(activeId);
  const activeSection = sections.find((s) => s.sectionId === sectionOf.get(activeId));
  const savedCount = ordered.filter((r) => saved[r.id]).length;
  const groups = sections
    .map((section) => ({
      section,
      remaining: section.durationSeconds ? timers.sections[section.sectionId] ?? null : null,
      items: ordered.filter((r) => r.section.sectionId === section.sectionId),
    }))
    .filter((g) => g.items.length);
  const lockReason = activeId ? lockReasonFor(activeId) : null;
  const timerTone = remainingSeconds !== null && remainingSeconds < 60 ? 'bg-bad-soft text-bad border-bad-line' : remainingSeconds < 300 ? 'bg-warn-soft text-warn border-warn-line' : 'bg-inset text-fg border-line';
  const palette = (
    <QuestionPalette groups={groups} activeId={activeId} stateOf={stateOf} flagged={flagged} onSelect={goTo} />
  );

  return (
    <div className="h-full flex flex-col bg-page">
      <header className="shrink-0 h-14 flex items-center gap-3 px-4 border-b border-line bg-surface">
        <div className="min-w-0 flex-1">
          <p className="text-sm font-bold text-fg truncate">{exam.title}</p>
          <p className="text-[11px] text-muted truncate">
            {exam.className}
            {activeSection && sections.length > 1 ? ` · ${activeSection.title}` : ''}
          </p>
        </div>
        <span className="hidden sm:inline text-xs text-muted tabular-nums">
          {savedCount}/{ordered.length} saved
        </span>
        <span className={`flex items-center gap-1.5 h-8 px-3 rounded-lg border text-sm font-bold tabular-nums ${timerTone}`} aria-live="polite">
          <Clock className="w-4 h-4" />
          {formatClock(remainingSeconds)}
        </span>
        <Button variant="secondary" className="md:hidden h-8" icon={ClipboardList} onClick={() => setPaletteOpen(true)}>
          {activeIndex + 1}/{ordered.length}
        </Button>
        <Button variant="ghost" icon={LogOut} onClick={handleLeave} className="hidden sm:flex">
          Leave
        </Button>
        <Button icon={Send} onClick={() => setSubmitOpen(true)}>
          Submit
        </Button>
      </header>

      {offline && (
        <div className="shrink-0 flex items-center gap-2 px-4 py-2 border-b border-warn-line bg-warn-soft text-xs text-warn">
          <WifiOff className="w-3.5 h-3.5" />
          You are offline. Keep working; answers save once you reconnect.
        </div>
      )}

      <div className="flex-1 min-h-0 flex">
        <aside className="hidden md:block w-60 shrink-0 overflow-y-auto border-r border-line bg-surface p-4">{palette}</aside>
        <main className="flex-1 min-w-0 relative">
          {activeQuestion ? (
            <ExamQuestionView
              question={activeQuestion}
              number={activeIndex + 1}
              total={ordered.length}
              sectionTitle={sections.length > 1 ? activeSection?.title : null}
              remaining={typeof timers.questions[activeId] === 'number' ? timers.questions[activeId] : null}
              draft={drafts[activeId]}
              dirty={isDirty(activeQuestion, drafts[activeId], saved[activeId])}
              save={saveState[activeId]}
              locked={Boolean(lockReason)}
              lockReason={lockReason}
              flagged={flagged.has(activeId)}
              onToggleFlag={toggleFlag}
              onChange={(next) => changeDraft(activeId, next)}
              onSave={() => saveAnswer(activeId)}
              onRun={(opts) => runCode(activeId, opts)}
              running={Boolean(runState[activeId]?.running)}
              runResult={runState[activeId]?.result}
              allowRun={proctoring.allowRunCode !== false}
              copyPasteDisabled={Boolean(proctoring.copyPasteDisabled)}
              onPrev={() => goTo(ordered[activeIndex - 1]?.id)}
              onNext={() => goTo(ordered[activeIndex + 1]?.id)}
              hasPrev={activeIndex > 0}
              hasNext={activeIndex < ordered.length - 1}
            />
          ) : (
            <EmptyState icon={ClipboardList} title="No questions" message="This exam has no questions." className="m-6" />
          )}

          {proctoring.fullscreenRequired && !isFullscreen && (
            <div className="absolute inset-0 z-20 flex items-center justify-center bg-page/95 p-6">
              <div className="max-w-sm text-center space-y-3">
                <Maximize className="w-8 h-8 text-accent-ink mx-auto" />
                <p className="text-sm font-bold text-fg">This exam runs in fullscreen</p>
                <p className="text-xs text-muted">Leaving fullscreen is recorded. Return to fullscreen to keep working.</p>
                <Button icon={Maximize} onClick={requestFullscreen}>
                  Enter fullscreen
                </Button>
          </div>
        </div>
          )}
        </main>
                  </div>

      {paletteOpen && (
        <div className="md:hidden fixed inset-0 z-40 flex">
          <button type="button" className="flex-1 bg-black/50" aria-label="Close questions" onClick={() => setPaletteOpen(false)} />
          <div className="w-72 max-w-[85vw] h-full overflow-y-auto bg-surface border-l border-line p-4 space-y-3">
            <div className="flex items-center justify-between">
              <p className="text-sm font-bold text-fg">Questions</p>
              <button type="button" className="p-1.5 rounded-lg text-muted hover:text-fg" onClick={() => setPaletteOpen(false)} aria-label="Close">
                <X className="w-4 h-4" />
                    </button>
                  </div>
            {palette}
                </div>
          </div>
        )}

      {warning && (
        <div className="fixed bottom-4 left-1/2 -translate-x-1/2 z-50 w-[min(28rem,calc(100vw-2rem))] flex items-start gap-3 rounded-2xl border border-warn-line bg-surface shadow-2xl p-4">
          <AlertTriangle className="w-5 h-5 text-warn shrink-0 mt-0.5" />
          <div className="flex-1 min-w-0">
            <p className="text-sm font-bold text-fg">{warning.title}</p>
            <p className="text-xs text-muted mt-0.5">{warning.message}</p>
        </div>
          <button type="button" onClick={() => setWarning(null)} className="p-1 rounded-lg text-muted hover:text-fg" aria-label="Dismiss">
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      <SubmitExamModal
        open={submitOpen}
        onClose={() => setSubmitOpen(false)}
        onConfirm={handleSubmit}
        submitting={submitting}
        remainingSeconds={remainingSeconds}
        items={ordered.map((r) => ({ id: r.id, number: r.number, state: stateOf(r.id), flagged: flagged.has(r.id) }))}
      />
    </div>
  );
};

export default StudentExamScreen;
