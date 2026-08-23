import React, { useState } from 'react';
import { parsePastedQuestions, summarizePastedQuestion } from '../utils/parsePastedQuestion';

const PasteFullQuestion = ({ onApply }) => {
  const [text, setText] = useState('');
  const [open, setOpen] = useState(true);
  const [message, setMessage] = useState('');
  const [parsed, setParsed] = useState([]);

  const handleParse = (applyFirst = true) => {
    const questions = parsePastedQuestions(text);
    setParsed(questions);
    if (questions.length === 0) {
      setMessage('No question found. Use labels like Title, Difficulty, Problem Statement, Input Format, Sample Input 1, Test Case Input 1, Python Code.');
      return;
    }
    if (questions.length === 1 && applyFirst) {
      onApply(questions[0]);
      setMessage(`Filled form: ${summarizePastedQuestion(questions[0])}. Review the steps, then save.`);
      return;
    }
    setMessage(`Found ${questions.length} questions. Click one to fill the form.`);
  };

  return (
    <div
      className="rounded-xl border p-4 space-y-3"
      style={{ borderColor: 'var(--card-border)', backgroundColor: 'var(--background-light)' }}
    >
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <h3 className="text-sm font-semibold" style={{ color: 'var(--text-primary)' }}>
            Paste full question
          </h3>
          <p className="text-xs mt-0.5" style={{ color: 'var(--text-secondary)' }}>
            Copy the whole dump (title, statement, samples, tests, Python/C++/Java). Numbers, strings, arrays, and multi-line I/O all work. Same box on admin and teacher create/edit.
          </p>
        </div>
        <button
          type="button"
          onClick={() => setOpen((v) => !v)}
          className="text-sm font-medium text-indigo-600 hover:text-indigo-800"
        >
          {open ? 'Hide' : 'Show paste box'}
        </button>
      </div>

      {open && (
        <>
          <textarea
            value={text}
            onChange={(e) => {
              setText(e.target.value);
              setMessage('');
            }}
            rows={10}
            className="w-full px-3 py-2 rounded-lg border font-mono text-xs focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
            style={{ backgroundColor: 'var(--card-white)', borderColor: 'var(--card-border)', color: 'var(--text-primary)' }}
            placeholder={'Title\nAll Armstrongs\nDifficulty\nEasy\nProblem Statement\n...\nInput Format\n...\nSample Input 1\n100\n999\nSample Output 1\n153 370 371 407\nTest Case Input 1\n1\n100\nTest Case Output 1\n1 2 3 4 5 6 7 8 9\nPython Code\n...'}
          />
          <div className="flex flex-wrap items-center gap-3">
            <button
              type="button"
              onClick={() => handleParse(true)}
              className="px-3 py-1.5 text-sm font-semibold text-white bg-indigo-600 rounded-lg hover:bg-indigo-700"
            >
              Parse & fill form
            </button>
            <button
              type="button"
              onClick={() => {
                setText('');
                setParsed([]);
                setMessage('');
              }}
              className="px-3 py-1.5 text-sm font-medium rounded-lg border"
              style={{ borderColor: 'var(--card-border)', color: 'var(--text-primary)' }}
            >
              Clear
            </button>
            {message && (
              <span className="text-xs" style={{ color: 'var(--text-secondary)' }}>{message}</span>
            )}
          </div>
          {parsed.length > 1 && (
            <div className="flex flex-col gap-2">
              {parsed.map((q, idx) => (
                <button
                  key={`${q.title}-${idx}`}
                  type="button"
                  onClick={() => {
                    onApply(q);
                    setMessage(`Filled form: ${summarizePastedQuestion(q)}. Review the steps, then save.`);
                  }}
                  className="text-left px-3 py-2 rounded-lg border text-sm hover:border-indigo-400"
                  style={{ borderColor: 'var(--card-border)', backgroundColor: 'var(--card-white)', color: 'var(--text-primary)' }}
                >
                  {idx + 1}. {summarizePastedQuestion(q)}
                </button>
              ))}
            </div>
          )}
        </>
      )}
    </div>
  );
};

export default PasteFullQuestion;
