/**
 * Shared question-domain constants. Import these instead of redefining them per screen
 * so the wording stays identical across admin, teacher and student panels.
 */

export const QUESTION_TYPE_LABELS = {
  singleCorrectMcq: 'Single choice',
  multipleCorrectMcq: 'Multiple choice',
  fillInTheBlanks: 'Fill in the blanks',
  fillInTheBlanksCoding: 'Fill in the blanks (code)',
  coding: 'Coding',
  codingWithDriver: 'Coding (driver)',
};

/** Question types that are judged by running code. */
export const CODING_TYPES = ['coding', 'fillInTheBlanksCoding', 'codingWithDriver'];

/** Coding types where the editor holds the whole submission (no template with blanks). */
export const FULL_CODE_EDITOR_TYPES = ['coding', 'codingWithDriver'];

export const isCodingType = (type) => CODING_TYPES.includes(type);

/** Number of hidden cases: server-provided count first, otherwise derived from the full list (staff views). */
export function hiddenTestCaseCount(question, tests) {
  if (typeof question?.hiddenTestCaseCount === 'number') return question.hiddenTestCaseCount;
  const list = Array.isArray(tests) ? tests : Array.isArray(question?.testCases) ? question.testCases : [];
  return list.filter((t) => t && t.isPublic === false).length;
}

export const LANGUAGE_LABELS = {
  javascript: 'JavaScript',
  python: 'Python',
  java: 'Java',
  cpp: 'C++',
  c: 'C',
  go: 'Go',
  php: 'PHP',
  ruby: 'Ruby',
};

export const languageLabel = (lang) => LANGUAGE_LABELS[lang] || lang || '';

export const questionTypeLabel = (type) => QUESTION_TYPE_LABELS[type] || type || '';
