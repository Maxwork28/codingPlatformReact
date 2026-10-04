import React, { useState } from 'react';
import { Copy, GraduationCap, Mail, UserMinus, UserPlus } from 'lucide-react';
import { manageTeacherPermission, removeTeacherFromClass } from '../../../../common/services/api';
import { Button, EmptyState, Switch, Table } from '../../../../common/ui/primitives';
import ActionMenu from '../../../../common/ui/ActionMenu';
import { table as tableClass, type } from '../../../../common/ui/format';
import { confirmAction, notify } from '../../../../common/ui/Toast';
import AssignTeacherModal from './AssignTeacherModal';
import { HIDE_SM, errorText, initials } from './helpers';

const COLUMNS = [
  { label: 'Teacher' },
  { label: 'Email', className: HIDE_SM },
  { label: 'Can create questions' },
  { key: 'actions', label: '' },
];

export default function TeachersTab({ classId, data, reload }) {
  const [assignOpen, setAssignOpen] = useState(false);
  const [busyId, setBusyId] = useState(null);

  const run = async (id, action, success, fallback) => {
    setBusyId(id);
    try {
      await action();
      notify(success, 'success');
      await reload();
    } catch (err) {
      notify(errorText(err, fallback), 'error');
    } finally {
      setBusyId(null);
    }
  };

  const setPermission = (t, allowed) =>
    run(
      t._id,
      () => manageTeacherPermission(t._id, allowed),
      allowed ? `${t.name} can now create questions` : `${t.name} can no longer create questions`,
      'Failed to update permission',
    );

  const remove = async (t) => {
    const last = data.teachers.length === 1;
    const ok = await confirmAction(
      `Remove ${t.name} from this class?${last ? ' The class will have no teacher until you assign another one.' : ''} Their questions stay in the bank.`,
      { title: 'Remove teacher', confirmLabel: 'Remove', danger: true },
    );
    if (ok) run(t._id, () => removeTeacherFromClass(classId, t._id), `${t.name} removed from the class`, 'Failed to remove teacher');
  };

  const copyEmail = async (t) => {
    try {
      await navigator.clipboard.writeText(t.email);
      notify('Email copied', 'success');
    } catch {
      notify('Could not copy to clipboard', 'error');
    }
  };

  const assignButton = (
    <Button icon={UserPlus} className="h-9" onClick={() => setAssignOpen(true)}>
      Assign teacher
    </Button>
  );

  return (
    <>
      {data.teachers.length === 0 ? (
        <EmptyState
          icon={GraduationCap}
          title="No teacher assigned"
          message="Assign at least one teacher so someone can manage questions, exams and students for this class."
          action={assignButton}
        />
      ) : (
        <>
          <div className="shrink-0 flex flex-wrap items-center gap-2">
            <p className={`${type.body} mr-auto`}>
              The question permission applies to the teacher across all their classes.
            </p>
            {assignButton}
          </div>
          <Table columns={COLUMNS} fill>
            {data.teachers.map((t) => (
              <tr key={t._id} className={`${tableClass.row} ${busyId === t._id ? 'opacity-50 pointer-events-none' : ''}`}>
                <td className={tableClass.td}>
                  <div className="flex items-center gap-3">
                    <span className="w-8 h-8 rounded-full bg-accent-soft text-accent-ink border border-accent-line text-[10px] font-bold flex items-center justify-center shrink-0">
                      {initials(t.name)}
                    </span>
                    <div className="min-w-0">
                      <p className="text-sm font-semibold text-fg truncate">{t.name}</p>
                      <p className={`${type.meta} truncate md:hidden`}>{t.email}</p>
                    </div>
                  </div>
                </td>
                <td className={`${tableClass.td} ${HIDE_SM}`}>{t.email}</td>
                <td className={tableClass.td}>
                  <div className="flex items-center gap-2">
                    <Switch
                      checked={t.canCreateQuestion}
                      disabled={busyId === t._id}
                      onChange={(on) => setPermission(t, on)}
                      label={`${t.name} can create questions`}
                    />
                    <span className={`text-[11px] font-semibold ${t.canCreateQuestion ? 'text-ok' : 'text-muted'}`}>
                      {t.canCreateQuestion ? 'Allowed' : 'View only'}
                    </span>
                  </div>
                </td>
                <td className={`${tableClass.td} text-right`}>
                  <ActionMenu
                    label={`Actions for ${t.name}`}
                    items={[
                      { label: 'Copy email', icon: Copy, onClick: () => copyEmail(t) },
                      { label: 'Send email', icon: Mail, onClick: () => window.open(`mailto:${t.email}`) },
                      { divider: true },
                      { label: 'Remove from class', icon: UserMinus, tone: 'danger', onClick: () => remove(t) },
                    ]}
                  />
                </td>
              </tr>
            ))}
          </Table>
        </>
      )}

      <AssignTeacherModal
        open={assignOpen}
        classId={classId}
        assignedIds={data.teachers.map((t) => t._id)}
        onClose={() => setAssignOpen(false)}
        onAssigned={async (message) => {
          setAssignOpen(false);
          notify(message, 'success');
          await reload();
        }}
      />
    </>
  );
}
