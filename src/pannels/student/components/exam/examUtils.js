import { CODING_TYPES, LANGUAGE_LABELS, QUESTION_TYPE_LABELS } from '../../../../common/domain/questions';
import { htmlToPlainText } from '../../../../common/utils/sanitizeHtml';

export { CODING_TYPES, LANGUAGE_LABELS };
export const TYPE_LABELS = QUESTION_TYPE_LABELS;
export const CLOSED_STATUSES = ['submitted', 'auto_submitted', 'terminated', 'expired'];

export const isCoding = (question) => CODING_TYPES.includes(question?.type);
export const isClosedAttempt = (attempt) => CLOSED_STATUSES.includes(attempt?.status);

export const ATTEMPT_LABELS = {
  in_progress: 'In progress',
  submitted: 'Submitted',
  auto_submitted: 'Auto-submitted',
  terminated: 'Locked',
  expired: 'Expired',
};

/** "1:05:09" / "05:09"; null means no limit. */
export const formatClock = (seconds) => {
  if (seconds === null || seconds === undefined) return '—';
  const s = Math.max(0, Math.floor(seconds));
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const sec = String(s % 60).padStart(2, '0');
  return h ? `${h}:${String(m).padStart(2, '0')}:${sec}` : `${String(m).padStart(2, '0')}:${sec}`;
};

export const formatMinutes = (minutes) => {
  if (!minutes) return '—';
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return h ? `${h} h${m ? ` ${m} min` : ''}` : `${m} min`;
};

export const formatDateTime = (value) =>
  value
    ? new Date(value).toLocaleString(undefined, { weekday: 'short', day: 'numeric', month: 'short', hour: 'numeric', minute: '2-digit' })
    : '—';

export const starterFor = (question, language) => {
  const starter = (question.starterCode || []).find((s) => s.language === language);
  if (starter?.code) return starter.code;
  if (question.type === 'fillInTheBlanksCoding' && question.codeSnippet) return htmlToPlainText(question.codeSnippet);
  return '';
};

/** The blank answer a student starts from, or the saved one when there is one. */
export const initialDraft = (question, saved) => {
  if (isCoding(question)) {
    const language = saved?.language && question.languages?.includes(saved.language) ? saved.language : question.languages?.[0] || 'javascript';
    const code = { [language]: typeof saved?.answer === 'string' ? saved.answer : starterFor(question, language) };
    return { language, code, answer: code[language] };
  }
  if (question.type === 'multipleCorrectMcq') return { answer: Array.isArray(saved?.answer) ? saved.answer.map(Number) : [] };
  if (question.type === 'singleCorrectMcq') return { answer: saved?.answer ?? null };
  return { answer: typeof saved?.answer === 'string' ? saved.answer : '' };
};

export const hasAnswer = (question, draft) => {
  const value = draft?.answer;
  if (question.type === 'singleCorrectMcq') return value !== null && value !== undefined && value !== '';
  if (question.type === 'multipleCorrectMcq') return Array.isArray(value) && value.length > 0;
  return typeof value === 'string' && value.trim() !== '';
};

const same = (a, b) => JSON.stringify(a ?? null) === JSON.stringify(b ?? null);

/** True when the draft differs from what the server last saved. */
export const isDirty = (question, draft, saved) => {
  if (!draft) return false;
  if (!saved) return hasAnswer(question, draft) && !(isCoding(question) && draft.answer === starterFor(question, draft.language));
  if (question.type === 'multipleCorrectMcq') {
    return !same([...(draft.answer || [])].sort(), [...(saved.answer || [])].map(Number).sort());
  }
  if (question.type === 'singleCorrectMcq') return Number(draft.answer) !== Number(saved.answer);
  if (isCoding(question)) return draft.answer !== saved.answer || draft.language !== saved.language;
  return (draft.answer || '') !== (saved.answer || '');
};

export const payloadAnswer = (question, draft) => {
  if (question.type === 'singleCorrectMcq') return Number(draft.answer);
  if (question.type === 'multipleCorrectMcq') return (draft.answer || []).map(Number);
  return draft.answer;
};

export const storageKey = (attemptId, name) => `exam:${attemptId}:${name}`;

export const readStored = (key, fallback) => {
  try {
    const raw = localStorage.getItem(key);
    return raw ? JSON.parse(raw) : fallback;
  } catch {
    return fallback;
  }
};

export const writeStored = (key, value) => {
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch {
    /* storage full or blocked: drafts just stay in memory */
  }
};
