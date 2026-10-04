import React from 'react';
import { PanelLeftClose, PanelLeftOpen } from 'lucide-react';
import { StatusChip } from '../../../../common/ui/primitives';
import { attemptKind, attemptLabel, classEntryFor, stripHtml } from './helpers';

export default function QuestionRail({
  questions,
  loading,
  selectedQuestion,
  classId,
  collapsed,
  mobileOpen,
  onToggle,
  onCloseMobile,
  onSelect,
}) {
  const list = (
    <div className="h-full min-h-0 flex flex-col bg-surface">
      <div className="shrink-0 h-12 px-3 border-b border-line flex items-center justify-between gap-2">
        <p className="text-xs font-bold uppercase tracking-wider text-muted">Questions</p>
        <button
          type="button"
          onClick={onToggle}
          className="hidden lg:inline-flex p-1.5 rounded-lg text-muted hover:text-fg hover:bg-hover"
          title="Collapse sidebar"
        >
          <PanelLeftClose className="w-4 h-4" />
        </button>
      </div>
      <div className="flex-1 min-h-0 overflow-y-auto p-2 space-y-1.5">
        {loading ? (
          <div className="py-10 flex justify-center">
            <div className="w-7 h-7 border-2 border-accent border-t-transparent rounded-full animate-spin" />
          </div>
        ) : questions.length === 0 ? (
          <p className="text-xs text-muted text-center py-10 px-3">No published questions in this class yet.</p>
        ) : (
          questions.map((question, idx) => {
            const selected = selectedQuestion?._id === question._id;
            const entry = classEntryFor(question, classId);
            const disabled = Boolean(entry?.isDisabled);
            return (
              <button
                key={question._id}
                type="button"
                onClick={() => onSelect(question)}
                className={`w-full rounded-xl border px-2 py-2 text-left transition ${
                  selected ? 'border-accent-line bg-accent-soft' : 'border-line bg-surface hover:bg-hover'
                }`}
              >
                <div className="flex items-center gap-2">
                  <span className="shrink-0 flex h-7 w-7 items-center justify-center rounded-full text-[11px] font-bold tabular-nums bg-accent text-on-accent">
                    {idx + 1}
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="text-xs font-semibold text-fg truncate" title={stripHtml(question.title)}>
                      {stripHtml(question.title) || 'Untitled'}
                    </p>
                    <p className="text-[11px] text-muted truncate">
                      {disabled ? 'Disabled' : attemptLabel(question.studentAttemptStatus)}
                    </p>
                  </div>
                  <StatusChip kind={disabled ? 'bad' : attemptKind(question.studentAttemptStatus)}>
                    {disabled ? 'Off' : attemptLabel(question.studentAttemptStatus)}
                  </StatusChip>
                </div>
              </button>
            );
          })
        )}
      </div>
    </div>
  );

  return (
    <>
      {collapsed && (
        <button
          type="button"
          onClick={onToggle}
          className="hidden lg:flex items-center justify-center w-10 shrink-0 border-r border-line bg-surface hover:bg-hover"
          title="Expand sidebar"
        >
          <PanelLeftOpen className="w-4 h-4 text-muted" />
        </button>
      )}
      <div className={`hidden lg:block shrink-0 border-r border-line overflow-hidden ${collapsed ? 'w-0 border-r-0' : 'w-[17.5rem]'}`}>
        {!collapsed && list}
      </div>
      {mobileOpen && (
        <div className="lg:hidden fixed inset-0 z-40">
          <button type="button" className="absolute inset-0 bg-slate-900/35 dark:bg-black/60" aria-label="Close" onClick={onCloseMobile} />
          <div className="relative h-full w-[17.5rem] max-w-[85vw] border-r border-line shadow-2xl">{list}</div>
        </div>
      )}
    </>
  );
}
