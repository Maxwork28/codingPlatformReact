/**
 * Exam lifecycle phases shared by every exam list / report / builder screen.
 * `tone` is the semantic colour; the class fragments are the usual ways it is rendered.
 */
export const EXAM_PHASES = {
  live: {
    label: 'Live',
    tone: 'ok',
    dot: 'bg-ok animate-pulse',
    text: 'text-ok',
    chip: 'bg-ok-soft text-ok border-ok-line',
    kind: 'pass',
  },
  scheduled: {
    label: 'Scheduled',
    tone: 'info',
    dot: 'bg-info',
    text: 'text-info',
    chip: 'bg-info-soft text-info border-info-line',
    kind: 'info',
  },
  draft: {
    label: 'Draft',
    tone: 'warn',
    dot: 'bg-warn',
    text: 'text-warn',
    chip: 'bg-warn-soft text-warn border-warn-line',
    kind: 'neutral',
  },
  completed: {
    label: 'Completed',
    tone: 'muted',
    dot: 'bg-subtle',
    text: 'text-muted',
    chip: 'bg-quiet-soft text-muted border-quiet-line',
    kind: 'ai',
  },
  archived: {
    label: 'Archived',
    tone: 'subtle',
    dot: 'bg-subtle',
    text: 'text-subtle',
    chip: 'bg-quiet-soft text-subtle border-quiet-line',
    kind: 'neutral',
  },
};

export const EXAM_PHASE_ORDER = ['live', 'scheduled', 'draft', 'completed', 'archived'];

export const examPhase = (phase) => EXAM_PHASES[phase] || EXAM_PHASES.draft;
