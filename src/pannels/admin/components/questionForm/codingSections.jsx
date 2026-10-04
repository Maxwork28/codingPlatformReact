import React, { useRef, useState } from 'react';
import { Check, FlaskConical, Info, Loader2, Wand2 } from 'lucide-react';
import { teacherTestQuestion } from '../../../../common/services/api';
import { Button } from '../../../../common/ui/primitives';
import { inputClass, type } from '../../../../common/ui/format';
import BulkIoPairsEditor from '../../../../common/components/BulkIoPairsEditor';
import TestSolutionResults from '../../../../common/components/TestSolutionResults';
import TestSolutionLimitControls from '../../../../common/components/TestSolutionLimitControls';
import { errorText } from '../classDetails/helpers';
import { langLabel } from '../questionDetails/helpers';
import RichTextEditor from './RichTextEditor';
import { Field, FormSection, LanguageCodeEditor } from './fields';
import { LANGUAGES, defaultDriverCode } from './model';

export function IoSection({ form, set, editorKey, ...section }) {
  return (
    <FormSection {...section} title="Input & output" description="How the program reads input and prints its answer, with worked samples.">
      <div className="grid gap-4 xl:grid-cols-2">
        <Field label="Input format" optional>
          <RichTextEditor key={`in-${editorKey}`} value={form.inputFormat} onChange={(v) => set('inputFormat', v)} placeholder="First line: n. Second line: n integers." compact />
        </Field>
        <Field label="Output format" optional>
          <RichTextEditor key={`out-${editorKey}`} value={form.outputFormat} onChange={(v) => set('outputFormat', v)} placeholder="Print a single integer." compact />
        </Field>
      </div>
      <Field label="Constraints" optional>
        <RichTextEditor key={`constraints-${editorKey}`} value={form.constraints} onChange={(v) => set('constraints', v)} placeholder="1 ≤ n ≤ 10^5" compact />
      </Field>
      <Field label="Samples" hint="Shown to students with their explanation. Blank rows are ignored.">
        <BulkIoPairsEditor
          items={form.sampleIo}
          onChange={(items) => set('sampleIo', items)}
          emptyItem={{ input: '', output: '', explanation: '' }}
          inputKey="input"
          outputKey="output"
          explanationKey="explanation"
          minItems={1}
          addLabel="Add sample"
        />
      </Field>
    </FormSection>
  );
}

export function TestsSection({ form, set, ...section }) {
  const total = form.testCases.length;
  const publicCount = form.testCases.filter((t) => t.isPublic).length;
  const large = form.testCases.filter((t) => t.isLargeTestCase).length;
  const summary = (
    <div className="flex flex-wrap gap-1.5 text-[11px]">
      <span className="px-2 py-0.5 rounded-md bg-hover text-body">{total} total</span>
      <span className="px-2 py-0.5 rounded-md bg-info-soft text-info">{publicCount} public</span>
      <span className="px-2 py-0.5 rounded-md bg-quiet-soft text-muted">{total - publicCount} hidden</span>
      {large > 0 && <span className="px-2 py-0.5 rounded-md bg-warn-soft text-warn">{large} large</span>}
    </div>
  );
  return (
    <FormSection {...section} title="Test cases" description="Used to grade submissions. Public cases are shown to students; hidden ones are not." action={summary}>
      <BulkIoPairsEditor
        items={form.testCases}
        onChange={(items) => set('testCases', items)}
        emptyItem={{ input: '', expectedOutput: '', isPublic: false, isLargeTestCase: false }}
        inputKey="input"
        outputKey="expectedOutput"
        showFlags
        minItems={1}
        addLabel="Add test case"
      />
    </FormSection>
  );
}

export function LanguagesSection({ form, set, ...section }) {
  const toggle = (lang) => {
    const on = form.languages.includes(lang);
    set('languages', (prev) => (on ? prev.filter((l) => l !== lang) : [...prev, lang]));
    if (!on && form.type === 'codingWithDriver' && !String(form.driver[lang] || '').trim()) {
      set('driver', (prev) => ({ ...prev, [lang]: defaultDriverCode(lang) }));
    }
  };
  return (
    <FormSection {...section} title="Languages & limits" description="Languages students can submit in, and the run limits for each test.">
      <Field label="Languages" hint="Code you wrote for a language is kept if you untick it and tick it again.">
        <div className="flex flex-wrap gap-1.5">
          {LANGUAGES.map((lang) => {
            const on = form.languages.includes(lang);
            return (
              <button
                key={lang}
                type="button"
                aria-pressed={on}
                onClick={() => toggle(lang)}
                className={`inline-flex items-center gap-1.5 h-8 px-3 rounded-lg border text-xs font-semibold transition ${
                  on ? 'bg-accent-soft text-accent-ink border-accent-line' : 'bg-surface text-muted border-line hover:text-fg hover:border-line-strong'
                }`}
              >
                {on && <Check className="w-3.5 h-3.5" />}
                {langLabel(lang)}
              </button>
            );
          })}
        </div>
      </Field>
      <div className="grid gap-4 sm:grid-cols-2 max-w-md">
        <Field label="Time limit" htmlFor="q-time" hint="Seconds per test case.">
          <input id="q-time" type="number" min="0.1" max="10" step="0.1" value={form.timeLimit} onChange={(e) => set('timeLimit', e.target.value)} className={`${inputClass} h-9`} />
        </Field>
        <Field label="Memory limit" htmlFor="q-memory" hint="Megabytes.">
          <input id="q-memory" type="number" min="16" max="1024" step="1" value={form.memoryLimit} onChange={(e) => set('memoryLimit', e.target.value)} className={`${inputClass} h-9`} />
        </Field>
      </div>
    </FormSection>
  );
}

export function CodeSection({ form, set, ...section }) {
  const driver = form.type === 'codingWithDriver';
  return (
    <FormSection
      {...section}
      title={driver ? 'Stub & driver' : 'Starter code'}
      description={driver ? 'Students complete the stub. The hidden driver reads input, calls their code and prints the result.' : 'What students see in the editor when they open the question.'}
    >
      <Field label={driver ? 'Function stub' : 'Starter code'}>
        <LanguageCodeEditor
          languages={form.languages}
          values={form.starter}
          onChange={(lang, code) => set('starter', (prev) => ({ ...prev, [lang]: code }))}
          height="280px"
        />
      </Field>
      {driver && (
        <Field label="Driver code" hint="Hidden from students. Put {{USER_CODE}} (or // USER_CODE_HERE, # USER_CODE_HERE) where their code is inserted.">
          <LanguageCodeEditor
            languages={form.languages}
            values={form.driver}
            onChange={(lang, code) => set('driver', (prev) => ({ ...prev, [lang]: code }))}
            height="260px"
            emptyHint={(lang) => (
              <Button variant="ghost" icon={Wand2} onClick={() => set('driver', (prev) => ({ ...prev, [lang]: defaultDriverCode(lang) }))}>
                Insert a {langLabel(lang)} driver template
              </Button>
            )}
          />
        </Field>
      )}
    </FormSection>
  );
}

export function SolutionSection({ form, set, questionId, dirty, onLimitsSaved, ...section }) {
  const [testing, setTesting] = useState(false);
  const [results, setResults] = useState(null);
  const limitOptionsRef = useRef(null);
  const language = form.languages.includes(form.solutionLanguage) ? form.solutionLanguage : form.languages[0];
  const code = form.solutions[language] || '';

  const run = async () => {
    setTesting(true);
    setResults(null);
    try {
      const { data } = await teacherTestQuestion(questionId, code, null, language, limitOptionsRef.current || {});
      const { testResults, passedTestCases, totalTestCases, isCorrect, publicTestCases, hiddenTestCases } = data;
      setResults({
        message: isCorrect
          ? `All ${totalTestCases} test cases passed (${publicTestCases} public, ${hiddenTestCases} hidden)`
          : `${passedTestCases}/${totalTestCases} test cases passed (${publicTestCases} public, ${hiddenTestCases} hidden)`,
        results: testResults,
        totalTestCases,
        passedTestCases,
        isCorrect,
        publicTestCases,
        hiddenTestCases,
      });
    } catch (err) {
      setResults({ error: true, message: `Error: ${errorText(err, 'Failed to run the tests')}` });
    } finally {
      setTesting(false);
    }
  };

  return (
    <FormSection
      {...section}
      title="Solution"
      description="Reference solution for each language. Used to check the test cases and tune limits; never shown to students."
      action={
        <Button
          icon={testing ? Loader2 : FlaskConical}
          className={`h-9 ${testing ? '[&>svg]:animate-spin' : ''}`}
          onClick={run}
          disabled={!questionId || testing || !code.trim()}
          title={!questionId ? 'Save the draft first' : undefined}
        >
          {testing ? 'Running…' : `Run ${langLabel(language)} solution`}
        </Button>
      }
    >
      {(!questionId || dirty) && (
        <p className="flex items-start gap-2 rounded-xl border border-info-line bg-info-soft px-3 py-2 text-[11px] text-info">
          <Info className="w-3.5 h-3.5 mt-px shrink-0" />
          {!questionId
            ? 'Save the draft once to run the solution against the test cases.'
            : 'Tests run against the last saved test cases and limits. Save first to include your latest edits.'}
        </p>
      )}
      <LanguageCodeEditor
        languages={form.languages}
        values={form.solutions}
        onChange={(lang, next) => set('solutions', (prev) => ({ ...prev, [lang]: next }))}
        active={language}
        onActiveChange={(lang) => {
          set('solutionLanguage', lang);
          setResults(null);
        }}
        height="340px"
      />
      {questionId && (
        <TestSolutionLimitControls
          question={{ _id: questionId, type: form.type, timeLimit: Number(form.timeLimit), memoryLimit: Number(form.memoryLimit) }}
          testResults={results}
          optionsRef={limitOptionsRef}
          getBenchmarkPayload={() => ({ questionId, answer: code, classId: null, language })}
          onSaved={onLimitsSaved}
        />
      )}
      {results && <TestSolutionResults testResults={results} />}
      {!questionId && <p className={type.meta}>Limit benchmarking is available after the first save.</p>}
    </FormSection>
  );
}
