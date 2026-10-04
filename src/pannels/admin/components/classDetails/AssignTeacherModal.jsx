import React, { useEffect, useMemo, useState } from 'react';
import { Check, GraduationCap, Search } from 'lucide-react';
import { assignTeacherToClass, getTeachers } from '../../../../common/services/api';
import Modal from '../../../../common/ui/Modal';
import { Button } from '../../../../common/ui/primitives';
import { type } from '../../../../common/ui/format';
import { errorText, initials, plural } from './helpers';

export default function AssignTeacherModal({ open, classId, assignedIds, onClose, onAssigned }) {
  const [teachers, setTeachers] = useState([]);
  const [loading, setLoading] = useState(false);
  const [query, setQuery] = useState('');
  const [picked, setPicked] = useState(() => new Set());
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!open) return undefined;
    let cancelled = false;
    setQuery('');
    setPicked(new Set());
    setError('');
    setLoading(true);
    getTeachers()
      .then((res) => !cancelled && setTeachers(res.data.teachers || []))
      .catch((err) => !cancelled && setError(errorText(err, 'Failed to load teachers')))
      .finally(() => !cancelled && setLoading(false));
    return () => {
      cancelled = true;
    };
  }, [open]);

  const assigned = useMemo(() => new Set(assignedIds.map(String)), [assignedIds]);
  const options = useMemo(() => {
    const q = query.trim().toLowerCase();
    return teachers
      .filter((t) => !assigned.has(String(t._id)))
      .filter((t) => !q || t.name.toLowerCase().includes(q) || t.email.toLowerCase().includes(q));
  }, [teachers, assigned, query]);

  const toggle = (id) =>
    setPicked((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });

  const assign = async () => {
    setSaving(true);
    setError('');
    const ids = [...picked];
    const outcomes = await Promise.allSettled(ids.map((id) => assignTeacherToClass(classId, id)));
    const failed = outcomes.filter((o) => o.status === 'rejected');
    setSaving(false);
    if (failed.length === ids.length) {
      setError(errorText(failed[0].reason, 'Failed to assign teacher'));
      return;
    }
    onAssigned(failed.length ? `${ids.length - failed.length} assigned, ${failed.length} failed` : `${plural(ids.length, 'teacher')} assigned`);
  };

  return (
    <Modal
      open={open}
      onClose={() => !saving && onClose()}
      title="Assign teachers"
      icon={GraduationCap}
      accent="accent"
      width="max-w-lg"
      footer={
        <>
          <Button variant="secondary" onClick={onClose} disabled={saving}>
            Cancel
          </Button>
          <Button onClick={assign} disabled={saving || picked.size === 0}>
            {saving ? 'Assigning…' : picked.size ? `Assign ${picked.size}` : 'Assign'}
          </Button>
        </>
      }
    >
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted pointer-events-none" />
        <input
          autoFocus
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search teachers by name or email"
          className="w-full h-9 bg-inset border border-line rounded-xl pl-9 pr-3 text-fg text-xs outline-none focus:border-accent"
        />
      </div>
      {error && <p className="rounded-xl border border-bad-line bg-bad-soft px-3 py-2 text-xs font-semibold text-bad">{error}</p>}
      <ul className="max-h-[45vh] overflow-y-auto -mx-2 space-y-0.5">
        {loading ? (
          Array.from({ length: 4 }, (_, i) => (
            <li key={i} className="px-2 py-3">
              <div className="h-3 w-1/2 rounded bg-hover animate-pulse" />
            </li>
          ))
        ) : options.length === 0 ? (
          <li className={`${type.body} px-2 py-8 text-center`}>
            {teachers.length && !query ? 'Every teacher is already assigned to this class.' : 'No teachers match your search.'}
          </li>
        ) : (
          options.map((t) => {
            const on = picked.has(t._id);
            return (
              <li key={t._id}>
                <button
                  type="button"
                  onClick={() => toggle(t._id)}
                  className={`w-full text-left flex items-center gap-3 px-2 py-2 rounded-lg transition ${on ? 'bg-accent-soft' : 'hover:bg-hover'}`}
                >
                  <span className="w-8 h-8 rounded-full bg-accent-soft text-accent-ink border border-accent-line text-[10px] font-bold flex items-center justify-center shrink-0">
                    {initials(t.name)}
                  </span>
                  <span className="flex-1 min-w-0">
                    <span className="block text-xs font-semibold text-fg truncate">{t.name}</span>
                    <span className={`block ${type.meta} truncate`}>
                      {t.email}
                      {t.classes?.length > 0 && ` · ${plural(t.classes.length, 'class', 'classes')}`}
                    </span>
                  </span>
                  <span className={`w-4 h-4 rounded border flex items-center justify-center ${on ? 'bg-accent border-accent text-on-accent' : 'border-line-strong bg-inset'}`}>
                    {on && <Check className="w-3 h-3" />}
                  </span>
                </button>
              </li>
            );
          })
        )}
      </ul>
    </Modal>
  );
}
