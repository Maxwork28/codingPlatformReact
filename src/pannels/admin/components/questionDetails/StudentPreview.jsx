import React, { useEffect, useMemo, useState } from 'react';
import QuestionHtml from '../../../../common/components/QuestionHtml';
import CodingQuestionDetails from '../../../../common/components/CodingQuestionDetails';
import CodeEditor from '../../../student/components/CodeEditor';
import { inputClass, type } from '../../../../common/ui/format';
import { selectClass } from '../classDetails/helpers';
import { isRunnable, langLabel, optionLetter } from './helpers';

const CODING = new Set(['coding', 'codingWithDriver']);
const FILL_CODE = 'fillInTheBlanksCoding';

const languagesOf = (question) => (question?.languages?.length ? question.languages : ['javascript']);

const starterFor = (question, language) =>
  question?.starterCode?.find((s) => s.language === language)?.code ||
  question?.templateCode?.find((s) => s.language === language)?.code ||
  '';

function Choice({ letter, selected, onSelect, children, multi }) {
  return (
    <button
      type="button"
      onClick={onSelect}
      className={`w-full flex items-start gap-3 rounded-xl border px-3 py-2.5 text-left transition ${
        selected ? 'border-accent-line bg-accent-soft' : 'border-line bg-surface hover:bg-hover'
      }`}
    >
      <span
        className={`h-[18px] w-[18px] shrink-0 mt-0.5 border flex items-center justify-center text-[10px] font-bold ${
          multi ? 'rounded-md' : 'rounded-full'
        } ${selected ? 'bg-accent border-accent text-on-accent' : 'border-line-strong text-muted'}`}
      >
        {selected && multi ? '✓' : letter}
      </span>
      <div className="min-w-0 flex-1 text-sm text-fg">{children}</div>
    </button>
  );
}

export default function StudentPreview({ question }) {
  const languages = languagesOf(question);
  const [language, setLanguage] = useState(languages[0]);
  const [choice, setChoice] = useState(null);
  const [choices, setChoices] = useState(() => new Set());
  const [text, setText] = useState('');
  const [code, setCode] = useState(() => starterFor(question, languages[0]));

  // A new question starts on the first language the teacher listed, with that language's starter code.
  useEffect(() => {
    const first = languagesOf(question)[0];
    setLanguage(first);
    setChoice(null);
    setChoices(new Set());
    setText('');
    setCode(starterFor(question, first));
  }, [question]);

  const publicTests = useMemo(() => (question.testCases || []).filter((t) => t.isPublic), [question.testCases]);

  const toggleChoice = (i) =>
    setChoices((prev) => {
      const next = new Set(prev);
      if (next.has(i)) next.delete(i);
      else next.add(i);
      return next;
    });

  return (
    <div className="space-y-5">
      <p className="rounded-xl border border-info-line bg-info-soft px-3 py-2 text-xs text-info">
        This is what students see. You can try the controls here; nothing is submitted.
      </p>

      <QuestionHtml
        html={question.description}
        className="text-sm text-body leading-relaxed prose prose-sm max-w-none"
        empty={<p className={`${type.body} italic`}>No description yet.</p>}
      />

      {isRunnable(question) && <CodingQuestionDetails question={question} tone="statement" publicTests={publicTests} />}

      {question.type === 'singleCorrectMcq' && (
        <div className="space-y-2">
          <h3 className={type.section}>Select one</h3>
          {(question.options || []).map((option, i) => (
            <Choice key={i} letter={optionLetter(i)} selected={choice === i} onSelect={() => setChoice(i)}>
              <QuestionHtml html={option} empty={<span className="text-subtle">Empty option</span>} />
            </Choice>
          ))}
        </div>
      )}

      {question.type === 'multipleCorrectMcq' && (
        <div className="space-y-2">
          <h3 className={type.section}>Select all that apply</h3>
          {(question.options || []).map((option, i) => (
            <Choice key={i} letter={optionLetter(i)} selected={choices.has(i)} onSelect={() => toggleChoice(i)} multi>
              <QuestionHtml html={option} empty={<span className="text-subtle">Empty option</span>} />
            </Choice>
          ))}
        </div>
      )}

      {question.type === 'fillInTheBlanks' && (
        <div className="space-y-1.5">
          <label htmlFor="preview-answer" className={type.section}>
            Your answer
          </label>
          <textarea
            id="preview-answer"
            value={text}
            onChange={(e) => setText(e.target.value)}
            rows={3}
            placeholder="Type the answer a student would enter"
            className={`${inputClass} resize-y field-box`}
          />
        </div>
      )}

      {question.type === FILL_CODE && (
        <div className="space-y-3">
          {question.codeSnippet && (
            <pre className="rounded-xl border border-line bg-inset p-3 text-[12px] leading-relaxed font-mono text-fg whitespace-pre-wrap">
              {question.codeSnippet}
            </pre>
          )}
          <div className="space-y-1.5">
            <label htmlFor="preview-blank" className={type.section}>
              Line for the blank
            </label>
            <textarea
              id="preview-blank"
              value={text}
              onChange={(e) => setText(e.target.value)}
              rows={3}
              placeholder="Replaces // FILL_IN_THE_BLANK"
              className={`${inputClass} resize-y field-box font-mono`}
            />
          </div>
        </div>
      )}

      {CODING.has(question.type) && (
        <div className="space-y-3">
          {languages.length > 1 && (
            <label className="flex items-center gap-2 text-xs text-muted">
              Language
              <select
                value={language}
                onChange={(e) => {
                  setLanguage(e.target.value);
                  setCode(starterFor(question, e.target.value));
                }}
                className={selectClass}
                aria-label="Language"
              >
                {languages.map((l) => (
                  <option key={l} value={l}>
                    {langLabel(l)}
                  </option>
                ))}
              </select>
            </label>
          )}
          {question.type === 'codingWithDriver' && (
            <p className={`${type.meta}`}>Students complete the stub. The hidden driver and tests run around it.</p>
          )}
          <div className="field-box rounded-xl border border-line overflow-hidden">
            <CodeEditor value={code} onChange={setCode} language={language} height="360px" />
          </div>
        </div>
      )}
    </div>
  );
}
