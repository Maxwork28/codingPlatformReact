import React from 'react';
import { AlertTriangle, ArrowDown, ArrowUp, ExternalLink, FolderInput, ListPlus, Trash2 } from 'lucide-react';
import ActionMenu from '../../../../common/ui/ActionMenu';
import { Button, StatusChip } from '../../../../common/ui/primitives';
import { type } from '../../../../common/ui/format';
import { DIFFICULTY_KIND, TYPE_LABELS, effectivePoints } from './model';

const smallInput =
  'h-8 w-full bg-inset border border-line rounded-lg px-2 text-fg text-xs text-right tabular-nums outline-none focus:border-accent disabled:opacity-60 disabled:cursor-not-allowed';

export default function SectionCard({
  section,
  index,
  sections,
  questions,
  firstNumber,
  locked,
  onChange,
  onMove,
  onRemove,
  onAddQuestions,
  onQuestionChange,
  onQuestionMove,
  onQuestionRemove,
  previewHref,
}) {
  const total = questions.reduce((sum, q) => sum + effectivePoints(q), 0);
  const multi = sections.length > 1;

  return (
    <section className="rounded-2xl border border-line bg-surface shadow-card">
      <header className="flex flex-wrap items-center gap-2 px-4 py-3 border-b border-line">
        <span className="h-6 min-w-6 px-1.5 rounded-lg bg-accent-soft text-accent-ink text-[11px] font-bold flex items-center justify-center">{index + 1}</span>
        <input
          value={section.title}
          onChange={(e) => onChange({ title: e.target.value })}
          disabled={locked}
          placeholder={`Section ${index + 1}`}
          aria-label="Section title"
          className="flex-1 min-w-40 h-8 bg-transparent border border-transparent hover:border-line focus:border-accent rounded-lg px-2 text-sm font-semibold text-fg outline-none disabled:hover:border-transparent"
        />
        <span className={type.meta}>
          {questions.length} question{questions.length === 1 ? '' : 's'} · {total} pts
        </span>
        <label className="flex items-center gap-1.5 text-xs text-muted" title="Leave blank for no separate section limit">
          Limit
          <input
            type="number"
            min="0"
            value={section.durationMinutes}
            onChange={(e) => onChange({ durationMinutes: e.target.value })}
            disabled={locked}
            placeholder="None"
            aria-label="Section time limit in minutes"
            className={`${smallInput} w-20!`}
          />
          min
        </label>
        {!locked && multi && (
          <ActionMenu
            label="Section actions"
            items={[
              { label: 'Move up', icon: ArrowUp, onClick: () => onMove(-1), disabled: index === 0 },
              { label: 'Move down', icon: ArrowDown, onClick: () => onMove(1), disabled: index === sections.length - 1 },
              { divider: true },
              { label: 'Remove section', icon: Trash2, tone: 'danger', onClick: onRemove },
            ]}
          />
        )}
      </header>

      {questions.length === 0 ? (
        <div className="px-4 py-8 text-center">
          <p className="text-xs text-muted mb-3">No questions in this section yet.</p>
          {!locked && (
            <Button variant="soft" icon={ListPlus} onClick={onAddQuestions}>
              Add questions
            </Button>
          )}
        </div>
      ) : (
        <>
          <div className="hidden sm:grid grid-cols-[2rem_1fr_5.5rem_5.5rem_2rem] gap-3 px-4 pt-2.5 pb-1 text-[10px] font-semibold uppercase tracking-wider text-subtle">
            <span>#</span>
            <span>Question</span>
            <span className="text-right">Points</span>
            <span className="text-right">Limit (min)</span>
            <span />
          </div>
          <ul className="divide-y divide-line">
            {questions.map((q, i) => {
              const moveTargets = sections.filter((s) => s.sectionId !== q.sectionId);
              return (
                <li key={q.questionId} className="grid grid-cols-[2rem_1fr_2rem] sm:grid-cols-[2rem_1fr_5.5rem_5.5rem_2rem] gap-x-3 gap-y-2 items-center px-4 py-2.5">
                  <span className="text-xs font-semibold text-muted tabular-nums">{firstNumber + i}</span>
                  <div className="min-w-0">
                    <p className="text-sm font-medium text-fg truncate">{q.title}</p>
                    <div className="flex flex-wrap items-center gap-1.5 mt-0.5">
                      <span className={type.meta}>{TYPE_LABELS[q.type] || q.type}</span>
                      {q.difficulty && <StatusChip kind={DIFFICULTY_KIND[q.difficulty] || 'neutral'}>{q.difficulty}</StatusChip>}
                      {q.draft && (
                        <StatusChip kind="fail">
                          <AlertTriangle className="w-3 h-3" /> Draft
                        </StatusChip>
                      )}
                    </div>
                  </div>
                  <div className="col-start-2 sm:col-start-auto flex sm:block gap-2 items-center">
                    <span className="sm:hidden text-[11px] text-muted w-14">Points</span>
                    <input
                      type="number"
                      min="0"
                      value={q.points}
                      onChange={(e) => onQuestionChange(q.questionId, { points: e.target.value })}
                      disabled={locked}
                      placeholder={q.defaultPoints != null ? String(q.defaultPoints) : '0'}
                      title="Leave blank to use the question's default points"
                      aria-label={`Points for ${q.title}`}
                      className={smallInput}
                    />
                  </div>
                  <div className="col-start-2 sm:col-start-auto flex sm:block gap-2 items-center">
                    <span className="sm:hidden text-[11px] text-muted w-14">Limit</span>
                    <input
                      type="number"
                      min="0"
                      step="0.5"
                      value={q.timeLimitMinutes}
                      onChange={(e) => onQuestionChange(q.questionId, { timeLimitMinutes: e.target.value })}
                      disabled={locked}
                      placeholder="None"
                      title="Optional time limit for this question"
                      aria-label={`Time limit for ${q.title} in minutes`}
                      className={smallInput}
                    />
                  </div>
                  <div className="row-start-1 col-start-3 sm:row-start-auto sm:col-start-auto">
                    <ActionMenu
                      label={`Actions for ${q.title}`}
                      items={[
                        ...(locked
                          ? []
                          : [
                              { label: 'Move up', icon: ArrowUp, onClick: () => onQuestionMove(q.questionId, -1), disabled: i === 0 },
                              { label: 'Move down', icon: ArrowDown, onClick: () => onQuestionMove(q.questionId, 1), disabled: i === questions.length - 1 },
                              ...(moveTargets.length ? [{ divider: true }] : []),
                              ...moveTargets.map((s) => ({
                                label: `Move to ${s.title || 'untitled section'}`,
                                icon: FolderInput,
                                onClick: () => onQuestionChange(q.questionId, { sectionId: s.sectionId }),
                              })),
                              { divider: true },
                            ]),
                        ...(previewHref ? [{ label: 'Open question', icon: ExternalLink, onClick: () => window.open(previewHref(q.questionId), '_blank', 'noopener') }] : []),
                        ...(locked ? [] : [{ label: 'Remove', icon: Trash2, tone: 'danger', onClick: () => onQuestionRemove(q.questionId) }]),
                      ]}
                    />
                  </div>
                </li>
              );
            })}
          </ul>
          {!locked && (
            <div className="px-4 py-2.5 border-t border-line">
              <button type="button" onClick={onAddQuestions} className="inline-flex items-center gap-1.5 text-xs font-semibold text-accent-ink hover:underline">
                <ListPlus className="w-3.5 h-3.5" /> Add questions to this section
              </button>
            </div>
          )}
        </>
      )}
    </section>
  );
}
