import React, { useEffect } from 'react';
import { AlertTriangle } from 'lucide-react';
import { button, surface, type } from './format';

export default function ConfirmDialog({
  open,
  title = 'Please confirm',
  message,
  confirmLabel = 'Confirm',
  cancelLabel = 'Cancel',
  danger = false,
  onConfirm,
  onCancel,
}) {
  useEffect(() => {
    if (!open) return undefined;
    const onKey = (event) => {
      if (event.key === 'Escape') onCancel?.();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, onCancel]);

  if (!open) return null;
  return (
    <div className={`${surface.modalOverlay} z-[70]`} role="alertdialog" aria-modal="true">
      <button type="button" className="absolute inset-0 cursor-default" aria-label="Cancel" onClick={onCancel} />
      <div className={`relative ${surface.modalPanel} max-w-md`}>
        <div className="p-6 flex items-start gap-4">
          <span className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 border ${danger ? 'bg-bad-soft border-bad-line text-bad' : 'bg-warn-soft border-warn-line text-warn'}`}>
            <AlertTriangle className="w-5 h-5" />
          </span>
          <div className="min-w-0">
            <h2 className={type.modalTitle}>{title}</h2>
            {message && <p className="mt-2 text-xs text-body whitespace-pre-line">{message}</p>}
          </div>
        </div>
        <div className={surface.modalFooter}>
          <button type="button" onClick={onCancel} className={`${button.base} ${button.secondary}`}>
            {cancelLabel}
          </button>
          <button
            type="button"
            autoFocus
            onClick={onConfirm}
            className={`${button.base} ${danger ? button.dangerSolid : button.primary}`}
          >
            {confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}
