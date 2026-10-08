/**
 * Safe Exam Browser (SEB) helpers for the browser side.
 *
 * - Detection: SEB appends "SEB/<version>" to its User-Agent (plus our "AlgoSutraSEB/1" suffix from the
 *   .seb file) and injects window.SafeExamBrowser (its JavaScript API).
 * - Config Key proof for a cross-host API: SEB only adds X-SafeExamBrowser-ConfigKeyHash itself to
 *   requests on the page's own host. For the API host we forward SEB's JavaScript API value
 *   (SafeExamBrowser.security.configKey = SHA-256(page URL + Config Key), computed for the URL the page
 *   was loaded with) as "jsapi;<hash>;<page URL>;<current URL>". When SEB does add its native header
 *   (same host), that one replaces ours. The server checks either form.
 */

const UA_PATTERN = /\bSEB\/\d/;
const UA_SUFFIX = 'AlgoSutraSEB/';

/** Captured at module load, before the router can change it: the URL SEB computed its JS API keys for. */
const INITIAL_URL = typeof window !== 'undefined' ? String(window.location.href).split('#')[0] : '';

/** Window event fired when an exam request is refused with code SEB_REQUIRED. */
export const SEB_REQUIRED_EVENT = 'exam:seb-required';

export function isSafeExamBrowser() {
  if (typeof window === 'undefined') return false;
  const ua = String(window.navigator?.userAgent || '');
  return UA_PATTERN.test(ua) || ua.includes(UA_SUFFIX) || Boolean(window.SafeExamBrowser?.security);
}

/** Extra headers for exam requests made from inside SEB (empty outside SEB). */
export function sebRequestHeaders() {
  if (typeof window === 'undefined') return {};
  const hash = String(window.SafeExamBrowser?.security?.configKey || '').toLowerCase();
  if (!/^[0-9a-f]{64}$/.test(hash)) return {};
  const current = String(window.location.href).split('#')[0];
  const urls = [...new Set([INITIAL_URL, current].filter(Boolean))].map(encodeURIComponent);
  return { 'X-SafeExamBrowser-ConfigKeyHash': ['jsapi', hash, ...urls].join(';') };
}

const EXAM_ROUTE = /^\/student\/exams\/[a-f\d]{24}$/i;

/** Only exam pages may be returned to after signing in (SEB opens the exam URL in a fresh session). */
export function examReturnPath(from) {
  const path = typeof from === 'string' ? from : '';
  return EXAM_ROUTE.test(path) ? path : null;
}
