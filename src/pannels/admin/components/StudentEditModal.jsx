import React, { useEffect, useState } from 'react';
import { UserPen } from 'lucide-react';
import Modal from '../../../common/ui/Modal';
import { Button } from '../../../common/ui/primitives';
import { inputClass, labelClass } from '../../../common/ui/format';
import { editStudent } from '../../../common/services/api';

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export default function StudentEditModal({ student, onClose, onSaved }) {
  const [form, setForm] = useState({ name: '', email: '', number: '' });
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!student) return;
    setForm({ name: student.name || '', email: student.email || '', number: student.number || '' });
    setError('');
  }, [student]);

  const set = (key) => (e) => setForm((f) => ({ ...f, [key]: e.target.value }));

  const close = () => {
    if (!saving) onClose();
  };

  const submit = async (e) => {
    e.preventDefault();
    const payload = { name: form.name.trim(), email: form.email.trim().toLowerCase(), number: form.number.trim() };
    if (!payload.name) return setError('Name is required.');
    if (!EMAIL_PATTERN.test(payload.email)) return setError('Enter a valid email address.');
    setSaving(true);
    setError('');
    try {
      const response = await editStudent(student._id, payload);
      onSaved({ ...student, ...(response.data?.student || payload) });
    } catch (err) {
      setError(typeof err === 'string' ? err : err.message || 'Failed to update student');
    } finally {
      setSaving(false);
    }
  };

  const unchanged =
    student &&
    form.name.trim() === student.name &&
    form.email.trim().toLowerCase() === student.email &&
    form.number.trim() === (student.number || '');

  return (
    <Modal
      open={Boolean(student)}
      onClose={close}
      title="Edit student"
      icon={UserPen}
      accent="accent"
      width="max-w-md"
      footer={
        <>
          <Button variant="secondary" onClick={close} disabled={saving}>
            Cancel
          </Button>
          <Button type="submit" form="student-edit-form" disabled={saving || unchanged}>
            {saving ? 'Saving…' : 'Save changes'}
          </Button>
        </>
      }
    >
      <form id="student-edit-form" onSubmit={submit} className="space-y-4">
        <div className="space-y-1.5">
          <label htmlFor="student-name" className={labelClass}>
            Full name <span className="text-bad">*</span>
          </label>
          <input id="student-name" autoFocus value={form.name} onChange={set('name')} className={inputClass} maxLength={100} />
        </div>
        <div className="space-y-1.5">
          <label htmlFor="student-email" className={labelClass}>
            Email <span className="text-bad">*</span>
          </label>
          <input id="student-email" type="email" value={form.email} onChange={set('email')} className={inputClass} />
          <p className="text-[11px] text-subtle">The student signs in with this email.</p>
        </div>
        <div className="space-y-1.5">
          <label htmlFor="student-phone" className={labelClass}>
            Phone
          </label>
          <input id="student-phone" type="tel" value={form.number} onChange={set('number')} className={inputClass} placeholder="Optional" />
        </div>
        {error && (
          <p className="rounded-xl border border-bad-line bg-bad-soft px-3 py-2 text-xs font-semibold text-bad">{error}</p>
        )}
      </form>
    </Modal>
  );
}
