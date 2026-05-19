import React from 'react';

export const parseTestCaseResultsList = (raw) => {
  if (raw == null) return [];
  if (Array.isArray(raw)) return raw;
  if (typeof raw === 'object') {
    if (Array.isArray(raw.testResults)) return raw.testResults;
    return [raw];
  }
  if (typeof raw === 'string') {
    const trimmed = raw.trim();
    if (!trimmed || trimmed.startsWith('Error:')) return [];
    try {
      const parsed = JSON.parse(trimmed);
      return Array.isArray(parsed) ? parsed : [parsed];
    } catch {
      return [];
    }
  }
  return [];
};

const formatIo = (value) => {
  if (value == null) return '—';
  return typeof value === 'string' ? value : JSON.stringify(value, null, 2);
};

/**
 * Public cases: "Test case 1 success" + input / your output / expected
 * Hidden cases: "Test case 3 passed" only (no I/O) unless showHiddenDetails is true (teacher view)
 */
const TestCaseResultsList = ({ results, className = '', showPublicIo = true, showHiddenDetails = false }) => {
  const resultArray = parseTestCaseResultsList(results);
  if (resultArray.length === 0) return null;

  return (
    <div className={`space-y-3 ${className}`}>
      {resultArray.map((result, index) => {
        const caseNum = result.testCaseNumber ?? index + 1;
        const isPublic = result.isPublic !== false;
        const showIo = showHiddenDetails || (isPublic && showPublicIo);
        const statusLabel =
          showHiddenDetails || isPublic
            ? result.passed
              ? 'success'
              : 'failed'
            : result.passed
              ? 'passed'
              : 'failed';

        return (
          <div key={`tc-${caseNum}-${index}`} className="space-y-2">
            <p
              className={`text-sm font-medium ${result.passed ? 'text-green-700' : 'text-red-700'}`}
            >
              Test case {caseNum} {statusLabel}
              {showHiddenDetails && !isPublic && (
                <span className="ml-1.5 text-xs font-normal text-gray-500">(hidden)</span>
              )}
            </p>

            {showIo && (
              <>
                {result.error && (
                  <div className="rounded-lg border border-red-100 bg-red-50/80 p-2">
                    <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-1">Error</p>
                    <pre className="text-xs text-red-600 whitespace-pre-wrap break-words">{result.error}</pre>
                  </div>
                )}
                {(result.input != null || result.output != null || result.expected != null) && (
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-2 text-xs">
                    <div className="rounded-lg border border-gray-100 bg-white p-2">
                      <p className="font-semibold text-gray-500 uppercase tracking-wider mb-1">Input</p>
                      <pre className="whitespace-pre-wrap break-words text-gray-800">{formatIo(result.input)}</pre>
                    </div>
                    <div className="rounded-lg border border-gray-100 bg-white p-2">
                      <p className="font-semibold text-gray-500 uppercase tracking-wider mb-1">Your output</p>
                      <pre className="whitespace-pre-wrap break-words text-gray-800">{formatIo(result.output)}</pre>
                    </div>
                    <div className="rounded-lg border border-gray-100 bg-white p-2">
                      <p className="font-semibold text-gray-500 uppercase tracking-wider mb-1">Expected</p>
                      <pre className="whitespace-pre-wrap break-words text-gray-800">{formatIo(result.expected)}</pre>
                    </div>
                  </div>
                )}
              </>
            )}
          </div>
        );
      })}
    </div>
  );
};

export default TestCaseResultsList;
