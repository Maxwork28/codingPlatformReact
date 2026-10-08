import React from 'react';
import { Clock } from 'lucide-react';
import Modal from '../../../../common/ui/Modal';
import { Button, StatusChip } from '../../../../common/ui/primitives';
import TestCaseResultsList from '../../../student/components/TestCaseResultsList';
import RunMetricsBadges from '../../../../common/components/RunMetricsBadges';
import { summarizeRunMetrics } from '../../../../common/utils/runMetrics';
import { formatHistoryTime, historyKindLabel } from '../../../../common/utils/runOutputHistory';

function ResultsBody({ testResults }) {
  if (!testResults) return null;
  if (testResults.error) {
    return <p className="text-xs text-bad bg-bad-soft border border-bad-line rounded-xl px-3 py-2">{testResults.message}</p>;
  }
  if (testResults.isCorrect != null && !testResults.isCustomTest && !(testResults.testResults?.length)) {
    return (
      <div className="space-y-2">
        <StatusChip kind={testResults.isCorrect ? 'ok' : 'bad'}>{testResults.isCorrect ? 'Correct' : 'Incorrect'}</StatusChip>
        {testResults.explanation ? <p className="text-xs text-body whitespace-pre-wrap">{testResults.explanation}</p> : null}
      </div>
    );
  }
  if (testResults.isCustomTest) {
    return (
      <div className="space-y-2">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
          <div className="p-2 rounded-xl border border-line bg-inset">
            <p className="text-[11px] font-semibold text-muted mb-1">Input</p>
            <pre className="whitespace-pre-wrap text-fg">{testResults.customInput}</pre>
          </div>
          <div className="p-2 rounded-xl border border-line bg-inset">
            <p className="text-[11px] font-semibold text-muted mb-1">Actual output</p>
            <pre className="whitespace-pre-wrap text-fg">{testResults.actualOutput}</pre>
          </div>
        </div>
        {testResults.expectedOutput && (
          <div className="p-2 rounded-xl border border-line bg-inset">
            <p className="text-[11px] font-semibold text-muted mb-1">Expected output</p>
            <pre className="whitespace-pre-wrap text-fg">{testResults.expectedOutput}</pre>
            <p className={`mt-2 text-xs font-semibold ${testResults.passed ? 'text-ok' : 'text-bad'}`}>
              {testResults.passed ? 'Output matches expected' : 'Output does not match expected'}
            </p>
          </div>
        )}
        <RunMetricsBadges result={testResults} className="pt-1" />
      </div>
    );
  }
  return (
    <div className="space-y-2">
      <TestCaseResultsList results={testResults.testResults} className="p-2 bg-inset rounded-xl border border-line" showHiddenDetails />
      {testResults.testResults && (
        <RunMetricsBadges
          timeMs={summarizeRunMetrics(testResults.testResults).maxTimeMs}
          memoryKb={summarizeRunMetrics(testResults.testResults).maxMemoryKb}
          className="pt-1"
        />
      )}
    </div>
  );
}

export default function ResultsModal({
  open,
  view,
  history,
  testResults,
  kind,
  onClose,
  onOpenHistory,
  onOpenEntry,
}) {
  const title =
    view === 'list'
      ? 'Run history'
      : testResults?.error
        ? 'Error'
        : testResults?.isCustomTest
          ? 'Custom test results'
          : kind === 'submit'
            ? 'Submit results'
            : 'Test results';

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={title}
      width="max-w-lg"
      footer={
        view === 'detail' && history.length > 0 ? (
          <Button variant="secondary" icon={Clock} onClick={onOpenHistory}>
            History
          </Button>
        ) : null
      }
    >
      {view === 'list' ? (
        history.length === 0 ? (
          <p className="text-xs text-muted">No runs yet for this question.</p>
        ) : (
          <div className="space-y-2">
            {history.map((entry) => (
              <button
                key={entry.id}
                type="button"
                onClick={() => onOpenEntry(entry)}
                className="w-full text-left rounded-xl border border-line bg-inset px-3 py-2 hover:border-accent-line transition"
              >
                <div className="flex items-center justify-between gap-2">
                  <span className="text-[11px] font-semibold uppercase tracking-wide text-muted">
                    {historyKindLabel(entry.kind)}
                  </span>
                  <span className="text-[11px] text-muted">{formatHistoryTime(entry.at)}</span>
                </div>
                <p className={`text-xs font-semibold mt-0.5 ${entry.failed ? 'text-bad' : 'text-ok'}`}>{entry.summary}</p>
              </button>
            ))}
          </div>
        )
      ) : (
        <div className="space-y-3">
          {!testResults?.error && !testResults?.isCustomTest && testResults?.totalTestCases != null && (
            <StatusChip kind={testResults.isCorrect ? 'ok' : 'warn'}>
              {testResults.passedTestCases}/{testResults.totalTestCases} passed
            </StatusChip>
          )}
          <ResultsBody testResults={testResults} />
        </div>
      )}
    </Modal>
  );
}
