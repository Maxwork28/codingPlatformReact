import React, { createContext, useCallback, useContext, useEffect, useRef, useState } from 'react';
import { AlertCircle, AlertTriangle, CheckCircle2, Info, X } from 'lucide-react';
import ConfirmDialog from './ConfirmDialog';

const ToastContext = createContext(null);

const KINDS = {
  success: { box: 'border-ok-line', icon: 'text-ok', Icon: CheckCircle2 },
  error: { box: 'border-bad-line', icon: 'text-bad', Icon: AlertCircle },
  warning: { box: 'border-warn-line', icon: 'text-warn', Icon: AlertTriangle },
  info: { box: 'border-info-line', icon: 'text-info', Icon: Info },
};

let toastHandler = null;
let confirmHandler = null;

function guessType(message) {
  const text = String(message || '').toLowerCase();
  if (/(fail|error|invalid|unable|cannot|can't|could not|not allowed|denied|missing|required)/.test(text)) return 'error';
  if (/(success|saved|created|updated|deleted|published|copied|added|removed|released|submitted|sent)/.test(text)) return 'success';
  if (/(please|warning|note)/.test(text)) return 'warning';
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

export function ToastProvider({ children }) {
  const [toasts, setToasts] = useState([]);
  const [pending, setPending] = useState(null);
  const resolveRef = useRef(null);

  const dismiss = useCallback((id) => {
    setToasts((current) => current.filter((item) => item.id !== id));
  }, []);

  const toast = useCallback((message, type) => {
    const id = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
    const resolved = type || guessType(message);
    const kind = KINDS[resolved] ? resolved : 'info';
    setToasts((current) => [...current, { id, message: String(message || ''), type: kind }]);
    window.setTimeout(() => dismiss(id), 4500);
  }, [dismiss]);

  const askConfirm = useCallback((message, options) => new Promise((resolve) => {
    resolveRef.current = resolve;
    setPending({ message, ...options });
  }), []);

  const settle = (value) => {
    resolveRef.current?.(value);
    resolveRef.current = null;
    setPending(null);
  };

  useEffect(() => {
    toastHandler = toast;
    confirmHandler = askConfirm;
    return () => {
      toastHandler = null;
      confirmHandler = null;
    };
  }, [toast, askConfirm]);

  return (
    <ToastContext.Provider value={toast}>
      {children}
      <ConfirmDialog
        open={Boolean(pending)}
        title={pending?.title}
        message={pending?.message}
        confirmLabel={pending?.confirmLabel}
        danger={pending?.danger}
        onConfirm={() => settle(true)}
        onCancel={() => settle(false)}
      />
      <div className="fixed bottom-5 right-5 z-[60] flex max-w-sm flex-col gap-2">
        {toasts.map((item) => {
          const kind = KINDS[item.type];
          const Icon = kind.Icon;
          return (
            <div
              key={item.id}
              className={`bg-surface text-body p-4 rounded-xl shadow-xl border text-sm flex items-start gap-3 animate-fade-in ${kind.box}`}
            >
              <Icon className={`w-5 h-5 shrink-0 ${kind.icon}`} />
              <p className="flex-1 leading-5 whitespace-pre-line">{item.message}</p>
              <button type="button" onClick={() => dismiss(item.id)} className="p-1.5 text-muted hover:text-fg rounded-lg hover:bg-hover" aria-label="Close">
                <X className="w-4 h-4" />
              </button>
            </div>
          );
        })}
      </div>
    </ToastContext.Provider>
  );
}

export function useToast() {
  const toast = useContext(ToastContext);
  return toast || notify;
}
