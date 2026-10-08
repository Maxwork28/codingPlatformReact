import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useLocation, useNavigate, useSearchParams } from 'react-router-dom';
import { ArrowLeft, CheckCircle2, Eye, FileText, Pencil, Plus, RefreshCw, Search, Send, Trash2, X } from 'lucide-react';
import { deleteDraftQuestion, getDrafts, publishDraftQuestion } from '../../../common/services/api';
import { Button, EmptyState, Pagination, StatusChip, Table } from '../../../common/ui/primitives';
import ActionMenu from '../../../common/ui/ActionMenu';
import { table as tableClass, type } from '../../../common/ui/format';
import { confirmAction, notify } from '../../../common/ui/Toast';
import { notifyDraftsChanged } from '../../../common/ui/events';
import { QUESTION_TYPE_LABELS as TYPE_LABELS } from '../../../common/domain/questions';
import { stripHtml } from '../../../common/utils/sanitizeHtml';

const PAGE_SIZE = 20;

const DIFFICULTY_CHIP = { easy: 'pass', medium: 'warning', hard: 'fail' };

const FILTERS = [
  { id: 'all', label: 'All', test: () => true },
  { id: 'ready', label: 'Ready', test: (d) => d.issues.length === 0 },
  { id: 'incomplete', label: 'Incomplete', test: (d) => d.issues.length > 0 },
];

const HIDE_SM = 'hidden md:table-cell';
const HIDE_MD = 'hidden lg:table-cell';

const errorText = (err, fallback) => (typeof err === 'string' ? err : err?.message || fallback);

const DAY = 24 * 60 * 60 * 1000;
function relativeTime(value) {
  if (!value) return '—';
  const diff = Date.now() - new Date(value).getTime();
  if (diff < 60 * 60 * 1000) return 'Just now';
  if (diff < DAY) return `${Math.floor(diff / (60 * 60 * 1000))}h ago`;
  if (diff < 30 * DAY) return `${Math.floor(diff / DAY)}d ago`;
  return new Date(value).toLocaleDateString(undefined, { day: 'numeric', month: 'short', year: 'numeric' });
}

const plural = (n, word) => `${n} ${word}${n === 1 ? '' : 's'}`;

const AdminDraftsPage = () => {
  const navigate = useNavigate();
  const base = useLocation().pathname.startsWith('/teacher') ? '/teacher' : '/admin';
  const [params, setParams] = useSearchParams();
  const [drafts, setDrafts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState('');
  const [busy, setBusy] = useState(new Set());
  const [selected, setSelected] = useState(new Set());

  const query = params.get('q') || '';
  const filter = FILTERS.find((f) => f.id === params.get('filter')) || FILTERS[0];
  const page = Math.max(1, Number(params.get('page')) || 1);

  const updateParams = (changes, { resetPage = true } = {}) => {
    setParams(
      (prev) => {
        const next = new URLSearchParams(prev);
        Object.entries(changes).forEach(([key, value]) => {
          if (!value || (key === 'filter' && value === 'all') || (key === 'page' && value === 1)) next.delete(key);
          else next.set(key, String(value));
        });
        if (resetPage && !('page' in changes)) next.delete('page');
        return next;
      },
      { replace: true },
    );
  };

  const load = useCallback(async () => {
    setLoading(true);
    setLoadError('');
    try {
      const response = await getDrafts({ page: 1, limit: 100 });
      setDrafts((response.data.drafts || []).map((d) => ({ ...d, issues: d.issues || [] })));
    } catch (err) {
      setLoadError(errorText(err, 'Failed to fetch drafts'));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const counts = useMemo(() => Object.fromEntries(FILTERS.map((f) => [f.id, drafts.filter(f.test).length])), [drafts]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return drafts
      .filter(filter.test)
      .filter((d) => !q || [stripHtml(d.title), ...(d.tags || [])].some((v) => v.toLowerCase().includes(q)));
  }, [drafts, query, filter]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const currentPage = Math.min(page, totalPages);
  const pageRows = filtered.slice((currentPage - 1) * PAGE_SIZE, currentPage * PAGE_SIZE);
  const hasFilters = Boolean(query) || filter.id !== 'all';

  const selectedDrafts = drafts.filter((d) => selected.has(d._id));
  const allOnPageSelected = pageRows.length > 0 && pageRows.every((d) => selected.has(d._id));

  const toggleOne = (id) =>
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });

  const togglePage = () =>
    setSelected((prev) => {
      const next = new Set(prev);
      pageRows.forEach((d) => (allOnPageSelected ? next.delete(d._id) : next.add(d._id)));
      return next;
    });

  const markBusy = (ids, on) =>
    setBusy((prev) => {
      const next = new Set(prev);
      ids.forEach((id) => (on ? next.add(id) : next.delete(id)));
      return next;
    });

  const afterChange = (removedIds) => {
    setDrafts((list) => list.filter((d) => !removedIds.includes(d._id)));
    setSelected((prev) => new Set([...prev].filter((id) => !removedIds.includes(id))));
    notifyDraftsChanged();
  };

  const runBatch = async (items, action) => {
    const ids = items.map((d) => d._id);
    markBusy(ids, true);
    const results = await Promise.allSettled(items.map((d) => action(d._id)));
    markBusy(ids, false);
    const done = items.filter((_, i) => results[i].status === 'fulfilled').map((d) => d._id);
    const failed = results.filter((r) => r.status === 'rejected').map((r) => errorText(r.reason, 'Failed'));
    if (done.length) afterChange(done);
    return { done: done.length, failed };
  };

  const publish = async (list) => {
    const ready = list.filter((d) => d.issues.length === 0);
    const notReady = list.length - ready.length;
    if (!ready.length) {
      notify('None of the selected drafts are complete yet. Edit them to fill in what is missing.', 'warning');
      return;
    }
    const ok = await confirmAction(
      `Publish ${plural(ready.length, 'draft')} to the question bank?` +
        (notReady ? ` ${plural(notReady, 'incomplete draft')} will be skipped.` : '') +
        ' Published questions can then be added to classes and exams.',
      { title: 'Publish drafts', confirmLabel: `Publish ${ready.length}` },
    );
    if (!ok) return;
    const { done, failed } = await runBatch(ready, publishDraftQuestion);
    if (done) notify(`${plural(done, 'question')} published`, 'success');
    if (failed.length) notify(`${failed.length} failed: ${failed[0]}`, 'error');
  };

  const remove = async (list) => {
    const ok = await confirmAction(
      list.length === 1
        ? `"${stripHtml(list[0].title) || 'Untitled draft'}" will be permanently deleted.`
        : `${plural(list.length, 'draft')} will be permanently deleted.`,
      { title: list.length === 1 ? 'Delete draft' : 'Delete drafts', confirmLabel: 'Delete', danger: true },
    );
    if (!ok) return;
    const { done, failed } = await runBatch(list, deleteDraftQuestion);
    if (done) notify(`${plural(done, 'draft')} deleted`, 'success');
    if (failed.length) notify(`${failed.length} failed: ${failed[0]}`, 'error');
  };

  const editDraft = (id) => navigate(`${base}/questions/${id}/edit`);
  const previewDraft = (id) => navigate(`${base}/questions/${id}/preview`, { state: { returnTo: `${base}/questions/drafts` } });
  const createQuestion = () => navigate(`${base}/questions/create`);

  const rowActions = (draft) => [
    { label: 'Edit', icon: Pencil, onClick: () => editDraft(draft._id) },
    { label: 'Preview & test', icon: Eye, onClick: () => previewDraft(draft._id) },
    { divider: true },
    { label: 'Delete draft', icon: Trash2, tone: 'danger', onClick: () => remove([draft]) },
  ];

  const columns = [
    {
      key: 'select',
      className: 'w-8',
      label: (
        <input
          type="checkbox"
          checked={allOnPageSelected}
          onChange={togglePage}
          aria-label="Select all drafts on this page"
          className="h-3.5 w-3.5 cursor-pointer"
        />
      ),
    },
    { label: 'Draft' },
    { label: 'Type', className: HIDE_SM },
    { label: 'Difficulty', className: HIDE_SM },
    { label: 'Status' },
    { label: 'Updated', className: HIDE_MD },
    { label: '', key: 'actions' },
  ];

  return (
    <div className="h-full flex flex-col px-4 sm:px-5 py-5">
      <section className="flex-1 min-h-0 flex flex-col gap-3">
        <header className="shrink-0 flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={() => navigate(`${base}/questions`)}
            className="p-1.5 rounded-lg text-muted hover:text-fg hover:bg-hover"
            aria-label="Back to question bank"
            title="Back to question bank"
          >
            <ArrowLeft className="w-4 h-4" />
          </button>
          <h1 className={`${type.pageTitle} mr-2`}>Drafts</h1>
          <div className="relative w-full sm:w-64">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted pointer-events-none" />
            <input
              value={query}
              onChange={(e) => updateParams({ q: e.target.value })}
              placeholder="Search title or tag"
              className="w-full h-9 bg-inset border border-line rounded-xl pl-9 pr-8 text-fg text-xs outline-none focus:border-accent"
              aria-label="Search drafts"
            />
            {query && (
              <button
                type="button"
                onClick={() => updateParams({ q: '' })}
                className="absolute right-2 top-1/2 -translate-y-1/2 p-1 rounded-lg text-muted hover:text-fg"
                aria-label="Clear search"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            )}
        </div>
          <div className="flex h-9 rounded-xl border border-line bg-inset p-0.5" role="tablist" aria-label="Filter drafts">
            {FILTERS.map((f) => (
            <button
                key={f.id}
                type="button"
                role="tab"
                aria-selected={filter.id === f.id}
                onClick={() => updateParams({ filter: f.id })}
                className={`px-3 rounded-lg text-xs font-semibold transition ${
                  filter.id === f.id ? 'bg-surface text-fg shadow-sm' : 'text-muted hover:text-fg'
                }`}
              >
                {f.label} <span className="text-subtle font-normal">{counts[f.id]}</span>
              </button>
            ))}
          </div>
          <Button
            variant="secondary"
            icon={RefreshCw}
            onClick={load}
            disabled={loading}
            aria-label="Refresh"
            title="Refresh"
            className={`ml-auto h-9 w-9 justify-center p-0! ${loading ? '[&>svg]:animate-spin' : ''}`}
          />
          <Button icon={Plus} className="h-9" onClick={createQuestion}>
            New question
          </Button>
        </header>

        {selected.size > 0 && (
          <div className="shrink-0 flex flex-wrap items-center gap-2 rounded-xl border border-accent-line bg-accent-soft px-3 py-2">
            <span className="text-xs font-semibold text-accent-ink">{selected.size} selected</span>
            <Button variant="publish" icon={Send} onClick={() => publish(selectedDrafts)}>
              Publish
            </Button>
            <Button variant="danger" icon={Trash2} className="px-3 py-1.5" onClick={() => remove(selectedDrafts)}>
              Delete
            </Button>
            <button type="button" onClick={() => setSelected(new Set())} className="ml-auto text-xs text-muted hover:text-fg">
              Clear selection
            </button>
        </div>
      )}

        {loadError ? (
          <EmptyState
            icon={FileText}
            title="Couldn't load drafts"
            message={loadError}
            action={<Button variant="secondary" onClick={load}>Try again</Button>}
          />
        ) : !loading && filtered.length === 0 ? (
          <EmptyState
            icon={hasFilters ? FileText : CheckCircle2}
            title={hasFilters ? 'No drafts match your filters' : 'No drafts'}
            message={
              hasFilters
                ? 'Try a different search or filter.'
                : 'Questions you save as draft appear here until you publish them.'
            }
            action={
              hasFilters ? (
                <Button variant="secondary" onClick={() => updateParams({ q: '', filter: 'all' })}>Clear filters</Button>
              ) : (
                <Button icon={Plus} onClick={createQuestion}>New question</Button>
              )
            }
          />
        ) : (
          <>
            <Table columns={columns} fill>
              {loading && drafts.length === 0
                ? Array.from({ length: 4 }, (_, i) => (
                    <tr key={i}>
                      {columns.map((c, j) => (
                        <td key={j} className={`${tableClass.td} ${c.className || ''}`}>
                          <div className="h-3 rounded bg-hover animate-pulse" style={{ width: j === 1 ? '70%' : '40%' }} />
                        </td>
                      ))}
                    </tr>
                  ))
                : pageRows.map((draft) => {
                    const title = stripHtml(draft.title) || 'Untitled draft';
                    const description = stripHtml(draft.description);
                    const ready = draft.issues.length === 0;
                    return (
                      <tr
                key={draft._id}
                        onClick={() => editDraft(draft._id)}
                        className={`${tableClass.row} cursor-pointer ${selected.has(draft._id) ? 'bg-accent-soft/40' : ''} ${
                          busy.has(draft._id) ? 'opacity-50 pointer-events-none' : ''
                        }`}
              >
                        <td className={tableClass.td} onClick={(e) => e.stopPropagation()}>
                  <input
                    type="checkbox"
                            checked={selected.has(draft._id)}
                            onChange={() => toggleOne(draft._id)}
                            aria-label={`Select ${title}`}
                            className="h-3.5 w-3.5 cursor-pointer"
                          />
                        </td>
                        <td className={`${tableClass.td} max-w-md`}>
                          <p className="text-sm font-semibold text-fg truncate" title={title}>
                            {title}
                          </p>
                          <p className={`${type.meta} truncate`}>{description || 'No description yet'}</p>
                        </td>
                        <td className={`${tableClass.td} whitespace-nowrap ${HIDE_SM}`}>{TYPE_LABELS[draft.type] || draft.type}</td>
                        <td className={`${tableClass.td} ${HIDE_SM}`}>
                          {draft.difficulty ? (
                            <StatusChip kind={DIFFICULTY_CHIP[draft.difficulty] || 'neutral'}>{draft.difficulty}</StatusChip>
                          ) : (
                            <span className="text-subtle">—</span>
                          )}
                        </td>
                        <td className={tableClass.td}>
                          {ready ? (
                            <StatusChip kind="pass">Ready</StatusChip>
                          ) : (
                            <span className="text-warn" title={`Missing: ${draft.issues.join(', ')}`}>
                              Needs {draft.issues.slice(0, 2).join(', ')}
                              {draft.issues.length > 2 && ` +${draft.issues.length - 2}`}
                      </span>
                          )}
                        </td>
                        <td className={`${tableClass.td} whitespace-nowrap ${HIDE_MD}`}>{relativeTime(draft.updatedAt)}</td>
                        <td className={`${tableClass.td} whitespace-nowrap`}>
                          <div className="flex items-center justify-end gap-1" onClick={(e) => e.stopPropagation()}>
                            {ready ? (
                              <Button variant="publish" icon={Send} className="hidden sm:flex" onClick={() => publish([draft])}>
                      Publish
                              </Button>
                            ) : (
                              <Button variant="soft" icon={Pencil} className="hidden sm:flex" onClick={() => editDraft(draft._id)}>
                                Finish
                              </Button>
                            )}
                            <ActionMenu label={`Actions for ${title}`} items={rowActions(draft)} />
        </div>
                        </td>
                      </tr>
                    );
                  })}
            </Table>
            <Pagination
              page={currentPage}
              pageSize={PAGE_SIZE}
              total={filtered.length}
              onChange={(p) => updateParams({ page: p }, { resetPage: false })}
            />
          </>
        )}
      </section>
    </div>
  );
};

export default AdminDraftsPage;
