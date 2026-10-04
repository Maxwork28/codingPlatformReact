import React from 'react';
import { Search, X } from 'lucide-react';

export function SearchBox({ value, onChange, placeholder, label }) {
  return (
    <div className="relative w-full sm:w-64">
      <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted pointer-events-none" />
      <input
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        aria-label={label || placeholder}
        className="w-full h-9 bg-inset border border-line rounded-xl pl-9 pr-8 text-fg text-xs outline-none focus:border-accent"
      />
      {value && (
        <button
          type="button"
          onClick={() => onChange('')}
          className="absolute right-2 top-1/2 -translate-y-1/2 p-1 rounded-lg text-muted hover:text-fg"
          aria-label="Clear search"
        >
          <X className="w-3.5 h-3.5" />
        </button>
      )}
    </div>
  );
}

export function Segmented({ options, value, onChange, label }) {
  return (
    <div className="flex h-9 rounded-xl border border-line bg-inset p-0.5 overflow-x-auto" role="tablist" aria-label={label}>
      {options.map((o) => (
        <button
          key={o.id}
          type="button"
          role="tab"
          aria-selected={value === o.id}
          onClick={() => onChange(o.id)}
          className={`px-3 rounded-lg text-xs font-semibold transition whitespace-nowrap ${
            value === o.id ? 'bg-surface text-fg shadow-sm' : 'text-muted hover:text-fg'
          }`}
        >
          {o.label}
          {o.count != null && <span className="text-subtle font-normal"> {o.count}</span>}
        </button>
      ))}
    </div>
  );
}

export function RateBar({ value, width = 'w-24' }) {
  if (value == null) return <span className="text-subtle">—</span>;
  const tone = value >= 70 ? 'bg-ok' : value >= 40 ? 'bg-warn' : 'bg-bad';
  return (
    <div className={`flex items-center gap-2 ${width}`}>
      <div className="flex-1 h-1.5 rounded-full bg-hover overflow-hidden">
        <div className={`h-full rounded-full ${tone}`} style={{ width: `${value}%` }} />
      </div>
      <span className="text-[11px] text-body tabular-nums w-8 text-right">{value}%</span>
    </div>
  );
}

export function Checkbox({ checked, indeterminate = false, onChange, label }) {
  return (
    <input
      type="checkbox"
      aria-label={label}
      checked={checked}
      ref={(el) => {
        if (el) el.indeterminate = indeterminate;
      }}
      onClick={(e) => e.stopPropagation()}
      onChange={(e) => onChange(e.target.checked)}
      className="w-3.5 h-3.5 rounded border-line-strong bg-inset text-accent focus:ring-accent cursor-pointer"
    />
  );
}
