import { useLocation, useSearchParams } from 'react-router-dom';
import { formatDistanceToNowStrict } from 'date-fns';

/** Staff panel prefix from the current route (`/admin` or `/teacher`). */
export function useStaffBase() {
  const { pathname } = useLocation();
  const base = pathname.startsWith('/teacher') ? '/teacher' : '/admin';
  return { base, isTeacher: base === '/teacher' };
}

export const HIDE_SM = 'hidden md:table-cell';
export const HIDE_MD = 'hidden lg:table-cell';

export const selectClass =
  'h-9 bg-inset border border-line rounded-xl px-3 text-fg text-xs outline-none focus:border-accent cursor-pointer';

export const plural = (n, word, many = `${word}s`) => `${n} ${n === 1 ? word : many}`;

export const errorText = (err, fallback) => (typeof err === 'string' ? err : err?.response?.data?.error || err?.message || fallback);

export const formatDate = (value, withTime = false) =>
  value
    ? new Date(value).toLocaleString(undefined, {
        day: 'numeric',
        month: 'short',
        year: 'numeric',
        ...(withTime ? { hour: 'numeric', minute: '2-digit' } : {}),
      })
    : '—';

export const timeAgo = (value) => (value ? `${formatDistanceToNowStrict(new Date(value))} ago` : 'Never');

export const initials = (name = '') =>
  name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0].toUpperCase())
    .join('') || '?';

export const QUESTION_TYPES = {
  singleCorrectMcq: 'Single MCQ',
  multipleCorrectMcq: 'Multi MCQ',
  fillInTheBlanks: 'Fill blanks',
  fillInTheBlanksCoding: 'Fill blanks (code)',
  coding: 'Coding',
  codingWithDriver: 'Coding (driver)',
};

export const paginate = (rows, page, pageSize) => {
  const totalPages = Math.max(1, Math.ceil(rows.length / pageSize));
  const current = Math.min(Math.max(1, page), totalPages);
  return { current, rows: rows.slice((current - 1) * pageSize, current * pageSize) };
};

/** Reads and writes tab-scoped filters in the URL. Keys equal to their default are removed. */
export function useUrlState(defaults) {
  const [params, setParams] = useSearchParams();
  const get = (key) => params.get(key) ?? defaults[key] ?? '';
  const update = (changes, { resetPage = true } = {}) =>
    setParams(
      (prev) => {
        const next = new URLSearchParams(prev);
        Object.entries(changes).forEach(([key, value]) => {
          if (value === undefined || value === null || value === '' || String(value) === String(defaults[key] ?? '')) next.delete(key);
          else next.set(key, String(value));
        });
        if (resetPage && !('page' in changes)) next.delete('page');
        return next;
      },
      { replace: true },
    );
  return [get, update];
}
