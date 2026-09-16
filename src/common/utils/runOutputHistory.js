export function summarizeRunResult(kind, results) {
  if (!results) return 'No output';
  if (results.error) return results.message ? `Error: ${String(results.message).slice(0, 80)}` : 'Error';
  if (results.isCustomTest) return results.passed ? 'Custom run passed' : 'Custom run failed';
  if (results.totalTestCases != null) {
    return `${results.passedTestCases ?? 0}/${results.totalTestCases} passed`;
  }
  if (kind === 'submit') return 'Submit';
  return 'Run';
}

export function makeRunHistoryEntry(questionId, kind, results) {
  const failed = Boolean(
    results?.error ||
      (results?.isCustomTest ? results.passed === false : results?.isCorrect === false)
  );
  return {
    id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    questionId: String(questionId),
    kind,
    at: new Date().toISOString(),
    summary: summarizeRunResult(kind, results),
    failed,
    results,
  };
}

export function historyKindLabel(kind) {
  if (kind === 'submit') return 'Submit';
  if (kind === 'custom') return 'Custom';
  return 'Run';
}

export function formatHistoryTime(iso) {
  try {
    return new Date(iso).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' });
  } catch {
    return '';
  }
}

function historyStorageKey(role, classId) {
  return `algo-run-history:${role}:${classId || 'none'}`;
}

export function loadRunHistory(role, classId) {
  if (typeof sessionStorage === 'undefined' || !classId) return [];
  try {
    const parsed = JSON.parse(sessionStorage.getItem(historyStorageKey(role, classId)) || '[]');
    return Array.isArray(parsed) ? parsed.slice(0, 30) : [];
  } catch {
    return [];
  }
}

export function saveRunHistory(role, classId, history) {
  if (typeof sessionStorage === 'undefined' || !classId) return;
  try {
    sessionStorage.setItem(historyStorageKey(role, classId), JSON.stringify((history || []).slice(0, 30)));
  } catch {
    /* ignore quota */
  }
}
