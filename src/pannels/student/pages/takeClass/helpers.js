export {
  QUESTION_TYPE_LABELS,
  RUNNABLE_CODING_TYPES,
  FULL_CODE_EDITOR_TYPES,
  classEntryFor,
  formatQuestionPublishedAt,
  stripHtml,
  getCodeTemplateForLanguage,
  difficultyKind,
} from '../../../teacher/pages/takeClass/helpers';

export function isEnrolledStudent(cls, userId) {
  if (!cls || !userId) return false;
  // The API only ever returns a student the classes they are enrolled in, and (for privacy) no
  // longer includes the full `students` roster. When the roster is absent, trust the server.
  if (!Array.isArray(cls.students)) return true;
  return cls.students.some((student) => String(student?._id ?? student) === String(userId));
}

export function availableLanguages(question) {
  if (question?.languages?.length) return question.languages;
  if (question?.starterCode?.length) {
    return question.starterCode.map((item) => item.language).filter(Boolean);
  }
  return ['javascript'];
}

export function attemptKind(status) {
  if (status === 'attempted') return 'ok';
  if (status === 'wrong') return 'bad';
  return 'neutral';
}

export function attemptLabel(status) {
  if (status === 'attempted') return 'Solved';
  if (status === 'wrong') return 'Attempted';
  return 'Not started';
}

export function publishedForClass(question, classId) {
  const entry = question && classId
    ? question.classes?.find((item) => String(item.classId?._id || item.classId) === String(classId))
    : null;
  return Boolean(entry?.isPublished);
}

export function interactionLock(question, classId) {
  if (!question || !classId) return { locked: false, banner: null };
  const entry = question.classes?.find((item) => String(item.classId?._id || item.classId) === String(classId));
  if (!entry?.isPublished) {
    return {
      locked: true,
      banner: 'This question is not available yet. Your teacher has not published it for the class.',
    };
  }
  if (entry.isDisabled) {
    return {
      locked: true,
      banner: 'Your teacher has disabled answers. You can read the problem, but run and submit are turned off.',
    };
  }
  return { locked: false, banner: null };
}
