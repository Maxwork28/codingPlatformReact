import React, { useEffect, useMemo, useState } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { useNavigate, useSearchParams } from 'react-router-dom';
import {
  ClipboardList,
  ExternalLink,
  Pencil,
  Play,
  Plus,
  RefreshCw,
  School,
  Search,
  Trash2,
  X,
} from 'lucide-react';
import { fetchClasses } from '../../../common/components/redux/classSlice';
import { changeClassStatus, deleteClass } from '../../../common/services/api';
import { Button, EmptyState, Pagination, Switch, Table } from '../../../common/ui/primitives';
import ActionMenu from '../../../common/ui/ActionMenu';
import { inputClass, table as tableClass, type } from '../../../common/ui/format';
import { confirmAction, notify } from '../../../common/ui/Toast';
import ClassFormModal from '../components/ClassFormModal';
import { useStaffBase } from '../components/classDetails/helpers';

const PAGE_SIZE = 10;

const STATUS_FILTERS = [
  { id: 'all', label: 'All' },
  { id: 'active', label: 'Active' },
  { id: 'inactive', label: 'Inactive' },
];

const SORTS = {
  newest: { label: 'Newest first', compare: (a, b) => new Date(b.createdAt) - new Date(a.createdAt) },
  name: { label: 'Name A–Z', compare: (a, b) => a.name.localeCompare(b.name) },
  students: { label: 'Most students', compare: (a, b) => (b.students?.length || 0) - (a.students?.length || 0) },
};

const HIDE_SM = 'hidden md:table-cell';
const HIDE_MD = 'hidden lg:table-cell';

const COLUMNS = [
  { label: 'Class' },
  { label: 'Teachers', className: HIDE_SM },
  { label: 'Students', className: 'text-right' },
  { label: 'Questions', className: `text-right ${HIDE_MD}` },
  { label: 'Exams', className: `text-right ${HIDE_SM}` },
  { label: 'Status' },
  { label: 'Created', className: HIDE_MD },
  { label: '', key: 'actions' },
];

const formatDate = (value) =>
  value ? new Date(value).toLocaleDateString(undefined, { day: 'numeric', month: 'short', year: 'numeric' }) : '—';

const plural = (n, word) => `${n} ${word}${n === 1 ? '' : 's'}`;

function TeacherList({ teachers = [] }) {
  if (teachers.length === 0) return <span className="text-warn">Not assigned</span>;
  const [first, ...rest] = teachers;
  return (
    <span className="text-body" title={teachers.map((t) => t.name).join(', ')}>
      {first.name}
      {rest.length > 0 && <span className="text-muted"> +{rest.length}</span>}
    </span>
  );
}

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

const ClassManagement = () => {
  const dispatch = useDispatch();
  const navigate = useNavigate();
  const { base, isTeacher } = useStaffBase();
  const { classes, status, error } = useSelector((state) => state.classes);
  const [params, setParams] = useSearchParams();

  const query = params.get('q') || '';
  const statusFilter = STATUS_FILTERS.some((f) => f.id === params.get('status')) ? params.get('status') : 'all';
  const sort = SORTS[params.get('sort')] ? params.get('sort') : 'newest';
  const page = Math.max(1, Number(params.get('page')) || 1);

  const [formState, setFormState] = useState({ open: false, editing: null });
  const [busyId, setBusyId] = useState(null);

  const updateParams = (changes, { resetPage = true } = {}) => {
    setParams(
      (prev) => {
        const next = new URLSearchParams(prev);
        Object.entries(changes).forEach(([key, value]) => {
          const isDefault = !value || (key === 'status' && value === 'all') || (key === 'sort' && value === 'newest') || (key === 'page' && value === 1);
          if (isDefault) next.delete(key);
          else next.set(key, String(value));
        });
        if (resetPage && !('page' in changes)) next.delete('page');
        return next;
      },
      { replace: true },
    );
  };

  const reload = () => dispatch(fetchClasses(''));

  useEffect(() => {
    dispatch(fetchClasses(''));
  }, [dispatch]);

  const stats = useMemo(
    () => ({
      total: classes.length,
      active: classes.filter((c) => c.status === 'active').length,
      unassigned: classes.filter((c) => !c.teachers?.length).length,
    }),
    [classes],
  );

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return classes
      .filter((c) => statusFilter === 'all' || c.status === statusFilter)
      .filter((c) => {
        if (!q) return true;
        return [c.name, c.description, c.createdBy?.name, ...(c.teachers || []).map((t) => t.name)]
          .filter(Boolean)
          .some((text) => text.toLowerCase().includes(q));
      })
      .sort(SORTS[sort].compare);
  }, [classes, query, statusFilter, sort]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const currentPage = Math.min(page, totalPages);
  const pageRows = filtered.slice((currentPage - 1) * PAGE_SIZE, currentPage * PAGE_SIZE);
  const loading = status === 'loading' && classes.length === 0;
  const hasFilters = Boolean(query) || statusFilter !== 'all';

  const openClass = (id) => navigate(`${base}/classes/${id}`);

  const handleSaved = (data) => {
    const wasEdit = Boolean(formState.editing);
    setFormState({ open: false, editing: null });
    notify(data?.message || (wasEdit ? 'Class updated' : 'Class created'), 'success');
    reload();
    if (!wasEdit && data?.class?._id) openClass(data.class._id);
  };

  const toggleStatus = async (cls) => {
    const next = cls.status === 'active' ? 'inactive' : 'active';
    if (next === 'inactive') {
      const ok = await confirmAction(`Mark "${cls.name}" as inactive? You can reactivate it at any time.`, {
        title: 'Deactivate class',
        confirmLabel: 'Deactivate',
      });
      if (!ok) return;
    }
    setBusyId(cls._id);
    try {
      await changeClassStatus(cls._id, next);
      notify(`"${cls.name}" is now ${next}`, 'success');
      reload();
          } catch (err) {
      notify(typeof err === 'string' ? err : 'Failed to change class status', 'error');
    } finally {
      setBusyId(null);
    }
  };

  const removeClass = async (cls) => {
    const parts = [plural(cls.examCount || 0, 'exam'), 'all submissions', 'the leaderboard'];
    const ok = await confirmAction(
      `"${cls.name}" will be permanently deleted along with ${parts.join(', ')}. ` +
        `Students, teachers and bank questions are kept. This cannot be undone.`,
      { title: 'Delete class', confirmLabel: 'Delete class', danger: true },
    );
    if (!ok) return;
    setBusyId(cls._id);
    try {
      await deleteClass(cls._id);
      notify(`"${cls.name}" deleted`, 'success');
      reload();
    } catch (err) {
      notify(typeof err === 'string' ? err : 'Failed to delete class', 'error');
    } finally {
      setBusyId(null);
    }
  };

  const rowActions = (cls) => [
    { label: 'Open class', icon: ExternalLink, onClick: () => openClass(cls._id) },
    ...(isTeacher
      ? [{ label: 'Take class', icon: Play, onClick: () => navigate('/teacher/take-class', { state: { classId: cls._id } }) }]
      : []),
    { label: 'Manage exams', icon: ClipboardList, onClick: () => navigate(`${base}/classes/${cls._id}/exams`) },
    { label: 'Edit details', icon: Pencil, onClick: () => setFormState({ open: true, editing: cls }) },
    ...(!isTeacher
      ? [{ divider: true }, { label: 'Delete class', icon: Trash2, tone: 'danger', onClick: () => removeClass(cls) }]
      : []),
  ];

  return (
    <div className="h-full flex flex-col px-4 sm:px-5 py-5">
      <section className="flex-1 min-h-0 flex flex-col gap-3">
        <header className="shrink-0 flex flex-wrap items-center gap-2">
          <h1 className={`${type.pageTitle} mr-2`}>{isTeacher ? 'My Classes' : 'Classes'}</h1>
          <div className="relative w-full sm:w-72">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted pointer-events-none" />
            <input
              value={query}
              onChange={(e) => updateParams({ q: e.target.value })}
              placeholder={isTeacher ? 'Search classes' : 'Search by class, teacher or creator'}
              className={`${inputClass} h-9 pl-9 pr-8`}
              aria-label="Search classes"
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

          <div className="flex h-9 rounded-xl border border-line bg-inset p-0.5" role="tablist" aria-label="Filter by status">
            {STATUS_FILTERS.map((f) => {
              const count = f.id === 'all' ? stats.total : f.id === 'active' ? stats.active : stats.total - stats.active;
              return (
          <button
                  key={f.id}
              type="button"
                  role="tab"
                  aria-selected={statusFilter === f.id}
                  onClick={() => updateParams({ status: f.id })}
                  className={`px-3 rounded-lg text-xs font-semibold transition ${
                    statusFilter === f.id ? 'bg-surface text-fg shadow-sm' : 'text-muted hover:text-fg'
                  }`}
                >
                  {f.label} <span className="text-subtle font-normal">{count}</span>
            </button>
              );
            })}
          </div>

          <select
            value={sort}
            onChange={(e) => updateParams({ sort: e.target.value })}
            className="ml-auto h-9 bg-inset border border-line rounded-xl px-3 text-fg text-xs outline-none focus:border-accent cursor-pointer"
            aria-label="Sort classes"
          >
            {Object.entries(SORTS).map(([id, s]) => (
              <option key={id} value={id}>
                {s.label}
              </option>
            ))}
          </select>

          <Button
            variant="secondary"
            icon={RefreshCw}
            onClick={reload}
            disabled={status === 'loading'}
            aria-label="Refresh"
            title="Refresh"
            className={`h-9 w-9 justify-center p-0! ${status === 'loading' ? '[&>svg]:animate-spin' : ''}`}
          />

          {!isTeacher && (
            <Button icon={Plus} className="h-9" onClick={() => setFormState({ open: true, editing: null })}>
              New class
            </Button>
          )}
        </header>

        {!isTeacher && stats.unassigned > 0 && (
          <p className="shrink-0 rounded-xl border border-warn-line bg-warn-soft px-3 py-2 text-xs text-warn">
            {plural(stats.unassigned, 'class')} {stats.unassigned === 1 ? 'has' : 'have'} no teacher assigned. Open the class to add one.
          </p>
        )}

        {status === 'failed' ? (
          <EmptyState
            icon={School}
            title="Couldn't load classes"
            message={error || 'Something went wrong while fetching classes.'}
            action={<Button variant="secondary" onClick={reload}>Try again</Button>}
          />
        ) : !loading && filtered.length === 0 ? (
          <EmptyState
            icon={School}
            title={hasFilters ? 'No classes match your filters' : 'No classes yet'}
            message={
              hasFilters
                ? 'Try a different search or status.'
                : isTeacher
                  ? 'You have not been assigned to any classes yet.'
                  : 'Create your first class to start adding students and questions.'
            }
            action={
              hasFilters ? (
                <Button variant="secondary" onClick={() => updateParams({ q: '', status: 'all' })}>Clear filters</Button>
              ) : isTeacher ? null : (
                <Button icon={Plus} onClick={() => setFormState({ open: true, editing: null })}>New class</Button>
              )
            }
          />
        ) : (
          <>
            <Table columns={COLUMNS} fill>
              {loading ? (
                <SkeletonRows />
              ) : (
                pageRows.map((cls) => (
                  <tr 
                    key={cls._id}
                    onClick={() => openClass(cls._id)}
                    className={`${tableClass.row} cursor-pointer ${busyId === cls._id ? 'opacity-50 pointer-events-none' : ''}`}
                  >
                    <td className={`${tableClass.td} max-w-xs`}>
                      <p className="text-sm font-semibold text-fg truncate">{cls.name}</p>
                      {cls.description && <p className={`${type.meta} truncate`}>{cls.description}</p>}
                    </td>
                    <td className={`${tableClass.td} whitespace-nowrap ${HIDE_SM}`}>
                      <TeacherList teachers={cls.teachers} />
                    </td>
                    <td className={`${tableClass.td} text-right tabular-nums`}>{cls.students?.length || 0}</td>
                    <td className={`${tableClass.td} text-right tabular-nums ${HIDE_MD}`}>{cls.questions?.length || 0}</td>
                    <td className={`${tableClass.td} text-right tabular-nums ${HIDE_SM}`}>{cls.examCount ?? 0}</td>
                    <td className={tableClass.td}>
                      <div className="flex items-center gap-2" onClick={(e) => e.stopPropagation()}>
                        <Switch
                          checked={cls.status === 'active'}
                          disabled={busyId === cls._id}
                          onChange={() => toggleStatus(cls)}
                          label={`${cls.name} is ${cls.status}`}
                        />
                        <span className={cls.status === 'active' ? 'text-ok font-semibold' : 'text-muted'}>
                          {cls.status === 'active' ? 'Active' : 'Inactive'}
                      </span>
                      </div>
                    </td>
                    <td className={`${tableClass.td} whitespace-nowrap ${HIDE_MD}`}>
                      <p className="text-body">{formatDate(cls.createdAt)}</p>
                      <p className={type.meta}>by {cls.createdBy?.name || 'Unknown'}</p>
                    </td>
                    <td className={`${tableClass.td} whitespace-nowrap`}>
                      <div className="flex items-center justify-end gap-1">
                        <Button
                          variant="soft"
                          icon={ClipboardList}
                          className="hidden sm:flex"
                        onClick={(e) => {
                          e.stopPropagation();
                          navigate(`${base}/classes/${cls._id}/exams`);
                        }}
                        >
                          Exams
                        </Button>
                        <ActionMenu label={`Actions for ${cls.name}`} items={rowActions(cls)} />
                      </div>
                    </td>
                  </tr>
                ))
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

      <ClassFormModal
        open={formState.open}
        editing={formState.editing}
        onClose={() => setFormState({ open: false, editing: null })}
        onSaved={handleSaved}
      />
    </div>
  );
}

export default ClassManagement;
