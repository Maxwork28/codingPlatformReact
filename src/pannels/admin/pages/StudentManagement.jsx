import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { Copy, GraduationCap, Lock, Pencil, RefreshCw, Search, Trash2, Upload, X } from 'lucide-react';
import { deleteStudent, getStudents } from '../../../common/services/api';
import { Button, EmptyState, Pagination, Table } from '../../../common/ui/primitives';
import ActionMenu from '../../../common/ui/ActionMenu';
import { inputClass, table as tableClass, type } from '../../../common/ui/format';
import { confirmAction, notify } from '../../../common/ui/Toast';
import StudentEditModal from '../components/StudentEditModal';

const PAGE_SIZE = 15;

const FILTERS = [
  { id: 'all', label: 'All', test: () => true },
  { id: 'enrolled', label: 'Enrolled', test: (s) => s.classes.length > 0 },
  { id: 'unenrolled', label: 'No class', test: (s) => s.classes.length === 0 },
  { id: 'blocked', label: 'Blocked', test: (s) => s.classes.some((c) => c.isBlocked) },
];

const SORTS = {
  name: { label: 'Name A–Z', compare: (a, b) => a.name.localeCompare(b.name) },
  recent: {
    label: 'Recently active',
    compare: (a, b) => new Date(b.lastActiveAt || 0) - new Date(a.lastActiveAt || 0),
  },
  submissions: { label: 'Most submissions', compare: (a, b) => b.submissionCount - a.submissionCount },
};

const HIDE_SM = 'hidden md:table-cell';
const HIDE_MD = 'hidden lg:table-cell';

const COLUMNS = [
  { label: 'Student' },
  { label: 'Phone', className: HIDE_MD },
  { label: 'Classes', className: HIDE_SM },
  { label: 'Submissions', className: 'text-right' },
  { label: 'Last active', className: HIDE_SM },
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

const DAY = 24 * 60 * 60 * 1000;
function relativeTime(value) {
  if (!value) return null;
  const diff = Date.now() - new Date(value).getTime();
  if (diff < 60 * 60 * 1000) return 'Just now';
  if (diff < DAY) return `${Math.floor(diff / (60 * 60 * 1000))}h ago`;
  if (diff < 30 * DAY) return `${Math.floor(diff / DAY)}d ago`;
  return new Date(value).toLocaleDateString(undefined, { day: 'numeric', month: 'short', year: 'numeric' });
}

const normalize = (s) => ({ ...s, classes: s.classes || [], submissionCount: s.submissionCount || 0 });

function ClassChips({ classes, onOpen }) {
  if (classes.length === 0) return <span className="text-warn">Not enrolled</span>;
  const shown = classes.slice(0, 2);
  const rest = classes.length - shown.length;
  return (
    <div className="flex flex-wrap items-center gap-1">
      {shown.map((c) => (
        <button
          key={c._id}
          type="button"
          onClick={() => onOpen(c._id)}
          title={c.isBlocked ? `Blocked in ${c.name}` : c.name}
          className={`inline-flex max-w-[170px] items-center gap-1 rounded-md border px-1.5 py-0.5 text-[11px] transition hover:border-accent ${
            c.isBlocked ? 'border-bad-line bg-bad-soft text-bad' : 'border-line bg-inset text-body hover:text-fg'
          }`}
        >
          {c.isBlocked && <Lock className="w-3 h-3 shrink-0" />}
          <span className="truncate">{c.name}</span>
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
  return Array.from({ length: 6 }, (_, i) => (
    <tr key={i}>
      {COLUMNS.map((c, j) => (
        <td key={j} className={`${tableClass.td} ${c.className || ''}`}>
          <div className="h-3 rounded bg-hover animate-pulse" style={{ width: j === 0 ? '70%' : '40%' }} />
        </td>
      ))}
    </tr>
  ));
}

const StudentManagement = () => {
  const navigate = useNavigate();
  const [params, setParams] = useSearchParams();
  const [students, setStudents] = useState([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState('');
  const [busyId, setBusyId] = useState(null);
  const [editing, setEditing] = useState(null);

  const query = params.get('q') || '';
  const filter = FILTERS.find((f) => f.id === params.get('filter')) || FILTERS[0];
  const sort = SORTS[params.get('sort')] ? params.get('sort') : 'name';
  const page = Math.max(1, Number(params.get('page')) || 1);

  const updateParams = (changes, { resetPage = true } = {}) => {
    setParams(
      (prev) => {
        const next = new URLSearchParams(prev);
        Object.entries(changes).forEach(([key, value]) => {
          const isDefault =
            !value || (key === 'filter' && value === 'all') || (key === 'sort' && value === 'name') || (key === 'page' && value === 1);
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
      const response = await getStudents('');
      setStudents((response.data.students || []).map(normalize));
    } catch (err) {
      setLoadError(errorText(err, 'Failed to fetch students'));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const counts = useMemo(
    () => Object.fromEntries(FILTERS.map((f) => [f.id, students.filter(f.test).length])),
    [students],
  );

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return students
      .filter(filter.test)
      .filter(
        (s) => !q || [s.name, s.email, s.number, ...s.classes.map((c) => c.name)].some((v) => v?.toLowerCase().includes(q)),
      )
      .sort(SORTS[sort].compare);
  }, [students, query, filter, sort]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const currentPage = Math.min(page, totalPages);
  const pageRows = filtered.slice((currentPage - 1) * PAGE_SIZE, currentPage * PAGE_SIZE);
  const hasFilters = Boolean(query) || filter.id !== 'all';

  const openClass = (id) => navigate(`/admin/classes/${id}`);
  const goImport = () => navigate('/admin/upload?role=student');

  const handleSaved = (updated) => {
    setStudents((list) => list.map((s) => (s._id === updated._id ? normalize({ ...s, ...updated }) : s)));
    setEditing(null);
    notify(`${updated.name} updated`, 'success');
  };

  const removeStudent = async (student) => {
    const classCount = student.classes.length;
    const ok = await confirmAction(
      `${student.name} (${student.email}) will be permanently deleted` +
        (classCount ? ` and removed from ${classCount} class${classCount === 1 ? '' : 'es'}` : '') +
        `, along with ${student.submissionCount} submission${student.submissionCount === 1 ? '' : 's'}, exam attempts and leaderboard entries. This cannot be undone.`,
      { title: 'Delete student', confirmLabel: 'Delete student', danger: true },
    );
    if (!ok) return;
    setBusyId(student._id);
    try {
      await deleteStudent(student._id);
      setStudents((list) => list.filter((s) => s._id !== student._id));
      notify(`${student.name} deleted`, 'success');
    } catch (err) {
      notify(errorText(err, 'Failed to delete student'), 'error');
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

  const rowActions = (student) => [
    { label: 'Edit details', icon: Pencil, onClick: () => setEditing(student) },
    { label: 'Copy email', icon: Copy, onClick: () => copyEmail(student.email) },
    { divider: true },
    { label: 'Delete student', icon: Trash2, tone: 'danger', onClick: () => removeStudent(student) },
  ];

  return (
    <div className="h-full flex flex-col px-4 sm:px-5 py-5">
      <section className="flex-1 min-h-0 flex flex-col gap-3">
        <header className="shrink-0 flex flex-wrap items-center gap-2">
          <h1 className={`${type.pageTitle} mr-2`}>Students</h1>
          <div className="relative w-full sm:w-72">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted pointer-events-none" />
            <input
              value={query}
              onChange={(e) => updateParams({ q: e.target.value })}
              placeholder="Search name, email, phone or class"
              className={`${inputClass} h-9 pl-9 pr-8`}
              aria-label="Search students"
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

          <div className="flex h-9 rounded-xl border border-line bg-inset p-0.5" role="tablist" aria-label="Filter students">
            {FILTERS.map((f) => (
          <button
                key={f.id}
              type="button"
                role="tab"
                aria-selected={filter.id === f.id}
                onClick={() => updateParams({ filter: f.id })}
                className={`px-3 rounded-lg text-xs font-semibold transition whitespace-nowrap ${
                  filter.id === f.id ? 'bg-surface text-fg shadow-sm' : 'text-muted hover:text-fg'
                }`}
              >
                {f.label} <span className="text-subtle font-normal">{counts[f.id]}</span>
            </button>
            ))}
      </div>

          <select
            value={sort}
            onChange={(e) => updateParams({ sort: e.target.value })}
            className="ml-auto h-9 bg-inset border border-line rounded-xl px-3 text-fg text-xs outline-none focus:border-accent cursor-pointer"
            aria-label="Sort students"
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
            onClick={load}
            disabled={loading}
            aria-label="Refresh"
            title="Refresh"
            className={`h-9 w-9 justify-center p-0! ${loading ? '[&>svg]:animate-spin' : ''}`}
          />
          <Button icon={Upload} className="h-9" onClick={goImport}>
            Import students
          </Button>
        </header>

        {loadError ? (
          <EmptyState
            icon={GraduationCap}
            title="Couldn't load students"
            message={loadError}
            action={<Button variant="secondary" onClick={load}>Try again</Button>}
          />
        ) : !loading && filtered.length === 0 ? (
          <EmptyState
            icon={GraduationCap}
            title={hasFilters ? 'No students match your filters' : 'No students yet'}
            message={hasFilters ? 'Try a different search or filter.' : 'Import students from an Excel sheet, or add them from a class.'}
            action={
              hasFilters ? (
                <Button variant="secondary" onClick={() => updateParams({ q: '', filter: 'all' })}>Clear filters</Button>
              ) : (
                <Button icon={Upload} onClick={goImport}>Import students</Button>
              )
            }
          />
          ) : (
            <>
            <Table columns={COLUMNS} fill>
              {loading && students.length === 0 ? (
                <SkeletonRows />
              ) : (
                pageRows.map((student) => (
                  <tr key={student._id} className={`${tableClass.row} ${busyId === student._id ? 'opacity-50 pointer-events-none' : ''}`}>
                    <td className={tableClass.td}>
                      <div className="flex items-center gap-3 min-w-0">
                        <span className="w-8 h-8 rounded-full bg-accent-soft text-accent-ink border border-accent-line flex items-center justify-center text-[11px] font-bold shrink-0">
                          {initials(student.name)}
                        </span>
                        <div className="min-w-0">
                          <p className="text-sm font-semibold text-fg truncate">{student.name}</p>
                          <p className={`${type.meta} truncate`}>{student.email}</p>
                      </div>
                      </div>
                    </td>
                    <td className={`${tableClass.td} whitespace-nowrap ${HIDE_MD}`}>
                      {student.number || <span className="text-subtle">—</span>}
                  </td>
                    <td className={`${tableClass.td} ${HIDE_SM}`}>
                      <ClassChips classes={student.classes} onOpen={openClass} />
                  </td>
                    <td className={`${tableClass.td} text-right tabular-nums`}>{student.submissionCount}</td>
                    <td className={`${tableClass.td} whitespace-nowrap ${HIDE_SM}`}>
                      {relativeTime(student.lastActiveAt) || <span className="text-subtle">Never</span>}
                  </td>
                    <td className={`${tableClass.td} text-right`}>
                      <ActionMenu label={`Actions for ${student.name}`} items={rowActions(student)} />
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

      <StudentEditModal student={editing} onClose={() => setEditing(null)} onSaved={handleSaved} />
    </div>
  );
};

export default StudentManagement;
