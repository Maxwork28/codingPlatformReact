import { notify } from '../../../../common/ui/Toast';

export const RUNNABLE_TYPES = ['coding', 'fillInTheBlanksCoding', 'codingWithDriver'];
export const isRunnable = (q) => RUNNABLE_TYPES.includes(q?.type);

export const DIFFICULTY_KIND = { easy: 'pass', medium: 'warning', hard: 'fail' };

export const LANGUAGE_LABELS = {
  javascript: 'JavaScript',
  python: 'Python',
  java: 'Java',
  cpp: 'C++',
  c: 'C',
  php: 'PHP',
  ruby: 'Ruby',
  go: 'Go',
};
export const langLabel = (lang) => LANGUAGE_LABELS[lang] || lang;

export const stripHtml = (html) => {
  if (!html || typeof html !== 'string') return '';
  const doc = new DOMParser().parseFromString(html, 'text/html');
  return (doc.body.textContent || '').trim();
};

export const hasText = (html) => stripHtml(html).length > 0;

export const optionLetter = (index) => String.fromCharCode(65 + index);

export async function copyText(text, label = 'Copied') {
  try {
    await navigator.clipboard.writeText(String(text));
    notify(label, 'success');
  } catch {
    notify('Could not copy to clipboard', 'error');
  }
}
