import React, { useEffect, useMemo, useState } from 'react';
import { BookPlus, Check, Search } from 'lucide-react';
import { assignQuestionToClass, getAllQuestionsPaginated, publishQuestion } from '../../../../common/services/api';
import Modal from '../../../../common/ui/Modal';
import { Button } from '../../../../common/ui/primitives';
import { type } from '../../../../common/ui/format';
import { QUESTION_TYPES, errorText, plural, selectClass } from './helpers';

const DIFFICULTY_TONE = { easy: 'text-ok', medium: 'text-warn', hard: 'text-bad' };

export default function AttachQuestionsModal({ open, classId, existingIds, onClose, onAttached }) {
  const [query, setQuery] = useState('');
  const [typeFilter, setTypeFilter] = useState('');
  const [results, setResults] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [picked, setPicked] = useState(() => new Map());
  const [publish, setPublish] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!open) return;
    setQuery('');
    setTypeFilter('');
    setPicked(new Map());
    setPublish(true);
    setError('');
  }, [open]);

  useEffect(() => {
    if (!open) return undefined;
    let cancelled = false;
    const timer = setTimeout(async () => {
      setLoading(true);
      try {
        const res = await getAllQuestionsPaginated({ q: query.trim() || undefined, type: typeFilter || undefined, limit: 30, sort: 'title' });
        if (!cancelled) setResults((res.data.questions || []).filter((q) => !q.isExamOnly));
      } catch (err) {
        if (!cancelled) setError(errorText(err, 'Failed to search questions'));
      } finally {
        if (!cancelled) setLoading(false);
      }
    }, 250);
    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [open, query, typeFilter]);

  const existing = useMemo(() => new Set(existingIds.map(String)), [existingIds]);

  const toggle = (q) =>
    setPicked((prev) => {
      const next = new Map(prev);
      if (next.has(q._id)) next.delete(q._id);
      else next.set(q._id, q);
      return next;
    });

  const attach = async () => {
    setSaving(true);
    setError('');
    const ids = [...picked.keys()];
    const outcomes = await Promise.allSettled(
      ids.map(async (id) => {
        await assignQuestionToClass(id, classId);
        if (publish) await publishQuestion(id, classId);
      }),
    );
    const failed = outcomes.filter((r) => r.status === 'rejected');
    setSaving(false);
    if (failed.length === ids.length) {
      setError(errorText(failed[0].reason, 'Failed to attach questions'));
      return;
    }
    onAttached(
      failed.length
        ? `${ids.length - failed.length} attached, ${failed.length} failed`
        : `${plural(ids.length, 'question')} attached${publish ? ' and published' : ''}`,
    );
  };

  return (
    <Modal
      open={open}
      onClose={() => !saving && onClose()}
      title="Attach questions from the bank"
      icon={BookPlus}
      accent="accent"
      width="max-w-2xl"
      footer={
        <>
          <label className="mr-auto flex items-center gap-2 text-xs text-body cursor-pointer">
            <input
              type="checkbox"
              checked={publish}
              onChange={(e) => setPublish(e.target.checked)}
              className="w-3.5 h-3.5 rounded border-line-strong bg-inset text-accent focus:ring-accent"
            />
            Publish to students right away
          </label>
          <Button variant="secondary" onClick={onClose} disabled={saving}>
            Cancel
          </Button>
          <Button onClick={attach} disabled={saving || picked.size === 0}>
            {saving ? 'Attaching…' : picked.size ? `Attach ${picked.size}` : 'Attach'}
          </Button>
        </>
      }
    >
      <div className="flex flex-wrap gap-2">
        <div className="relative flex-1 min-w-48">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted pointer-events-none" />
          <input
            autoFocus
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search by title, tag or paste a question ID"
            className="w-full h-9 bg-inset border border-line rounded-xl pl-9 pr-3 text-fg text-xs outline-none focus:border-accent"
          />
        </div>
        <select value={typeFilter} onChange={(e) => setTypeFilter(e.target.value)} className={selectClass} aria-label="Question type">
          <option value="">All types</option>
          {Object.entries(QUESTION_TYPES).map(([id, label]) => (
            <option key={id} value={id}>
              {label}
            </option>
          ))}
        </select>
      </div>

      {error && <p className="rounded-xl border border-bad-line bg-bad-soft px-3 py-2 text-xs font-semibold text-bad">{error}</p>}

      <ul className="max-h-[50vh] overflow-y-auto -mx-2 divide-y divide-line" aria-busy={loading}>
        {loading && results.length === 0 ? (
          Array.from({ length: 5 }, (_, i) => (
            <li key={i} className="px-2 py-3">
              <div className="h-3 w-2/3 rounded bg-hover animate-pulse" />
            </li>
          ))
        ) : results.length === 0 ? (
          <li className={`${type.body} px-2 py-8 text-center`}>No questions match your search.</li>
        ) : (
          results.map((q) => {
            const inClass = existing.has(String(q._id));
            const isPicked = picked.has(q._id);
            return (
              <li key={q._id}>
                <button
                  type="button"
                  disabled={inClass}
                  onClick={() => toggle(q)}
                  className={`w-full text-left flex items-center gap-3 px-2 py-2.5 rounded-lg transition disabled:cursor-default ${
                    isPicked ? 'bg-accent-soft' : inClass ? 'opacity-60' : 'hover:bg-hover'
                  }`}
                >
                  <span
                    className={`w-4 h-4 rounded border flex items-center justify-center shrink-0 ${
                      isPicked || inClass ? 'bg-accent border-accent text-on-accent' : 'border-line-strong bg-inset'
                    }`}
                  >
                    {(isPicked || inClass) && <Check className="w-3 h-3" />}
                  </span>
                  <span className="flex-1 min-w-0">
                    <span className="block text-xs font-semibold text-fg truncate">{q.title}</span>
                    <span className={`block ${type.meta}`}>
                      {QUESTION_TYPES[q.type] || q.type}
                      {q.difficulty && <span className={`${DIFFICULTY_TONE[q.difficulty] || ''} capitalize`}> · {q.difficulty}</span>}
                      {q.points != null && ` · ${q.points} pts`}
                      {q.classCount > 0 && ` · in ${plural(q.classCount, 'class', 'classes')}`}
                    </span>
                  </span>
                  {inClass && <span className="text-[11px] font-semibold text-muted">Already in class</span>}
                </button>
              </li>
            );
          })
        )}
      </ul>
      <p className={type.meta}>Showing up to 30 matches. Refine the search to find more.</p>
    </Modal>
  );
}
