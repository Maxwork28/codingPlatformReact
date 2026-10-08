import React, { useEffect, useState } from 'react';
import { teacherTestQuestion, updateQuestionLimits } from '../services/api';
import {
  LIMIT_MEM_FACTOR,
  LIMIT_MEM_MIN_MB,
  LIMIT_MEM_PAD_MB,
  LIMIT_MEM_STEP_MB,
  LIMIT_TIME_FACTOR,
  LIMIT_TIME_MIN_S,
  LIMIT_TIME_PAD_S,
  MEMORY_MAX,
  MEMORY_MIN,
  TIME_MAX,
  TIME_MIN,
  limitsFromAverageMetrics,
  suggestLimitsFromTestResults,
} from '../utils/judgeLimits';

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
  const [shownQuestionId, setShownQuestionId] = useState(question?._id);
  const suggested = suggestLimitsFromTestResults(testResults);

  // Reset the fields only when a different question is shown (not when the saved limits change
  // after "Save limits on question"), using React's "adjust state while rendering" pattern.
  if (question?._id !== shownQuestionId) {
    setShownQuestionId(question?._id);
    setTimeLimit(savedTime);
    setMemoryLimit(savedMemory);
    setSaveMessage('');
    setAverage(null);
  }

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
    setSaveMessage(`Set ${next.timeLimit}s / ${next.memoryLimit} MB from the 10-run average. Click “Save limits on question” to store them.`);
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
        { runs: 10, timeLimit: 2, memoryLimit: 1024 }
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
      // Pre-fill the suggestion so "Save limits on question" stores it; the fields stay editable.
      setSetLimits(true);
      setTimeLimit(fields.timeLimit);
      setMemoryLimit(fields.memoryLimit);
      setSaveMessage(
        `10-run average ${bench.avgTimeMs ?? '—'} ms / ${bench.avgMemoryKb ?? '—'} KB → suggested ${fields.timeLimit}s / ${fields.memoryLimit} MB (filled in below). Edit the fields to override, then click “Save limits on question”.`
      );
    } catch (err) {
      setSaveMessage(err?.response?.data?.error || err?.message || 'Failed to measure 10-run averages');
    } finally {
      setMeasuring(false);
    }
  };

  const averageSeconds = Number.isFinite(Number(average?.avgTimeMs)) && average?.avgTimeMs != null
    ? Math.max(0, Number(average.avgTimeMs)) / 1000
    : null;
  const averageMb = Number.isFinite(Number(average?.avgMemoryKb)) && average?.avgMemoryKb != null
    ? Math.max(0, Number(average.avgMemoryKb)) / 1024
    : null;

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
    <div className="rounded-lg border border-line bg-inset p-4 space-y-3">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <label className="flex items-start gap-2 text-sm text-fg cursor-pointer">
          <input
            type="checkbox"
            className="mt-0.5 h-4 w-4 text-accent-ink focus:ring-accent border-line-strong rounded"
            checked={setLimits}
            onChange={(e) => {
              setSetLimits(e.target.checked);
              setSaveMessage('');
            }}
          />
          <span>
            <span className="font-semibold">Set time and memory limits</span>
            <span className="block text-xs text-muted mt-0.5">
              Leave unchecked to keep the current question limits ({savedTime}s / {savedMemory} MB).
            </span>
          </span>
        </label>
        <button
          type="button"
          onClick={handleMeasureAverages}
          disabled={measuring}
          className="inline-flex items-center px-3 py-1.5 rounded-lg text-xs font-semibold text-on-accent bg-accent hover:bg-accent-hover disabled:opacity-50"
        >
          {measuring ? 'Running 10 times...' : 'Measure TLE & memory (10 runs)'}
        </button>
      </div>

      {average && (
        <div className="rounded-lg border border-accent-line bg-accent-soft px-3 py-2 space-y-2">
          <p className="text-xs text-accent-ink">
            10-run average: <strong>{average.avgTimeMs ?? '—'} ms</strong>,{' '}
            <strong>{average.avgMemoryKb ?? '—'} KB</strong>
            {' → question limits '}
            <strong>{average.timeLimit} seconds</strong> / <strong>{average.memoryLimit} MB</strong>
          </p>
          <div className="text-xs text-accent-ink space-y-1 font-mono bg-surface rounded-md px-2 py-2">
            <p>
              Time: {LIMIT_TIME_FACTOR} × {averageSeconds == null ? '—' : `${averageSeconds.toFixed(4)} s`} + {LIMIT_TIME_PAD_S} s ={' '}
              {averageSeconds == null ? '—' : `${(averageSeconds * LIMIT_TIME_FACTOR + LIMIT_TIME_PAD_S).toFixed(4)} s`}
              {` → round up to 0.1 s (min ${LIMIT_TIME_MIN_S} s, max ${TIME_MAX} s) → `}
              <strong>{average.timeLimit} s</strong>
            </p>
            <p>
              Memory: {LIMIT_MEM_FACTOR} × {averageMb == null ? '—' : `${averageMb.toFixed(2)} MB`} + {LIMIT_MEM_PAD_MB} MB ={' '}
              {averageMb == null ? '—' : `${(averageMb * LIMIT_MEM_FACTOR + LIMIT_MEM_PAD_MB).toFixed(2)} MB`}
              {` → round up to a multiple of ${LIMIT_MEM_STEP_MB} MB (min ${LIMIT_MEM_MIN_MB} MB, max ${MEMORY_MAX} MB) → `}
              <strong>{average.memoryLimit} MB</strong>
            </p>
            <p className="font-sans text-muted">
              The limits leave headroom over the measured average ({LIMIT_TIME_FACTOR}× the time + {LIMIT_TIME_PAD_S} s,{' '}
              {LIMIT_MEM_FACTOR}× the memory + {LIMIT_MEM_PAD_MB} MB) so normal judge jitter doesn’t fail a correct solution.
            </p>
          </div>
          <button
            type="button"
            onClick={applyAveragesToFields}
            className="inline-flex items-center px-3 py-1.5 rounded-lg text-xs font-semibold text-on-accent bg-accent hover:bg-accent-hover"
          >
            Set average time & memory limits
          </button>
        </div>
      )}

      {(setLimits || average) && (
        <div className="space-y-3">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold text-body mb-1">Time limit (seconds, 0.1–5)</label>
              <input
                type="text"
                inputMode="decimal"
                value={timeLimit}
                onChange={(e) => {
                  setSetLimits(true);
                  setTimeLimit(e.target.value);
                }}
                onBlur={() => setTimeLimit(interpretTimeSeconds(timeLimit))}
                className="w-full px-3 py-2 rounded-lg border border-line text-sm focus:ring-2 focus:ring-accent focus:border-accent"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-body mb-1">Memory limit (MB, 16–1024)</label>
              <input
                type="text"
                inputMode="decimal"
                value={memoryLimit}
                onChange={(e) => {
                  setSetLimits(true);
                  setMemoryLimit(e.target.value);
                }}
                onBlur={() => setMemoryLimit(interpretMemoryMb(memoryLimit))}
                className="w-full px-3 py-2 rounded-lg border border-line text-sm focus:ring-2 focus:ring-accent focus:border-accent"
              />
            </div>
          </div>
          <p className="text-xs text-muted">
            These are the limits the judge enforces (no extra headroom is added to what you type here).
            Values above 5 are read as milliseconds and values above 1024 as KB, e.g. 1200 → 1.2 s, 131072 → 128 MB.
          </p>
          {suggested && !average && (
            <button
              type="button"
              onClick={() => {
                setSetLimits(true);
                setTimeLimit(suggested.timeLimit);
                setMemoryLimit(suggested.memoryLimit);
              }}
              className="text-xs font-semibold text-accent-ink hover:underline"
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
            {saveMessage && <span className="text-xs text-muted">{saveMessage}</span>}
          </div>
        </div>
      )}
    </div>
  );
};

export default TestSolutionLimitControls;
