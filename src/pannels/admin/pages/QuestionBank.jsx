import React, { useCallback, useEffect, useState } from 'react';
import { useLocation, useNavigate, useSearchParams } from 'react-router-dom';
import { Copy, Eye, FileText, Library, Pencil, Plus, RefreshCw, Search, Trash2, X } from 'lucide-react';
import { adminDeleteQuestion, getAllQuestionsPaginated } from '../../../common/services/api';
import { Button, EmptyState, Pagination, StatusChip, Table } from '../../../common/ui/primitives';
import ActionMenu from '../../../common/ui/ActionMenu';
import { table as tableClass, type } from '../../../common/ui/format';
import { confirmAction, notify } from '../../../common/ui/Toast';

const PAGE_SIZE = 20;

const QUESTION_TYPE_LABELS = {
  singleCorrectMcq: 'MCQ · single',
  multipleCorrectMcq: 'MCQ · multiple',
  fillInTheBlanks: 'Fill in the blanks',
  fillInTheBlanksCoding: 'Fill-in code',
  coding: 'Coding',
  codingWithDriver: 'Coding · driver',
};

const DIFFICULTIES = [
  { id: '', label: 'All' },
  { id: 'easy', label: 'Easy' },
  { id: 'medium', label: 'Medium' },
  { id: 'hard', label: 'Hard' },
];

const DIFFICULTY_CHIP = { easy: 'pass', medium: 'warning', hard: 'fail' };

const USAGE = [
  { id: '', label: 'Any usage' },
  { id: 'bank', label: 'Not in a class' },
  { id: 'classes', label: 'Used in classes' },
  { id: 'exam', label: 'Exam-only' },
];

const SORTS = [
  { id: '', label: 'Recently updated' },
  { id: 'oldest', label: 'Oldest first' },
  { id: 'title', label: 'Title A–Z' },
  { id: 'points', label: 'Most points' },
];

const HIDE_SM = 'hidden md:table-cell';
const HIDE_MD = 'hidden lg:table-cell';

const COLUMNS = [
  { label: 'Question' },
  { label: 'Type', className: HIDE_SM },
  { label: 'Difficulty' },
  { label: 'Points', className: `text-right ${HIDE_SM}` },
  { label: 'Used in', className: HIDE_MD },
  { label: 'Updated', className: HIDE_MD },
  { label: '', key: 'actions' },
];

const selectClass =
  'h-9 bg-inset border border-line rounded-xl px-3 text-fg text-xs outline-none focus:border-accent cursor-pointer';

const stripHtml = (html) => {
  if (!html || typeof html !== 'string') return '';
  const div = document.createElement('div');
  div.innerHTML = html;
  return (div.textContent || '').trim();
};

const formatDate = (value) =>
  value ? new Date(value).toLocaleDateString(undefined, { day: 'numeric', month: 'short', year: 'numeric' }) : '—';

const errorText = (err, fallback) => (typeof err === 'string' ? err : err?.message || fallback);

function Usage({ question }) {
  if (question.isExamOnly) return <span className="text-info">Exam-only</span>;
  const parts = [];
  if (question.classCount) parts.push(`${question.classCount} class${question.classCount === 1 ? '' : 'es'}`);
  if (question.examCount) parts.push(`${question.examCount} exam${question.examCount === 1 ? '' : 's'}`);
  return parts.length ? <span className="text-body">{parts.join(' · ')}</span> : <span className="text-subtle">Not used</span>;
}

function SkeletonRows() {
  return Array.from({ length: 8 }, (_, i) => (
    <tr key={i}>
      {COLUMNS.map((c, j) => (
        <td key={j} className={`${tableClass.td} ${c.className || ''}`}>
          <div className="h-3 rounded bg-hover animate-pulse" style={{ width: j === 0 ? '75%' : '45%' }} />
        </td>
      ))}
    </tr>
  ));
}

const QuestionBank = () => {
  const navigate = useNavigate();
  const base = useLocation().pathname.startsWith('/teacher') ? '/teacher' : '/admin';
  const isAdmin = base === '/admin';
  const [params, setParams] = useSearchParams();

  const query = params.get('q') || '';
  const typeFilter = QUESTION_TYPE_LABELS[params.get('type')] ? params.get('type') : '';
  const difficulty = DIFFICULTIES.some((d) => d.id === params.get('difficulty')) ? params.get('difficulty') : '';
  const usage = USAGE.some((u) => u.id === params.get('usage')) ? params.get('usage') : '';
  const sort = SORTS.some((s) => s.id === params.get('sort')) ? params.get('sort') : '';
  const page = Math.max(1, Number(params.get('page')) || 1);

  const [searchInput, setSearchInput] = useState(query);
  const [questions, setQuestions] = useState([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState('');
  const [busyId, setBusyId] = useState(null);

  const updateParams = useCallback(
    (changes, { resetPage = true } = {}) => {
      setParams(
        (prev) => {
          const next = new URLSearchParams(prev);
          Object.entries(changes).forEach(([key, value]) => {
            if (!value || (key === 'page' && value === 1)) next.delete(key);
            else next.set(key, String(value));
          });
          if (resetPage && !('page' in changes)) next.delete('page');
          return next;
        },
        { replace: true },
      );
    },
    [setParams],
  );

  useEffect(() => {
    if (searchInput.trim() === query) return undefined;
    const timer = setTimeout(() => updateParams({ q: searchInput.trim() }), 300);
    return () => clearTimeout(timer);
  }, [searchInput, query, updateParams]);

  const load = useCallback(async () => {
    setLoading(true);
    setLoadError('');
    try {
      const response = await getAllQuestionsPaginated({
        page,
        limit: PAGE_SIZE,
        q: query || undefined,
        type: typeFilter || undefined,
        difficulty: difficulty || undefined,
        usage: usage || undefined,
        sort: sort || undefined,
      });
      setQuestions(response.data.questions || []);
      setTotal(response.data.pagination?.totalQuestions || 0);
    } catch (err) {
      setLoadError(errorText(err, 'Failed to fetch questions'));
    } finally {
      setLoading(false);
    }
  }, [page, query, typeFilter, difficulty, usage, sort]);

  useEffect(() => {
    load();
  }, [load]);

  const hasFilters = Boolean(query || typeFilter || difficulty || usage);

  const clearFilters = () => {
    setSearchInput('');
    updateParams({ q: '', type: '', difficulty: '', usage: '' });
  };

  const copyId = async (id) => {
    try {
      await navigator.clipboard.writeText(id);
      notify('Question ID copied', 'success');
    } catch {
      notify('Could not copy ID', 'error');
    }
  };

  const removeQuestion = async (question) => {
    const title = stripHtml(question.title) || 'this question';
    const usageNote = question.classCount
      ? ` It will be removed from ${question.classCount} class${question.classCount === 1 ? '' : 'es'}, along with all student submissions for it.`
      : '';
    const ok = await confirmAction(`"${title}" will be permanently deleted.${usageNote} This cannot be undone.`, {
      title: 'Delete question',
      confirmLabel: 'Delete question',
      danger: true,
    });
    if (!ok) return;
    setBusyId(question._id);
    try {
      await adminDeleteQuestion(question._id);
      notify('Question deleted', 'success');
      if (questions.length === 1 && page > 1) updateParams({ page: page - 1 }, { resetPage: false });
      else load();
    } catch (err) {
      notify(errorText(err, 'Failed to delete question'), 'error');
    } finally {
      setBusyId(null);
    }
  };

  const rowActions = (question) => [
    { label: 'Preview & test', icon: Eye, onClick: () => navigate(`${base}/questions/${question._id}/preview`) },
    { label: 'Edit', icon: Pencil, onClick: () => navigate(`${base}/questions/${question._id}/edit`) },
    { label: 'Copy ID', icon: Copy, onClick: () => copyId(question._id) },
    ...(isAdmin
      ? [{ divider: true }, { label: 'Delete question', icon: Trash2, tone: 'danger', onClick: () => removeQuestion(question) }]
      : []),
  ];

  return (
    <div className="h-full flex flex-col px-4 sm:px-5 py-5">
      <section className="flex-1 min-h-0 flex flex-col gap-3">
        <header className="shrink-0 flex flex-wrap items-center gap-2">
          <h1 className={`${type.pageTitle} mr-2`}>Question Bank</h1>
          <div className="relative w-full sm:w-64">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted pointer-events-none" />
            <input
              value={searchInput}
              onChange={(e) => setSearchInput(e.target.value)}
              placeholder="Search title, tag or ID"
              className="w-full h-9 bg-inset border border-line rounded-xl pl-9 pr-8 text-fg text-xs outline-none focus:border-accent"
              aria-label="Search questions"
            />
            {searchInput && (
              <button
                type="button"
                onClick={() => {
                  setSearchInput('');
                  updateParams({ q: '' });
                }}
                className="absolute right-2 top-1/2 -translate-y-1/2 p-1 rounded-lg text-muted hover:text-fg"
                aria-label="Clear search"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            )}
          </div>

          <div className="flex h-9 rounded-xl border border-line bg-inset p-0.5" role="tablist" aria-label="Difficulty">
            {DIFFICULTIES.map((d) => (
              <button
                key={d.id || 'all'}
                type="button"
                role="tab"
                aria-selected={difficulty === d.id}
                onClick={() => updateParams({ difficulty: d.id })}
                className={`px-3 rounded-lg text-xs font-semibold transition ${
                  difficulty === d.id ? 'bg-surface text-fg shadow-sm' : 'text-muted hover:text-fg'
                }`}
              >
                {d.label}
              </button>
            ))}
          </div>

          <select value={typeFilter} onChange={(e) => updateParams({ type: e.target.value })} className={selectClass} aria-label="Question type">
            <option value="">All types</option>
            {Object.entries(QUESTION_TYPE_LABELS).map(([id, label]) => (
              <option key={id} value={id}>
                {label}
              </option>
            ))}
          </select>

          <select value={usage} onChange={(e) => updateParams({ usage: e.target.value })} className={selectClass} aria-label="Usage">
            {USAGE.map((u) => (
              <option key={u.id || 'any'} value={u.id}>
                {u.label}
              </option>
            ))}
          </select>

          <select value={sort} onChange={(e) => updateParams({ sort: e.target.value })} className={`${selectClass} ml-auto`} aria-label="Sort">
            {SORTS.map((s) => (
              <option key={s.id || 'recent'} value={s.id}>
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
          <Button variant="secondary" icon={FileText} className="h-9" onClick={() => navigate(`${base}/questions/drafts`)}>
            Drafts
          </Button>
          <Button icon={Plus} className="h-9" onClick={() => navigate(`${base}/questions/create`)}>
            New question
          </Button>
        </header>

        {loadError ? (
          <EmptyState
            icon={Library}
            title="Couldn't load questions"
            message={loadError}
            action={<Button variant="secondary" onClick={load}>Try again</Button>}
          />
        ) : !loading && questions.length === 0 ? (
          <EmptyState
            icon={Library}
            title={hasFilters ? 'No questions match your filters' : 'The question bank is empty'}
            message={hasFilters ? 'Try a different search, type or difficulty.' : 'Create a question to start building your bank.'}
            action={
              hasFilters ? (
                <Button variant="secondary" onClick={clearFilters}>Clear filters</Button>
              ) : (
                <Button icon={Plus} onClick={() => navigate(`${base}/questions/create`)}>New question</Button>
              )
            }
          />
        ) : (
          <>
            <Table columns={COLUMNS} fill>
              {loading && questions.length === 0 ? (
                <SkeletonRows />
              ) : (
                questions.map((question) => {
                  const title = stripHtml(question.title) || 'Untitled question';
                  return (
                    <tr
                      key={question._id}
                      onClick={() => navigate(`${base}/questions/${question._id}/preview`)}
                      className={`${tableClass.row} cursor-pointer ${busyId === question._id ? 'opacity-50 pointer-events-none' : ''} ${
                        loading ? 'opacity-70' : ''
                      }`}
                    >
                      <td className={`${tableClass.td} max-w-md`}>
                        <p className="text-sm font-semibold text-fg truncate" title={title}>
                          {title}
                        </p>
                        <p className={`${type.meta} truncate`}>
                          {question.createdBy?.name ? `by ${question.createdBy.name}` : 'Unknown author'}
                          {question.tags?.length > 0 && ` · ${question.tags.slice(0, 3).join(', ')}`}
                        </p>
                      </td>
                      <td className={`${tableClass.td} whitespace-nowrap ${HIDE_SM}`}>
                        {QUESTION_TYPE_LABELS[question.type] || question.type}
                      </td>
                      <td className={tableClass.td}>
                        {question.difficulty ? (
                          <StatusChip kind={DIFFICULTY_CHIP[question.difficulty] || 'neutral'}>{question.difficulty}</StatusChip>
                        ) : (
                          <span className="text-subtle">—</span>
                        )}
                      </td>
                      <td className={`${tableClass.td} text-right tabular-nums ${HIDE_SM}`}>{question.points ?? '—'}</td>
                      <td className={`${tableClass.td} whitespace-nowrap ${HIDE_MD}`}>
                        <Usage question={question} />
                      </td>
                      <td className={`${tableClass.td} whitespace-nowrap ${HIDE_MD}`}>{formatDate(question.updatedAt)}</td>
                      <td className={`${tableClass.td} whitespace-nowrap`}>
                        <div className="flex items-center justify-end gap-1" onClick={(e) => e.stopPropagation()}>
                          <Button
                            variant="soft"
                            icon={Pencil}
                            className="hidden sm:flex"
                            onClick={() => navigate(`${base}/questions/${question._id}/edit`)}
                          >
                            Edit
                          </Button>
                          <ActionMenu label={`Actions for ${title}`} items={rowActions(question)} />
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </Table>
            <Pagination
              page={page}
              pageSize={PAGE_SIZE}
              total={total}
              onChange={(p) => updateParams({ page: p }, { resetPage: false })}
            />
          </>
        )}
      </section>
    </div>
  );
};

export default QuestionBank;
