import { createContext, useContext } from 'react';

/**
 * Toast / confirm API used across the app. The UI lives in ToastProvider.jsx, which registers
 * its handlers here on mount so `notify` and `confirmAction` work from anywhere (event handlers, services).
 */
export const ToastContext = createContext(null);

let toastHandler = null;
let confirmHandler = null;

/** Called by ToastProvider; pass nulls to unregister. */
export function registerToastHandlers(toast, confirm) {
  toastHandler = toast;
  confirmHandler = confirm;
}

export function guessType(message) {
  const text = String(message || '').toLowerCase();
  if (/(fail|error|invalid|unable|cannot|can't|could not|not allowed|denied|missing|required)/.test(text)) return 'error';
  if (/(success|saved|created|updated|deleted|published|copied|added|removed|released|submitted|sent)/.test(text)) return 'success';
  if (/(warning|caution|note:)/.test(text)) return 'warning';
  return 'info';
}

/** Show a toast from anywhere (event handlers, services). Type is guessed from the text when omitted. */
export function notify(message, type) {
  const kind = type || guessType(message);
  if (toastHandler) toastHandler(message, kind);
  else console.warn(message);
}

/** Promise-based replacement for window.confirm. Resolves true when the user confirms. */
export function confirmAction(message, options = {}) {
  if (!confirmHandler) return Promise.resolve(window.confirm(message));
  return confirmHandler(message, options);
}

export function useToast() {
  const toast = useContext(ToastContext);
  return toast || notify;
}
