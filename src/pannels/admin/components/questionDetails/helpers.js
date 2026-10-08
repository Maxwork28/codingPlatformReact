import { notify } from '../../../../common/ui/Toast';
import { CODING_TYPES, LANGUAGE_LABELS } from '../../../../common/domain/questions';
import { stripHtml } from '../../../../common/utils/sanitizeHtml';

export const RUNNABLE_TYPES = CODING_TYPES;
export const isRunnable = (q) => RUNNABLE_TYPES.includes(q?.type);

export const DIFFICULTY_KIND = { easy: 'pass', medium: 'warning', hard: 'fail' };

export { LANGUAGE_LABELS, stripHtml };
export const langLabel = (lang) => LANGUAGE_LABELS[lang] || lang;

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
