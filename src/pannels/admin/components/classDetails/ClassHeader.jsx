import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, ClipboardList, Copy, Pencil, Play, Trash2, UserPlus } from 'lucide-react';
import { changeClassStatus, deleteClass } from '../../../../common/services/api';
import { Button, Switch } from '../../../../common/ui/primitives';
import ActionMenu from '../../../../common/ui/ActionMenu';
import { type } from '../../../../common/ui/format';
import { confirmAction, notify } from '../../../../common/ui/Toast';
import ClassFormModal from '../ClassFormModal';
import { errorText, plural, useStaffBase } from './helpers';

export default function ClassHeader({ data, onChanged, onAddStudents }) {
  const navigate = useNavigate();
  const { base, isTeacher } = useStaffBase();
  const [busy, setBusy] = useState(false);
  const [editing, setEditing] = useState(false);
  const cls = data.class;
  const active = cls.status === 'active';

  const toggleStatus = async () => {
    const next = active ? 'inactive' : 'active';
    if (next === 'inactive') {
      const ok = await confirmAction(
        `Students in "${cls.name}" will no longer see it as an active class. You can reactivate it at any time.`,
        { title: 'Deactivate class', confirmLabel: 'Deactivate' },
      );
      if (!ok) return;
    }
    setBusy(true);
    try {
      await changeClassStatus(cls._id, next);
      notify(`Class is now ${next}`, 'success');
      await onChanged();
    } catch (err) {
      notify(errorText(err, 'Failed to change class status'), 'error');
    } finally {
      setBusy(false);
    }
  };

  const remove = async () => {
    const ok = await confirmAction(
      `"${cls.name}" will be permanently deleted along with ${plural(data.counts.exams, 'exam')}, all practice submissions and the leaderboard. ` +
        `The ${plural(data.counts.students, 'student')}, teachers and bank questions are kept. This cannot be undone.`,
      { title: 'Delete class', confirmLabel: 'Delete class', danger: true },
    );
    if (!ok) return;
    setBusy(true);
    try {
      await deleteClass(cls._id);
      notify(`"${cls.name}" deleted`, 'success');
      navigate(`${base}/classes`);
    } catch (err) {
      notify(errorText(err, 'Failed to delete class'), 'error');
      setBusy(false);
    }
  };

  const copyId = async () => {
    try {
      await navigator.clipboard.writeText(String(cls._id));
      notify('Class ID copied', 'success');
    } catch {
      notify('Could not copy to clipboard', 'error');
    }
  };

  return (
    <header className="shrink-0 flex flex-wrap items-center gap-2">
      <Button
        variant="ghost"
        icon={ArrowLeft}
        className="h-9 w-9 justify-center p-0!"
        onClick={() => navigate(`${base}/classes`)}
        aria-label="Back to classes"
        title="Back to classes"
      />
      <h1 className={`${type.pageTitle} truncate max-w-full sm:max-w-md`} title={cls.name}>
        {cls.name}
      </h1>
      <div className="flex items-center gap-2 rounded-xl border border-line bg-inset h-9 px-3">
        <Switch checked={active} disabled={busy} onChange={toggleStatus} label={`Class is ${cls.status}`} />
        <span className={`text-xs font-semibold ${active ? 'text-ok' : 'text-muted'}`}>{active ? 'Active' : 'Inactive'}</span>
      </div>

      <div className="ml-auto flex items-center gap-2">
        <Button variant="secondary" icon={Pencil} className="h-9" onClick={() => setEditing(true)} disabled={busy}>
          Edit
        </Button>
        {isTeacher && (
          <Button
            variant="soft"
            icon={Play}
            className="h-9"
            onClick={() => navigate('/teacher/take-class', { state: { classId: cls._id } })}
          >
            Take class
          </Button>
        )}
        <Button icon={UserPlus} className="h-9" onClick={onAddStudents} disabled={busy}>
          Add students
        </Button>
        <ActionMenu
          label="More class actions"
          items={[
            { label: 'Manage exams', icon: ClipboardList, onClick: () => navigate(`${base}/classes/${cls._id}/exams`) },
            { label: 'Copy class ID', icon: Copy, onClick: copyId },
            ...(!isTeacher
              ? [{ divider: true }, { label: 'Delete class', icon: Trash2, tone: 'danger', onClick: remove }]
              : []),
          ]}
        />
      </div>

      <ClassFormModal
        open={editing}
        editing={editing ? cls : null}
        onClose={() => setEditing(false)}
        onSaved={async (res) => {
          setEditing(false);
          notify(res?.message || 'Class updated', 'success');
          await onChanged();
        }}
      />
    </header>
  );
}
