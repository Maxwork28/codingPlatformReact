import React, { useEffect, useRef, useState } from 'react';
import { FileSpreadsheet, Pencil, School, Upload, X } from 'lucide-react';
import Modal from '../../../common/ui/Modal';
import { Button } from '../../../common/ui/primitives';
import { inputClass, labelClass, type } from '../../../common/ui/format';
import { createClass, editClass } from '../../../common/services/api';
import OneTimeCredentials from '../../../common/components/OneTimeCredentials';
import { hasOneTimeCredentials } from '../../../common/utils/oneTimeCredentials';

/**
 * Create a class (name, description, optional student sheet) or edit an
 * existing one's name and description when `editing` is a class object.
 */
export default function ClassFormModal({ open, editing, onClose, onSaved }) {
  const isEdit = Boolean(editing);
  const [form, setForm] = useState({ name: '', description: '' });
  const [file, setFile] = useState(null);
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);
  /** Create response that carried one-time passwords; shown before the modal hands off to `onSaved`. */
  const [pendingCredentials, setPendingCredentials] = useState(null);
  const fileInput = useRef(null);

  useEffect(() => {
    if (!open) return;
    setForm({ name: editing?.name || '', description: editing?.description || '' });
    setFile(null);
    setError('');
    setPendingCredentials(null);
  }, [open, editing]);

  const close = () => {
    if (!saving) onClose();
  };

  const submit = async (e) => {
    e.preventDefault();
    const name = form.name.trim();
    if (!name) {
      setError('Class name is required.');
      return;
    }
    setSaving(true);
    setError('');
    try {
      const payload = { name, description: form.description.trim() };
      const response = isEdit ? await editClass(editing._id, payload) : await createClass(payload, file);
      if (hasOneTimeCredentials(response.data)) {
        // Passwords are only sent once: let the admin copy them before the modal closes.
        setPendingCredentials(response.data);
        return;
      }
      onSaved(response.data);
    } catch (err) {
      setError(typeof err === 'string' ? err : err.message || 'Failed to save class');
    } finally {
      setSaving(false);
    }
  };

  const unchanged = isEdit && form.name.trim() === editing.name && form.description.trim() === (editing.description || '');

  if (pendingCredentials) {
    return (
      <Modal
        open={open}
        onClose={() => onSaved(pendingCredentials)}
        title="Class created"
        icon={School}
        accent="accent"
        width="max-w-2xl"
        footer={<Button onClick={() => onSaved(pendingCredentials)}>Done</Button>}
      >
        <div className="space-y-3">
          <p className={type.body}>{pendingCredentials.message || 'The class has been created.'}</p>
          <OneTimeCredentials credentials={pendingCredentials.credentials} filename={`${form.name.trim() || 'class'}-student-passwords`} />
        </div>
      </Modal>
    );
  }

  return (
    <Modal
      open={open}
      onClose={close}
      title={isEdit ? 'Edit class' : 'Create class'}
      icon={isEdit ? Pencil : School}
      accent="accent"
      width="max-w-lg"
      footer={
        <>
          <Button variant="secondary" onClick={close} disabled={saving}>
            Cancel
          </Button>
          <Button type="submit" form="class-form" disabled={saving || unchanged}>
            {saving ? 'Saving…' : isEdit ? 'Save changes' : 'Create class'}
          </Button>
        </>
      }
    >
      <form id="class-form" onSubmit={submit} className="space-y-4">
        <div className="space-y-1.5">
          <label htmlFor="class-name" className={labelClass}>
            Class name <span className="text-bad">*</span>
          </label>
          <input
            id="class-name"
            autoFocus
            value={form.name}
            onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
            placeholder="e.g. Data Structures - Batch B"
            className={inputClass}
            maxLength={120}
          />
        </div>

        <div className="space-y-1.5">
          <label htmlFor="class-description" className={labelClass}>
            Description
          </label>
          <textarea
            id="class-description"
            rows={3}
            value={form.description}
            onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))}
            placeholder="What this class covers, schedule, audience…"
            className={`${inputClass} resize-none`}
          />
        </div>

        {!isEdit && (
          <div className="space-y-1.5">
            <span className={labelClass}>Students (optional)</span>
            <input
              ref={fileInput}
              type="file"
              accept=".xlsx,.xls"
              className="hidden"
              onChange={(e) => setFile(e.target.files?.[0] || null)}
            />
            {file ? (
              <div className="flex items-center gap-3 rounded-xl border border-line bg-inset px-3 py-2">
                <FileSpreadsheet className="w-4 h-4 text-ok shrink-0" />
                <span className="text-xs text-fg truncate flex-1">{file.name}</span>
                <button
                  type="button"
                  onClick={() => {
                    setFile(null);
                    if (fileInput.current) fileInput.current.value = '';
                  }}
                  className="p-1 rounded-lg text-muted hover:text-fg hover:bg-hover"
                  aria-label="Remove file"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              </div>
            ) : (
              <button
                type="button"
                onClick={() => fileInput.current?.click()}
                className="w-full flex flex-col items-center gap-1 rounded-xl border border-dashed border-line-strong bg-inset px-3 py-5 text-muted hover:border-accent hover:text-fg transition"
              >
                <Upload className="w-5 h-5" />
                <span className="text-xs font-semibold">Upload an Excel sheet of student emails</span>
                <span className={type.meta}>.xlsx or .xls · an Email column is enough · you can also add students later</span>
              </button>
            )}
          </div>
        )}

        {error && (
          <p className="rounded-xl border border-bad-line bg-bad-soft px-3 py-2 text-xs font-semibold text-bad">{error}</p>
        )}
      </form>
    </Modal>
  );
}
