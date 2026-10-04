import React, { useMemo, useState } from 'react';
import { Check, Copy, Eye, EyeOff, KeyRound } from 'lucide-react';
import { EmptyState } from '../../../../common/ui/primitives';
import { type } from '../../../../common/ui/format';
import QuestionHtml from '../../../../common/components/QuestionHtml';
import { buildSolutionCodesFromQuestion } from '../../../../common/utils/solutionCodes';
import { Segmented } from '../classDetails/shared';
import { copyText, hasText, isRunnable, langLabel, optionLetter, stripHtml } from './helpers';

const PREVIEW_CHARS = 300;

function Section({ title, hint, children }) {
  return (
    <section className="space-y-2">
      <div className="flex items-baseline gap-2">
        <h3 className={type.section}>{title}</h3>
        {hint && <span className={type.meta}>{hint}</span>}
      </div>
      {children}
    </section>
  );
}

function CodeBlock({ code, label, maxHeight = 'max-h-96' }) {
  if (!String(code || '').trim()) return <p className={`${type.body} italic`}>Not provided</p>;
  return (
    <div className="relative group">
      <pre className={`${maxHeight} overflow-auto rounded-xl border border-line bg-inset p-3 text-[12px] leading-relaxed font-mono text-fg whitespace-pre`}>
        {code}
      </pre>
      <button
        type="button"
        onClick={() => copyText(code, `${label || 'Code'} copied`)}
        className="absolute top-2 right-2 p-1.5 rounded-lg bg-surface border border-line text-muted hover:text-fg opacity-0 group-hover:opacity-100 focus:opacity-100 transition"
        aria-label={`Copy ${label || 'code'}`}
      >
        <Copy className="w-3.5 h-3.5" />
      </button>
    </div>
  );
}

function IoValue({ value }) {
  const [expanded, setExpanded] = useState(false);
  const text = String(value ?? '');
  const long = text.length > PREVIEW_CHARS;
  return (
    <div>
      <pre className="max-h-48 overflow-auto rounded-lg bg-inset border border-line px-2.5 py-1.5 text-[11px] font-mono text-fg whitespace-pre-wrap break-all">
        {long && !expanded ? `${text.slice(0, PREVIEW_CHARS)}…` : text || <span className="text-subtle">(empty)</span>}
      </pre>
      {long && (
        <button type="button" onClick={() => setExpanded((v) => !v)} className="mt-1 text-[11px] text-accent-ink hover:underline">
          {expanded ? 'Show less' : `Show all (${text.length.toLocaleString()} chars)`}
        </button>
      )}
    </div>
  );
}

function Options({ question }) {
  const correct = new Set(
    question.type === 'multipleCorrectMcq' ? (question.correctOptions || []).map(Number) : [Number(question.correctOption)],
  );
  return (
    <ul className="space-y-2">
      {(question.options || []).map((option, i) => {
        const ok = correct.has(i);
        return (
          <li
            key={i}
            className={`flex items-start gap-3 rounded-xl border px-3 py-2.5 ${ok ? 'border-ok-line bg-ok-soft' : 'border-line bg-surface'}`}
          >
            <span
              className={`w-6 h-6 shrink-0 rounded-lg flex items-center justify-center text-[11px] font-bold ${
                ok ? 'bg-ok text-on-accent' : 'bg-hover text-muted'
              }`}
            >
              {ok ? <Check className="w-3.5 h-3.5" /> : optionLetter(i)}
            </span>
            <QuestionHtml html={option} className="flex-1 min-w-0 text-xs text-fg prose prose-sm max-w-none" empty={<span className={type.body}>(empty)</span>} />
            {ok && <span className="text-[10px] font-bold uppercase tracking-wider text-ok shrink-0 self-center">Correct</span>}
          </li>
        );
      })}
    </ul>
  );
}

function TestCases({ tests }) {
  const [filter, setFilter] = useState('all');
  const publicCount = tests.filter((t) => t.isPublic).length;
  const shown = tests
    .map((t, i) => ({ ...t, index: i + 1 }))
    .filter((t) => filter === 'all' || (filter === 'public' ? t.isPublic : !t.isPublic));

  if (tests.length === 0) {
    return <p className="rounded-xl border border-warn-line bg-warn-soft px-3 py-2 text-xs text-warn">No test cases. Students' code cannot be graded.</p>;
  }
  return (
    <div className="space-y-2">
      <Segmented
        label="Filter test cases"
        value={filter}
        onChange={setFilter}
        options={[
          { id: 'all', label: 'All', count: tests.length },
          { id: 'public', label: 'Public', count: publicCount },
          { id: 'hidden', label: 'Hidden', count: tests.length - publicCount },
        ]}
      />
      <ul className="space-y-2">
        {shown.map((t) => (
          <li key={t.index} className="rounded-xl border border-line bg-surface p-3">
            <div className="flex flex-wrap items-center gap-2 mb-2">
              <span className="text-xs font-semibold text-fg">Test {t.index}</span>
              <span
                className={`inline-flex items-center gap-1 px-1.5 py-0.5 rounded-md border text-[10px] font-semibold ${
                  t.isPublic ? 'bg-info-soft text-info border-info-line' : 'bg-quiet-soft text-muted border-quiet-line'
                }`}
              >
                {t.isPublic ? <Eye className="w-3 h-3" /> : <EyeOff className="w-3 h-3" />}
                {t.isPublic ? 'Public' : 'Hidden'}
              </span>
              {t.isLargeTestCase && <span className="px-1.5 py-0.5 rounded-md bg-warn-soft text-warn text-[10px] font-semibold">Large</span>}
              {(t.timeLimit || t.memoryLimit) && (
                <span className={type.meta}>
                  {t.timeLimit ? `${t.timeLimit}s` : ''}
                  {t.timeLimit && t.memoryLimit ? ' · ' : ''}
                  {t.memoryLimit ? `${t.memoryLimit} MB` : ''}
                </span>
              )}
            </div>
            <div className="grid gap-2 md:grid-cols-2">
              <div>
                <p className="text-[10px] font-bold uppercase tracking-wider text-muted mb-1">Input</p>
                <IoValue value={t.input} />
              </div>
              <div>
                <p className="text-[10px] font-bold uppercase tracking-wider text-muted mb-1">Expected output</p>
                <IoValue value={t.expectedOutput} />
              </div>
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
}

function CodeByLanguage({ question }) {
  const solutions = useMemo(() => buildSolutionCodesFromQuestion(question), [question]);
  const languages = useMemo(() => {
    const set = new Set([...(question.languages || []), ...solutions.map((s) => s.language)]);
    return [...set].filter(Boolean);
  }, [question.languages, solutions]);
  const [lang, setLang] = useState(() => question.solutionLanguage || languages[0] || '');
  const active = languages.includes(lang) ? lang : languages[0];

  const pick = (list) => (list || []).find((x) => x.language === active)?.code || '';
  const solution = solutions.find((s) => s.language === active)?.code || '';
  const starter = pick(question.templateCode) || pick(question.starterCode);
  const driver = pick(question.driverCode);

  if (!languages.length) return <p className={type.body}>No languages configured.</p>;
  return (
    <div className="space-y-4">
      <Segmented
        label="Language"
        value={active}
        onChange={setLang}
        options={languages.map((l) => ({ id: l, label: `${langLabel(l)}${solutions.find((s) => s.language === l && s.code?.trim()) ? '' : ' · no solution'}` }))}
      />
      <Section title="Reference solution">
        <CodeBlock code={solution} label="Solution" />
      </Section>
      {question.type !== 'fillInTheBlanksCoding' && (
        <Section title="Starter code" hint="What students see in the editor">
          <CodeBlock code={starter} label="Starter code" maxHeight="max-h-64" />
        </Section>
      )}
      {question.type === 'codingWithDriver' && (
        <Section title="Driver code" hint="Hidden from students">
          <CodeBlock code={driver} label="Driver code" maxHeight="max-h-64" />
        </Section>
      )}
    </div>
  );
}

export default function AnswerKeyTab({ question: q }) {
  const isMcq = q.type === 'singleCorrectMcq' || q.type === 'multipleCorrectMcq';
  const hints = (q.hints || []).filter(hasText);
  const nothing =
    !isMcq && !q.correctAnswer && !isRunnable(q) && !hints.length && !hasText(q.solution) && !hasText(q.explanation);

  if (nothing) {
    return <EmptyState icon={KeyRound} title="No answer key" message="This question has no stored answer, hints or explanation." />;
  }

  return (
    <div className="space-y-6">
      {isMcq && (
        <Section title="Options" hint={q.type === 'multipleCorrectMcq' ? 'All highlighted options are required' : 'One correct option'}>
          <Options question={q} />
        </Section>
      )}

      {q.type === 'fillInTheBlanksCoding' && (
        <Section title="Code template" hint="The blank is marked // FILL_IN_THE_BLANK">
          <CodeBlock code={stripHtml(q.codeSnippet)} label="Template" maxHeight="max-h-72" />
        </Section>
      )}

      {(q.type === 'fillInTheBlanks' || q.type === 'fillInTheBlanksCoding') && (
        <Section title="Correct answer">
          {q.correctAnswer ? (
            <p className="rounded-xl border border-ok-line bg-ok-soft px-3 py-2 text-xs font-mono text-fg whitespace-pre-wrap">{q.correctAnswer}</p>
          ) : (
            <p className={`${type.body} italic`}>Not provided</p>
          )}
        </Section>
      )}

      {isRunnable(q) && (
        <>
          <Section title="Test cases">
            <TestCases tests={q.testCases || []} />
          </Section>
          <CodeByLanguage question={q} />
        </>
      )}

      {hasText(q.solution) && (
        <Section title="Solution notes">
          <QuestionHtml html={q.solution} className="rounded-xl border border-line bg-inset p-3 text-xs text-body prose prose-sm max-w-none" />
        </Section>
      )}

      {hasText(q.explanation) && !isRunnable(q) && (
        <Section title="Explanation" hint="Shown to students after answering">
          <QuestionHtml html={q.explanation} className="rounded-xl border border-line bg-inset p-3 text-xs text-body prose prose-sm max-w-none" />
        </Section>
      )}

      {hints.length > 0 && (
        <Section title="Hints" hint={`${hints.length} total`}>
          <ol className="space-y-2">
            {hints.map((h, i) => (
              <li key={i} className="flex gap-3 rounded-xl border border-line bg-surface px-3 py-2">
                <span className="text-[11px] font-bold text-accent-ink shrink-0">#{i + 1}</span>
                <QuestionHtml html={h} className="text-xs text-body prose prose-sm max-w-none" />
              </li>
            ))}
          </ol>
        </Section>
      )}
    </div>
  );
}
