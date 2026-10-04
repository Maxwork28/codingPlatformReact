import React, { useMemo, useRef, useState } from 'react';
import { FlaskConical, Loader2, RotateCcw } from 'lucide-react';
import { teacherTestQuestion } from '../../../../common/services/api';
import { Button } from '../../../../common/ui/primitives';
import { type } from '../../../../common/ui/format';
import AuthorCodeEditor from '../questionForm/AuthorCodeEditor';
import TestSolutionResults from '../../../../common/components/TestSolutionResults';
import TestSolutionLimitControls from '../../../../common/components/TestSolutionLimitControls';
import { buildSolutionCodesFromQuestion, hasSavedSolution, solutionCodeForLanguage } from '../../../../common/utils/solutionCodes';
import { errorText, selectClass } from '../classDetails/helpers';
import { langLabel } from './helpers';

/** Runs the stored (or edited) reference solution against every test case without creating a submission. */
export default function TestSolutionTab({ question, classId, onLimitsSaved }) {
  const saved = useMemo(() => buildSolutionCodesFromQuestion(question), [question]);
  const [codes, setCodes] = useState(saved);
  const languages = question.languages?.length ? question.languages : saved.map((s) => s.language);
  const [language, setLanguage] = useState(
    () => question.solutionLanguage || saved.find((s) => s.code?.trim())?.language || languages[0] || 'javascript',
  );
  const [testing, setTesting] = useState(false);
  const [results, setResults] = useState(null);
  const limitOptionsRef = useRef(null);

  const code = solutionCodeForLanguage(codes, language);
  const savedCode = solutionCodeForLanguage(saved, language);
  const tests = question.testCases || [];
  const publicCount = tests.filter((t) => t.isPublic).length;

  const setCode = (next) =>
    setCodes((prev) =>
      prev.some((s) => s.language === language)
        ? prev.map((s) => (s.language === language ? { ...s, code: next } : s))
        : [...prev, { language, code: next }],
    );

  const runTests = async () => {
    setTesting(true);
    setResults(null);
    try {
      const { data } = await teacherTestQuestion(question._id, code, classId || null, language, limitOptionsRef.current || {});
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

  const blocked = !tests.length
    ? 'Add at least one test case before testing.'
    : tests.some((t) => !String(t.input ?? '').trim() || !String(t.expectedOutput ?? '').trim())
      ? 'Some test cases are missing input or expected output.'
      : '';

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-2">
        <select
          value={language}
          onChange={(e) => {
            setLanguage(e.target.value);
            setResults(null);
          }}
          className={selectClass}
          aria-label="Solution language"
        >
          {languages.map((l) => (
            <option key={l} value={l}>
              {langLabel(l)}
              {hasSavedSolution(saved, l) ? '' : ' (no saved solution)'}
            </option>
          ))}
        </select>
        <span className={type.meta}>
          Runs against {tests.length} test cases ({publicCount} public · {tests.length - publicCount} hidden). Nothing is saved.
        </span>
        <div className="ml-auto flex items-center gap-2">
          {code !== savedCode && (
            <Button variant="ghost" icon={RotateCcw} className="h-9" onClick={() => setCode(savedCode)}>
              Reset
            </Button>
          )}
          <Button icon={testing ? Loader2 : FlaskConical} className={`h-9 ${testing ? '[&>svg]:animate-spin' : ''}`} onClick={runTests} disabled={testing || !code.trim() || Boolean(blocked)}>
            {testing ? 'Running…' : 'Run tests'}
          </Button>
        </div>
      </div>

      {blocked && <p className="rounded-xl border border-warn-line bg-warn-soft px-3 py-2 text-xs text-warn">{blocked}</p>}

      <div className="rounded-xl border border-line overflow-hidden">
        <AuthorCodeEditor key={`${question._id}-${language}`} name="test-solution" value={code} onChange={setCode} language={language} height="420px" />
      </div>

      <TestSolutionLimitControls
        question={question}
        testResults={results}
        optionsRef={limitOptionsRef}
        getBenchmarkPayload={() => ({ questionId: question._id, answer: code, classId: classId || null, language })}
        onSaved={onLimitsSaved}
      />

      {results && <TestSolutionResults testResults={results} />}
    </div>
  );
}
