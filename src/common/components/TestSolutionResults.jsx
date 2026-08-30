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
          ? 'bg-red-50 border-red-200'
          : testResults.isCorrect
            ? 'bg-green-50 border-green-200'
            : 'bg-yellow-50 border-yellow-200'
      }`}
    >
      <div className="flex flex-wrap items-center justify-between gap-2 mb-2">
        <h4 className="text-sm font-semibold text-gray-800">
          {testResults.error ? 'Error' : 'Test Results'}
        </h4>
        {!testResults.error && (
          <div className="flex flex-wrap items-center gap-3">
            <RunMetricsBadges timeMs={summary.maxTimeMs} memoryKb={summary.maxMemoryKb} />
            {testResults.totalTestCases != null && (
              <span className={`text-xs font-semibold ${testResults.isCorrect ? 'text-green-700' : 'text-yellow-700'}`}>
                {testResults.passedTestCases}/{testResults.totalTestCases} Passed
              </span>
            )}
          </div>
        )}
      </div>
      {testResults.message && <p className="text-sm text-gray-700 mb-3">{testResults.message}</p>}
      {!testResults.error && rows.length > 0 && (
        <div className="max-h-96 overflow-y-auto">
          <TestCaseResultsList results={rows} showHiddenDetails />
        </div>
      )}
      {testResults.explanation && (
        <div
          className="mt-4 p-3 bg-gray-50 rounded text-sm text-gray-700 prose prose-sm max-w-none"
          dangerouslySetInnerHTML={{ __html: String(testResults.explanation) }}
        />
      )}
    </div>
  );
};

export default TestSolutionResults;
