import React, { useCallback, useEffect, useRef, useState } from 'react';
import { AlertCircle, AlertTriangle, CheckCircle2, Info, X } from 'lucide-react';
import ConfirmDialog from './ConfirmDialog';
import { ToastContext, guessType, registerToastHandlers } from './Toast';

const KINDS = {
  success: { box: 'border-ok-line', icon: 'text-ok', Icon: CheckCircle2 },
  error: { box: 'border-bad-line', icon: 'text-bad', Icon: AlertCircle },
  warning: { box: 'border-warn-line', icon: 'text-warn', Icon: AlertTriangle },
  info: { box: 'border-info-line', icon: 'text-info', Icon: Info },
};

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
    registerToastHandlers(toast, askConfirm);
    return () => registerToastHandlers(null, null);
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
      <div className="fixed bottom-5 right-5 z-[60] flex max-w-sm flex-col gap-2" role="status" aria-live="polite">
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

export default ToastProvider;
