import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useLocation, useNavigate, useSearchParams } from 'react-router-dom';
import { ArrowLeft, Award, CopyPlus, Pencil, Plus, RefreshCw, Search, Trash2, X } from 'lucide-react';
import { deleteExam, listExamTemplates } from '../../../common/services/api';
import { Button, EmptyState, Pagination, Table } from '../../../common/ui/primitives';
import ActionMenu from '../../../common/ui/ActionMenu';
import { table as tableClass, type } from '../../../common/ui/format';
import { confirmAction, notify } from '../../../common/ui/Toast';

const PAGE_SIZE = 10;

const USAGE_FILTERS = [
  { id: 'all', label: 'All' },
  { id: 'used', label: 'Used' },
  { id: 'unused', label: 'Never used' },
];

const SORTS = {
  updated: { label: 'Recently updated', compare: (a, b) => new Date(b.updatedAt) - new Date(a.updatedAt) },
  name: { label: 'Name A–Z', compare: (a, b) => a.title.localeCompare(b.title) },
  used: { label: 'Most used', compare: (a, b) => b.usageCount - a.usageCount },
};

const HIDE_SM = 'hidden md:table-cell';
const HIDE_MD = 'hidden lg:table-cell';

const COLUMNS = [
  { label: 'Template' },
  { label: 'Source class', className: HIDE_SM },
  { label: 'Questions', className: 'text-right' },
  { label: 'Duration', className: `text-right ${HIDE_SM}` },
  { label: 'Exams created', className: `text-right ${HIDE_MD}` },
  { label: 'Updated', className: HIDE_MD },
  { label: '', key: 'actions' },
];

const selectClass = 'h-9 bg-inset border border-line rounded-xl px-3 text-fg text-xs outline-none focus:border-accent cursor-pointer';

const formatDate = (value) =>
  value ? new Date(value).toLocaleDateString(undefined, { day: 'numeric', month: 'short', year: 'numeric' }) : '—';

const plural = (n, word) => `${n} ${word}${n === 1 ? '' : 's'}`;

const errorText = (err, fallback) => (typeof err === 'string' ? err : err?.response?.data?.error || fallback);

function SkeletonRows() {
  return Array.from({ length: 5 }, (_, i) => (
    <tr key={i}>
      {COLUMNS.map((c, j) => (
        <td key={j} className={`${tableClass.td} ${c.className || ''}`}>
          <div className="h-3 rounded bg-hover animate-pulse" style={{ width: j === 0 ? '70%' : '50%' }} />
        </td>
      ))}
    </tr>
  ));
}

const ExamTemplates = () => {
  const navigate = useNavigate();
  const base = useLocation().pathname.startsWith('/teacher') ? '/teacher' : '/admin';
  const [params, setParams] = useSearchParams();
  const [templates, setTemplates] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [busyId, setBusyId] = useState(null);

  const query = params.get('q') || '';
  const usageFilter = USAGE_FILTERS.some((f) => f.id === params.get('usage')) ? params.get('usage') : 'all';
  const classFilter = params.get('class') || '';
  const sort = SORTS[params.get('sort')] ? params.get('sort') : 'updated';
  const page = Math.max(1, Number(params.get('page')) || 1);

  const updateParams = (changes, { resetPage = true } = {}) => {
    setParams(
      (prev) => {
        const next = new URLSearchParams(prev);
        Object.entries(changes).forEach(([key, value]) => {
          const isDefault = !value || (key === 'usage' && value === 'all') || (key === 'sort' && value === 'updated') || (key === 'page' && value === 1);
          if (isDefault) next.delete(key);
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
    setError('');
    try {
      const response = await listExamTemplates();
      setTemplates(response.data.templates || []);
    } catch (err) {
      setError(errorText(err, 'Failed to fetch templates'));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const classOptions = useMemo(() => {
    const map = new Map();
    templates.forEach((t) => t.classId && map.set(String(t.classId), t.className || 'Unknown class'));
    return [...map.entries()].sort((a, b) => a[1].localeCompare(b[1]));
  }, [templates]);

  const counts = useMemo(() => {
    const used = templates.filter((t) => t.usageCount > 0).length;
    return { all: templates.length, used, unused: templates.length - used };
  }, [templates]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return templates
      .filter((t) => usageFilter === 'all' || (usageFilter === 'used' ? t.usageCount > 0 : t.usageCount === 0))
      .filter((t) => !classFilter || String(t.classId) === classFilter)
      .filter((t) => {
        if (!q) return true;
        return [t.title, t.description, t.template?.templateDescription, t.className, t.createdByName]
          .filter(Boolean)
          .some((text) => text.toLowerCase().includes(q));
      })
      .sort(SORTS[sort].compare);
  }, [templates, query, usageFilter, classFilter, sort]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const currentPage = Math.min(page, totalPages);
  const pageRows = filtered.slice((currentPage - 1) * PAGE_SIZE, currentPage * PAGE_SIZE);
  const hasFilters = Boolean(query) || usageFilter !== 'all' || Boolean(classFilter);
  const showSkeleton = loading && templates.length === 0;

  const startFromTemplate = (t) => navigate(`${base}/exams/templates/${t._id}/use`);
  const editTemplate = (t) => navigate(`${base}/classes/${t.classId}/exams/${t._id}/edit`);
  const createTemplate = () => navigate(`${base}/exams/templates/create`);

  const removeTemplate = async (t) => {
    const usedNote = t.usageCount
      ? ` The ${plural(t.usageCount, 'exam')} already created from it will not be affected.`
      : '';
    const ok = await confirmAction(`Delete the template "${t.title}"?${usedNote} This cannot be undone.`, {
      title: 'Delete template',
      confirmLabel: 'Delete template',
      danger: true,
    });
    if (!ok) return;
    setBusyId(t._id);
    try {
      await deleteExam(t._id);
      setTemplates((prev) => prev.filter((x) => x._id !== t._id));
      notify(`"${t.title}" deleted`, 'success');
    } catch (err) {
      notify(errorText(err, 'Failed to delete template'), 'error');
    } finally {
      setBusyId(null);
    }
  };

  const rowActions = (t) => [
    { label: 'Create exam from template', icon: CopyPlus, onClick: () => startFromTemplate(t) },
    { label: 'Edit template', icon: Pencil, onClick: () => editTemplate(t), disabled: !t.classId },
    { divider: true },
    { label: 'Delete template', icon: Trash2, tone: 'danger', onClick: () => removeTemplate(t) },
  ];

  return (
    <div className="h-full flex flex-col px-4 sm:px-5 py-5">
      <section className="flex-1 min-h-0 flex flex-col gap-3">
        <header className="shrink-0 flex flex-wrap items-center gap-2">
          <Button
            variant="ghost"
            icon={ArrowLeft}
            className="h-9 w-9 justify-center p-0!"
            onClick={() => navigate(`${base}/exams`)}
            aria-label="Back to exams"
            title="Back to exams"
          />
          <h1 className={`${type.pageTitle} mr-2`}>Exam Templates</h1>
          <div className="relative w-full sm:w-72">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted pointer-events-none" />
            <input
              value={query}
              onChange={(e) => updateParams({ q: e.target.value })}
              placeholder="Search by name, class or author"
              className="w-full h-9 bg-inset border border-line rounded-xl pl-9 pr-8 text-fg text-xs outline-none focus:border-accent"
              aria-label="Search templates"
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

          <div className="flex h-9 rounded-xl border border-line bg-inset p-0.5" role="tablist" aria-label="Filter by usage">
            {USAGE_FILTERS.map((f) => (
              <button
                key={f.id}
                type="button"
                role="tab"
                aria-selected={usageFilter === f.id}
                onClick={() => updateParams({ usage: f.id })}
                className={`px-3 rounded-lg text-xs font-semibold transition whitespace-nowrap ${
                  usageFilter === f.id ? 'bg-surface text-fg shadow-sm' : 'text-muted hover:text-fg'
                }`}
              >
                {f.label} <span className="text-subtle font-normal">{counts[f.id]}</span>
                  </button>
            ))}
          </div>

          <select
            value={classFilter}
            onChange={(e) => updateParams({ class: e.target.value })}
            className={`ml-auto max-w-48 ${selectClass}`}
            aria-label="Filter by class"
          >
            <option value="">All classes</option>
            {classOptions.map(([id, name]) => (
              <option key={id} value={id}>
                {name}
              </option>
            ))}
          </select>

          <select value={sort} onChange={(e) => updateParams({ sort: e.target.value })} className={selectClass} aria-label="Sort templates">
            {Object.entries(SORTS).map(([id, s]) => (
              <option key={id} value={id}>
                {s.label}
              </option>
            ))}
          </select>

          <Button
            variant="secondary"
            icon={RefreshCw}
            onClick={load}
            disabled={loading}
            aria-label="Refresh"
            title="Refresh"
            className={`h-9 w-9 justify-center p-0! ${loading ? '[&>svg]:animate-spin' : ''}`}
          />

          <Button icon={Plus} className="h-9" onClick={createTemplate}>
            New template
          </Button>
        </header>

        {error ? (
          <EmptyState
            icon={Award}
            title="Couldn't load templates"
            message={error}
            action={<Button variant="secondary" onClick={load}>Try again</Button>}
          />
        ) : !showSkeleton && filtered.length === 0 ? (
          <EmptyState
            icon={Award}
            title={hasFilters ? 'No templates match your filters' : 'No exam templates yet'}
            message={
              hasFilters
                ? 'Try a different search, class or usage filter.'
                : 'Save an exam layout once as a template, then create exams for any class from it in a few clicks.'
            }
            action={
              hasFilters ? (
                <Button variant="secondary" onClick={() => updateParams({ q: '', usage: 'all', class: '' })}>Clear filters</Button>
              ) : (
                <Button icon={Plus} onClick={createTemplate}>New template</Button>
              )
            }
          />
        ) : (
          <>
            <Table columns={COLUMNS} fill>
              {showSkeleton ? (
                <SkeletonRows />
              ) : (
                pageRows.map((t) => {
                  const summary = t.template?.templateDescription || t.description;
                  return (
                    <tr
                      key={t._id}
                      onClick={() => startFromTemplate(t)}
                      className={`${tableClass.row} cursor-pointer ${busyId === t._id ? 'opacity-50 pointer-events-none' : ''}`}
                    >
                      <td className={`${tableClass.td} max-w-xs`}>
                        <p className="text-sm font-semibold text-fg truncate">{t.title}</p>
                        {summary && <p className={`${type.meta} truncate`}>{summary}</p>}
                      </td>
                      <td className={`${tableClass.td} whitespace-nowrap ${HIDE_SM}`}>
                        {t.className ? (
                          <span className={t.classStatus === 'inactive' ? 'text-muted' : 'text-body'}>
                            {t.className}
                            {t.classStatus === 'inactive' && <span className={type.meta}> (inactive)</span>}
                          </span>
                        ) : (
                          <span className="text-warn">Class deleted</span>
                        )}
                      </td>
                      <td className={`${tableClass.td} text-right whitespace-nowrap`}>
                        <p className="tabular-nums text-body">{t.questionCount}</p>
                        <p className={type.meta}>
                          {plural(t.sectionCount, 'section')}
                          {t.totalPoints > 0 && ` · ${t.totalPoints} pts`}
                        </p>
                      </td>
                      <td className={`${tableClass.td} text-right tabular-nums whitespace-nowrap ${HIDE_SM}`}>
                        {t.proctoring?.durationMinutes ? `${t.proctoring.durationMinutes} min` : '—'}
                      </td>
                      <td className={`${tableClass.td} text-right whitespace-nowrap ${HIDE_MD}`}>
                        <p className={`tabular-nums ${t.usageCount ? 'text-body' : 'text-muted'}`}>{t.usageCount}</p>
                        {t.lastUsedAt && <p className={type.meta}>last {formatDate(t.lastUsedAt)}</p>}
                      </td>
                      <td className={`${tableClass.td} whitespace-nowrap ${HIDE_MD}`}>
                        <p className="text-body">{formatDate(t.updatedAt)}</p>
                        <p className={type.meta}>by {t.createdByName || 'Unknown'}</p>
                      </td>
                      <td className={`${tableClass.td} whitespace-nowrap`}>
                        <div className="flex items-center justify-end gap-1">
                          <Button
                            variant="soft"
                            icon={CopyPlus}
                            className="hidden sm:flex"
                            onClick={(e) => {
                              e.stopPropagation();
                              startFromTemplate(t);
                            }}
                          >
                            Use
                          </Button>
                          <ActionMenu label={`Actions for ${t.title}`} items={rowActions(t)} />
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
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

export default ExamTemplates;
