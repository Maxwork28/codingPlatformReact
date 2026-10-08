import React, { useEffect, useId, useRef } from 'react';
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

const FOCUSABLE =
  'a[href], button:not([disabled]), textarea:not([disabled]), input:not([disabled]), select:not([disabled]), [tabindex]:not([tabindex="-1"])';

/** Number of modals currently holding the body scroll lock (nested dialogs). */
let scrollLocks = 0;

function ModalDialog({ onClose, title, icon: Icon, accent, width, children, footer }) {
  const panelRef = useRef(null);
  const titleId = useId();

  useEffect(() => {
    const panel = panelRef.current;
    const previouslyFocused = document.activeElement;

    // Body scroll lock (reference counted so nested modals do not unlock early).
    const previousOverflow = document.body.style.overflow;
    scrollLocks += 1;
    document.body.style.overflow = 'hidden';

    // Move focus into the dialog: first focusable control (skipping the close button) or the panel itself.
    const focusables = () => Array.from(panel?.querySelectorAll(FOCUSABLE) || []).filter((el) => el.offsetParent !== null || el === document.activeElement);
    const initial = focusables().find((el) => el.getAttribute('aria-label') !== 'Close') || focusables()[0] || panel;
    initial?.focus?.({ preventScroll: true });

    const onKeyDown = (event) => {
      if (event.key === 'Escape') {
        event.stopPropagation();
        onClose?.();
        return;
      }
      if (event.key !== 'Tab' || !panel) return;
      const items = focusables();
      if (!items.length) {
        event.preventDefault();
        panel.focus();
        return;
      }
      const first = items[0];
      const last = items[items.length - 1];
      const active = document.activeElement;
      if (event.shiftKey && (active === first || !panel.contains(active))) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && (active === last || !panel.contains(active))) {
        event.preventDefault();
        first.focus();
      }
    };
    document.addEventListener('keydown', onKeyDown);

    return () => {
      document.removeEventListener('keydown', onKeyDown);
      scrollLocks = Math.max(0, scrollLocks - 1);
      if (scrollLocks === 0) document.body.style.overflow = previousOverflow;
      if (previouslyFocused && typeof previouslyFocused.focus === 'function' && document.contains(previouslyFocused)) {
        previouslyFocused.focus({ preventScroll: true });
      }
    };
  }, [onClose]);

  return (
    <div className={surface.modalOverlay}>
      <button type="button" className="absolute inset-0 cursor-default" aria-label="Close" tabIndex={-1} onClick={onClose} />
      <div
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby={title ? titleId : undefined}
        tabIndex={-1}
        className={`relative outline-none ${surface.modalPanel} ${width}`}
      >
        <div className={`${surface.modalHeader} flex items-center justify-between gap-3`}>
          <div className="flex items-center gap-3 min-w-0">
            {Icon && (
              <span className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 ${accentBox[accent] || accentBox.blue}`}>
                <Icon className="w-5 h-5" />
              </span>
            )}
            <h2 id={titleId} className={type.modalTitle}>{title}</h2>
          </div>
          <button type="button" onClick={onClose} className={button.close} aria-label="Close">
            <X className="w-4 h-4" />
          </button>
        </div>
        <div className={surface.modalBody}>{children}</div>
        {footer && <div className={surface.modalFooter}>{footer}</div>}
      </div>
    </div>
  );
}

export default function Modal({ open, onClose, title, icon, accent = 'blue', width = 'max-w-2xl', children, footer }) {
  if (!open) return null;
  // Mounting a child component per open/close keeps the focus + scroll-lock effect scoped to the visible dialog.
  return (
    <ModalDialog onClose={onClose} title={title} icon={icon} accent={accent} width={width} footer={footer}>
      {children}
    </ModalDialog>
  );
}
