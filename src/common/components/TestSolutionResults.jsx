import React from 'react';
import TestCaseResultsList, { parseTestCaseResultsList } from '../../pannels/student/components/TestCaseResultsList';
import RunMetricsBadges, { summarizeRunMetrics } from './RunMetricsBadges';

const TestSolutionResults = ({ testResults }) => {
  if (!testResults) return null;
  const rows = parseTestCaseResultsList(testResults.results || testResults.testResults || []);
  const summary = summarizeRunMetrics(rows);

  return (
    <div
      className={`mt-4 p-4 rounded-lg border ${
        testResults.error
          ? 'bg-bad-soft border-bad-line'
          : testResults.isCorrect
            ? 'bg-ok-soft border-ok-line'
            : 'bg-warn-soft border-warn-line'
      }`}
    >
      <div className="flex flex-wrap items-center justify-between gap-2 mb-2">
        <h4 className="text-sm font-semibold text-fg">
          {testResults.error ? 'Error' : 'Test Results'}
        </h4>
        {!testResults.error && (
          <div className="flex flex-wrap items-center gap-3">
            <RunMetricsBadges timeMs={summary.maxTimeMs} memoryKb={summary.maxMemoryKb} />
            {testResults.totalTestCases != null && (
              <span className={`text-xs font-semibold ${testResults.isCorrect ? 'text-ok' : 'text-warn'}`}>
                {testResults.passedTestCases}/{testResults.totalTestCases} Passed
              </span>
            )}
          </div>
        )}
      </div>
      {testResults.message && <p className="text-sm text-body mb-3">{testResults.message}</p>}
      {!testResults.error && rows.length > 0 && (
        <div className="max-h-96 overflow-y-auto">
          <TestCaseResultsList results={rows} showHiddenDetails />
        </div>
      )}
      {testResults.explanation && (
        <div
          className="mt-4 p-3 bg-inset rounded text-sm text-body prose prose-sm max-w-none"
          dangerouslySetInnerHTML={{ __html: String(testResults.explanation) }}
        />
      )}
    </div>
  );
};

export default TestSolutionResults;
