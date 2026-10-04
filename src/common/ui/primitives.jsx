import React from 'react';
import { button as buttonClass, chip, status, surface, table as tableClass, type } from './format';

export function Card({ as = 'div', hover = false, className = '', children, ...rest }) {
  return React.createElement(
    as,
    { className: `${surface.card} ${hover ? surface.cardHover : ''} ${className}`, ...rest },
    children,
  );
}

const statTones = {
  accent: 'bg-accent-soft text-accent-ink border-accent-line',
  ok: 'bg-ok-soft text-ok border-ok-line',
  warn: 'bg-warn-soft text-warn border-warn-line',
  bad: 'bg-bad-soft text-bad border-bad-line',
  info: 'bg-info-soft text-info border-info-line',
  quiet: 'bg-quiet-soft text-quiet border-quiet-line',
};

export function StatCard({ label, value, hint, icon: Icon, tone = 'accent', className = '' }) {
  return (
    <div className={`bg-surface border border-line rounded-xl p-3 shadow-card flex items-center gap-3 ${className}`}>
      {Icon && (
        <span className={`w-8 h-8 rounded-lg border flex items-center justify-center shrink-0 ${statTones[tone] || statTones.accent}`}>
          <Icon className="w-4 h-4" />
        </span>
      )}
      <div className="min-w-0">
        <p className="text-[10px] font-bold uppercase tracking-wider text-muted truncate">{label}</p>
        <p className="text-xl font-bold text-fg leading-tight">{value}</p>
        {hint && <p className={type.meta}>{hint}</p>}
      </div>
    </div>
  );
}

const chipKinds = {
  pass: status.pass,
  ok: status.pass,
  warning: status.warning,
  warn: status.warning,
  fail: status.fail,
  bad: status.fail,
  info: status.info,
  neutral: status.neutral,
  ai: status.ai,
};

export function StatusChip({ kind = 'neutral', className = '', children }) {
  return <span className={`${chipKinds[kind] || chip} ${className}`}>{children}</span>;
}

const buttonVariants = {
  primary: buttonClass.primary,
  secondary: buttonClass.secondary,
  soft: `px-3 py-1.5 ${buttonClass.soft}`,
  publish: `px-3 py-1.5 ${buttonClass.publish}`,
  danger: `px-3 py-1.5 ${buttonClass.danger}`,
  dangerSolid: buttonClass.dangerSolid,
  ghost: 'px-3 py-1.5 text-muted hover:text-fg hover:bg-hover',
};

export function Button({ variant = 'primary', icon: Icon, type: htmlType = 'button', className = '', children, ...rest }) {
  return (
    <button
      type={htmlType}
      className={`${Icon ? buttonClass.withIcon : buttonClass.base} ${buttonVariants[variant] || buttonVariants.primary} ${className}`}
      {...rest}
    >
      {Icon && <Icon className="w-3.5 h-3.5" />}
      {children}
    </button>
  );
}

/** `fill` lets the table shrink to the remaining height of a flex-column page and scroll inside it. */
export function Table({ columns, children, fill = false, className = '' }) {
  return (
    <div className={`${tableClass.wrap} ${fill ? 'table-fill min-h-0' : ''} ${className}`}>
      <table className={tableClass.table}>
        <thead className={tableClass.head}>
          <tr>
            {columns.map((column) => (
              <th key={column.key || column.label} className={`${tableClass.th} ${column.className || ''}`}>
                {column.label}
              </th>
            ))}
          </tr>
        </thead>
        <tbody className={tableClass.body}>{children}</tbody>
      </table>
    </div>
  );
}

export function Switch({ checked, onChange, disabled = false, label, className = '' }) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      aria-label={label}
      disabled={disabled}
      onClick={(e) => {
        e.stopPropagation();
        onChange(!checked);
      }}
      className={`relative inline-flex h-5 w-9 shrink-0 items-center rounded-full border transition disabled:opacity-50 disabled:cursor-not-allowed ${
        checked ? 'bg-accent border-accent' : 'bg-inset border-line-strong'
      } ${className}`}
    >
      <span
        className={`inline-block h-3.5 w-3.5 rounded-full bg-white shadow transition-transform ${
          checked ? 'translate-x-[18px]' : 'translate-x-[2px]'
        }`}
      />
    </button>
  );
}

export function Pagination({ page, pageSize, total, onChange, className = '' }) {
  const pages = Math.max(1, Math.ceil(total / pageSize));
  if (total <= pageSize) return null;
  const from = (page - 1) * pageSize + 1;
  const to = Math.min(page * pageSize, total);
  return (
    <div className={`shrink-0 flex items-center justify-between gap-3 ${className}`}>
      <p className={type.body}>
        Showing <span className="font-semibold text-fg">{from}</span>–<span className="font-semibold text-fg">{to}</span> of{' '}
        <span className="font-semibold text-fg">{total}</span>
      </p>
      <div className="flex items-center gap-1">
        <Button variant="secondary" disabled={page <= 1} onClick={() => onChange(page - 1)}>
          Previous
        </Button>
        <span className="px-2 text-xs text-muted">
          {page} / {pages}
        </span>
        <Button variant="secondary" disabled={page >= pages} onClick={() => onChange(page + 1)}>
          Next
        </Button>
      </div>
    </div>
  );
}

export function EmptyState({ icon: Icon, title, message, action, className = '' }) {
  return (
    <div className={`${surface.empty} p-10 text-center flex flex-col items-center gap-2 ${className}`}>
      {Icon && (
        <span className="w-10 h-10 rounded-xl bg-hover text-muted flex items-center justify-center">
          <Icon className="w-5 h-5" />
        </span>
      )}
      {title && <p className={type.cardTitle}>{title}</p>}
      {message && <p className={type.body}>{message}</p>}
      {action && <div className="mt-2">{action}</div>}
    </div>
  );
}
