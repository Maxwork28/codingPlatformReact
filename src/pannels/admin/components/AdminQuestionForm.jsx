import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { AlertCircle, ArrowLeft, Check, CircleDot, ClipboardPaste, Loader2, Save } from 'lucide-react';
import { Button, Card } from '../../../common/ui/primitives';
import { type } from '../../../common/ui/format';
import { confirmAction, notify } from '../../../common/ui/Toast';
import PasteFullQuestion from '../../../common/components/PasteFullQuestion';
import { plainTextToSlate, STARTER_STUBS } from '../../../common/utils/parsePastedQuestion';
import { errorText } from './classDetails/helpers';
import { buildPayload, defaultDriverCode, formFromQuestion, isCodingType, sectionsFor, validate } from './questionForm/model';
import { AnswerSection, BasicsSection, StatementSection } from './questionForm/basicSections';
import { CodeSection, IoSection, LanguagesSection, SolutionSection, TestsSection } from './questionForm/codingSections';

const SECTION_COMPONENTS = {
  basics: BasicsSection,
  statement: StatementSection,
  answer: AnswerSection,
  io: IoSection,
  tests: TestsSection,
  languages: LanguagesSection,
  code: CodeSection,
  solution: SolutionSection,
};

/**
 * Full-page question editor shared by "new question" and "edit question".
 * `onSave(payload)` must resolve on success and throw (string or Error) on failure.
 */
export default function AdminQuestionForm({
  initialQuestion = null,
  questionId = null,
  heading,
  badges = null,
  backTo = '/admin/questions',
  saveLabel = 'Save',
  onSave,
  extraActions,
  allowImport = false,
}) {
  const navigate = useNavigate();
  const [form, setForm] = useState(() => formFromQuestion(initialQuestion));
  const [saved, setSaved] = useState(form);
  const [editorKey, setEditorKey] = useState(0);
  const [saving, setSaving] = useState(false);
  const [showIssues, setShowIssues] = useState(false);
  const [importOpen, setImportOpen] = useState(false);
  const [active, setActive] = useState('basics');
  const scrollRef = useRef(null);

  const set = useCallback((key, value) => {
    setForm((prev) => ({ ...prev, [key]: typeof value === 'function' ? value(prev[key]) : value }));
  }, []);
  const bumpEditors = useCallback(() => setEditorKey((k) => k + 1), []);

  const payload = useMemo(() => buildPayload(form), [form]);
  const savedPayload = useMemo(() => buildPayload(saved), [saved]);
  const dirty = JSON.stringify(payload) !== JSON.stringify(savedPayload);
  const issues = useMemo(() => validate(form), [form]);
  const errors = issues.filter((i) => i.level === 'error');
  const sections = sectionsFor(form.type);
  const issuesBySection = useMemo(() => {
    const map = {};
    issues.forEach((i) => {
      (map[i.section] ||= []).push(i);
    });
    return map;
  }, [issues]);

  const scrollTo = (id) => {
    setActive(id);
    document.getElementById(`section-${id}`)?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  };

  const save = useCallback(async () => {
    if (saving) return false;
    if (errors.length) {
      setShowIssues(true);
      notify(`Fix ${errors.length} issue${errors.length === 1 ? '' : 's'} before saving`, 'error');
      document.getElementById(`section-${errors[0].section}`)?.scrollIntoView({ behavior: 'smooth', block: 'start' });
      return false;
    }
    setSaving(true);
    try {
      await onSave(payload);
      setSaved(form);
      setShowIssues(false);
      return true;
    } catch (err) {
      notify(errorText(err, 'Failed to save the question'), 'error');
      return false;
    } finally {
      setSaving(false);
    }
  }, [saving, errors, onSave, payload, form]);

  // Ctrl/Cmd+S saves; leaving the tab with unsaved work asks first.
  useEffect(() => {
    const onKey = (e) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 's') {
        e.preventDefault();
        save();
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [save]);

  useEffect(() => {
    if (!dirty) return undefined;
    const onUnload = (e) => {
      e.preventDefault();
      e.returnValue = '';
    };
    window.addEventListener('beforeunload', onUnload);
    return () => window.removeEventListener('beforeunload', onUnload);
  }, [dirty]);

  // Highlight the section in view (desktop, where the form scrolls inside its own pane).
  const onScroll = () => {
    const root = scrollRef.current;
    if (!root) return;
    const top = root.getBoundingClientRect().top;
    let current = sections[0]?.id;
    for (const s of sections) {
      const el = document.getElementById(`section-${s.id}`);
      if (el && el.getBoundingClientRect().top - top <= 80) current = s.id;
    }
    if (current && current !== active) setActive(current);
  };

  const leave = async () => {
    if (dirty && !(await confirmAction('You have unsaved changes. Leave without saving?', { title: 'Discard changes', confirmLabel: 'Discard', danger: true }))) return;
    navigate(backTo);
  };

  const changeType = async (next) => {
    if (initialQuestion?.type && initialQuestion.type !== next && form.type === initialQuestion.type) {
      const ok = await confirmAction(
        'Changing the type changes which fields are saved. Answers that only apply to the current type are removed when you save.',
        { title: 'Change question type', confirmLabel: 'Change type' },
      );
      if (!ok) return;
    }
    setForm((prev) => {
      if (next !== 'codingWithDriver') return { ...prev, type: next };
      const driver = { ...prev.driver };
      prev.languages.forEach((l) => {
        if (!String(driver[l] || '').trim()) driver[l] = defaultDriverCode(l);
      });
      return { ...prev, type: next, driver };
    });
  };

  const applyImport = (parsed) => {
    const langs = parsed.languages?.length ? parsed.languages : ['python'];
    setForm((prev) => ({
      ...prev,
      type: 'coding',
      title: parsed.title || '',
      description: plainTextToSlate(parsed.description),
      inputFormat: plainTextToSlate(parsed.inputFormat),
      outputFormat: plainTextToSlate(parsed.outputFormat),
      constraints: plainTextToSlate(parsed.constraints),
      explanation: plainTextToSlate(parsed.explanation),
      difficulty: parsed.difficulty || prev.difficulty,
      points: parsed.points !== '' && parsed.points != null ? String(parsed.points) : prev.points,
      sampleIo: parsed.sampleIo?.length ? parsed.sampleIo : prev.sampleIo,
      testCases: parsed.testCases?.length ? parsed.testCases : prev.testCases,
      languages: langs,
      starter: Object.fromEntries(
        langs.map((l) => [l, parsed.starterCode?.find((s) => s.language === l)?.code || STARTER_STUBS[l] || '']),
      ),
      solutions: Object.fromEntries((parsed.solutionCodes || []).map((s) => [s.language, s.code || ''])),
      solutionLanguage: parsed.solutionLanguage || langs[0],
    }));
    bumpEditors();
    setImportOpen(false);
    notify('Question imported. Review each section, then save.', 'success');
  };

  const onLimitsSaved = (timeLimit, memoryLimit) => {
    set('timeLimit', String(timeLimit));
    set('memoryLimit', String(memoryLimit));
    setSaved((prev) => ({ ...prev, timeLimit: String(timeLimit), memoryLimit: String(memoryLimit) }));
  };

  const sectionProps = (id) => ({
    id,
    form,
    set,
    editorKey,
    issues: issuesBySection[id] || [],
    showIssues,
    ...(id === 'basics' ? { onTypeChange: changeType } : {}),
    ...(id === 'statement' ? { bumpEditors } : {}),
    ...(id === 'solution' ? { questionId, dirty, onLimitsSaved } : {}),
  });

  const status = saving ? (
    <span className="inline-flex items-center gap-1.5 text-[11px] text-muted">
      <Loader2 className="w-3.5 h-3.5 animate-spin" /> Saving…
    </span>
  ) : dirty ? (
    <span className="inline-flex items-center gap-1.5 text-[11px] text-warn">
      <CircleDot className="w-3.5 h-3.5" /> Unsaved changes
    </span>
  ) : questionId ? (
    <span className="inline-flex items-center gap-1.5 text-[11px] text-ok">
      <Check className="w-3.5 h-3.5" /> All changes saved
    </span>
  ) : null;

  return (
    <div className="lg:h-full flex flex-col gap-4 px-4 sm:px-5 py-5">
      <header className="shrink-0 flex flex-wrap items-center gap-x-3 gap-y-2">
        <button
          type="button"
          onClick={leave}
          className="w-9 h-9 shrink-0 rounded-xl border border-line bg-surface text-muted hover:text-fg hover:bg-hover flex items-center justify-center"
          aria-label="Back"
          title="Back"
        >
          <ArrowLeft className="w-4 h-4" />
        </button>
        <h1 className={`${type.pageTitle} min-w-0 truncate max-w-full sm:max-w-[32rem]`} title={form.title || heading}>
          {form.title.trim() || heading}
        </h1>
        {badges}
        {status}
        <div className="ml-auto flex flex-wrap items-center gap-2">
          {allowImport && (
            <Button variant="ghost" icon={ClipboardPaste} className="h-9" onClick={() => setImportOpen((v) => !v)}>
              Import from text
            </Button>
          )}
          {extraActions?.({ dirty, saving, save })}
          <Button icon={saving ? Loader2 : Save} className={`h-9 ${saving ? '[&>svg]:animate-spin' : ''}`} onClick={save} disabled={saving || (!dirty && Boolean(questionId))} title="Ctrl+S">
            {saveLabel}
          </Button>
        </div>
      </header>

      <div className="flex-1 lg:min-h-0 flex gap-4">
        <nav className="hidden lg:flex w-52 shrink-0 flex-col gap-3 overflow-y-auto" aria-label="Form sections">
          <Card className="p-2">
            <ul className="space-y-0.5">
              {sections.map((s, idx) => {
                const list = issuesBySection[s.id] || [];
                const err = list.some((i) => i.level === 'error');
                const warn = list.some((i) => i.level !== 'error');
                const on = active === s.id;
                return (
                  <li key={s.id}>
                    <button
                      type="button"
                      onClick={() => scrollTo(s.id)}
                      className={`w-full flex items-center gap-2 rounded-lg px-2.5 py-2 text-xs text-left transition ${
                        on ? 'bg-accent-soft text-accent-ink font-semibold' : 'text-body hover:bg-hover'
                      }`}
                    >
                      <span
                        className={`w-5 h-5 shrink-0 rounded-full flex items-center justify-center text-[10px] font-bold ${
                          err && showIssues ? 'bg-bad-soft text-bad' : err ? 'bg-hover text-muted' : warn ? 'bg-warn-soft text-warn' : 'bg-ok-soft text-ok'
                        }`}
                      >
                        {err ? idx + 1 : warn ? '!' : <Check className="w-3 h-3" />}
                      </span>
                      <span className="truncate">{s.label}</span>
                    </button>
                  </li>
                );
              })}
            </ul>
          </Card>
          {errors.length > 0 && (
            <Card className="p-3">
              <p className="flex items-center gap-1.5 text-[11px] font-semibold text-fg mb-1.5">
                <AlertCircle className={`w-3.5 h-3.5 ${showIssues ? 'text-bad' : 'text-muted'}`} />
                {errors.length} thing{errors.length === 1 ? '' : 's'} left to fill in
              </p>
              <ul className="space-y-1">
                {errors.slice(0, 6).map((i) => (
                  <li key={`${i.section}-${i.message}`}>
                    <button type="button" onClick={() => scrollTo(i.section)} className="text-left text-[11px] text-muted hover:text-fg">
                      {i.message}
                    </button>
                  </li>
                ))}
              </ul>
            </Card>
          )}
          <p className={`${type.meta} px-1`}>Ctrl+S saves from anywhere.</p>
        </nav>

        <div ref={scrollRef} onScroll={onScroll} className="flex-1 min-w-0 lg:overflow-y-auto space-y-4 pb-16 lg:pr-1">
          <div className="lg:hidden flex gap-1.5 overflow-x-auto">
            {sections.map((s) => {
              const err = (issuesBySection[s.id] || []).some((i) => i.level === 'error');
              return (
                <button
                  key={s.id}
                  type="button"
                  onClick={() => scrollTo(s.id)}
                  className={`shrink-0 px-3 h-8 rounded-lg border text-[11px] font-semibold ${
                    err && showIssues ? 'border-bad-line text-bad bg-bad-soft' : 'border-line text-body bg-surface'
                  }`}
                >
                  {s.label}
                </button>
              );
            })}
          </div>

          {allowImport && importOpen && (
            <Card className="p-4">
              <PasteFullQuestion onApply={applyImport} />
            </Card>
          )}

          {sections.map((s) => {
            const Section = SECTION_COMPONENTS[s.id];
            return <Section key={s.id} {...sectionProps(s.id)} />;
          })}

          {isCodingType(form.type) && !questionId && (
            <p className={`${type.meta} text-center`}>Save the draft to unlock solution testing and limit benchmarking.</p>
          )}
        </div>
      </div>
    </div>
  );
}
