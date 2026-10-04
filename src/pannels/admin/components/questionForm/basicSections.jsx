import React from 'react';
import { Check, Plus, Trash2 } from 'lucide-react';
import { Button } from '../../../../common/ui/primitives';
import { inputClass, type } from '../../../../common/ui/format';
import QuestionImageAttach from '../../../../common/components/QuestionImageAttach';
import { appendImageElements } from '../../../../common/utils/questionRichTextImages';
import RichTextEditor from './RichTextEditor';
import { Field, FormSection, TagInput } from './fields';
import { QUESTION_TYPE_OPTIONS, isCodingType, newOption } from './model';

const DIFFICULTIES = [
  { id: 'easy', label: 'Easy', on: 'bg-ok-soft text-ok border-ok-line' },
  { id: 'medium', label: 'Medium', on: 'bg-warn-soft text-warn border-warn-line' },
  { id: 'hard', label: 'Hard', on: 'bg-bad-soft text-bad border-bad-line' },
];

export function BasicsSection({ form, set, onTypeChange, ...section }) {
  return (
    <FormSection {...section} title="Basics" description="Question type, difficulty and scoring.">
      <Field label="Question type">
        <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-2" role="radiogroup" aria-label="Question type">
          {QUESTION_TYPE_OPTIONS.map((t) => {
            const Icon = t.icon;
            const on = form.type === t.id;
            return (
              <button
                key={t.id}
                type="button"
                role="radio"
                aria-checked={on}
                onClick={() => !on && onTypeChange(t.id)}
                className={`flex items-start gap-2.5 rounded-xl border px-3 py-2.5 text-left transition ${
                  on ? 'border-accent bg-accent-soft' : 'border-line bg-surface hover:border-line-strong hover:bg-hover'
                }`}
              >
                <span className={`mt-0.5 w-7 h-7 shrink-0 rounded-lg flex items-center justify-center ${on ? 'bg-accent text-on-accent' : 'bg-hover text-muted'}`}>
                  <Icon className="w-3.5 h-3.5" />
                </span>
                <span className="min-w-0">
                  <span className={`block text-xs font-semibold ${on ? 'text-accent-ink' : 'text-fg'}`}>{t.label}</span>
                  <span className={`block ${type.meta}`}>{t.hint}</span>
                </span>
              </button>
            );
          })}
        </div>
      </Field>

      <div className="grid gap-4 sm:grid-cols-3">
        <Field label="Difficulty">
          <div className="flex h-9 rounded-xl border border-line bg-inset p-0.5" role="radiogroup" aria-label="Difficulty">
            {DIFFICULTIES.map((d) => (
              <button
                key={d.id}
                type="button"
                role="radio"
                aria-checked={form.difficulty === d.id}
                onClick={() => set('difficulty', d.id)}
                className={`flex-1 rounded-lg text-xs font-semibold border transition ${
                  form.difficulty === d.id ? d.on : 'border-transparent text-muted hover:text-fg'
                }`}
              >
                {d.label}
              </button>
            ))}
          </div>
        </Field>
        <Field label="Points" htmlFor="q-points" optional hint="Leave blank if it isn't scored.">
          <input id="q-points" type="number" min="0" step="any" value={form.points} onChange={(e) => set('points', e.target.value)} className={`${inputClass} h-9`} placeholder="e.g. 10" />
        </Field>
        <Field label="Max attempts" htmlFor="q-attempts" optional hint="Blank means unlimited.">
          <input id="q-attempts" type="number" min="1" step="1" value={form.maxAttempts} onChange={(e) => set('maxAttempts', e.target.value)} className={`${inputClass} h-9`} placeholder="Unlimited" />
        </Field>
      </div>

      <Field label="Tags" htmlFor="q-tags" optional hint="Press Enter or comma to add. Used for search and filtering.">
        <TagInput id="q-tags" value={form.tags} onChange={(tags) => set('tags', tags)} placeholder="e.g. arrays, sorting" />
      </Field>
    </FormSection>
  );
}

export function StatementSection({ form, set, editorKey, bumpEditors, ...section }) {
  return (
    <FormSection {...section} title="Statement" description="What students read.">
      <Field label="Title" htmlFor="q-title">
        <input
          id="q-title"
          value={form.title}
          onChange={(e) => set('title', e.target.value)}
          className={`${inputClass} h-10 text-sm! font-semibold`}
          placeholder="e.g. Two Sum"
          maxLength={200}
        />
      </Field>
      <Field label="Description" hint="Paste a screenshot straight into the editor, or upload images below.">
        <RichTextEditor
          key={`description-${editorKey}`}
          value={form.description}
          onChange={(v) => set('description', v)}
          placeholder="Describe the problem…"
          allowImages
          minHeight="min-h-48"
        />
        <QuestionImageAttach
          onUploaded={(items) => {
            set('description', (prev) => appendImageElements(prev, items));
            bumpEditors();
          }}
        />
      </Field>
      {!isCodingType(form.type) && (
        <Field label="Explanation" optional hint="Shown to students after they answer.">
          <RichTextEditor key={`explanation-${editorKey}`} value={form.explanation} onChange={(v) => set('explanation', v)} placeholder="Why the answer is correct…" />
        </Field>
      )}
    </FormSection>
  );
}

function McqOptions({ form, set, editorKey }) {
  const multi = form.type === 'multipleCorrectMcq';
  const isCorrect = (i) => (multi ? form.correctOptions.includes(i) : form.correctOption === i);

  const toggleCorrect = (i) => {
    if (!multi) set('correctOption', i);
    else set('correctOptions', (prev) => (prev.includes(i) ? prev.filter((x) => x !== i) : [...prev, i]));
  };

  const remove = (i) => {
    set('options', (prev) => prev.filter((_, idx) => idx !== i));
    if (multi) set('correctOptions', (prev) => prev.filter((x) => x !== i).map((x) => (x > i ? x - 1 : x)));
    else set('correctOption', (prev) => (prev === i ? 0 : prev > i ? prev - 1 : prev));
  };

  return (
    <Field label="Options" hint={multi ? 'Tick every correct option.' : 'Click a letter to mark the correct option.'}>
      <ul className="space-y-2">
        {form.options.map((o, i) => {
          const ok = isCorrect(i);
          return (
            <li key={o.id} className="flex items-start gap-2">
              <button
                type="button"
                onClick={() => toggleCorrect(i)}
                aria-pressed={ok}
                title={ok ? 'Correct answer' : 'Mark as correct'}
                className={`mt-1 w-8 h-8 shrink-0 ${multi ? 'rounded-lg' : 'rounded-full'} border flex items-center justify-center text-xs font-bold transition ${
                  ok ? 'bg-ok border-ok text-on-accent' : 'bg-surface border-line text-muted hover:border-ok-line hover:text-ok'
                }`}
              >
                {ok ? <Check className="w-4 h-4" /> : String.fromCharCode(65 + i)}
              </button>
              <div className="flex-1 min-w-0">
                <RichTextEditor
                  key={`${o.id}-${editorKey}`}
                  value={o.value}
                  onChange={(v) => set('options', (prev) => prev.map((x) => (x.id === o.id ? { ...x, value: v } : x)))}
                  placeholder={`Option ${String.fromCharCode(65 + i)}`}
                  compact
                  minHeight="min-h-9"
                />
              </div>
              <button
                type="button"
                onClick={() => remove(i)}
                disabled={form.options.length <= 2}
                className="mt-1 w-8 h-8 shrink-0 rounded-lg text-muted hover:text-bad hover:bg-bad-soft flex items-center justify-center disabled:opacity-30 disabled:pointer-events-none"
                aria-label={`Remove option ${String.fromCharCode(65 + i)}`}
              >
                <Trash2 className="w-4 h-4" />
              </button>
            </li>
          );
        })}
      </ul>
      <Button variant="secondary" icon={Plus} onClick={() => set('options', (prev) => [...prev, newOption()])} disabled={form.options.length >= 10}>
        Add option
      </Button>
    </Field>
  );
}

export function AnswerSection({ form, set, editorKey, ...section }) {
  const isMcq = form.type === 'singleCorrectMcq' || form.type === 'multipleCorrectMcq';
  return (
    <FormSection {...section} title="Answer" description={isMcq ? 'Options and the correct answer.' : 'The answer students must give.'}>
      {isMcq && <McqOptions form={form} set={set} editorKey={editorKey} />}
      {form.type === 'fillInTheBlanksCoding' && (
        <Field label="Code template" hint="Mark the blank with // FILL_IN_THE_BLANK. Students write the missing line.">
          <RichTextEditor key={`snippet-${editorKey}`} value={form.codeSnippet} onChange={(v) => set('codeSnippet', v)} placeholder="Code with // FILL_IN_THE_BLANK where the missing line goes" compact mono minHeight="min-h-32" />
        </Field>
      )}
      {(form.type === 'fillInTheBlanks' || form.type === 'fillInTheBlanksCoding') && (
        <Field label="Correct answer" hint={form.type === 'fillInTheBlanksCoding' ? 'The line that fills the blank.' : 'Compared with what the student types.'}>
          <RichTextEditor key={`answer-${editorKey}`} value={form.correctAnswer} onChange={(v) => set('correctAnswer', v)} placeholder="Correct answer" compact mono={form.type === 'fillInTheBlanksCoding'} minHeight="min-h-9" />
        </Field>
      )}
    </FormSection>
  );
}
