import React from 'react';

const CODING_TYPES = ['coding', 'fillInTheBlanksCoding', 'codingWithDriver'];

export function isCodingQuestionType(type) {
  return CODING_TYPES.includes(type);
}

function hasText(value) {
  return String(value || '').replace(/<[^>]*>/g, '').replace(/&nbsp;/gi, ' ').trim().length > 0;
}

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
    .filter((test) => test?.isPublic)
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
    section: 'border-b border-gray-100 px-6 py-4',
    heading: 'text-sm font-semibold text-gray-900',
    body: 'mt-2 text-sm text-gray-600 leading-relaxed prose prose-sm max-w-none',
    list: 'mt-2 space-y-3',
    card: 'rounded-md border border-gray-200 bg-white p-3 text-xs space-y-2',
    label: 'font-semibold text-gray-600',
    pre: 'mt-1 overflow-x-auto rounded bg-gray-900 px-3 py-2 font-mono text-gray-100 whitespace-pre-wrap',
    note: 'mt-1 text-sm text-gray-700 whitespace-pre-wrap',
  },
  statement: {
    section: '',
    heading: 'text-lg font-semibold text-gray-800 mb-2',
    body: 'text-sm text-gray-700 prose prose-sm max-w-none rounded-xl border border-gray-100 bg-gray-50/80 p-4',
    list: 'space-y-3',
    card: 'bg-gray-50 p-4 rounded-xl border border-gray-100 space-y-2',
    label: 'text-xs font-semibold text-gray-500 uppercase',
    pre: 'mt-1 text-sm text-gray-800 font-mono whitespace-pre-wrap break-all bg-white p-3 rounded-lg border border-gray-100',
    note: 'mt-1 text-sm text-gray-700 whitespace-pre-wrap',
  },
  report: {
    section: '',
    heading: 'text-sm font-medium text-gray-600',
    body: 'text-gray-800 prose prose-sm max-w-none',
    list: 'mt-2 space-y-2',
    card: 'text-sm rounded border border-gray-200 bg-gray-50 p-2 space-y-1',
    label: 'text-gray-600',
    pre: 'text-gray-900 whitespace-pre-wrap',
    note: 'text-gray-900 whitespace-pre-wrap',
  },
};

const CodingQuestionDetails = ({ question, tone = 'statement', publicTests = [] }) => {
  if (!isCodingQuestionType(question?.type)) return null;

  const styles = TONES[tone] || TONES.statement;
  const examples = examplesFromQuestion(question, publicTests);
  const sections = [
    hasText(question.inputFormat) && { title: 'Input format', html: question.inputFormat },
    hasText(question.outputFormat) && { title: 'Output format', html: question.outputFormat },
    hasText(question.constraints) && { title: 'Constraints', html: question.constraints },
  ].filter(Boolean);

  if (sections.length === 0 && examples.length === 0) return null;

  return (
    <>
      {sections.map((section) => (
        <div key={section.title} className={styles.section}>
          <h3 className={styles.heading} style={styles.headingStyle}>{section.title}</h3>
          <div
            className={styles.body}
            style={styles.bodyStyle}
            dangerouslySetInnerHTML={{ __html: section.html }}
          />
        </div>
      ))}
      {examples.length > 0 && (
        <div className={styles.section}>
          <h3 className={styles.heading} style={styles.headingStyle}>Sample input / output</h3>
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
