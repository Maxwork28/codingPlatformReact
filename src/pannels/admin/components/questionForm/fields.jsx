import React, { useState } from 'react';
import { AlertCircle, AlertTriangle, X } from 'lucide-react';
import { Card } from '../../../../common/ui/primitives';
import { inputClass, type } from '../../../../common/ui/format';
import AuthorCodeEditor from './AuthorCodeEditor';
import { langLabel } from '../questionDetails/helpers';

export function FormSection({ id, title, description, issues = [], showIssues, action, children }) {
  const errors = issues.filter((i) => i.level === 'error');
  const warnings = issues.filter((i) => i.level !== 'error');
  const visible = [...(showIssues ? errors : []), ...warnings];
  return (
    <Card id={`section-${id}`} className={`p-4 sm:p-5 scroll-mt-4 ${showIssues && errors.length ? 'border-bad-line!' : ''}`}>
      <div className="flex flex-wrap items-start gap-2 mb-4">
        <div className="min-w-0 flex-1">
          <h2 className={type.cardTitle}>{title}</h2>
          {description && <p className={type.subtitle}>{description}</p>}
        </div>
        {action}
      </div>
      {visible.length > 0 && (
        <ul className="mb-4 space-y-1">
          {visible.map((i) => (
            <li
              key={i.message}
              className={`flex items-center gap-2 rounded-lg px-2.5 py-1.5 text-[11px] border ${
                i.level === 'error' ? 'bg-bad-soft text-bad border-bad-line' : 'bg-warn-soft text-warn border-warn-line'
              }`}
            >
              {i.level === 'error' ? <AlertCircle className="w-3.5 h-3.5 shrink-0" /> : <AlertTriangle className="w-3.5 h-3.5 shrink-0" />}
              {i.message}
            </li>
          ))}
        </ul>
      )}
      <div className="space-y-5">{children}</div>
    </Card>
  );
}

export function Field({ label, hint, htmlFor, optional, children, className = '' }) {
  return (
    <div className={`space-y-1.5 ${className}`}>
      {label && (
        <label htmlFor={htmlFor} className="flex items-baseline gap-2 text-xs font-semibold text-body">
          {label}
          {optional && <span className="font-normal text-subtle">Optional</span>}
        </label>
      )}
      {children}
      {hint && <p className={type.meta}>{hint}</p>}
    </div>
  );
}

export function TagInput({ id, value, onChange, placeholder }) {
  const [draft, setDraft] = useState('');
  const commit = (raw) => {
    const next = raw
      .split(',')
      .map((t) => t.trim())
      .filter(Boolean)
      .filter((t, i, all) => all.indexOf(t) === i && !value.some((v) => v.toLowerCase() === t.toLowerCase()));
    if (next.length) onChange([...value, ...next]);
    setDraft('');
  };
  return (
    <div className={`${inputClass} field-box flex flex-wrap items-center gap-1.5 py-1.5! min-h-9 focus-within:border-accent`}>
      {value.map((tag) => (
        <span key={tag} className="inline-flex items-center gap-1 pl-2 pr-1 py-0.5 rounded-md bg-accent-soft text-accent-ink text-[11px] font-medium">
          {tag}
          <button type="button" onClick={() => onChange(value.filter((t) => t !== tag))} className="p-0.5 rounded hover:bg-accent/20" aria-label={`Remove ${tag}`}>
            <X className="w-3 h-3" />
          </button>
        </span>
      ))}
      <input
        id={id}
        value={draft}
        onChange={(e) => (e.target.value.includes(',') ? commit(e.target.value) : setDraft(e.target.value))}
        onKeyDown={(e) => {
          if (e.key === 'Enter') {
            e.preventDefault();
            commit(draft);
          } else if (e.key === 'Backspace' && !draft && value.length) {
            onChange(value.slice(0, -1));
          }
        }}
        onBlur={() => draft.trim() && commit(draft)}
        placeholder={value.length ? '' : placeholder}
        className="flex-1 min-w-24 bg-transparent outline-none text-xs text-fg"
      />
    </div>
  );
}

/** One code editor with a tab per language. `values` maps language → code. */
export function LanguageCodeEditor({ languages, values, onChange, active, onActiveChange, height = '320px', marker, emptyHint }) {
  const [localActive, setLocalActive] = useState(languages[0]);
  const current = active ?? localActive;
  const selected = languages.includes(current) ? current : languages[0];
  const select = onActiveChange || setLocalActive;

  if (!languages.length) return <p className={`${type.body} italic`}>Pick at least one language first.</p>;
  return (
    <div className="rounded-xl border border-line overflow-hidden">
      <div className="flex items-center gap-0.5 overflow-x-auto bg-inset border-b border-line px-1.5 pt-1.5" role="tablist">
        {languages.map((lang) => {
          const filled = String(values[lang] || '').trim().length > 0;
          const on = lang === selected;
          return (
            <button
              key={lang}
              type="button"
              role="tab"
              aria-selected={on}
              onClick={() => select(lang)}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-t-lg text-[11px] font-semibold whitespace-nowrap border border-b-0 transition ${
                on ? 'bg-surface text-fg border-line' : 'border-transparent text-muted hover:text-fg'
              }`}
            >
              <span className={`w-1.5 h-1.5 rounded-full ${filled ? (marker ? marker(lang) : 'bg-ok') : 'bg-line-strong'}`} />
              {langLabel(lang)}
            </button>
          );
        })}
      </div>
      {!String(values[selected] || '').trim() && emptyHint && <div className="px-3 py-2 border-b border-line bg-surface">{emptyHint(selected)}</div>}
      <AuthorCodeEditor
        key={selected}
        name={`code-${selected}`}
        value={values[selected] || ''}
        onChange={(code) => onChange(selected, code ?? '')}
        language={selected}
        height={height}
      />
    </div>
  );
}
