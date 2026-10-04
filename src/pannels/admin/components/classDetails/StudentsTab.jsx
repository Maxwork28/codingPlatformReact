import React, { useMemo, useState } from 'react';
import { Ban, Copy, Flag, FlagOff, Mail, ShieldCheck, Trash2, UserPlus, Users, X } from 'lucide-react';
import { blockAllUsers, blockUser, focusStudent, removeStudentFromClass } from '../../../../common/services/api';
import { Button, EmptyState, Pagination, Switch, Table } from '../../../../common/ui/primitives';
import ActionMenu from '../../../../common/ui/ActionMenu';
import { table as tableClass, type } from '../../../../common/ui/format';
import { confirmAction, notify } from '../../../../common/ui/Toast';
import { Checkbox, RateBar, SearchBox, Segmented } from './shared';
import { HIDE_MD, HIDE_SM, errorText, paginate, plural, selectClass, timeAgo, useUrlState } from './helpers';

const PAGE_SIZE = 15;

const FILTERS = [
  { id: 'all', label: 'All', test: () => true },
  { id: 'active', label: 'Active this week', test: (s) => s.activeThisWeek },
  { id: 'idle', label: 'Idle', test: (s) => s.submissions > 0 && !s.activeThisWeek },
  { id: 'never', label: 'Never active', test: (s) => s.submissions === 0 },
  { id: 'focus', label: 'Focus', test: (s) => s.needsFocus },
  { id: 'blocked', label: 'Blocked', test: (s) => s.isBlocked },
];

const SORTS = {
  rank: { label: 'Rank', compare: (a, b) => (a.rank ?? Infinity) - (b.rank ?? Infinity) || a.name.localeCompare(b.name) },
  name: { label: 'Name A–Z', compare: (a, b) => a.name.localeCompare(b.name) },
  solved: { label: 'Most solved', compare: (a, b) => b.solved - a.solved },
  accuracy: { label: 'Accuracy', compare: (a, b) => (b.accuracy ?? -1) - (a.accuracy ?? -1) },
  recent: { label: 'Recently active', compare: (a, b) => new Date(b.lastActiveAt || 0) - new Date(a.lastActiveAt || 0) },
};

const DEFAULTS = { q: '', filter: 'all', sort: 'rank', page: 1 };

export default function StudentsTab({ classId, data, reload, onAddStudents }) {
  const [get, update] = useUrlState(DEFAULTS);
  const [selected, setSelected] = useState(() => new Set());
  const [busyIds, setBusyIds] = useState(() => new Set());
  const [bulkBusy, setBulkBusy] = useState(false);

  const query = get('q');
  const filter = FILTERS.find((f) => f.id === get('filter')) || FILTERS[0];
  const sort = SORTS[get('sort')] ? get('sort') : 'rank';
  const published = data.counts.publishedQuestions;

  const counts = useMemo(
    () => Object.fromEntries(FILTERS.map((f) => [f.id, data.students.filter(f.test).length])),
    [data.students],
  );

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return data.students
      .filter(filter.test)
      .filter((s) => !q || [s.name, s.email, s.number].filter(Boolean).some((v) => String(v).toLowerCase().includes(q)))
      .sort(SORTS[sort].compare);
  }, [data.students, filter, query, sort]);

  const { current, rows } = paginate(filtered, Number(get('page')) || 1, PAGE_SIZE);
  const pageIds = rows.map((s) => String(s._id));
  const allOnPage = pageIds.length > 0 && pageIds.every((id) => selected.has(id));
  const someOnPage = pageIds.some((id) => selected.has(id));
  const setBusy = (id, on) =>
    setBusyIds((prev) => {
      const next = new Set(prev);
      if (on) next.add(id);
      else next.delete(id);
      return next;
    });

  const toggleSelect = (id, on) =>
    setSelected((prev) => {
      const next = new Set(prev);
      if (on) next.add(id);
      else next.delete(id);
      return next;
    });

  const togglePage = (on) =>
    setSelected((prev) => {
      const next = new Set(prev);
      pageIds.forEach((id) => (on ? next.add(id) : next.delete(id)));
      return next;
    });

  const run = async (id, action, success, fallback) => {
    setBusy(id, true);
    try {
      await action();
      notify(success, 'success');
      await reload();
    } catch (err) {
      notify(errorText(err, fallback), 'error');
    } finally {
      setBusy(id, false);
    }
  };

  const setAccess = (s, allow) =>
    run(s._id, () => blockUser(classId, s._id, !allow), `${s.name} ${allow ? 'can access the class again' : 'is blocked from this class'}`, 'Failed to update access');

  const setFocus = (s, needsFocus) =>
    run(s._id, () => focusStudent(classId, s._id, needsFocus), needsFocus ? `${s.name} flagged for focus` : `Focus flag removed for ${s.name}`, 'Failed to update focus flag');

  const removeOne = async (s) => {
    const ok = await confirmAction(
      `Remove ${s.name} from this class? Their ${plural(s.submissions, 'submission')} and leaderboard entry for this class will be deleted. The account itself is kept.`,
      { title: 'Remove student', confirmLabel: 'Remove', danger: true },
    );
    if (!ok) return;
    toggleSelect(String(s._id), false);
    run(s._id, () => removeStudentFromClass(classId, s._id), `${s.name} removed from the class`, 'Failed to remove student');
  };

  const bulkAccess = async (block) => {
    setBulkBusy(true);
    try {
      const res = await blockAllUsers(classId, block, { studentIds: [...selected] });
      notify(res.data?.message || 'Access updated', 'success');
      setSelected(new Set());
      await reload();
    } catch (err) {
      notify(errorText(err, 'Failed to update access'), 'error');
    } finally {
      setBulkBusy(false);
    }
  };

  const bulkRemove = async () => {
    const ok = await confirmAction(
      `Remove ${plural(selected.size, 'student')} from this class? Their submissions and leaderboard entries for this class will be deleted.`,
      { title: 'Remove students', confirmLabel: `Remove ${selected.size}`, danger: true },
    );
    if (!ok) return;
    setBulkBusy(true);
    const results = await Promise.allSettled([...selected].map((id) => removeStudentFromClass(classId, id)));
    const failed = results.filter((r) => r.status === 'rejected').length;
    notify(
      failed ? `${results.length - failed} removed, ${failed} failed` : `${plural(results.length, 'student')} removed`,
      failed ? 'warning' : 'success',
    );
    setSelected(new Set());
    setBulkBusy(false);
    await reload();
  };

  const copyEmail = async (s) => {
    try {
      await navigator.clipboard.writeText(s.email);
      notify('Email copied', 'success');
    } catch {
      notify('Could not copy to clipboard', 'error');
    }
  };

  const columns = [
    {
      key: 'select',
      label: <Checkbox checked={allOnPage} indeterminate={!allOnPage && someOnPage} onChange={togglePage} label="Select all on this page" />,
      className: 'w-8',
    },
    { label: '#', className: 'w-10 text-right' },
    { label: 'Student' },
    { label: 'Solved', className: 'text-right' },
    { label: 'Accuracy', className: HIDE_SM },
    { label: 'Score', className: 'text-right' },
    { label: 'Runs / submits', className: `text-right ${HIDE_MD}` },
    { label: 'Last active', className: HIDE_SM },
    { label: 'Access' },
    { key: 'actions', label: '' },
  ];

  const hasFilters = Boolean(query) || filter.id !== 'all';

  if (data.students.length === 0) {
    return (
      <EmptyState
        icon={Users}
        title="No students yet"
        message="Add students by uploading a spreadsheet or pasting their emails."
        action={<Button icon={UserPlus} onClick={onAddStudents}>Add students</Button>}
      />
    );
  }

  return (
    <>
      <div className="shrink-0 flex flex-wrap items-center gap-2">
        <SearchBox value={query} onChange={(v) => update({ q: v })} placeholder="Search name, email or phone" label="Search students" />
        <Segmented
          label="Filter students"
          value={filter.id}
          onChange={(v) => update({ filter: v })}
          options={FILTERS.map((f) => ({ id: f.id, label: f.label, count: counts[f.id] }))}
        />
        <select value={sort} onChange={(e) => update({ sort: e.target.value })} className={`ml-auto ${selectClass}`} aria-label="Sort students">
          {Object.entries(SORTS).map(([id, s]) => (
            <option key={id} value={id}>
              {s.label}
            </option>
          ))}
        </select>
      </div>

      {selected.size > 0 && (
        <div className="shrink-0 flex flex-wrap items-center gap-2 rounded-xl border border-accent-line bg-accent-soft px-3 py-2">
          <span className="text-xs font-semibold text-accent-ink mr-auto">{plural(selected.size, 'student')} selected</span>
          <Button variant="secondary" icon={Ban} disabled={bulkBusy} onClick={() => bulkAccess(true)}>
            Block
          </Button>
          <Button variant="secondary" icon={ShieldCheck} disabled={bulkBusy} onClick={() => bulkAccess(false)}>
            Unblock
          </Button>
          <Button variant="danger" icon={Trash2} disabled={bulkBusy} onClick={bulkRemove}>
            Remove
          </Button>
          <Button variant="ghost" icon={X} disabled={bulkBusy} onClick={() => setSelected(new Set())} aria-label="Clear selection" />
        </div>
      )}

      {filtered.length === 0 ? (
        <EmptyState
          icon={Users}
          title="No students match"
          message={hasFilters ? 'Try a different search or filter.' : ''}
          action={<Button variant="secondary" onClick={() => update({ q: '', filter: 'all' })}>Clear filters</Button>}
        />
      ) : (
        <>
          <Table columns={columns} fill>
            {rows.map((s) => {
              const id = String(s._id);
              const busy = busyIds.has(s._id) || bulkBusy;
              return (
                <tr key={id} className={`${tableClass.row} ${busy ? 'opacity-50 pointer-events-none' : ''} ${selected.has(id) ? 'bg-accent-soft/40' : ''}`}>
                  <td className={tableClass.td}>
                    <Checkbox checked={selected.has(id)} onChange={(on) => toggleSelect(id, on)} label={`Select ${s.name}`} />
                  </td>
                  <td className={`${tableClass.td} text-right tabular-nums ${s.rank && s.rank <= 3 ? 'text-warn font-bold' : 'text-subtle'}`}>
                    {s.rank ?? '—'}
                  </td>
                  <td className={`${tableClass.td} max-w-xs`}>
                    <p className="text-sm font-semibold text-fg truncate flex items-center gap-1.5">
                      {s.name}
                      {s.needsFocus && <Flag className="w-3 h-3 text-warn shrink-0" aria-label="Flagged for focus" />}
                    </p>
                    <p className={`${type.meta} truncate`}>{s.email}</p>
                  </td>
                  <td className={`${tableClass.td} text-right tabular-nums whitespace-nowrap`}>
                    <span className="text-fg font-semibold">{s.solved}</span>
                    <span className="text-subtle">/{published}</span>
                    {s.attempted > s.solved && <p className={type.meta}>{s.attempted} attempted</p>}
                  </td>
                  <td className={`${tableClass.td} ${HIDE_SM}`}>
                    <RateBar value={s.accuracy} />
                  </td>
                  <td className={`${tableClass.td} text-right tabular-nums font-semibold text-fg`}>{s.score}</td>
                  <td className={`${tableClass.td} text-right tabular-nums ${HIDE_MD}`}>
                    {s.runs} / {s.submissions}
                  </td>
                  <td className={`${tableClass.td} whitespace-nowrap ${HIDE_SM}`}>
                    <span className={s.activeThisWeek ? 'text-body' : 'text-muted'}>{timeAgo(s.lastActiveAt)}</span>
                  </td>
                  <td className={tableClass.td}>
                    <div className="flex items-center gap-2">
                      <Switch checked={!s.isBlocked} disabled={busy} onChange={(allow) => setAccess(s, allow)} label={`${s.name} access`} />
                      <span className={`text-[11px] font-semibold ${s.isBlocked ? 'text-bad' : 'text-muted'}`}>{s.isBlocked ? 'Blocked' : 'Allowed'}</span>
                    </div>
                  </td>
                  <td className={`${tableClass.td} text-right`}>
                    <ActionMenu
                      label={`Actions for ${s.name}`}
                      items={[
                        s.needsFocus
                          ? { label: 'Remove focus flag', icon: FlagOff, onClick: () => setFocus(s, false) }
                          : { label: 'Flag for focus', icon: Flag, onClick: () => setFocus(s, true) },
                        { label: 'Copy email', icon: Copy, onClick: () => copyEmail(s) },
                        { label: 'Send email', icon: Mail, onClick: () => window.open(`mailto:${s.email}`) },
                        { divider: true },
                        { label: 'Remove from class', icon: Trash2, tone: 'danger', onClick: () => removeOne(s) },
                      ]}
                    />
                  </td>
                </tr>
              );
            })}
          </Table>
          <Pagination page={current} pageSize={PAGE_SIZE} total={filtered.length} onChange={(p) => update({ page: p }, { resetPage: false })} />
        </>
      )}
    </>
  );
}
