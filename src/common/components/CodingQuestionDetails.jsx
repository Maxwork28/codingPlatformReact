import React from 'react';
import { hiddenTestCaseCount, isCodingType } from '../domain/questions';
import { sanitizeHtml } from '../utils/sanitizeHtml';

function hasText(value) {
  return String(value || '').replace(/<[^>]*>/g, '').replace(/&nbsp;/gi, ' ').trim().length > 0;
}

/**
 * Students only receive the public test cases (the server strips hidden ones), so an
 * `isPublic` flag may be missing. Treat a case as public unless it is explicitly private.
 */
function examplesFromQuestion(question, publicTests) {
  const samples = (question?.sampleIo || [])
    .filter((pair) => String(pair?.input || '').trim() || String(pair?.output || '').trim())
    .map((pair) => ({
      input: pair.input || '',
      output: pair.output || '',
      explanation: pair.explanation || '',
    }));
  if (samples.length > 0) return samples;
  return (publicTests || [])
    .filter((test) => test && test.isPublic !== false)
    .filter((test) => String(test?.input || '').trim() || String(test?.expectedOutput || '').trim())
    .map((test) => ({
      input: test.input || '',
      output: test.expectedOutput || '',
      explanation: '',
    }));
}

const TONES = {
  theme: {
    section: 'mb-4 sm:mb-6',
    heading: 'text-base sm:text-lg font-semibold mb-2',
    headingStyle: { color: 'var(--text-heading)' },
    body: 'text-xs sm:text-sm leading-relaxed prose prose-sm max-w-none',
    bodyStyle: { color: 'var(--text-primary)' },
    list: 'space-y-2 sm:space-y-3',
    card: 'p-2 sm:p-3 rounded-lg border space-y-2',
    cardStyle: { backgroundColor: 'var(--background-light)', borderColor: 'var(--card-border)' },
    label: 'text-xs font-semibold',
    labelStyle: { color: 'var(--text-secondary)' },
    pre: 'text-xs sm:text-sm whitespace-pre-wrap mt-1',
    preStyle: { color: 'var(--text-primary)' },
    note: 'text-xs sm:text-sm whitespace-pre-wrap mt-1',
  },
  workspace: {
    section: 'border-b border-line px-6 py-4',
    heading: 'text-sm font-semibold text-fg',
    body: 'mt-2 text-sm text-muted leading-relaxed prose prose-sm max-w-none',
    list: 'mt-2 space-y-3',
    card: 'rounded-md border border-line bg-surface p-3 text-xs space-y-2',
    label: 'font-semibold text-muted',
    pre: 'mt-1 overflow-x-auto rounded bg-gray-900 px-3 py-2 font-mono text-gray-100 whitespace-pre-wrap',
    note: 'mt-1 text-sm text-body whitespace-pre-wrap',
  },
  statement: {
    section: '',
    heading: 'text-lg font-semibold text-fg mb-2',
    body: 'text-sm text-body prose prose-sm max-w-none rounded-xl border border-line bg-inset p-4',
    list: 'space-y-3',
    card: 'bg-inset p-4 rounded-xl border border-line space-y-2',
    label: 'text-xs font-semibold text-muted uppercase',
    pre: 'mt-1 text-sm text-fg font-mono whitespace-pre-wrap break-all bg-surface p-3 rounded-lg border border-line',
    note: 'mt-1 text-sm text-body whitespace-pre-wrap',
  },
  report: {
    section: '',
    heading: 'text-sm font-medium text-muted',
    body: 'text-fg prose prose-sm max-w-none',
    list: 'mt-2 space-y-2',
    card: 'text-sm rounded border border-line bg-inset p-2 space-y-1',
    label: 'text-muted',
    pre: 'text-fg whitespace-pre-wrap',
    note: 'text-fg whitespace-pre-wrap',
  },
};

const CodingQuestionDetails = ({ question, tone = 'statement', publicTests = [] }) => {
  if (!isCodingType(question?.type)) return null;

  const styles = TONES[tone] || TONES.statement;
  const examples = examplesFromQuestion(question, publicTests);
  const hiddenCount = hiddenTestCaseCount(question, publicTests);
  const sections = [
    hasText(question.inputFormat) && { title: 'Input format', html: question.inputFormat },
    hasText(question.outputFormat) && { title: 'Output format', html: question.outputFormat },
    hasText(question.constraints) && { title: 'Constraints', html: question.constraints },
  ].filter(Boolean);

  if (sections.length === 0 && examples.length === 0 && hiddenCount === 0) return null;

  return (
    <>
      {sections.map((section) => (
        <div key={section.title} className={styles.section}>
          <h3 className={styles.heading} style={styles.headingStyle}>{section.title}</h3>
          <div
            className={styles.body}
            style={styles.bodyStyle}
            dangerouslySetInnerHTML={{ __html: sanitizeHtml(section.html) }}
          />
        </div>
      ))}
      {(examples.length > 0 || hiddenCount > 0) && (
        <div className={styles.section}>
          <h3 className={styles.heading} style={styles.headingStyle}>Sample input / output</h3>
          {hiddenCount > 0 && (
            <p className={styles.note} style={styles.labelStyle}>
              {hiddenCount} hidden test case{hiddenCount === 1 ? '' : 's'} {examples.length > 0 ? 'also run' : 'run'} on submit.
            </p>
          )}
          <div className={styles.list}>
            {examples.map((example, index) => (
              <div key={index} className={styles.card} style={styles.cardStyle}>
                <div>
                  <span className={styles.label} style={styles.labelStyle}>Input</span>
                  <pre className={styles.pre} style={styles.preStyle}>{example.input || '—'}</pre>
                </div>
                <div>
                  <span className={styles.label} style={styles.labelStyle}>Output</span>
                  <pre className={styles.pre} style={styles.preStyle}>{example.output || '—'}</pre>
                </div>
                {String(example.explanation || '').trim() && (
                  <div>
                    <span className={styles.label} style={styles.labelStyle}>Explanation</span>
                    <p className={styles.note} style={styles.bodyStyle}>{example.explanation}</p>
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      )}
    </>
  );
};

export default CodingQuestionDetails;
