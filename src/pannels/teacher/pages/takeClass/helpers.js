import { CODING_TYPES, FULL_CODE_EDITOR_TYPES, QUESTION_TYPE_LABELS } from '../../../../common/domain/questions';
import { stripHtml } from '../../../../common/utils/sanitizeHtml';

export { QUESTION_TYPE_LABELS, FULL_CODE_EDITOR_TYPES, stripHtml };
export const RUNNABLE_CODING_TYPES = CODING_TYPES;

export function classEntryFor(question, classId) {
  if (!question || !classId) return null;
  const id = String(classId);
  return (
    question.classes?.find(
      (entry) => String(entry.classId?._id || entry.classId) === id
    ) || null
  );
}

export function formatQuestionPublishedAt(entry, question) {
  const raw =
    entry?.publishedAt ||
    question?.publishedAt ||
    (entry?.isPublished ? question?.updatedAt || question?.createdAt : null);
  if (!raw) return '';
  const date = new Date(raw);
  if (Number.isNaN(date.getTime())) return '';
  return date.toLocaleDateString(undefined, { day: 'numeric', month: 'short', year: 'numeric' });
}

export function getCodeTemplateForLanguage(question, lang) {
  if (!question || !lang) return '';
  const fromTemplate = question.templateCode?.find((item) => item.language === lang);
  if (fromTemplate?.code) return fromTemplate.code;
  const fromStarter = question.starterCode?.find((item) => item.language === lang);
  if (fromStarter?.code) return fromStarter.code;
  return question.codeSnippet || '';
}

function normalizeLang(lang) {
  return String(lang || '').trim().toLowerCase();
}

export function getSolutionCodeForLanguage(question, lang) {
  if (!question) return '';
  const want = normalizeLang(lang);
  const fromList = (question.solutionCodes || []).find(
    (item) => normalizeLang(item.language) === want && String(item.code || '').trim()
  );
  if (fromList?.code) return fromList.code;
  const legacy = String(question.solutionCode || '').trim();
  if (legacy && (!question.solutionLanguage || normalizeLang(question.solutionLanguage) === want)) {
    return question.solutionCode;
  }
  return '';
}

export function pickSolutionForQuestion(question, preferredLang) {
  if (!question) return { code: '', language: preferredLang };
  const preferred = getSolutionCodeForLanguage(question, preferredLang);
  if (preferred) return { code: preferred, language: preferredLang };
  const firstSaved = (question.solutionCodes || []).find((item) => String(item.code || '').trim());
  if (firstSaved?.code) return { code: firstSaved.code, language: firstSaved.language || preferredLang };
  if (String(question.solutionCode || '').trim()) {
    return { code: question.solutionCode, language: question.solutionLanguage || preferredLang };
  }
  return { code: '', language: preferredLang };
}

export function describeOfficialAnswer(question) {
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
    return { indexes, text: `Correct options: ${lines.join(' · ')}` };
  }
  if (question.type === 'fillInTheBlanks' || question.type === 'fillInTheBlanksCoding') {
    const ans = stripHtml(question.correctAnswer || '');
    if (!ans) return null;
    return { indexes: [], text: `Correct answer: ${ans}`, blank: ans };
  }
  return null;
}

export function difficultyKind(value) {
  if (value === 'easy') return 'ok';
  if (value === 'medium') return 'warn';
  if (value === 'hard') return 'bad';
  return 'neutral';
}

export function extractAnswerText(answer) {
  if (answer == null || answer === '') return '';
  if (typeof answer === 'string') return answer;
  if (Array.isArray(answer)) return answer.join('\n');
  try {
    return JSON.stringify(answer, null, 2);
  } catch {
    return String(answer);
  }
}

export function tokenColor(name, fallback) {
  if (typeof document === 'undefined') return fallback;
  const value = getComputedStyle(document.documentElement).getPropertyValue(name).trim();
  return value || fallback;
}

export function isTeacherClass(cls, userId) {
  if (!cls || !userId) return false;
  const id = String(userId);
  return (
    cls.teachers?.some((teacher) => String(teacher._id || teacher) === id) ||
    String(cls.createdBy?._id || cls.createdBy) === id
  );
}
