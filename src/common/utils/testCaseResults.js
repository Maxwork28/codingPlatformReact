/** Normalises a judge result payload (array, object with testResults, JSON string) into a list of case results. */
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
