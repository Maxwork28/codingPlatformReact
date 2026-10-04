import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { Copy, Mail, RefreshCw, Search, Trash2, Upload, Users, X } from 'lucide-react';
import { deleteTeacher, getTeachers, manageTeacherPermission } from '../../../common/services/api';
import { Button, EmptyState, Pagination, Switch, Table } from '../../../common/ui/primitives';
import ActionMenu from '../../../common/ui/ActionMenu';
import { inputClass, table as tableClass, type } from '../../../common/ui/format';
import { confirmAction, notify } from '../../../common/ui/Toast';

const PAGE_SIZE = 10;

const PERMISSION_FILTERS = [
  { id: 'all', label: 'All' },
  { id: 'author', label: 'Can create' },
  { id: 'viewer', label: 'View only' },
];

const HIDE_SM = 'hidden md:table-cell';

const COLUMNS = [
  { label: 'Teacher' },
  { label: 'Classes', className: HIDE_SM },
  { label: 'Questions', className: `text-right ${HIDE_SM}` },
  { label: 'Can create questions' },
  { label: '', key: 'actions' },
];

const initials = (name = '') =>
  name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0].toUpperCase())
    .join('') || '?';

const errorText = (err, fallback) => (typeof err === 'string' ? err : err?.message || fallback);

function ClassChips({ classes = [], onOpen }) {
  if (classes.length === 0) return <span className="text-subtle">No classes</span>;
  const shown = classes.slice(0, 2);
  const rest = classes.length - shown.length;
  return (
    <div className="flex flex-wrap items-center gap-1">
      {shown.map((c) => (
        <button
          key={c._id}
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            onOpen(c._id);
          }}
          className={`max-w-[160px] truncate rounded-md border px-1.5 py-0.5 text-[11px] transition hover:border-accent hover:text-fg ${
            c.status === 'active' ? 'border-line bg-inset text-body' : 'border-line bg-inset text-subtle line-through'
          }`}
          title={c.status === 'active' ? c.name : `${c.name} (inactive)`}
        >
          {c.name}
        </button>
      ))}
      {rest > 0 && (
        <span className="text-[11px] text-muted" title={classes.slice(2).map((c) => c.name).join(', ')}>
          +{rest} more
        </span>
      )}
    </div>
  );
}

function SkeletonRows() {
  return Array.from({ length: 4 }, (_, i) => (
    <tr key={i}>
      {COLUMNS.map((c, j) => (
        <td key={j} className={`${tableClass.td} ${c.className || ''}`}>
          <div className="h-3 rounded bg-hover animate-pulse" style={{ width: j === 0 ? '70%' : '40%' }} />
        </td>
      ))}
    </tr>
  ));
}

const TeacherManagement = () => {
  const navigate = useNavigate();
  const [params, setParams] = useSearchParams();
  const [teachers, setTeachers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState('');
  const [busyId, setBusyId] = useState(null);

  const query = params.get('q') || '';
  const permission = PERMISSION_FILTERS.some((f) => f.id === params.get('perm')) ? params.get('perm') : 'all';
  const page = Math.max(1, Number(params.get('page')) || 1);

  const updateParams = (changes, { resetPage = true } = {}) => {
    setParams(
      (prev) => {
        const next = new URLSearchParams(prev);
        Object.entries(changes).forEach(([key, value]) => {
          const isDefault = !value || (key === 'perm' && value === 'all') || (key === 'page' && value === 1);
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
    setLoadError('');
    try {
      const response = await getTeachers('');
      setTeachers(response.data.teachers || []);
    } catch (err) {
      setLoadError(errorText(err, 'Failed to fetch teachers'));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const counts = useMemo(() => {
    const authors = teachers.filter((t) => t.canCreateQuestion).length;
    return { all: teachers.length, author: authors, viewer: teachers.length - authors };
  }, [teachers]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return teachers
      .filter((t) => permission === 'all' || (permission === 'author' ? t.canCreateQuestion : !t.canCreateQuestion))
      .filter((t) => !q || [t.name, t.email, ...(t.classes || []).map((c) => c.name)].some((v) => v?.toLowerCase().includes(q)));
  }, [teachers, query, permission]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const currentPage = Math.min(page, totalPages);
  const pageRows = filtered.slice((currentPage - 1) * PAGE_SIZE, currentPage * PAGE_SIZE);
  const hasFilters = Boolean(query) || permission !== 'all';

  const togglePermission = async (teacher, canCreateQuestion) => {
    setBusyId(teacher._id);
    setTeachers((list) => list.map((t) => (t._id === teacher._id ? { ...t, canCreateQuestion } : t)));
    try {
      await manageTeacherPermission(teacher._id, canCreateQuestion);
      notify(
        canCreateQuestion
          ? `${teacher.name} can now create and edit questions`
          : `${teacher.name} can no longer create or edit questions`,
        'success',
      );
    } catch (err) {
      setTeachers((list) => list.map((t) => (t._id === teacher._id ? { ...t, canCreateQuestion: !canCreateQuestion } : t)));
      notify(errorText(err, 'Failed to update permission'), 'error');
    } finally {
      setBusyId(null);
    }
  };

  const removeTeacher = async (teacher) => {
    const classCount = teacher.classes?.length || 0;
    const ok = await confirmAction(
      `${teacher.name} (${teacher.email}) will lose access` +
        (classCount ? ` and be unassigned from ${classCount} class${classCount === 1 ? '' : 'es'}` : '') +
        '. Classes, questions, exams and student work they created are kept.',
      { title: 'Delete teacher', confirmLabel: 'Delete teacher', danger: true },
    );
    if (!ok) return;
    setBusyId(teacher._id);
    try {
      await deleteTeacher(teacher._id);
      setTeachers((list) => list.filter((t) => t._id !== teacher._id));
      notify(`${teacher.name} deleted`, 'success');
    } catch (err) {
      notify(errorText(err, 'Failed to delete teacher'), 'error');
    } finally {
      setBusyId(null);
    }
  };

  const copyEmail = async (email) => {
    try {
      await navigator.clipboard.writeText(email);
      notify('Email copied', 'success');
    } catch {
      notify('Could not copy email', 'error');
    }
  };

  const rowActions = (teacher) => [
    { label: 'Copy email', icon: Copy, onClick: () => copyEmail(teacher.email) },
    { label: 'Send email', icon: Mail, onClick: () => window.open(`mailto:${teacher.email}`) },
    { divider: true },
    { label: 'Delete teacher', icon: Trash2, tone: 'danger', onClick: () => removeTeacher(teacher) },
  ];

  const openClass = (id) => navigate(`/admin/classes/${id}`);

  return (
    <div className="h-full flex flex-col px-4 sm:px-5 py-5">
      <section className="flex-1 min-h-0 flex flex-col gap-3">
        <header className="shrink-0 flex flex-wrap items-center gap-2">
          <h1 className={`${type.pageTitle} mr-2`}>Teachers</h1>
          <div className="relative w-full sm:w-72">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted pointer-events-none" />
            <input
              value={query}
              onChange={(e) => updateParams({ q: e.target.value })}
              placeholder="Search by name, email or class"
              className={`${inputClass} h-9 pl-9 pr-8`}
              aria-label="Search teachers"
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

          <div className="flex h-9 rounded-xl border border-line bg-inset p-0.5" role="tablist" aria-label="Filter by permission">
            {PERMISSION_FILTERS.map((f) => (
              <button
                key={f.id}
                type="button"
                role="tab"
                aria-selected={permission === f.id}
                onClick={() => updateParams({ perm: f.id })}
                className={`px-3 rounded-lg text-xs font-semibold transition ${
                  permission === f.id ? 'bg-surface text-fg shadow-sm' : 'text-muted hover:text-fg'
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
          <Button icon={Upload} className="h-9" onClick={() => navigate('/admin/upload?role=teacher')}>
            Import teachers
          </Button>
        </header>

        {loadError ? (
          <EmptyState
            icon={Users}
            title="Couldn't load teachers"
            message={loadError}
            action={<Button variant="secondary" onClick={load}>Try again</Button>}
          />
        ) : !loading && filtered.length === 0 ? (
          <EmptyState
            icon={Users}
            title={hasFilters ? 'No teachers match your filters' : 'No teachers yet'}
            message={hasFilters ? 'Try a different search or permission.' : 'Import teachers from an Excel sheet to get started.'}
            action={
              hasFilters ? (
                <Button variant="secondary" onClick={() => updateParams({ q: '', perm: 'all' })}>Clear filters</Button>
              ) : (
                <Button icon={Upload} onClick={() => navigate('/admin/upload?role=teacher')}>Import teachers</Button>
              )
            }
          />
        ) : (
          <>
            <Table columns={COLUMNS} fill>
              {loading && teachers.length === 0 ? (
                <SkeletonRows />
              ) : (
                pageRows.map((teacher) => (
                  <tr key={teacher._id} className={`${tableClass.row} ${busyId === teacher._id ? 'opacity-60' : ''}`}>
                    <td className={tableClass.td}>
                      <div className="flex items-center gap-3 min-w-0">
                        <span className="w-8 h-8 rounded-full bg-accent-soft text-accent-ink border border-accent-line flex items-center justify-center text-[11px] font-bold shrink-0">
                          {initials(teacher.name)}
                        </span>
                        <div className="min-w-0">
                          <p className="text-sm font-semibold text-fg truncate">{teacher.name}</p>
                          <p className={`${type.meta} truncate`}>{teacher.email}</p>
                        </div>
                      </div>
                    </td>
                    <td className={`${tableClass.td} ${HIDE_SM}`}>
                      <ClassChips classes={teacher.classes} onOpen={openClass} />
                    </td>
                    <td className={`${tableClass.td} text-right tabular-nums ${HIDE_SM}`}>{teacher.questionCount ?? 0}</td>
                    <td className={tableClass.td}>
                      <div className="flex items-center gap-2">
                        <Switch
                          checked={Boolean(teacher.canCreateQuestion)}
                          disabled={busyId === teacher._id}
                          onChange={(value) => togglePermission(teacher, value)}
                          label={`Allow ${teacher.name} to create questions`}
                        />
                        <span className={teacher.canCreateQuestion ? 'text-ok font-semibold' : 'text-muted'}>
                          {teacher.canCreateQuestion ? 'Allowed' : 'View only'}
                        </span>
                      </div>
                    </td>
                    <td className={`${tableClass.td} text-right`}>
                      <ActionMenu label={`Actions for ${teacher.name}`} items={rowActions(teacher)} />
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
    </div>
  );
};

export default TeacherManagement;
