import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { AlertTriangle, CheckCircle2, ClipboardList, Clock, ExternalLink, LogOut, Maximize, Send, ShieldAlert, WifiOff, X } from 'lucide-react';
import {
  autoSubmitExam,
  getExamAttempt,
  getStudentExamSummary,
  logProctoringEvent,
  navigateExam,
  runExamCode,
  startExam,
  submitExam,
  submitExamAnswer,
} from '../../../common/services/api';
import { Button, EmptyState } from '../../../common/ui/primitives';
import { confirmAction } from '../../../common/ui/Toast';
import { stripHtml } from '../../../common/utils/sanitizeHtml';
import { SEB_REQUIRED_EVENT, isSafeExamBrowser } from '../../../common/utils/seb';
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
import { expireTimers, nextDeadline, timerMap, useRemainingSeconds } from '../components/exam/useCountdown';

const AUTOSAVE_MS = 700;
const HEARTBEAT_MS = 30000;
/** How long after a window blur we wait before deciding the tab did not simply go hidden. */
const BLUR_SETTLE_MS = 400;
/** After a timer runs out locally, ask the server to confirm this long afterwards. */
const EXPIRY_RESYNC_MS = 800;
/** Re-anchor the clock offset only when it drifted more than this (avoids latency jitter). */
const OFFSET_TOLERANCE_MS = 1000;

const timersFrom = (data) => ({
  sections: timerMap(data?.sectionTimers, 'sectionId'),
  questions: timerMap(data?.questionTimers, 'questionId'),
});

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

/**
 * The header countdown. Owns the 1 Hz tick so the rest of the exam screen (editor, palette)
 * is not re-rendered every second. Calls `onTimeUp` once when the attempt reaches zero.
 */
function ExamClock({ endsAt, clockOffset, onTimeUp }) {
  const remaining = useRemainingSeconds(endsAt, clockOffset);
  const onTimeUpRef = useRef(onTimeUp);
  onTimeUpRef.current = onTimeUp;
  const timeUp = remaining === 0;
  useEffect(() => {
    if (timeUp) onTimeUpRef.current?.();
  }, [timeUp, endsAt]);

  const tone =
    remaining !== null && remaining < 60
      ? 'bg-bad-soft text-bad border-bad-line'
      : remaining !== null && remaining < 300
        ? 'bg-warn-soft text-warn border-warn-line'
        : 'bg-inset text-fg border-line';
  return (
    <span className={`flex items-center gap-1.5 h-8 px-3 rounded-lg border text-sm font-bold tabular-nums ${tone}`} aria-live="polite">
      <Clock className="w-4 h-4" />
      {formatClock(remaining)}
    </span>
  );
}

/** Submit dialog wrapper that only ticks while it is open. */
function SubmitDialog({ open, endsAt, clockOffset, ...rest }) {
  const remaining = useRemainingSeconds(endsAt, clockOffset, open);
  return <SubmitExamModal open={open} remainingSeconds={remaining} {...rest} />;
}

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
  // Navigation is serialised: one /navigate request in flight, then the latest target (if it changed).
  const navTargetRef = useRef(null);
  const navBusyRef = useRef(false);
  const navPromiseRef = useRef(Promise.resolve());
  const navEpochRef = useRef(0);
  const requestNavigateRef = useRef(null);
  const resyncTimeoutRef = useRef(null);
  const timeUpRef = useRef(false);
  const leavingRef = useRef(false);
  const lastCopyLogRef = useRef(0);
  draftsRef.current = drafts;
  timersRef.current = timers;
  activeIdRef.current = activeId;
  attemptRef.current = attempt;

  const running = view === 'running' && !closed;
  // Safe Exam Browser is already a locked-down fullscreen kiosk (and its macOS web view may not support
  // the Fullscreen API), so the fullscreen rule is satisfied by SEB itself.
  const inSeb = useMemo(() => isSafeExamBrowser(), []);
  const proctoring = useMemo(() => {
    const p = exam?.proctoring || {};
    return inSeb && p.fullscreenRequired ? { ...p, fullscreenRequired: false } : p;
  }, [exam, inSeb]);
  // Set when any exam request is refused with code SEB_REQUIRED: replaces the screen with a blocking message.
  const [sebBlocked, setSebBlocked] = useState(null);
  useEffect(() => {
    const onSebRequired = (event) => setSebBlocked(event.detail?.message || 'This exam must be taken in Safe Exam Browser');
    window.addEventListener(SEB_REQUIRED_EVENT, onSebRequired);
    return () => window.removeEventListener(SEB_REQUIRED_EVENT, onSebRequired);
  }, []);

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

  // The lobby shows "opens in" / "time left" countdowns; while the exam runs <ExamClock> owns the tick.
  useEffect(() => {
    if (view !== 'lobby') return undefined;
    setNowMs(Date.now() + clockOffset);
    const id = setInterval(() => setNowMs(Date.now() + clockOffset), 1000);
    return () => clearInterval(id);
  }, [clockOffset, view]);

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
        if (sectionOf.get(String(q._id)) === section.sectionId) {
          rows.push({ id: String(q._id), section, number: rows.length + 1, title: stripHtml(q.title) });
        }
      });
    });
    return rows;
  }, [sections, questions, sectionOf]);
  const sectionOfRef = useRef(sectionOf);
  sectionOfRef.current = sectionOf;

  const sectionsRef = useRef(sections);
  sectionsRef.current = sections;

  // Timers change only when the server answers or one runs out locally, never once a second.
  const lockReasonFor = useCallback(
    (id) => {
      const st = timers.sections[sectionOf.get(id)];
      if (st?.completed) {
        return st.remaining > 0 || st.remaining === null
          ? 'You left this section, so its answers are locked. Your saved answer stands.'
          : 'Time for this section is over. Your saved answer stands.';
      }
      const qt = timers.questions[id];
      if (qt?.completed) {
        return qt.remaining > 0 ? 'This question is locked. Your saved answer stands.' : 'Time for this question is over. Your saved answer stands.';
      }
      return null;
    },
    [sectionOf, timers],
  );

  /**
   * True when `id` sits in a timed question or section other than the one open now. The server pauses
   * those timers and only accepts answers while they run, so drafts there cannot be saved from here.
   */
  const isAwayTimed = useCallback(
    (id) => {
      const sectionId = sectionOf.get(id);
      const section = sections.find((s) => s.sectionId === sectionId);
      if (section?.durationSeconds && sectionId !== sectionOf.get(activeId)) return true;
      return Boolean(questionById.get(id)?.timeLimitSeconds) && id !== activeId;
    },
    [sectionOf, sections, questionById, activeId],
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

  /** Drop every `exam:<attemptId>:*` key this attempt wrote. */
  const clearStorage = useCallback(() => {
    const id = attemptRef.current?._id;
    if (!id) return;
    const prefix = storageKey(id, '');
    const stale = [];
    try {
      for (let i = 0; i < localStorage.length; i += 1) {
        const key = localStorage.key(i);
        if (key && key.startsWith(prefix)) stale.push(key);
      }
    } catch {
      /* storage blocked: nothing to clear */
    }
    [storageKey(id, 'drafts'), storageKey(id, 'flags'), ...stale].forEach((key) => localStorage.removeItem(key));
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

  // ---------------------------------------------------------------- server timer state
  const syncOffset = useCallback((serverTime) => {
    if (!serverTime) return;
    const offset = new Date(serverTime).getTime() - Date.now();
    setClockOffset((prev) => (Math.abs(prev - offset) > OFFSET_TOLERANCE_MS ? offset : prev));
  }, []);

  /** Adopt the server's section/question timers (and exam end) from an attempt or /navigate payload. */
  const applyTimerState = useCallback((data) => {
    if (!data) return;
    const next = timersFrom(data);
    timersRef.current = next;
    setTimers(next);
    if (data.endsAt) setAttempt((prev) => (prev && prev.endsAt !== data.endsAt ? { ...prev, endsAt: data.endsAt } : prev));
  }, []);

  /**
   * Re-read the attempt: closes the screen if the attempt ended, otherwise re-syncs the timers. A reply is
   * ignored for timers when a /navigate was sent meanwhile (it would be older than that answer).
   * With `renavigate`, a server that lost track of the open question (e.g. a navigate failed offline) is told again.
   */
  const checkClosed = useCallback(
    async ({ renavigate = true } = {}) => {
      const epoch = navEpochRef.current;
      try {
        const res = await getExamAttempt(examId);
        const a = res.data.attempt;
        if (isClosedAttempt(a)) {
          closeOut(a.status);
          return;
        }
        syncOffset(res.data.serverTime);
        if (navEpochRef.current !== epoch || navBusyRef.current) {
          if (a?.endsAt) setAttempt((prev) => (prev && prev.endsAt !== a.endsAt ? { ...prev, endsAt: a.endsAt } : prev));
          return;
        }
        applyTimerState(a);
        const active = activeIdRef.current;
        if (renavigate && active && a?.currentQuestionId && String(a.currentQuestionId) !== active) requestNavigateRef.current?.(active);
      } catch {
        /* the next heartbeat / navigation retries */
      }
    },
    [examId, closeOut, syncOffset, applyTimerState],
  );

  /**
   * Tell the server which question is open. Requests are serialised: while one is in flight, further
   * calls only update the target, and the latest target is sent when it returns (rapid clicks never race).
   */
  const requestNavigate = useCallback(
    (questionId) => {
      navTargetRef.current = questionId;
      if (navBusyRef.current) return navPromiseRef.current;
      navBusyRef.current = true;
      navPromiseRef.current = (async () => {
        let sent = null;
        let failed = false;
        try {
          while (navTargetRef.current && navTargetRef.current !== sent && attemptRef.current) {
            sent = navTargetRef.current;
            navEpochRef.current += 1;
            try {
              const res = await navigateExam(examId, { attemptId: attemptRef.current._id, questionId: sent });
              if (navTargetRef.current === sent) {
                syncOffset(res.data.serverTime);
                applyTimerState(res.data);
              }
            } catch {
              failed = true;
              break;
            }
          }
        } finally {
          navBusyRef.current = false;
        }
        if (failed) checkClosed({ renavigate: false });
      })();
      return navPromiseRef.current;
    },
    [examId, syncOffset, applyTimerState, checkClosed],
  );
  requestNavigateRef.current = requestNavigate;

  /** Resolves once the server knows `id` is open (so its timers run before we save or run code for it). */
  const navigationSettled = useCallback(async (id) => {
    if (navBusyRef.current && navTargetRef.current === id) await navPromiseRef.current;
  }, []);

  // ---------------------------------------------------------------- start
  const requestFullscreen = useCallback(async () => {
    if (document.fullscreenElement || !document.documentElement.requestFullscreen) return;
    try {
      await document.documentElement.requestFullscreen();
    } catch {
      /* the overlay offers another try */
    }
  }, []);

  const handleStart = async (entryPassword) => {
    setStarting(true);
    setStartError('');
    if (summary?.exam?.proctoring?.fullscreenRequired && !inSeb) await requestFullscreen();
    try {
      const res = await startExam(examId, typeof entryPassword === 'string' ? entryPassword : undefined);
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
      // The server already opened its current question and started that question's/section's timers.
      const resumeId = startedAttempt.currentQuestionId && ids.has(String(startedAttempt.currentQuestionId)) ? String(startedAttempt.currentQuestionId) : null;
      const firstId = resumeId || (list[0] ? String(list[0]._id) : null);
      const startTimers = timersFrom(startedAttempt);

      setExam(startedExam);
      setAttempt(startedAttempt);
      attemptRef.current = startedAttempt;
      setQuestions(list);
      setSaved(savedAnswers);
      setDrafts(initial);
      setFlagged(new Set(readStored(storageKey(startedAttempt._id, 'flags'), [])));
      timersRef.current = startTimers;
      setTimers(startTimers);
      setActiveId(firstId);
      activeIdRef.current = firstId;
      leavingRef.current = false;
      timeUpRef.current = false;
      setView('running');
      if (firstId && firstId !== resumeId) requestNavigate(firstId);
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
        await navigationSettled(id);
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
    [examId, questionById, checkClosed, navigationSettled],
  );

  const changeDraft = useCallback(
    (id, next) => {
      setDrafts((prev) => ({ ...prev, [id]: next }));
      const q = questionById.get(id);
      if (q && !isCoding(q)) {
        clearTimeout(autosaveRef.current[id]);
        autosaveRef.current[id] = setTimeout(() => {
          delete autosaveRef.current[id];
          saveAnswer(id);
        }, AUTOSAVE_MS);
      }
    },
    [questionById, saveAnswer],
  );

  /** Send a pending autosave now (before leaving the question, while its timer still runs). */
  const flushAutosave = useCallback(
    (id) => {
      const pending = autosaveRef.current[id];
      if (!pending) return;
      clearTimeout(pending);
      delete autosaveRef.current[id];
      saveAnswer(id);
    },
    [saveAnswer],
  );

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
      return q && !lockReasonFor(id) && !isAwayTimed(id) && isDirty(q, draftsRef.current[id], saved[id]);
    });
    await Promise.allSettled(ids.map((id) => saveAnswer(id)));
  }, [ordered, questionById, lockReasonFor, isAwayTimed, saved, saveAnswer]);

  // ---------------------------------------------------------------- running code
  const runCode = useCallback(
    async (id, { customInput, expectedOutput } = {}) => {
      const q = questionById.get(id);
      const draft = draftsRef.current[id];
      const att = attemptRef.current;
      if (!q || !draft || !att) return;
      const custom = Boolean(customInput && customInput.trim());
      setRunState((s) => ({ ...s, [id]: { running: true, result: s[id]?.result } }));
      try {
        await navigationSettled(id);
        const res = await runExamCode(examId, {
          attemptId: att._id,
          questionId: id,
          answer: draft.answer,
          language: draft.language,
          customInput: custom ? customInput : undefined,
          expectedOutput: custom ? expectedOutput : undefined,
        });
        setRunState((s) => ({ ...s, [id]: { running: false, result: { custom: res.data.custom, testResults: res.data.testResults } } }));
      } catch (err) {
        // Thrown strings (judge busy / rate limited) are shown verbatim.
        setRunState((s) => ({ ...s, [id]: { running: false, result: { custom, error: typeof err === 'string' ? err : 'Run failed' } } }));
        checkClosed();
      }
    },
    [examId, questionById, checkClosed, navigationSettled],
  );

  // ---------------------------------------------------------------- timers
  // Countdowns render from the server's deadlines (<ExamClock>, the palette and the question badge tick
  // by themselves). Here we only arm one timeout for the nearest deadline: when it passes, the timer is
  // shown as locked at once and the server is asked to confirm. Nothing re-renders once a second.
  useEffect(() => {
    if (!running) return undefined;
    const deadline = nextDeadline(timers);
    if (deadline === null) return undefined;
    const id = setTimeout(() => {
      const next = expireTimers(timersRef.current, Date.now() + clockOffset, sectionOfRef.current);
      if (next !== timersRef.current) {
        timersRef.current = next;
        setTimers(next);
      }
      clearTimeout(resyncTimeoutRef.current);
      resyncTimeoutRef.current = setTimeout(() => checkClosed(), EXPIRY_RESYNC_MS);
    }, Math.max(0, deadline - (Date.now() + clockOffset)) + 50);
    return () => clearTimeout(id);
  }, [running, timers, clockOffset, checkClosed]);

  // A throttled background tab or a sleeping laptop may have missed deadlines: re-sync when it wakes up.
  useEffect(() => {
    if (!running) return undefined;
    const onVisible = () => {
      if (!document.hidden) checkClosed();
    };
    const onOnline = () => checkClosed();
    document.addEventListener('visibilitychange', onVisible);
    window.addEventListener('online', onOnline);
    return () => {
      document.removeEventListener('visibilitychange', onVisible);
      window.removeEventListener('online', onOnline);
    };
  }, [running, checkClosed]);

  useEffect(() => () => clearTimeout(resyncTimeoutRef.current), []);

  const handleTimeUp = useCallback(async () => {
    if (!running || timeUpRef.current) return;
    timeUpRef.current = true;
    await saveAllDirty();
    try {
      const res = await autoSubmitExam(examId, attemptRef.current._id);
      closeOut(res.data.attempt?.status || 'auto_submitted');
    } catch {
      checkClosed();
      timeUpRef.current = false;
    }
  }, [running, saveAllDirty, examId, closeOut, checkClosed]);

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
    const reportTabSwitch = async (details) => {
      const d = await logEvent('tab_switch', details);
      if (d && !d.terminate) {
        const limit = d.tabSwitchLimit > 0 ? ` (${d.tabSwitchCount} of ${d.tabSwitchLimit})` : '';
        setWarning({
          title: 'You left the exam window',
          message: `This has been recorded${limit}.${d.tabSwitchLimit > 0 ? ' Reaching the limit locks and submits your exam.' : ''}`,
        });
      }
    };
    const onVisibility = () => {
      if (!document.hidden) return;
      reportTabSwitch();
    };
    // Switching to another window (alt-tab, second monitor) blurs the window without necessarily hiding the
    // document. Wait briefly so a real tab switch is reported once, by the visibility handler only.
    let blurTimer = null;
    const onBlur = () => {
      clearTimeout(blurTimer);
      blurTimer = setTimeout(() => {
        if (document.hidden || document.hasFocus()) return;
        reportTabSwitch('window_blur');
      }, BLUR_SETTLE_MS);
    };
    const onFocus = () => clearTimeout(blurTimer);
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
    window.addEventListener('blur', onBlur);
    window.addEventListener('focus', onFocus);
    window.addEventListener('online', onOnline);
    window.addEventListener('offline', onOffline);
    window.addEventListener('beforeunload', onBeforeUnload);
    return () => {
      clearInterval(heartbeat);
      clearTimeout(blurTimer);
      document.removeEventListener('visibilitychange', onVisibility);
      document.removeEventListener('fullscreenchange', onFullscreen);
      ['copy', 'cut', 'paste'].forEach((t) => document.removeEventListener(t, onClipboard, true));
      document.removeEventListener('contextmenu', onContextMenu);
      window.removeEventListener('blur', onBlur);
      window.removeEventListener('focus', onFocus);
      window.removeEventListener('online', onOnline);
      window.removeEventListener('offline', onOffline);
      window.removeEventListener('beforeunload', onBeforeUnload);
    };
  }, [running, logEvent, proctoring.fullscreenRequired, proctoring.copyPasteDisabled]);

  useEffect(() => () => {
    if (document.fullscreenElement) document.exitFullscreen().catch(() => {});
  }, []);

  // ---------------------------------------------------------------- navigation
  const goTo = useCallback(
    async (id) => {
      const from = activeIdRef.current;
      if (!id || id === from) return;
      const fromSection = sectionOfRef.current.get(from);
      if (fromSection !== sectionOfRef.current.get(id)) {
        const section = sectionsRef.current.find((s) => s.sectionId === fromSection);
        if (section?.allowRevisit === false && !timersRef.current.sections[fromSection]?.completed) {
          const ok = await confirmAction(
            'This section does not allow coming back. Once you leave it, its answers are locked; changes you have not saved are lost.',
            { title: `Leave ${section.title || 'this section'}?`, confirmLabel: 'Leave section' },
          );
          if (!ok || activeIdRef.current !== from) return;
        }
      }
      flushAutosave(from);
      activeIdRef.current = id;
      setActiveId(id);
      setPaletteOpen(false);
      requestNavigate(id);
    },
    [flushAutosave, requestNavigate],
  );
  const activeIndex = ordered.findIndex((r) => r.id === activeId);
  const prevId = ordered[activeIndex - 1]?.id;
  const nextId = ordered[activeIndex + 1]?.id;
  const goPrev = useCallback(() => goTo(prevId), [goTo, prevId]);
  const goNext = useCallback(() => goTo(nextId), [goTo, nextId]);
  const toggleFlag = useCallback(() => {
    const id = activeIdRef.current;
    setFlagged((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }, []);
  const changeActive = useCallback((next) => changeDraft(activeIdRef.current, next), [changeDraft]);
  const saveActive = useCallback(() => saveAnswer(activeIdRef.current), [saveAnswer]);
  const runActive = useCallback((opts) => runCode(activeIdRef.current, opts), [runCode]);

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
    clearStorage();
    exitFullscreen();
    navigate('/student/exams');
  };

  const groups = useMemo(
    () =>
      sections
        .map((section) => {
          const timer = timers.sections[section.sectionId] ?? null;
          return {
            section,
            // Shown for sections with their own limit, and for no-revisit sections once locked.
            timer: section.durationSeconds || timer?.completed ? timer : null,
            items: ordered.filter((r) => r.section.sectionId === section.sectionId),
          };
        })
        .filter((g) => g.items.length),
    [sections, timers.sections, ordered],
  );

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

  if (sebBlocked) {
    const link = summary?.sebLink || summary?.exam?.seb?.link || null;
    return (
      <div className="h-full flex items-center justify-center p-6">
        <div className="max-w-md w-full bg-surface border border-line rounded-2xl p-6 text-center space-y-3" role="alert">
          <ShieldAlert className="w-10 h-10 text-warn mx-auto" />
          <h1 className="text-lg font-bold text-fg">Open this exam in Safe Exam Browser</h1>
          <p className="text-sm text-muted">
            {sebBlocked}. {inSeb ? 'This Safe Exam Browser was not started with this exam’s settings. Ask your teacher: quit it and open the exam again with its “Open in Safe Exam Browser” link.' : 'Your answers so far are saved. Continue in Safe Exam Browser; it must already be installed on this laptop.'}
          </p>
          <div className="flex flex-wrap justify-center gap-2 pt-1">
            {link && !inSeb && (
              <a
                href={link}
                className="rounded-xl text-xs font-semibold transition cursor-pointer flex items-center gap-1.5 px-4 py-2 bg-accent hover:bg-accent-hover text-on-accent"
              >
                <ExternalLink className="w-3.5 h-3.5" />
                Open in Safe Exam Browser
              </a>
            )}
            <Button variant="secondary" onClick={() => navigate('/student/exams')}>
              Back to exams
            </Button>
          </div>
        </div>
      </div>
    );
  }

  if (view === 'lobby') {
    return (
      <div className="h-full overflow-y-auto">
        <ExamLobby
          exam={summary.exam}
          attempt={summary.attempt}
          sebLink={summary.sebLink}
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
  const lockReason = activeId ? lockReasonFor(activeId) : null;
  const palette = (
    <QuestionPalette groups={groups} activeId={activeId} stateOf={stateOf} flagged={flagged} onSelect={goTo} clockOffset={clockOffset} />
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
        <ExamClock endsAt={attempt?.endsAt} clockOffset={clockOffset} onTimeUp={handleTimeUp} />
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
              timer={activeQuestion.timeLimitSeconds ? timers.questions[activeId] ?? null : null}
              clockOffset={clockOffset}
              draft={drafts[activeId]}
              dirty={isDirty(activeQuestion, drafts[activeId], saved[activeId])}
              save={saveState[activeId]}
              locked={Boolean(lockReason)}
              lockReason={lockReason}
              flagged={flagged.has(activeId)}
              onToggleFlag={toggleFlag}
              onChange={changeActive}
              onSave={saveActive}
              onRun={runActive}
              running={Boolean(runState[activeId]?.running)}
              runResult={runState[activeId]?.result}
              allowRun={proctoring.allowRunCode !== false}
              copyPasteDisabled={Boolean(proctoring.copyPasteDisabled)}
              onPrev={goPrev}
              onNext={goNext}
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

      <SubmitDialog
        open={submitOpen}
        endsAt={attempt?.endsAt}
        clockOffset={clockOffset}
        onClose={() => setSubmitOpen(false)}
        onConfirm={handleSubmit}
        submitting={submitting}
        items={ordered.map((r) => {
          const state = stateOf(r.id);
          return { id: r.id, number: r.number, state, flagged: flagged.has(r.id), away: state === 'dirty' && isAwayTimed(r.id) };
        })}
      />
    </div>
  );
};

export default StudentExamScreen;
