import React from 'react';
import { Ban, BarChart3, CheckCircle2, Eye, FileCode2, PanelLeftClose, PanelLeftOpen } from 'lucide-react';
import ActionMenu from '../../../../common/ui/ActionMenu';
import { StatusChip } from '../../../../common/ui/primitives';
import { classEntryFor, formatQuestionPublishedAt, stripHtml } from './helpers';

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
  onStats,
  onSolution,
  onTestCases,
  onPublish,
  onDisable,
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
          aria-label="Collapse sidebar"
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
          <p className="text-xs text-muted text-center py-10 px-3">No questions assigned to this class.</p>
        ) : (
          questions.map((question, idx) => {
            const selected = selectedQuestion?._id === question._id;
            const entry = classEntryFor(question, classId);
            const published = Boolean(entry?.isPublished);
            const disabled = Boolean(entry?.isDisabled);
            const publishedDate = formatQuestionPublishedAt(entry, question);
            return (
              <div
                key={question._id}
                className={`rounded-xl border transition ${
                  selected ? 'border-accent-line bg-accent-soft' : 'border-line bg-surface hover:bg-hover'
                }`}
              >
                <div className="flex items-center gap-1 px-1.5 py-1.5">
                  <button
                    type="button"
                    onClick={() => onSelect(question)}
                    className="flex-1 min-w-0 flex items-center gap-2 text-left px-1 py-0.5"
                  >
                    <span className="shrink-0 flex h-7 w-7 items-center justify-center rounded-full text-[11px] font-bold tabular-nums bg-accent text-on-accent">
                      {idx + 1}
                    </span>
                    <div className="min-w-0 flex-1">
                      <p className="text-xs font-semibold text-fg truncate" title={stripHtml(question.title)}>
                        {stripHtml(question.title) || 'Untitled'}
                      </p>
                      <p className="text-[11px] text-muted truncate">
                        {disabled ? 'Disabled' : published ? (publishedDate ? `Published ${publishedDate}` : 'Published') : 'Unpublished'}
                      </p>
                    </div>
                  </button>
                  <ActionMenu
                    items={[
                      { label: 'Statistics', icon: BarChart3, onClick: () => onStats(question._id) },
                      { label: 'View solution', icon: Eye, onClick: () => onSolution(question._id) },
                      { label: 'Test cases', icon: FileCode2, onClick: () => onTestCases(question._id) },
                      { divider: true },
                      {
                        label: published ? 'Unpublish' : 'Publish',
                        icon: CheckCircle2,
                        onClick: () => onPublish(question._id),
                      },
                      {
                        label: disabled ? 'Enable' : 'Disable',
                        icon: Ban,
                        tone: 'danger',
                        onClick: () => onDisable(question._id),
                      },
                    ]}
                  />
                </div>
              </div>
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
          aria-label="Expand sidebar"
        >
          <PanelLeftOpen className="w-4 h-4 text-muted" />
        </button>
      )}

      <div
        className={`hidden lg:block shrink-0 border-r border-line overflow-hidden ${
          collapsed ? 'w-0 border-r-0' : 'w-[17.5rem]'
        }`}
      >
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

export function LiveChips({ question, classId }) {
  const entry = classEntryFor(question, classId);
  const published = Boolean(entry?.isPublished);
  const disabled = Boolean(entry?.isDisabled);
  const publishedDate = formatQuestionPublishedAt(entry, question);
  return (
    <>
      <StatusChip kind={published ? 'ok' : 'neutral'}>
        {published ? (publishedDate ? `Published ${publishedDate}` : 'Published') : 'Unpublished'}
      </StatusChip>
      <StatusChip kind={disabled ? 'bad' : 'info'}>{disabled ? 'Disabled' : 'Enabled'}</StatusChip>
    </>
  );
}
