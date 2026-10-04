import React from 'react';
import { X } from 'lucide-react';
import { surface, type, button } from './format';

const accentBox = {
  accent: 'bg-accent-soft border border-accent-line text-accent-ink',
  cyan: 'bg-info-soft border border-info-line text-info',
  blue: 'bg-accent-soft border border-accent-line text-accent-ink',
  purple: 'bg-accent-soft border border-accent-line text-accent-ink',
  emerald: 'bg-ok-soft border border-ok-line text-ok',
  amber: 'bg-warn-soft border border-warn-line text-warn',
  red: 'bg-bad-soft border border-bad-line text-bad',
};

export default function Modal({
  open,
  onClose,
  title,
  icon: Icon,
  accent = 'blue',
  width = 'max-w-2xl',
  children,
  footer,
}) {
  if (!open) return null;
  return (
    <div className={surface.modalOverlay} role="dialog" aria-modal="true">
      <button type="button" className="absolute inset-0 cursor-default" aria-label="Close" onClick={onClose} />
      <div className={`relative ${surface.modalPanel} ${width}`}>
        <div className={`${surface.modalHeader} flex items-center justify-between gap-3`}>
          <div className="flex items-center gap-3 min-w-0">
            {Icon && (
              <span className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 ${accentBox[accent] || accentBox.blue}`}>
                <Icon className="w-5 h-5" />
              </span>
            )}
            <h2 className={type.modalTitle}>{title}</h2>
          </div>
          <button type="button" onClick={onClose} className={button.close} aria-label="Close">
            <X className="w-4 h-4" />
          </button>
        </div>
        <div className={surface.modalBody}>{children}</div>
        {footer && (
          <div className={surface.modalFooter}>
            {footer}
          </div>
        )}
      </div>
    </div>
  );
}
