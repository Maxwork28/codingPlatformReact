import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useLocation, useNavigate, useParams, useSearchParams } from 'react-router-dom';
import {
  AlertCircle,
  AlertTriangle,
  ArrowLeft,
  Award,
  CheckCircle2,
  Clock,
  Layers,
  ListPlus,
  Lock,
  Plus,
  Save,
  Send,
} from 'lucide-react';
import {
  createExam,
  createExamTemplate,
  editExam,
  getExamDetails,
  listClassExams,
  listExamQuestionBank,
} from '../../../common/services/api';
import { notify, confirmAction } from '../../../common/ui/Toast';
import { Button, Card, EmptyState, StatusChip, Switch } from '../../../common/ui/primitives';
import { inputClass, labelClass, type } from '../../../common/ui/format';
import QuestionPickerModal from '../components/examBuilder/QuestionPickerModal';
import SectionCard from '../components/examBuilder/SectionCard';
import { EXAM_PHASES } from '../../../common/domain/exams';
import {
  TYPE_LABELS,
  buildPayload,
  effectivePoints,
  emptyForm,
  formFromExam,
  newSectionId,
  questionFromBank,
  validate,
} from '../components/examBuilder/model';

const errorText = (err, fallback) => (typeof err === 'string' ? err : err?.response?.data?.error || err?.message || fallback);

const PHASE_CHIP = {
  ...Object.fromEntries(Object.entries(EXAM_PHASES).map(([id, p]) => [id, [p.kind, p.label]])),
  template: ['ai', 'Template'],
};

const DURATION_PRESETS = [30, 45, 60, 90, 120, 180];

function Field({ label, htmlFor, hint, children, className = '' }) {
  return (
    <div className={`space-y-1.5 ${className}`}>
      <label htmlFor={htmlFor} className={labelClass}>
        {label}
      </label>
      {children}
      {hint && <p className={type.meta}>{hint}</p>}
    </div>
  );
}

function RuleRow({ title, hint, checked, onChange }) {
  return (
    <div className="flex items-start justify-between gap-4 py-3">
      <div className="min-w-0">
        <p className="text-xs font-semibold text-fg">{title}</p>
        <p className={`${type.meta} mt-0.5`}>{hint}</p>
      </div>
      <Switch checked={checked} onChange={onChange} label={title} className="mt-0.5" />
    </div>
  );
}

function SummaryRow({ label, value }) {
  return (
    <div className="flex items-baseline justify-between gap-3 py-1.5">
      <dt className="text-xs text-muted">{label}</dt>
      <dd className="text-xs font-semibold text-fg text-right tabular-nums">{value}</dd>
    </div>
  );
}

const windowLabel = (form, isTemplate) => {
  if (isTemplate) return 'Set per exam';
  const fmt = (v) => new Date(v).toLocaleString(undefined, { dateStyle: 'medium', timeStyle: 'short' });
  const start = form.startTime ? fmt(form.startTime) : 'When published';
  const end = form.endTime ? fmt(form.endTime) : 'Until closed';
  return `${start} → ${end}`;
};

export default function ExamBuilder() {
  const { classId: routeClassId, examId } = useParams();
  const [searchParams] = useSearchParams();
  const location = useLocation();
  const navigate = useNavigate();
  const base = location.pathname.startsWith('/teacher') ? '/teacher' : '/admin';
  const templateId = examId ? null : searchParams.get('templateId');
  const isEdit = Boolean(examId);

  const [form, setForm] = useState(emptyForm);
  const [baseline, setBaseline] = useState('');
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState('');
  const [meta, setMeta] = useState({ className: '', attemptCount: 0, phase: null, storedStatus: null, classId: routeClassId, templateTitle: '' });
  const [isTemplate, setIsTemplate] = useState(!examId && searchParams.get('template') === 'true');
  const [saving, setSaving] = useState('');
  const [showIssues, setShowIssues] = useState(false);
  const [picker, setPicker] = useState({ open: false, sectionId: null });
  const [bank, setBank] = useState({ items: null, loading: false, error: '' });
  const [reloadKey, setReloadKey] = useState(0);

  const classId = meta.classId || routeClassId;
  const locked = meta.attemptCount > 0;
  const dirty = baseline !== '' && JSON.stringify(form) !== baseline;
  const listPath = isTemplate ? `${base}/exams/templates` : `${base}/classes/${classId}/exams`;

  useEffect(() => {
    let cancelled = false;
    const finish = (nextForm, nextMeta) => {
      if (cancelled) return;
      setForm(nextForm);
      setBaseline(JSON.stringify(nextForm));
      setMeta((m) => ({ ...m, ...nextMeta }));
      setLoading(false);
    };
    const className = () =>
      listClassExams(routeClassId)
        .then((r) => r.data.className || '')
        .catch(() => '');

    setLoading(true);
    setLoadError('');
    (async () => {
      try {
        if (isEdit) {
          const { data } = await getExamDetails(examId);
          const template = Boolean(data.exam.template?.isTemplate);
          const { form: loaded, missing } = formFromExam(data.exam);
          if (missing) notify(`${missing} question${missing === 1 ? ' was' : 's were'} deleted and removed from this ${template ? 'template' : 'exam'}. Save to keep the change.`, 'warning');
          if (!cancelled) setIsTemplate(template);
          finish(loaded, {
            className: data.className || '',
            attemptCount: data.attemptCount || 0,
            phase: data.exam.phase,
            storedStatus: data.exam.status,
            classId: String(data.exam.classId?._id || data.exam.classId || routeClassId),
          });
        } else if (templateId) {
          const [{ data }, name] = await Promise.all([getExamDetails(templateId), className()]);
          if (!data.exam.template?.isTemplate) throw new Error('That exam is not a template.');
          const { form: loaded, missing } = formFromExam(data.exam, { keepSchedule: false });
          if (missing) notify(`${missing} question${missing === 1 ? ' from the template no longer exists' : 's from the template no longer exist'} and ${missing === 1 ? 'was' : 'were'} left out.`, 'warning');
          finish(loaded, { className: name, templateTitle: data.exam.title });
        } else {
          finish(emptyForm(), { className: await className() });
        }
      } catch (err) {
        if (!cancelled) {
          setLoadError(errorText(err, 'Failed to load the exam'));
          setLoading(false);
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [examId, isEdit, routeClassId, templateId, reloadKey]);

  useEffect(() => {
    if (!dirty) return undefined;
    const warn = (e) => {
      e.preventDefault();
      e.returnValue = '';
    };
    window.addEventListener('beforeunload', warn);
    return () => window.removeEventListener('beforeunload', warn);
  }, [dirty]);

  const loadBank = useCallback(() => {
    setBank((b) => ({ ...b, loading: true, error: '' }));
    listExamQuestionBank(classId)
      .then((r) => setBank({ items: r.data.questions || [], loading: false, error: '' }))
      .catch((err) => setBank({ items: null, loading: false, error: errorText(err, 'Failed to load questions') }));
  }, [classId]);

  const openPicker = (sectionId) => {
    setPicker({ open: true, sectionId: sectionId || form.sections[0]?.sectionId });
    if (!bank.items && !bank.loading) loadBank();
  };

  // ---- form updates ---------------------------------------------------------
  const set = (patch) => setForm((f) => ({ ...f, ...patch }));

  const updateSection = (sectionId, patch) =>
    setForm((f) => ({ ...f, sections: f.sections.map((s) => (s.sectionId === sectionId ? { ...s, ...patch } : s)) }));

  const moveSection = (index, dir) =>
    setForm((f) => {
      const sections = [...f.sections];
      const target = index + dir;
      if (target < 0 || target >= sections.length) return f;
      [sections[index], sections[target]] = [sections[target], sections[index]];
      return { ...f, sections };
    });

  const addSection = () =>
    setForm((f) => ({
      ...f,
      sections: [...f.sections, { sectionId: newSectionId(), title: `Section ${f.sections.length + 1}`, description: '', durationMinutes: '' }],
    }));

  const removeSection = async (sectionId) => {
    const remaining = form.sections.filter((s) => s.sectionId !== sectionId);
    const count = form.questions.filter((q) => q.sectionId === sectionId).length;
    if (!remaining.length) return;
    if (count) {
      const ok = await confirmAction(`Its ${count} question${count === 1 ? '' : 's'} will move to "${remaining[0].title || 'the first section'}".`, {
        title: 'Remove this section?',
        confirmLabel: 'Remove section',
      });
      if (!ok) return;
    }
    setForm((f) => ({
      ...f,
      sections: f.sections.filter((s) => s.sectionId !== sectionId),
      questions: f.questions.map((q) => (q.sectionId === sectionId ? { ...q, sectionId: remaining[0].sectionId } : q)),
    }));
  };

  const updateQuestion = (questionId, patch) =>
    setForm((f) => {
      const current = f.questions.find((q) => q.questionId === questionId);
      if (!current) return f;
      const updated = { ...current, ...patch };
      const others = f.questions.filter((q) => q.questionId !== questionId);
      // A question moved to another section goes to the end of that section.
      return { ...f, questions: patch.sectionId && patch.sectionId !== current.sectionId ? [...others, updated] : f.questions.map((q) => (q.questionId === questionId ? updated : q)) };
    });

  const moveQuestion = (questionId, dir) =>
    setForm((f) => {
      const current = f.questions.find((q) => q.questionId === questionId);
      const peers = f.questions.map((q, i) => (q.sectionId === current.sectionId ? i : -1)).filter((i) => i >= 0);
      const pos = peers.indexOf(f.questions.indexOf(current));
      const swapWith = peers[pos + dir];
      if (swapWith === undefined) return f;
      const questions = [...f.questions];
      [questions[peers[pos]], questions[swapWith]] = [questions[swapWith], questions[peers[pos]]];
      return { ...f, questions };
    });

  const removeQuestion = (questionId) => setForm((f) => ({ ...f, questions: f.questions.filter((q) => q.questionId !== questionId) }));

  const addQuestions = (chosen, sectionId) => {
    setForm((f) => {
      const have = new Set(f.questions.map((q) => q.questionId));
      const fresh = chosen.filter((q) => !have.has(String(q._id))).map((q) => questionFromBank(q, sectionId));
      return { ...f, questions: [...f.questions, ...fresh] };
    });
    setPicker({ open: false, sectionId: null });
    notify(`Added ${chosen.length} question${chosen.length === 1 ? '' : 's'}`, 'success');
  };

  // ---- derived --------------------------------------------------------------
  const issues = useMemo(() => validate(form, { isTemplate }), [form, isTemplate]);
  const errors = issues.filter((i) => i.level === 'error');
  const totalPoints = form.questions.reduce((sum, q) => sum + effectivePoints(q), 0);
  const addedIds = useMemo(() => new Set(form.questions.map((q) => q.questionId)), [form.questions]);
  const typeCounts = useMemo(() => {
    const counts = {};
    form.questions.forEach((q) => {
      counts[q.type] = (counts[q.type] || 0) + 1;
    });
    return Object.entries(counts);
  }, [form.questions]);
  const previewHref = (id) => `${base}/questions/${id}/preview`;
  const isDraftExam = !isEdit || meta.storedStatus === 'draft';

  // ---- saving ---------------------------------------------------------------
  const save = async (action, { stay = false } = {}) => {
    if (saving) return;
    if (errors.length) {
      setShowIssues(true);
      notify(errors[0].message, 'error');
      return;
    }
    if (action === 'publish') {
      const opens = form.startTime ? `at ${new Date(form.startTime).toLocaleString(undefined, { dateStyle: 'medium', timeStyle: 'short' })}` : 'right away';
      const ok = await confirmAction(`Students in ${meta.className || 'this class'} will be able to take it ${opens}.`, {
        title: 'Publish this exam?',
        confirmLabel: 'Publish',
      });
      if (!ok) return;
    }

    const payload = buildPayload(form, { isTemplate });
    setSaving(action);
    try {
      if (isTemplate) {
        if (isEdit) await editExam(examId, payload);
        else await createExamTemplate({ ...payload, classId });
        notify(isEdit ? 'Template saved' : 'Template created', 'success');
      } else if (isEdit) {
        const status = action === 'publish' ? 'scheduled' : action === 'draft' ? 'draft' : undefined;
        await editExam(examId, status ? { ...payload, status } : payload);
        notify(action === 'publish' ? 'Exam published' : 'Changes saved', 'success');
      } else {
        const res = await createExam({ ...payload, classId, templateId: templateId || undefined, status: action === 'publish' ? 'scheduled' : 'draft' });
        notify(action === 'publish' ? 'Exam published' : 'Draft saved', 'success');
        const createdId = res?.data?._id || res?.data?.exam?._id || res?.data?.id;
        if (stay && createdId) {
          // Keep editing the exam that now exists instead of creating a second one on the next save.
          setBaseline(JSON.stringify(form));
          navigate(`${base}/classes/${classId}/exams/${createdId}/edit`, { replace: true });
          return;
        }
      }
      setBaseline(JSON.stringify(form));
      if (!stay) navigate(listPath);
    } catch (err) {
      notify(errorText(err, 'Failed to save'), 'error');
    } finally {
      setSaving('');
    }
  };

  const primaryAction = isTemplate ? 'template' : isDraftExam ? 'draft' : 'save';
  const saveRef = useRef(save);
  saveRef.current = save;

  useEffect(() => {
    const onKey = (e) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 's') {
        e.preventDefault();
        // Ctrl+S on a draft keeps the author in the builder; publishing still leaves.
        saveRef.current(primaryAction, { stay: primaryAction === 'draft' });
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [primaryAction]);

  const goBack = async () => {
    if (dirty) {
      const ok = await confirmAction('Your changes have not been saved.', { title: 'Leave without saving?', confirmLabel: 'Leave', danger: true });
      if (!ok) return;
    }
    navigate(listPath);
  };

  const heading = isTemplate ? (isEdit ? 'Edit template' : 'New exam template') : isEdit ? 'Edit exam' : 'New exam';
  const [chipKind, chipLabel] = isTemplate ? PHASE_CHIP.template : PHASE_CHIP[meta.phase] || [];

  // ---- render ---------------------------------------------------------------
  if (loadError) {
    return (
      <div className="px-4 sm:px-5 py-10 max-w-xl mx-auto">
        <EmptyState
          icon={Award}
          title="Could not open the exam builder"
          message={loadError}
          action={
            <div className="flex gap-2 justify-center">
              <Button variant="secondary" onClick={() => navigate(listPath)}>
                Back
              </Button>
              <Button onClick={() => setReloadKey((k) => k + 1)}>Try again</Button>
            </div>
          }
        />
      </div>
    );
  }

  const ordered = form.sections.map((s) => ({ section: s, questions: form.questions.filter((q) => q.sectionId === s.sectionId) }));
  let counter = 1;

  return (
    <div className="flex flex-col min-h-full">
      <div className="sticky top-0 z-30 border-b border-line bg-page/95 backdrop-blur-md">
        <div className="w-full px-4 sm:px-5 py-3 flex items-center gap-2">
          <Button variant="ghost" icon={ArrowLeft} className="h-9 w-9 justify-center p-0!" onClick={goBack} aria-label="Back" title="Back" />
          <h1 className={`${type.pageTitle} text-xl! truncate`}>{heading}</h1>
          {chipLabel && <StatusChip kind={chipKind}>{chipLabel}</StatusChip>}
          {meta.className && <span className="hidden md:inline text-xs text-muted truncate">· {meta.className}</span>}
          {dirty && <span className="hidden sm:inline text-[11px] text-warn font-semibold">Unsaved changes</span>}
          <div className="ml-auto flex items-center gap-2 shrink-0">
            {primaryAction === 'template' ? (
              <Button icon={Save} onClick={() => save('template')} disabled={loading || !!saving}>
                {saving ? 'Saving…' : 'Save template'}
              </Button>
            ) : primaryAction === 'draft' ? (
              <>
                <Button variant="secondary" icon={Save} onClick={() => save('draft')} disabled={loading || !!saving}>
                  {saving === 'draft' ? 'Saving…' : 'Save draft'}
                </Button>
                <Button icon={Send} onClick={() => save('publish')} disabled={loading || !!saving}>
                  {saving === 'publish' ? 'Publishing…' : 'Publish'}
                </Button>
              </>
            ) : (
              <Button icon={Save} onClick={() => save('save')} disabled={loading || !!saving || !dirty}>
                {saving ? 'Saving…' : 'Save changes'}
              </Button>
            )}
          </div>
        </div>
      </div>

      {loading ? (
        <div className="w-full px-4 sm:px-5 py-5 grid lg:grid-cols-[1fr_20rem] xl:grid-cols-[1fr_22rem] gap-5">
          <div className="space-y-4">
            {[1, 2, 3].map((i) => (
              <div key={i} className="h-40 rounded-2xl bg-hover animate-pulse" />
            ))}
          </div>
          <div className="h-64 rounded-2xl bg-hover animate-pulse" />
        </div>
      ) : (
        <div className="w-full px-4 sm:px-5 py-5 grid lg:grid-cols-[1fr_20rem] xl:grid-cols-[1fr_22rem] gap-5 items-start">
          <div className="space-y-5 min-w-0">
            {locked && (
              <div className="flex gap-3 rounded-2xl border border-warn-line bg-warn-soft px-4 py-3">
                <Lock className="w-4 h-4 text-warn shrink-0 mt-0.5" />
                <p className="text-xs text-body">
                  <span className="font-semibold text-fg">
                    {meta.attemptCount} student{meta.attemptCount === 1 ? ' has' : 's have'} started this exam.
                  </span>{' '}
                  Questions, points and sections are locked so everyone is graded the same way. You can still change the title,
                  description, schedule and rules.
                </p>
              </div>
            )}
            {templateId && meta.templateTitle && (
              <div className="flex gap-3 rounded-2xl border border-accent-line bg-accent-soft px-4 py-3">
                <Layers className="w-4 h-4 text-accent-ink shrink-0 mt-0.5" />
                <p className="text-xs text-body">
                  Started from the template <span className="font-semibold text-fg">{meta.templateTitle}</span>. Changes here only
                  affect this exam.
                </p>
              </div>
            )}

            <Card className="space-y-4">
              <h2 className={type.section}>Details</h2>
              <Field label="Title" htmlFor="exam-title">
                <input
                  id="exam-title"
                  value={form.title}
                  onChange={(e) => set({ title: e.target.value })}
                  maxLength={200}
                  placeholder={isTemplate ? 'e.g. Data structures midterm' : 'e.g. Week 6 quiz: arrays and strings'}
                  className={inputClass}
                  autoFocus={!isEdit && !templateId}
                />
              </Field>
              <Field label="Instructions for students" htmlFor="exam-description" hint="Shown on the start screen before the exam begins.">
                <textarea
                  id="exam-description"
                  value={form.description}
                  onChange={(e) => set({ description: e.target.value })}
                  rows={3}
                  placeholder="What to expect, allowed material, how answers are graded…"
                  className={`${inputClass} resize-y`}
                />
              </Field>
            </Card>

            <div className="space-y-3">
              <div className="flex items-center gap-2">
                <h2 className={type.section}>Questions</h2>
                <span className={type.meta}>
                  {form.questions.length} · {totalPoints} pts
                </span>
                {!locked && (
                  <div className="ml-auto flex gap-2">
                    <Button variant="secondary" icon={Plus} onClick={addSection}>
                      Add section
                    </Button>
                    <Button variant="soft" icon={ListPlus} onClick={() => openPicker()}>
                      Add questions
                    </Button>
                  </div>
                )}
              </div>
              {ordered.map(({ section, questions }, index) => {
                const firstNumber = counter;
                counter += questions.length;
                return (
                  <SectionCard
                    key={section.sectionId}
                    section={section}
                    index={index}
                    sections={form.sections}
                    questions={questions}
                    firstNumber={firstNumber}
                    locked={locked}
                    onChange={(patch) => updateSection(section.sectionId, patch)}
                    onMove={(dir) => moveSection(index, dir)}
                    onRemove={() => removeSection(section.sectionId)}
                    onAddQuestions={() => openPicker(section.sectionId)}
                    onQuestionChange={updateQuestion}
                    onQuestionMove={moveQuestion}
                    onQuestionRemove={removeQuestion}
                    previewHref={previewHref}
                  />
                );
              })}
            </div>

            <Card className="space-y-4">
              <h2 className={type.section}>{isTemplate ? 'Timing' : 'Schedule'}</h2>
              <Field label="Duration" htmlFor="exam-duration" hint="How long each student has once they start.">
                <div className="flex flex-wrap items-center gap-2">
                  <div className="relative w-32">
                    <input
                      id="exam-duration"
                      type="number"
                      min="1"
                      max="1440"
                      value={form.durationMinutes}
                      onChange={(e) => set({ durationMinutes: e.target.value })}
                      className={`${inputClass} pr-12 tabular-nums`}
                    />
                    <span className="absolute right-3 top-1/2 -translate-y-1/2 text-[11px] text-muted pointer-events-none">min</span>
                  </div>
                  {DURATION_PRESETS.map((m) => (
                    <button
                      key={m}
                      type="button"
                      onClick={() => set({ durationMinutes: m })}
                      className={`h-8 px-2.5 rounded-lg border text-[11px] font-semibold transition ${
                        Number(form.durationMinutes) === m ? 'border-accent-line bg-accent-soft text-accent-ink' : 'border-line text-muted hover:text-fg hover:bg-hover'
                      }`}
                    >
                      {m < 60 ? `${m}m` : `${m / 60}h`}
                    </button>
                  ))}
                </div>
              </Field>
              {isTemplate ? (
                <p className={type.meta}>The start and end time are set when you create an exam from this template.</p>
              ) : (
                <div className="grid sm:grid-cols-2 gap-4">
                  <Field label="Opens" htmlFor="exam-start" hint="Leave empty to open as soon as it is published.">
                    <input id="exam-start" type="datetime-local" value={form.startTime} onChange={(e) => set({ startTime: e.target.value })} className={inputClass} />
                  </Field>
                  <Field label="Closes" htmlFor="exam-end" hint="Leave empty to keep it open until you close it.">
                    <input
                      id="exam-end"
                      type="datetime-local"
                      value={form.endTime}
                      min={form.startTime || undefined}
                      onChange={(e) => set({ endTime: e.target.value })}
                      className={inputClass}
                    />
                  </Field>
                </div>
              )}
            </Card>

            <Card className="space-y-1">
              <h2 className={`${type.section} mb-1`}>Rules</h2>
              <div className="divide-y divide-line">
                <RuleRow
                  title="Require fullscreen"
                  hint="Students must stay in fullscreen. Leaving it is logged and blocks the exam until they return."
                  checked={form.fullscreenRequired}
                  onChange={(v) => set({ fullscreenRequired: v })}
                />
                <RuleRow
                  title="Block copy and paste"
                  hint="Disables copy, cut, paste and the right-click menu during the exam."
                  checked={form.copyPasteDisabled}
                  onChange={(v) => set({ copyPasteDisabled: v })}
                />
                <RuleRow
                  title="Allow running code"
                  hint="Students can run coding answers against sample tests before submitting."
                  checked={form.allowRunCode}
                  onChange={(v) => set({ allowRunCode: v })}
                />
                <RuleRow
                  title="Show scores right after submitting"
                  hint="Otherwise scores stay hidden until you release them from the report."
                  checked={form.immediateScoreRelease}
                  onChange={(v) => set({ immediateScoreRelease: v })}
                />
                <div className="flex items-start justify-between gap-4 py-3">
                  <div className="min-w-0">
                    <label htmlFor="exam-tabs" className="text-xs font-semibold text-fg">
                      Tab switch limit
                    </label>
                    <p className={`${type.meta} mt-0.5`}>The exam is submitted automatically after this many tab switches. 0 only logs them.</p>
                  </div>
                  <input
                    id="exam-tabs"
                    type="number"
                    min="0"
                    max="100"
                    value={form.tabSwitchLimit}
                    onChange={(e) => set({ tabSwitchLimit: e.target.value })}
                    className={`${inputClass} w-20! text-right tabular-nums`}
                  />
                </div>
                <RuleRow
                  title="Require Safe Exam Browser"
                  hint="Students must open the exam in Safe Exam Browser (already installed on their laptops). An entry password and an exit password are generated for you to announce in class; find them on the exam report."
                  checked={form.sebRequired}
                  onChange={(v) => set({ sebRequired: v })}
                />
                {form.sebRequired && (
                  <div className="py-3 space-y-3">
                    <div className="flex items-start justify-between gap-4">
                      <div className="min-w-0">
                        <label htmlFor="exam-seb-mode" className="text-xs font-semibold text-fg">
                          Verification
                        </label>
                        <p className={`${type.meta} mt-0.5`}>
                          Basic checks that requests come from Safe Exam Browser. Strict also checks SEB's Config Key, so only our exam
                          settings are accepted. Switch to Strict only after “Test SEB detection” on the report shows the Config Key as
                          valid on a real SEB laptop.
                        </p>
                      </div>
                      <select
                        id="exam-seb-mode"
                        value={form.sebVerifyMode}
                        onChange={(e) => set({ sebVerifyMode: e.target.value })}
                        className={`${inputClass} w-32! shrink-0`}
                      >
                        <option value="basic">Basic</option>
                        <option value="strict">Strict</option>
                      </select>
                    </div>
                    <details className="group" open={Boolean(form.sebConfigKeyOverride)}>
                      <summary className="cursor-pointer text-xs font-semibold text-muted hover:text-fg select-none">Advanced</summary>
                      <Field
                        label="Config Key override (optional)"
                        htmlFor="exam-seb-key"
                        hint="Only if Test SEB detection says the Config Key does not match: paste the Config Key that Safe Exam Browser shows for this exam's .seb file. Leave empty otherwise. Generating new passwords clears it."
                        className="mt-2"
                      >
                        <input
                          id="exam-seb-key"
                          value={form.sebConfigKeyOverride}
                          onChange={(e) => set({ sebConfigKeyOverride: e.target.value })}
                          placeholder="64 hexadecimal characters"
                          spellCheck={false}
                          autoComplete="off"
                          className={`${inputClass} font-mono`}
                        />
                      </Field>
                    </details>
                  </div>
                )}
              </div>
            </Card>
          </div>

          <aside className="space-y-4 lg:sticky lg:top-20">
            <Card className="space-y-2">
              <h2 className={type.section}>Summary</h2>
              <dl className="divide-y divide-line">
                {!isTemplate && <SummaryRow label="Class" value={meta.className || '—'} />}
                <SummaryRow label="Questions" value={form.questions.length} />
                <SummaryRow label="Total points" value={totalPoints} />
                <SummaryRow label="Sections" value={form.sections.length} />
                <SummaryRow label="Duration" value={Number(form.durationMinutes) ? `${form.durationMinutes} min` : '—'} />
                <SummaryRow label="Window" value={windowLabel(form, isTemplate)} />
              </dl>
              {typeCounts.length > 0 && (
                <div className="flex flex-wrap gap-1.5 pt-1">
                  {typeCounts.map(([t, n]) => (
                    <span key={t} className="px-2 py-0.5 rounded-md bg-inset border border-line text-[11px] text-body">
                      {TYPE_LABELS[t] || t} · {n}
                    </span>
                  ))}
                </div>
              )}
            </Card>

            <Card className="space-y-2">
              <div className="flex items-center gap-2">
                <h2 className={type.section}>Checks</h2>
                {issues.length === 0 && <CheckCircle2 className="w-4 h-4 text-ok ml-auto" />}
              </div>
              {issues.length === 0 ? (
                <p className={type.body}>Everything looks ready.</p>
              ) : (
                <ul className="space-y-2">
                  {issues.map((issue) => {
                    const Icon = issue.level === 'error' ? AlertCircle : AlertTriangle;
                    return (
                      <li key={issue.message} className="flex gap-2 text-xs">
                        <Icon className={`w-3.5 h-3.5 shrink-0 mt-0.5 ${issue.level === 'error' ? 'text-bad' : 'text-warn'}`} />
                        <span className={issue.level === 'error' && showIssues ? 'text-bad' : 'text-body'}>{issue.message}</span>
                      </li>
                    );
                  })}
                </ul>
              )}
            </Card>

            <p className={`${type.meta} flex items-center gap-1.5 px-1`}>
              <Clock className="w-3 h-3" /> Press Ctrl+S to save.
            </p>
          </aside>
        </div>
      )}

      {picker.open && (
        <QuestionPickerModal
          open
          onClose={() => setPicker({ open: false, sectionId: null })}
          bank={bank.items}
          loading={bank.loading}
          error={bank.error}
          onRetry={loadBank}
          addedIds={addedIds}
          sections={form.sections}
          defaultSectionId={picker.sectionId}
          onAdd={addQuestions}
          previewHref={previewHref}
        />
      )}
    </div>
  );
}
