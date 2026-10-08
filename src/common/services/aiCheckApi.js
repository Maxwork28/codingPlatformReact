import api from './api';

/**
 * Staff API for AI-generated-code detection on exam coding answers (backend: /ai-check).
 * Uses the shared axios instance from api.js (base URL, bearer token, 401 → login redirect).
 * Every wrapper resolves with the response body and rejects with a user-facing string.
 */
const aiCall = async (request, fallback) => {
  try {
    const { data } = await request();
    return data;
  } catch (err) {
    throw err?.response?.data?.error || fallback;
  }
};

/** Which providers are configured on the server (never the keys). */
export const getAiCheckConfig = () => aiCall(() => api.get('/ai-check/config'), 'Failed to load AI check settings');

/** { byAttempt: { attemptId: { questionId: summary } }, questions: [...], generation, anyProvider } */
export const getExamAiReport = (examId) => aiCall(() => api.get(`/ai-check/exams/${examId}`), 'Failed to load AI similarity results');

export const listAiReferences = (examId) => aiCall(() => api.get(`/ai-check/exams/${examId}/references`), 'Failed to load AI references');

/** Paste a reference solution: { questionId, language, code, label? } */
export const addAiReference = (examId, body) => aiCall(() => api.post(`/ai-check/exams/${examId}/references`, body), 'Failed to add the reference');

export const deleteAiReference = (examId, referenceId) =>
  aiCall(() => api.delete(`/ai-check/exams/${examId}/references/${referenceId}`), 'Failed to delete the reference');

/** Start generating references with the configured providers: { questionIds?, languages?, replace? } → 202 */
export const generateAiReferences = (examId, body = {}) =>
  aiCall(() => api.post(`/ai-check/exams/${examId}/generate`, body), 'Failed to start generating AI references');

export const getAiGenerationStatus = (examId) => aiCall(() => api.get(`/ai-check/exams/${examId}/generate`), 'Failed to load generation progress');

export const recheckExamAi = (examId) => aiCall(() => api.post(`/ai-check/exams/${examId}/recheck`), 'Failed to start the re-check');

/** Side-by-side comparison for one submission, optionally against a specific reference. */
export const getAiComparison = (submissionId, referenceId) =>
  aiCall(() => api.get(`/ai-check/submissions/${submissionId}`, { params: referenceId ? { referenceId } : undefined }), 'Failed to load the comparison');
