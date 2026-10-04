import React, { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { MoreHorizontal } from 'lucide-react';

const MENU_WIDTH = 192;

const toneClass = {
  default: 'text-body hover:bg-hover hover:text-fg',
  danger: 'text-bad hover:bg-bad-soft',
};

/**
 * Kebab menu for row actions. Rendered with fixed positioning so it is not
 * clipped by scrollable table wrappers.
 * items: [{ label, icon, onClick, tone?: 'danger', disabled?, divider? }]
 */
export default function ActionMenu({ items, label = 'More actions' }) {
  const [open, setOpen] = useState(false);
  const [pos, setPos] = useState({ top: 0, left: 0 });
  const triggerRef = useRef(null);
  const menuRef = useRef(null);

  useLayoutEffect(() => {
    if (!open || !triggerRef.current) return;
    const rect = triggerRef.current.getBoundingClientRect();
    const menuHeight = menuRef.current?.offsetHeight || 0;
    const fitsBelow = rect.bottom + 4 + menuHeight < window.innerHeight;
    setPos({
      top: fitsBelow ? rect.bottom + 4 : rect.top - 4 - menuHeight,
      left: Math.max(8, rect.right - MENU_WIDTH),
    });
  }, [open]);

  useEffect(() => {
    if (!open) return undefined;
    const close = (e) => {
      if (menuRef.current?.contains(e.target) || triggerRef.current?.contains(e.target)) return;
      setOpen(false);
    };
    const onKey = (e) => e.key === 'Escape' && setOpen(false);
    const dismiss = () => setOpen(false);
    document.addEventListener('mousedown', close);
    document.addEventListener('keydown', onKey);
    window.addEventListener('scroll', dismiss, true);
    window.addEventListener('resize', dismiss);
    return () => {
      document.removeEventListener('mousedown', close);
      document.removeEventListener('keydown', onKey);
      window.removeEventListener('scroll', dismiss, true);
      window.removeEventListener('resize', dismiss);
    };
  }, [open]);

  return (
    <>
      <button
        ref={triggerRef}
        type="button"
        aria-label={label}
        aria-haspopup="menu"
        aria-expanded={open}
        onClick={(e) => {
          e.stopPropagation();
          setOpen((v) => !v);
        }}
        className="p-1.5 rounded-lg text-muted hover:text-fg hover:bg-hover transition"
      >
        <MoreHorizontal className="w-4 h-4" />
      </button>
      {open && (
        <div
          ref={menuRef}
          role="menu"
          onClick={(e) => e.stopPropagation()}
          style={{ top: pos.top, left: pos.left, width: MENU_WIDTH }}
          className="fixed z-50 rounded-xl border border-line bg-surface p-1 shadow-xl animate-fade-in"
        >
          {items.map((item, i) =>
            item.divider ? (
              <div key={`d-${i}`} className="my-1 border-t border-line" />
            ) : (
              <button
                key={item.label}
                type="button"
                role="menuitem"
                disabled={item.disabled}
                onClick={() => {
                  setOpen(false);
                  item.onClick();
                }}
                className={`w-full flex items-center gap-2 rounded-lg px-2.5 py-1.5 text-xs font-medium text-left transition disabled:opacity-50 disabled:cursor-not-allowed ${
                  toneClass[item.tone] || toneClass.default
                }`}
              >
                {item.icon && <item.icon className="w-3.5 h-3.5 shrink-0" />}
                {item.label}
              </button>
            ),
          )}
        </div>
      )}
    </>
  );
}
