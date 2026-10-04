export const TYPE_LABELS = {
  singleCorrectMcq: 'Single choice',
  multipleCorrectMcq: 'Multiple choice',
  fillInTheBlanks: 'Fill in the blank',
  fillInTheBlanksCoding: 'Code completion',
  coding: 'Coding',
  codingWithDriver: 'Coding (driver)',
};

export const DIFFICULTY_KIND = { easy: 'pass', medium: 'warning', hard: 'fail' };

export const MAX_DURATION = 1440;

export const newSectionId = () => `section-${Date.now().toString(36)}${Math.random().toString(36).slice(2, 5)}`;

const pad = (n) => String(n).padStart(2, '0');

/** Date → value for <input type="datetime-local"> in the browser's time zone. */
export const toLocalInput = (value) => {
  if (!value) return '';
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return '';
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
};

const fromLocalInput = (value) => {
  if (!value) return null;
  const d = new Date(value);
  return Number.isNaN(d.getTime()) ? null : d.toISOString();
};

const numberOrBlank = (value) => (value === '' || value === null || value === undefined ? '' : Number(value));

export const emptyForm = () => {
  const sectionId = newSectionId();
  return {
    title: '',
    description: '',
    sections: [{ sectionId, title: 'Section 1', description: '', durationMinutes: '' }],
    questions: [],
    durationMinutes: 60,
    startTime: '',
    endTime: '',
    tabSwitchLimit: 5,
    copyPasteDisabled: true,
    fullscreenRequired: true,
    allowRunCode: true,
    immediateScoreRelease: false,
  };
};

/** Builds the form from an exam or template whose questions.questionId is populated. */
export const formFromExam = (exam, { keepSchedule = true } = {}) => {
  const sections = (exam.sections?.length ? [...exam.sections] : [{ sectionId: newSectionId(), title: 'Section 1' }])
    .sort((a, b) => (a.order ?? 0) - (b.order ?? 0))
    .map((s) => ({
      sectionId: s.sectionId,
      title: s.title || 'Section',
      description: s.description || '',
      durationMinutes: s.durationSeconds ? Math.round(s.durationSeconds / 60) : '',
    }));
  const sectionIds = new Set(sections.map((s) => s.sectionId));
  const rows = [...(exam.questions || [])].sort((a, b) => (a.order ?? 0) - (b.order ?? 0));
  const questions = rows
    .filter((q) => q.questionId && typeof q.questionId === 'object')
    .map((q) => ({
      questionId: String(q.questionId._id),
      title: q.questionId.title,
      type: q.questionId.type,
      difficulty: q.questionId.difficulty,
      defaultPoints: q.questionId.points ?? null,
      draft: q.questionId.status === 'draft' || q.questionId.isDraft,
      points: numberOrBlank(q.points),
      timeLimitMinutes: q.timeLimitSeconds ? Math.round((q.timeLimitSeconds / 60) * 10) / 10 : '',
      sectionId: sectionIds.has(q.sectionId) ? q.sectionId : sections[0].sectionId,
    }));
  const p = exam.proctoring || {};
  return {
    form: {
      title: exam.title || '',
      description: exam.description || '',
      sections,
      questions,
      durationMinutes: p.durationMinutes || 60,
      startTime: keepSchedule ? toLocalInput(p.startTime) : '',
      endTime: keepSchedule ? toLocalInput(p.endTime) : '',
      tabSwitchLimit: p.tabSwitchLimit ?? 5,
      copyPasteDisabled: p.copyPasteDisabled ?? true,
      fullscreenRequired: p.fullscreenRequired ?? true,
      allowRunCode: p.allowRunCode ?? true,
      immediateScoreRelease: Boolean(exam.scoring?.immediateScoreRelease),
    },
    missing: rows.length - questions.length,
  };
};

export const questionFromBank = (q, sectionId) => ({
  questionId: String(q._id),
  title: q.title,
  type: q.type,
  difficulty: q.difficulty,
  defaultPoints: q.points ?? null,
  draft: false,
  points: '',
  timeLimitMinutes: '',
  sectionId,
});

export const effectivePoints = (q) => (q.points === '' ? Number(q.defaultPoints) || 0 : Number(q.points) || 0);

/** Questions in display order: grouped by section, in section order. */
export const orderedQuestions = (form) =>
  form.sections.flatMap((s) => form.questions.filter((q) => q.sectionId === s.sectionId));

export const buildPayload = (form, { isTemplate = false } = {}) => ({
  title: form.title.trim(),
  description: form.description.trim(),
  sections: form.sections.map((s, order) => ({
    sectionId: s.sectionId,
    title: s.title.trim() || `Section ${order + 1}`,
    description: s.description.trim(),
    durationSeconds: s.durationMinutes ? Math.round(Number(s.durationMinutes) * 60) : 0,
    allowRevisit: true,
    order,
  })),
  questions: orderedQuestions(form).map((q, order) => ({
    questionId: q.questionId,
    points: q.points === '' ? null : Number(q.points),
    sectionId: q.sectionId,
    timeLimitSeconds: q.timeLimitMinutes ? Math.round(Number(q.timeLimitMinutes) * 60) : null,
    order,
  })),
  proctoring: {
    durationMinutes: Number(form.durationMinutes),
    startTime: isTemplate ? null : fromLocalInput(form.startTime),
    endTime: isTemplate ? null : fromLocalInput(form.endTime),
    tabSwitchLimit: Number(form.tabSwitchLimit) || 0,
    copyPasteDisabled: form.copyPasteDisabled,
    fullscreenRequired: form.fullscreenRequired,
    allowRunCode: form.allowRunCode,
    autoSubmitOnEnd: true,
    internetRequired: true,
  },
  scoring: { immediateScoreRelease: form.immediateScoreRelease, gradingMode: 'auto' },
});

/** Returns [{ level: 'error' | 'warn', area: 'details' | 'questions' | 'schedule', message }]. */
export const validate = (form, { isTemplate = false, now = Date.now() } = {}) => {
  const issues = [];
  const add = (level, area, message) => issues.push({ level, area, message });
  const duration = Number(form.durationMinutes);

  if (!form.title.trim()) add('error', 'details', 'Give the exam a title.');
  if (!form.questions.length) add('error', 'questions', 'Add at least one question.');
  const drafts = form.questions.filter((q) => q.draft).length;
  if (drafts) add('error', 'questions', `${drafts} question${drafts === 1 ? ' is' : 's are'} still a draft. Publish or remove ${drafts === 1 ? 'it' : 'them'}.`);
  if (!Number.isFinite(duration) || duration < 1 || duration > MAX_DURATION) add('error', 'schedule', 'Duration must be between 1 and 1440 minutes.');

  const badPoints = form.questions.filter((q) => q.points !== '' && (!Number.isFinite(Number(q.points)) || Number(q.points) < 0)).length;
  if (badPoints) add('error', 'questions', 'Points cannot be negative.');
  const zero = form.questions.filter((q) => effectivePoints(q) === 0).length;
  if (zero) add('warn', 'questions', `${zero} question${zero === 1 ? ' is' : 's are'} worth 0 points.`);

  const empty = form.sections.filter((s) => !form.questions.some((q) => q.sectionId === s.sectionId));
  if (form.questions.length && empty.length) add('warn', 'questions', `${empty.map((s) => `"${s.title || 'Untitled'}"`).join(', ')} has no questions.`);
  const sectionMinutes = form.sections.reduce((sum, s) => sum + (Number(s.durationMinutes) || 0), 0);
  if (Number.isFinite(duration) && form.sections.every((s) => Number(s.durationMinutes) > 0) && sectionMinutes < duration) {
    add('warn', 'questions', `Section limits add up to ${sectionMinutes} min, less than the ${duration} min exam.`);
  }
  if (form.sections.some((s) => Number(s.durationMinutes) > duration)) add('warn', 'questions', 'A section limit is longer than the whole exam.');

  if (!isTemplate) {
    const start = form.startTime ? new Date(form.startTime).getTime() : null;
    const end = form.endTime ? new Date(form.endTime).getTime() : null;
    if (start && end && end <= start) add('error', 'schedule', 'The end time must be after the start time.');
    if (end && end < now) add('warn', 'schedule', 'The end time is in the past, so students cannot take it.');
    if (start && end && end > start && Number.isFinite(duration) && (end - start) / 60000 < duration) {
      add('warn', 'schedule', 'The window is shorter than the duration, so late starters get less time.');
    }
  }
  return issues;
};
