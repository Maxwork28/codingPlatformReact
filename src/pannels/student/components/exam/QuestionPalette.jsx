import React from 'react';
import { Lock } from 'lucide-react';
import { formatClock } from './examUtils';

const TONES = {
  saved: 'bg-ok-soft text-ok border-ok-line',
  dirty: 'bg-warn-soft text-warn border-warn-line',
  empty: 'bg-inset text-muted border-line hover:border-line-strong',
  locked: 'bg-inset text-subtle border-line opacity-60',
};

const LEGEND = [
  ['saved', 'Saved'],
  ['dirty', 'Not saved'],
  ['empty', 'Not answered'],
];

/** Numbered question grid grouped by section. `stateOf(id)` returns saved | dirty | empty | locked. */
export default function QuestionPalette({ groups, activeId, stateOf, flagged, onSelect }) {
  return (
    <div className="space-y-5">
      {groups.map((group) => (
        <div key={group.section.sectionId} className="space-y-2">
          {groups.length > 1 || group.remaining != null ? (
            <div className="flex items-center justify-between gap-2">
              <p className="text-[11px] font-bold uppercase tracking-wider text-muted truncate">{group.section.title}</p>
              {group.remaining != null && (
                <span
                  className={`text-[11px] font-semibold tabular-nums ${
                    group.remaining === 0 ? 'text-bad' : group.remaining < 60 ? 'text-warn' : 'text-muted'
                  }`}
                >
                  {group.remaining === 0 ? 'Time over' : formatClock(group.remaining)}
                </span>
              )}
            </div>
          ) : null}
          <div className="grid grid-cols-5 gap-1.5">
            {group.items.map((item) => {
              const state = stateOf(item.id);
              const active = item.id === activeId;
              return (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => onSelect(item.id)}
                  title={item.title}
                  aria-label={`Question ${item.number}${flagged.has(item.id) ? ', flagged' : ''}`}
                  aria-current={active ? 'step' : undefined}
                  className={`relative h-9 rounded-lg border text-xs font-bold tabular-nums transition ${TONES[state] || TONES.empty} ${
                    active ? 'ring-2 ring-accent ring-offset-1 ring-offset-surface' : ''
                  }`}
                >
                  {state === 'locked' ? <Lock className="w-3 h-3 mx-auto" /> : item.number}
                  {flagged.has(item.id) && <span className="absolute -top-1 -right-1 h-2.5 w-2.5 rounded-full bg-info border-2 border-surface" />}
                </button>
              );
            })}
          </div>
        </div>
      ))}

      <div className="pt-3 border-t border-line grid grid-cols-2 gap-x-3 gap-y-1.5">
        {LEGEND.map(([key, label]) => (
          <span key={key} className="flex items-center gap-1.5 text-[11px] text-muted">
            <span className={`h-3 w-3 rounded border ${TONES[key]}`} />
            {label}
          </span>
        ))}
        <span className="flex items-center gap-1.5 text-[11px] text-muted">
          <span className="h-2.5 w-2.5 rounded-full bg-info" />
          Flagged
        </span>
      </div>
    </div>
  );
}
