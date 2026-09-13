import React, { useEffect, useState } from 'react';
import { parseTestCaseResultsList } from '../../pannels/student/components/TestCaseResultsList';
import { summarizeRunMetrics } from './RunMetricsBadges';
import { teacherTestQuestion, updateQuestionLimits } from '../services/api';

const TIME_MIN = 0.1;
const TIME_MAX = 5;
const MEMORY_MIN = 16;
const MEMORY_MAX = 1024;

const parseLooseNumber = (value) => {
  const match = String(value ?? '').trim().replace(/,/g, '').match(/-?\d+(\.\d+)?/);
  return match ? Number(match[0]) : NaN;
};

/** Seconds: 1 decimal, 0.1–5. Values above 5 are treated as milliseconds (paste 61.6). */
const interpretTimeSeconds = (value) => {
  const n = parseLooseNumber(value);
  if (!Number.isFinite(n) || n <= 0) return 2;
  const seconds = n > TIME_MAX ? n / 1000 : n;
  return Math.min(TIME_MAX, Math.max(TIME_MIN, Math.ceil(seconds * 10) / 10));
};

/** MB: whole MB, 16–1024. Values above 1024 are treated as KB (paste 42126). */
const interpretMemoryMb = (value) => {
  const n = parseLooseNumber(value);
  if (!Number.isFinite(n) || n <= 0) return 256;
  const mb = n > MEMORY_MAX ? n / 1024 : n;
  return Math.min(MEMORY_MAX, Math.max(MEMORY_MIN, Math.ceil(mb)));
};

/** Convert a 10-run average (ms / KB) into question fields (seconds / MB). */
export const limitsFromAverageMetrics = (avgTimeMs, avgMemoryKb) => {
  const timeFromMs = Number(avgTimeMs) > 0 ? Number(avgTimeMs) / 1000 : TIME_MIN;
  const memoryFromKb = Number(avgMemoryKb) > 0 ? Number(avgMemoryKb) / 1024 : MEMORY_MIN;
  return {
    timeLimit: Math.min(TIME_MAX, Math.max(TIME_MIN, Math.ceil(timeFromMs * 10) / 10)),
    memoryLimit: Math.min(MEMORY_MAX, Math.max(MEMORY_MIN, Math.ceil(memoryFromKb))),
  };
};

export const suggestLimitsFromTestResults = (testResults) => {
  if (!testResults || testResults.error) return null;
  const rows = parseTestCaseResultsList(testResults.results || testResults.testResults || []);
  const { maxTimeMs, maxMemoryKb } = summarizeRunMetrics(rows);
  if (!Number.isFinite(maxTimeMs) && !Number.isFinite(maxMemoryKb)) return null;
  return {
    ...limitsFromAverageMetrics(maxTimeMs, maxMemoryKb),
    maxTimeMs,
    maxMemoryKb,
  };
};

const TestSolutionLimitControls = ({
  question,
  testResults,
  optionsRef,
  onLimitsChange,
  onSaved,
  getBenchmarkPayload,
}) => {
  const savedTime = interpretTimeSeconds(question?.timeLimit || 2);
  const savedMemory = interpretMemoryMb(question?.memoryLimit || 256);
  const [setLimits, setSetLimits] = useState(false);
  const [timeLimit, setTimeLimit] = useState(savedTime);
  const [memoryLimit, setMemoryLimit] = useState(savedMemory);
  const [saving, setSaving] = useState(false);
  const [measuring, setMeasuring] = useState(false);
  const [saveMessage, setSaveMessage] = useState('');
  const [average, setAverage] = useState(null);
  const suggested = suggestLimitsFromTestResults(testResults);

  useEffect(() => {
    setTimeLimit(savedTime);
    setMemoryLimit(savedMemory);
    setSaveMessage('');
    setAverage(null);
  }, [question?._id]);

  useEffect(() => {
    const next = setLimits
      ? { timeLimit: interpretTimeSeconds(timeLimit), memoryLimit: interpretMemoryMb(memoryLimit) }
      : null;
    if (optionsRef) optionsRef.current = next;
    onLimitsChange?.(next);
  }, [setLimits, timeLimit, memoryLimit, optionsRef, onLimitsChange]);

  const applyAveragesToFields = () => {
    if (!average) return;
    const next = limitsFromAverageMetrics(average.avgTimeMs, average.avgMemoryKb);
    setSetLimits(true);
    setTimeLimit(next.timeLimit);
    setMemoryLimit(next.memoryLimit);
    onLimitsChange?.(next);
    setSaveMessage(`Set ${next.timeLimit}s / ${next.memoryLimit} MB from the 10-run average. Save to store them on the question.`);
  };

  const handleMeasureAverages = async () => {
    const payload = typeof getBenchmarkPayload === 'function' ? getBenchmarkPayload() : null;
    if (!payload?.questionId) {
      setSaveMessage('Save the question first, then measure averages.');
      return;
    }
    if (!String(payload.answer || '').trim()) {
      setSaveMessage('Write or load a solution before measuring.');
      return;
    }
    if (!payload.language) {
      setSaveMessage('Select a language before measuring.');
      return;
    }

    setMeasuring(true);
    setSaveMessage('');
    try {
      const response = await teacherTestQuestion(
        payload.questionId,
        payload.answer,
        payload.classId || null,
        payload.language,
        { runs: 10, timeLimit: 5, memoryLimit: 1024 }
      );
      const bench = response.data?.benchmark;
      if (!bench) {
        setSaveMessage('Benchmark did not return averages. Try again.');
        return;
      }
      const fields = limitsFromAverageMetrics(bench.avgTimeMs, bench.avgMemoryKb);
      setAverage({
        avgTimeMs: bench.avgTimeMs,
        avgMemoryKb: bench.avgMemoryKb,
        timeLimit: fields.timeLimit,
        memoryLimit: fields.memoryLimit,
      });
      setSaveMessage(
        `10-run average ${bench.avgTimeMs ?? '—'} ms / ${bench.avgMemoryKb ?? '—'} KB. Click “Set average time & memory limits” to use ${fields.timeLimit}s / ${fields.memoryLimit} MB.`
      );
    } catch (err) {
      setSaveMessage(err?.response?.data?.error || err?.message || 'Failed to measure 10-run averages');
    } finally {
      setMeasuring(false);
    }
  };

  const handleSave = async () => {
    const nextTime = interpretTimeSeconds(timeLimit);
    const nextMemory = interpretMemoryMb(memoryLimit);
    setTimeLimit(nextTime);
    setMemoryLimit(nextMemory);

    if (!question?._id) {
      onSaved?.(nextTime, nextMemory);
      setSaveMessage('Limits will be stored when you save the question.');
      return;
    }
    setSaving(true);
    setSaveMessage('');
    try {
      await updateQuestionLimits(question._id, nextTime, nextMemory);
      onSaved?.(nextTime, nextMemory);
      setSaveMessage(`Saved ${nextTime}s / ${nextMemory} MB on this question.`);
    } catch (err) {
      setSaveMessage(err?.response?.data?.error || err?.message || 'Failed to save limits');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="rounded-lg border border-gray-200 bg-gray-50 p-4 space-y-3">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <label className="flex items-start gap-2 text-sm text-gray-800 cursor-pointer">
          <input
            type="checkbox"
            className="mt-0.5 h-4 w-4 text-indigo-600 focus:ring-indigo-500 border-gray-300 rounded"
            checked={setLimits}
            onChange={(e) => {
              setSetLimits(e.target.checked);
              setSaveMessage('');
            }}
          />
          <span>
            <span className="font-semibold">Set time and memory limits</span>
            <span className="block text-xs text-gray-500 mt-0.5">
              Leave unchecked to keep the current question limits ({savedTime}s / {savedMemory} MB).
            </span>
          </span>
        </label>
        <button
          type="button"
          onClick={handleMeasureAverages}
          disabled={measuring}
          className="inline-flex items-center px-3 py-1.5 rounded-lg text-xs font-semibold text-white bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50"
        >
          {measuring ? 'Running 10 times...' : 'Measure TLE & memory (10 runs)'}
        </button>
      </div>

      {average && (
        <div className="rounded-lg border border-indigo-200 bg-indigo-50 px-3 py-2 space-y-2">
          <p className="text-xs text-indigo-900">
            10-run average: <strong>{average.avgTimeMs ?? '—'} ms</strong>,{' '}
            <strong>{average.avgMemoryKb ?? '—'} KB</strong>
            {' → question limits '}
            <strong>{average.timeLimit} seconds</strong> / <strong>{average.memoryLimit} MB</strong>
          </p>
          <div className="text-xs text-indigo-900/90 space-y-1 font-mono bg-white/70 rounded-md px-2 py-2">
            <p>
              Time: {average.avgTimeMs ?? '—'} ms ÷ 1000 ={' '}
              {Number.isFinite(Number(average.avgTimeMs))
                ? `${(Number(average.avgTimeMs) / 1000).toFixed(4)} s`
                : '—'}
              {' → ceil to 0.1 s (0.1–5) → '}
              <strong>{average.timeLimit} s</strong>
            </p>
            <p>
              Memory: {average.avgMemoryKb ?? '—'} KB ÷ 1024 ={' '}
              {Number.isFinite(Number(average.avgMemoryKb))
                ? `${(Number(average.avgMemoryKb) / 1024).toFixed(2)} MB`
                : '—'}
              {' → ceil to whole MB (16–1024) → '}
              <strong>{average.memoryLimit} MB</strong>
            </p>
          </div>
          <button
            type="button"
            onClick={applyAveragesToFields}
            className="inline-flex items-center px-3 py-1.5 rounded-lg text-xs font-semibold text-white bg-indigo-600 hover:bg-indigo-700"
          >
            Set average time & memory limits
          </button>
        </div>
      )}

      {(setLimits || average) && (
        <div className="space-y-3">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold text-gray-700 mb-1">Time limit (seconds, 0.1–5)</label>
              <input
                type="text"
                inputMode="decimal"
                value={timeLimit}
                onChange={(e) => {
                  setSetLimits(true);
                  setTimeLimit(e.target.value);
                }}
                onBlur={() => setTimeLimit(interpretTimeSeconds(timeLimit))}
                className="w-full px-3 py-2 rounded-lg border border-gray-200 text-sm focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-gray-700 mb-1">Memory limit (MB, 16–1024)</label>
              <input
                type="text"
                inputMode="decimal"
                value={memoryLimit}
                onChange={(e) => {
                  setSetLimits(true);
                  setMemoryLimit(e.target.value);
                }}
                onBlur={() => setMemoryLimit(interpretMemoryMb(memoryLimit))}
                className="w-full px-3 py-2 rounded-lg border border-gray-200 text-sm focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
              />
            </div>
          </div>
          <p className="text-xs text-gray-500">
            Paste the 10-run averages as-is: values above 5 are treated as milliseconds, values above 1024 as KB.
            Example: 61.6 → 0.1 s, 42126 → 42 MB.
          </p>
          {suggested && !average && (
            <button
              type="button"
              onClick={() => {
                setSetLimits(true);
                setTimeLimit(suggested.timeLimit);
                setMemoryLimit(suggested.memoryLimit);
              }}
              className="text-xs font-semibold text-indigo-700 hover:underline"
            >
              Use last test: {suggested.timeLimit}s / {suggested.memoryLimit} MB
            </button>
          )}
          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={handleSave}
              disabled={saving || measuring}
              className="inline-flex items-center px-3 py-1.5 rounded-lg text-xs font-semibold text-white bg-slate-800 hover:bg-slate-900 disabled:opacity-50"
            >
              {saving ? 'Saving...' : 'Save limits on question'}
            </button>
            {saveMessage && <span className="text-xs text-gray-600">{saveMessage}</span>}
          </div>
        </div>
      )}
    </div>
  );
};

export default TestSolutionLimitControls;
