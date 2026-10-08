import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Bot, ChevronDown, ChevronRight, ClipboardPaste, Info, Loader2, RefreshCw, Sparkles, Trash2 } from 'lucide-react';
import Modal from '../../../../common/ui/Modal';
import { Button, EmptyState, StatusChip } from '../../../../common/ui/primitives';
import { inputClass, type } from '../../../../common/ui/format';
import { confirmAction, notify } from '../../../../common/ui/Toast';
import { LANGUAGE_LABELS, languageLabel, questionTypeLabel } from '../../../../common/domain/questions';
import {
  addAiReference,
  deleteAiReference,
  generateAiReferences,
  getAiCheckConfig,
  getAiGenerationStatus,
  listAiReferences,
  recheckExamAi,
} from '../../../../common/services/aiCheckApi';
import { errorText, formatDate, plural, selectClass } from '../classDetails/helpers';
import { refreshExamAi, useExamAi } from './aiStore';
import { AI_DISCLAIMER, aiSourceLabel } from './aiUtils';

const GENERATION_POLL_MS = 3000;
const SOURCE_KIND = { openai: 'pass', gemini: 'info', anthropic: 'warning', manual: 'ai' };

function ReferenceRow({ reference, onDelete, busy }) {
  const [expanded, setExpanded] = useState(false);
  const lines = String(reference.code || '').split('\n');
  const preview = expanded ? reference.code : lines.slice(0, 4).join('\n') + (lines.length > 4 ? '\n…' : '');
  return (
    <li className="px-3 py-2 space-y-1.5">
      <div className="flex flex-wrap items-center gap-2">
        <StatusChip kind={SOURCE_KIND[reference.source] || 'neutral'}>{aiSourceLabel(reference.source)}</StatusChip>
        <span className="text-xs font-medium text-fg">{reference.label || 'Reference'}</span>
        {reference.model && <span className={type.meta}>{reference.model}</span>}
        {reference.variant != null && <span className={type.meta}>prompt {reference.variant}</span>}
        <span className={type.meta}>
          {formatDate(reference.createdAt, true)}
          {reference.createdBy?.name ? ` · ${reference.createdBy.name}` : ''}
        </span>
        <span className="ml-auto flex items-center gap-1">
          <Button
            variant="ghost"
            icon={expanded ? ChevronDown : ChevronRight}
            className="h-7"
            onClick={() => setExpanded((v) => !v)}
            aria-expanded={expanded}
          >
            {expanded ? 'Hide' : `View ${plural(lines.length, 'line')}`}
          </Button>
          <Button variant="danger" icon={Trash2} onClick={() => onDelete(reference)} disabled={busy} title="Delete reference" aria-label="Delete reference" />
        </span>
      </div>
      <pre className={`overflow-auto rounded-lg bg-inset border border-line p-2 text-[11px] leading-relaxed text-body font-mono whitespace-pre ${expanded ? 'max-h-96' : 'max-h-24'}`}>
        {preview}
      </pre>
    </li>
  );
}

function PasteForm({ question, onAdd, busy }) {
  const defaultLanguage = question.answeredLanguages?.[0] || question.languages?.[0] || 'python';
  const [language, setLanguage] = useState(defaultLanguage);
  const [label, setLabel] = useState('');
  const [code, setCode] = useState('');
  const options = useMemo(() => [...new Set([...(question.languages || []), ...Object.keys(LANGUAGE_LABELS)])], [question.languages]);
  const submit = async (e) => {
    e.preventDefault();
    const ok = await onAdd({ questionId: question.questionId, language, label: label.trim() || undefined, code });
    if (ok) {
      setCode('');
      setLabel('');
    }
  };
  return (
    <form onSubmit={submit} className="space-y-2 rounded-xl border border-dashed border-line-strong p-3">
      <p className={type.meta}>
        Ask ChatGPT, Gemini or another assistant to solve this question the way a student would, then paste its code here.
      </p>
      <div className="flex flex-wrap gap-2">
        <select value={language} onChange={(e) => setLanguage(e.target.value)} className={selectClass} aria-label="Language">
          {options.map((l) => (
            <option key={l} value={l}>
              {languageLabel(l)}
            </option>
          ))}
        </select>
        <input
          value={label}
          onChange={(e) => setLabel(e.target.value)}
          maxLength={60}
          placeholder="Where it came from, e.g. ChatGPT"
          aria-label="Source label"
          className={`${inputClass} h-9 py-0 flex-1 min-w-40`}
        />
      </div>
      <textarea
        value={code}
        onChange={(e) => setCode(e.target.value)}
        rows={8}
        spellCheck={false}
        placeholder="Paste the AI-generated solution"
        aria-label="Reference code"
        className={`${inputClass} font-mono text-[11px] leading-relaxed`}
      />
      <div className="flex justify-end">
        <Button type="submit" icon={ClipboardPaste} disabled={busy || code.trim().length < 10}>
          {busy ? 'Adding…' : 'Add reference'}
        </Button>
      </div>
    </form>
  );
}

function QuestionCard({ index, question, stats, busyKey, onAdd, onDelete }) {
  const [pasting, setPasting] = useState(false);
  const byLanguage = useMemo(() => {
    const map = new Map(question.languages.map((l) => [l, []]));
    question.references.forEach((r) => {
      if (!map.has(r.language)) map.set(r.language, []);
      map.get(r.language).push(r);
    });
    return [...map.entries()];
  }, [question]);

  return (
    <li className="rounded-xl border border-line bg-surface">
      <div className="flex flex-wrap items-center gap-2 px-3 py-2.5 border-b border-line">
        <p className="text-sm font-semibold text-fg min-w-0 truncate">
          <span className="text-muted">{index}.</span> {question.title}
        </p>
        <span className={type.meta}>{questionTypeLabel(question.type)}</span>
        <StatusChip kind={question.references.length ? 'ai' : 'neutral'}>{plural(question.references.length, 'reference')}</StatusChip>
        {stats?.cohortMedian != null && <span className={type.meta}>class median {stats.cohortMedian}%</span>}
        {question.answeredLanguages?.length > 0 && <span className={type.meta}>answered in {question.answeredLanguages.map(languageLabel).join(', ')}</span>}
        <Button variant="soft" icon={ClipboardPaste} className="ml-auto h-7" onClick={() => setPasting((v) => !v)} aria-expanded={pasting}>
          Paste a reference
        </Button>
      </div>
      <div className="p-3 space-y-3">
        {pasting && <PasteForm question={question} busy={busyKey === `add-${question.questionId}`} onAdd={onAdd} />}
        {byLanguage.map(([language, list]) => (
          <div key={language} className="space-y-1">
            <p className="text-[11px] font-bold uppercase tracking-wider text-muted">
              {languageLabel(language)} <span className="font-normal normal-case tracking-normal text-subtle">· {plural(list.length, 'reference')}</span>
            </p>
            {list.length ? (
              <ul className="rounded-xl border border-line divide-y divide-line">
                {list.map((r) => (
                  <ReferenceRow key={r._id} reference={r} onDelete={onDelete} busy={busyKey === `delete-${r._id}`} />
                ))}
              </ul>
            ) : (
              <p className={type.meta}>No references for {languageLabel(language)} yet — answers in it cannot be scored.</p>
            )}
          </div>
        ))}
      </div>
    </li>
  );
}

function GenerationProgress({ generation }) {
  if (!generation) return null;
  const running = generation.status === 'running';
  const pct = generation.total ? Math.round((generation.completed / generation.total) * 100) : 0;
  return (
    <div className="rounded-xl border border-line bg-inset px-3 py-2 space-y-1.5">
      <div className="flex flex-wrap items-center gap-2 text-xs">
        {running ? <Loader2 className="w-3.5 h-3.5 animate-spin text-accent-ink" /> : <Sparkles className="w-3.5 h-3.5 text-muted" />}
        <span className="font-semibold text-fg">
          {running ? `Generating AI references… ${generation.completed}/${generation.total}` : `Last generation: ${plural(generation.created || 0, 'reference')} created`}
        </span>
        {generation.failed > 0 && <span className="text-warn">{plural(generation.failed, 'request')} failed</span>}
        {!running && generation.finishedAt && <span className={type.meta}>{formatDate(generation.finishedAt, true)}</span>}
      </div>
      {running && (
        <div className="h-1.5 rounded-full bg-hover overflow-hidden">
          <div className="h-full rounded-full bg-accent transition-all" style={{ width: `${pct}%` }} />
        </div>
      )}
      {generation.errors?.length > 0 && (
        <ul className="space-y-0.5">
          {generation.errors.slice(-3).map((e, i) => (
            <li key={i} className="text-[11px] text-subtle break-words">
              {e}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

/** Manager for the AI reference solutions of an exam's coding questions. */
export default function AiReferencesModal({ exam, onClose }) {
  const examId = exam._id;
  const { data: aiData } = useExamAi();
  const [list, setList] = useState(null);
  const [config, setConfig] = useState(null);
  const [generation, setGeneration] = useState(null);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState('');
  const [replace, setReplace] = useState(false);

  const load = useCallback(async () => {
    try {
      const data = await listAiReferences(examId);
      setList(data);
      setGeneration(data.generation);
      setError('');
    } catch (err) {
      setError(errorText(err, 'Failed to load AI references'));
    }
  }, [examId]);

  useEffect(() => {
    load();
    getAiCheckConfig()
      .then(setConfig)
      .catch(() => setConfig({ providers: [], anyProvider: false }));
  }, [load]);

  const running = generation?.status === 'running';
  useEffect(() => {
    if (!running) return undefined;
    const timer = setInterval(async () => {
      try {
        const { generation: g } = await getAiGenerationStatus(examId);
        setGeneration(g);
        if (g?.status !== 'running') {
          await load();
          refreshExamAi(examId);
          notify(g?.created ? `Generated ${plural(g.created, 'AI reference')}` : 'AI reference generation failed', g?.created ? 'success' : 'error');
        }
      } catch {
        /* keep polling */
      }
    }, GENERATION_POLL_MS);
    return () => clearInterval(timer);
  }, [running, examId, load]);

  const statsById = useMemo(() => new Map((aiData?.questions || []).map((q) => [String(q.questionId), q])), [aiData]);
  const providers = config?.providers || [];
  const anyProvider = Boolean(config?.anyProvider);

  const act = async (key, task, success) => {
    setBusy(key);
    try {
      const result = await task();
      if (success) notify(typeof success === 'function' ? success(result) : success, 'success');
      return result || true;
    } catch (err) {
      notify(errorText(err, 'Something went wrong'), 'error');
      return false;
    } finally {
      setBusy('');
    }
  };

  const add = async (body) => {
    const ok = await act(`add-${body.questionId}`, () => addAiReference(examId, body), (r) => (r.rechecking ? `Reference added · re-checking ${plural(r.rechecking, 'answer')}` : 'Reference added'));
    if (ok) {
      await load();
      refreshExamAi(examId);
    }
    return Boolean(ok);
  };

  const remove = async (reference) => {
    const confirmed = await confirmAction('Answers in this language will be re-scored against the remaining references.', {
      title: 'Delete this reference?',
      confirmLabel: 'Delete',
      danger: true,
    });
    if (!confirmed) return;
    const ok = await act(`delete-${reference._id}`, () => deleteAiReference(examId, reference._id), 'Reference deleted');
    if (ok) {
      await load();
      refreshExamAi(examId);
    }
  };

  const generate = async () => {
    const result = await act('generate', () => generateAiReferences(examId, { replace }), (r) => r.message);
    if (result?.generation) setGeneration(result.generation);
  };

  const recheck = async () => {
    const ok = await act('recheck', () => recheckExamAi(examId), (r) => r.message);
    if (ok) refreshExamAi(examId);
  };

  const generateHint = !config
    ? 'Loading…'
    : !anyProvider
      ? 'No AI provider key is configured on the server (OPENAI_API_KEY, GEMINI_API_KEY or ANTHROPIC_API_KEY). Paste references instead.'
      : running
        ? 'Generation in progress'
        : `Ask ${providers.filter((p) => p.enabled).map((p) => aiSourceLabel(p.id)).join(', ')} to solve every coding question in each allowed language`;

  return (
    <Modal
      open
      onClose={onClose}
      title="AI reference solutions"
      icon={Bot}
      width="max-w-4xl"
      footer={
        <Button variant="secondary" onClick={onClose}>
          Close
        </Button>
      }
    >
      <div className="flex gap-2 rounded-xl border border-info-line bg-info-soft px-3 py-2 -mt-2">
        <Info className="w-4 h-4 shrink-0 text-info mt-0.5" />
        <div className="space-y-1 text-xs text-body">
          <p>
            Coding answers are compared with solutions produced by ChatGPT, Gemini and similar tools for the same question. The
            “AI match” is the highest similarity, computed on our server (student code is never sent to an AI provider).
          </p>
          <p className="text-muted">{AI_DISCLAIMER} Nothing is penalised automatically.</p>
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        {providers.map((p) => (
          <StatusChip key={p.id} kind={p.enabled ? 'pass' : 'neutral'}>
            {aiSourceLabel(p.id)}
            {p.enabled ? ` · ${p.model}` : ' · off'}
          </StatusChip>
        ))}
        <span className="ml-auto flex flex-wrap items-center gap-2">
          <label className={`flex items-center gap-1.5 text-xs text-muted ${anyProvider ? '' : 'opacity-50'}`}>
            <input type="checkbox" checked={replace} onChange={(e) => setReplace(e.target.checked)} disabled={!anyProvider || running} className="rounded" />
            Replace existing AI-generated
          </label>
          <span title={generateHint}>
            <Button variant="soft" icon={Sparkles} className="h-9" onClick={generate} disabled={!anyProvider || running || busy === 'generate'}>
              {running ? 'Generating…' : 'Generate with AI'}
            </Button>
          </span>
          <Button variant="secondary" icon={RefreshCw} className="h-9" onClick={recheck} disabled={busy === 'recheck'} title="Score every student's latest coding answer again">
            Re-check all submissions
          </Button>
        </span>
      </div>
      {config && !anyProvider && <p className={`${type.meta} -mt-3`}>{generateHint}</p>}

      <GenerationProgress generation={generation} />

      {error ? (
        <EmptyState icon={Bot} title="Couldn't load AI references" message={error} action={<Button onClick={load}>Try again</Button>} />
      ) : !list ? (
        <div className="space-y-2">
          <div className="h-24 rounded-xl bg-hover animate-pulse" />
          <div className="h-24 rounded-xl bg-hover animate-pulse" />
        </div>
      ) : !list.questions.length ? (
        <EmptyState icon={Bot} title="No coding questions" message="AI similarity is only checked for coding questions." />
      ) : (
        <ol className="space-y-3">
          {list.questions.map((q, i) => (
            <QuestionCard
              key={q.questionId}
              index={i + 1}
              question={q}
              stats={statsById.get(String(q.questionId))}
              busyKey={busy}
              onAdd={add}
              onDelete={remove}
            />
          ))}
        </ol>
      )}
    </Modal>
  );
}
