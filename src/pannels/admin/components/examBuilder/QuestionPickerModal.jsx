import React, { useMemo, useState } from 'react';
import { Check, ExternalLink, ListPlus, Search, X } from 'lucide-react';
import Modal from '../../../../common/ui/Modal';
import { Button, StatusChip } from '../../../../common/ui/primitives';
import { type } from '../../../../common/ui/format';
import { DIFFICULTY_KIND, TYPE_LABELS } from './model';

const selectClass = 'h-9 bg-inset border border-line rounded-xl px-3 text-fg text-xs outline-none focus:border-accent cursor-pointer';
const PAGE = 60;

export default function QuestionPickerModal({ open, onClose, bank, loading, error, onRetry, addedIds, sections, defaultSectionId, onAdd, previewHref }) {
  const [query, setQuery] = useState('');
  const [kind, setKind] = useState('');
  const [difficulty, setDifficulty] = useState('');
  const [scope, setScope] = useState('all');
  const [picked, setPicked] = useState(() => new Set());
  const [sectionId, setSectionId] = useState(defaultSectionId);
  const [limit, setLimit] = useState(PAGE);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return (bank || []).filter(
      (item) =>
        (!kind || item.type === kind) &&
        (!difficulty || item.difficulty === difficulty) &&
        (scope === 'all' || (scope === 'class' ? item.inClass : !addedIds.has(String(item._id)))) &&
        (!q || item.title.toLowerCase().includes(q) || (item.tags || []).some((t) => t.toLowerCase().includes(q))),
    );
  }, [bank, query, kind, difficulty, scope, addedIds]);

  const toggle = (id) =>
    setPicked((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });

  const confirm = () => {
    const chosen = (bank || []).filter((q) => picked.has(String(q._id)));
    onAdd(chosen, sectionId || defaultSectionId);
    setPicked(new Set());
  };

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Add questions"
      icon={ListPlus}
      width="max-w-3xl"
      footer={
        <div className="w-full flex flex-wrap items-center gap-2">
          {sections.length > 1 && (
            <label className="flex items-center gap-2 text-xs text-muted mr-auto">
              Add to
              <select value={sectionId || defaultSectionId} onChange={(e) => setSectionId(e.target.value)} className={selectClass}>
                {sections.map((s) => (
                  <option key={s.sectionId} value={s.sectionId}>
                    {s.title || 'Untitled section'}
                  </option>
                ))}
              </select>
            </label>
          )}
          <Button variant="secondary" onClick={onClose} className={sections.length > 1 ? '' : 'ml-auto'}>
            Cancel
          </Button>
          <Button icon={ListPlus} onClick={confirm} disabled={!picked.size}>
            {picked.size ? `Add ${picked.size} question${picked.size === 1 ? '' : 's'}` : 'Add questions'}
          </Button>
        </div>
      }
    >
      <div className="flex flex-wrap items-center gap-2 -mt-2">
        <div className="relative flex-1 min-w-48">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted pointer-events-none" />
          <input
            autoFocus
            value={query}
            onChange={(e) => {
              setQuery(e.target.value);
              setLimit(PAGE);
            }}
            placeholder="Search by title or tag"
            className="w-full h-9 bg-inset border border-line rounded-xl pl-9 pr-8 text-fg text-xs outline-none focus:border-accent"
            aria-label="Search questions"
          />
          {query && (
            <button type="button" onClick={() => setQuery('')} className="absolute right-2 top-1/2 -translate-y-1/2 p-1 rounded-lg text-muted hover:text-fg" aria-label="Clear search">
              <X className="w-3.5 h-3.5" />
            </button>
          )}
        </div>
        <select value={kind} onChange={(e) => setKind(e.target.value)} className={selectClass} aria-label="Question type">
          <option value="">All types</option>
          {Object.entries(TYPE_LABELS).map(([id, label]) => (
            <option key={id} value={id}>
              {label}
            </option>
          ))}
        </select>
        <select value={difficulty} onChange={(e) => setDifficulty(e.target.value)} className={selectClass} aria-label="Difficulty">
          <option value="">Any difficulty</option>
          <option value="easy">Easy</option>
          <option value="medium">Medium</option>
          <option value="hard">Hard</option>
        </select>
        <select value={scope} onChange={(e) => setScope(e.target.value)} className={selectClass} aria-label="Scope">
          <option value="all">All questions</option>
          <option value="class">Used in this class</option>
          <option value="new">Not in this exam</option>
        </select>
      </div>

      {error ? (
        <div className="text-center py-10 space-y-2">
          <p className="text-xs text-bad">{error}</p>
          <Button variant="secondary" onClick={onRetry}>
            Try again
          </Button>
        </div>
      ) : loading ? (
        <div className="space-y-2">
          {Array.from({ length: 6 }, (_, i) => (
            <div key={i} className="h-12 rounded-xl bg-hover animate-pulse" />
          ))}
        </div>
      ) : filtered.length === 0 ? (
        <p className="text-center py-10 text-xs text-muted">No published questions match these filters.</p>
      ) : (
        <div className="rounded-xl border border-line divide-y divide-line">
          {filtered.slice(0, limit).map((q) => {
            const id = String(q._id);
            const added = addedIds.has(id);
            const on = picked.has(id);
            return (
              <div
                key={id}
                role="checkbox"
                aria-checked={on || added}
                aria-disabled={added}
                tabIndex={added ? -1 : 0}
                onClick={() => !added && toggle(id)}
                onKeyDown={(e) => {
                  if (!added && (e.key === ' ' || e.key === 'Enter')) {
                    e.preventDefault();
                    toggle(id);
                  }
                }}
                className={`flex items-center gap-3 px-3 py-2.5 ${added ? 'opacity-55' : 'cursor-pointer hover:bg-hover'} ${on ? 'bg-accent-soft' : ''}`}
              >
                <span
                  className={`h-[18px] w-[18px] rounded-md border flex items-center justify-center shrink-0 ${
                    on || added ? 'bg-accent border-accent text-on-accent' : 'border-line-strong'
                  }`}
                >
                  {(on || added) && <Check className="w-3 h-3" />}
                </span>
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-semibold text-fg truncate">{q.title}</p>
                  <p className={`${type.meta} truncate`}>
                    {TYPE_LABELS[q.type] || q.type}
                    {q.points != null ? ` · ${q.points} pts` : ''}
                    {q.tags?.length ? ` · ${q.tags.slice(0, 3).join(', ')}` : ''}
                    {added ? ' · already in exam' : q.inClass ? ' · used in this class' : ''}
                  </p>
                </div>
                {q.difficulty && <StatusChip kind={DIFFICULTY_KIND[q.difficulty] || 'neutral'}>{q.difficulty}</StatusChip>}
                {previewHref && (
                  <a
                    href={previewHref(id)}
                    target="_blank"
                    rel="noreferrer"
                    onClick={(e) => e.stopPropagation()}
                    className="p-1.5 rounded-lg text-muted hover:text-fg hover:bg-hover"
                    title="Open question in a new tab"
                    aria-label={`Open ${q.title} in a new tab`}
                  >
                    <ExternalLink className="w-3.5 h-3.5" />
                  </a>
                )}
              </div>
            );
          })}
          {filtered.length > limit && (
            <button type="button" onClick={() => setLimit((l) => l + PAGE)} className="w-full py-2.5 text-xs font-semibold text-accent-ink hover:bg-hover">
              Show more ({filtered.length - limit} left)
            </button>
          )}
        </div>
      )}
      <p className={type.meta}>Only published questions are listed. Draft questions must be published before they can go in an exam.</p>
    </Modal>
  );
}
