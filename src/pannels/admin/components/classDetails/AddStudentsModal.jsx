import React, { useEffect, useRef, useState } from 'react';
import { FileSpreadsheet, Upload, UserPlus, X } from 'lucide-react';
import { addStudentsToClass } from '../../../../common/services/api';
import Modal from '../../../../common/ui/Modal';
import { Button } from '../../../../common/ui/primitives';
import { inputClass, labelClass, type } from '../../../../common/ui/format';
import { errorText } from './helpers';

const ACCEPT = '.xlsx,.xls,.csv';
const MAX_BYTES = 5 * 1024 * 1024;

export default function AddStudentsModal({ open, classId, className, onClose, onAdded }) {
  const [file, setFile] = useState(null);
  const [emails, setEmails] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [result, setResult] = useState(null);
  const fileInput = useRef(null);

  useEffect(() => {
    if (!open) return;
    setFile(null);
    setEmails('');
    setError('');
    setResult(null);
  }, [open]);

  const pickFile = (picked) => {
    if (!picked) return;
    if (!/\.(xlsx|xls|csv)$/i.test(picked.name)) return setError('Use an .xlsx, .xls or .csv file.');
    if (picked.size > MAX_BYTES) return setError('The file is larger than 5 MB.');
    setError('');
    setFile(picked);
  };

  const close = () => !saving && onClose();

  const submit = async (e) => {
    e.preventDefault();
    if (!file && !emails.trim()) {
      setError('Upload a spreadsheet or paste at least one email, name or phone number.');
      return;
    }
    setSaving(true);
    setError('');
    try {
      const response = await addStudentsToClass(classId, { file, emails });
      setResult(response.data);
      await onAdded();
    } catch (err) {
      setError(errorText(err, 'Failed to add students'));
    } finally {
      setSaving(false);
    }
  };

  const lines = emails.split(/[\n,;]+/).map((l) => l.trim()).filter(Boolean).length;

  return (
    <Modal
      open={open}
      onClose={close}
      title={`Add students to ${className}`}
      icon={UserPlus}
      accent="accent"
      width="max-w-lg"
      footer={
        result ? (
          <Button onClick={onClose}>Done</Button>
        ) : (
          <>
            <Button variant="secondary" onClick={close} disabled={saving}>
              Cancel
            </Button>
            <Button type="submit" form="add-students-form" disabled={saving || (!file && !lines)}>
              {saving ? 'Adding…' : 'Add students'}
            </Button>
          </>
        )
      }
    >
      {result ? (
        <div className="space-y-3">
          <div className="grid grid-cols-3 gap-2">
            {[
              { label: 'Added', value: result.added, tone: 'text-ok' },
              { label: 'Already enrolled', value: result.alreadyInClass, tone: 'text-muted' },
              { label: 'New accounts', value: result.created, tone: 'text-info' },
            ].map((s) => (
              <div key={s.label} className="rounded-xl border border-line bg-inset px-3 py-2">
                <p className="text-[10px] font-bold uppercase tracking-wider text-muted">{s.label}</p>
                <p className={`text-lg font-bold tabular-nums ${s.value ? s.tone : 'text-subtle'}`}>{s.value || 0}</p>
              </div>
            ))}
          </div>
          {result.unmatched?.length > 0 && (
            <p className="rounded-xl border border-warn-line bg-warn-soft px-3 py-2 text-xs text-warn">
              Not found: {result.unmatched.slice(0, 8).join(', ')}
              {result.unmatched.length > 8 && ` and ${result.unmatched.length - 8} more`}. Import them on the Data Import page first.
            </p>
          )}
          {result.ambiguous?.length > 0 && (
            <p className="rounded-xl border border-warn-line bg-warn-soft px-3 py-2 text-xs text-warn">
              More than one student matched: {result.ambiguous.slice(0, 8).join(', ')}. Use their email instead.
            </p>
          )}
          {(result.invalid?.length > 0 || result.skipped?.length > 0) && (
            <p className={type.body}>
              {result.invalid?.length || 0} invalid and {result.skipped?.length || 0} skipped rows in the file.
            </p>
          )}
          <p className={type.meta}>{result.message}</p>
        </div>
      ) : (
        <form id="add-students-form" onSubmit={submit} className="space-y-4">
          <div className="space-y-1.5">
            <span className={labelClass}>Spreadsheet</span>
            <input ref={fileInput} type="file" accept={ACCEPT} className="hidden" onChange={(e) => pickFile(e.target.files?.[0])} />
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
                onDragOver={(e) => e.preventDefault()}
                onDrop={(e) => {
                  e.preventDefault();
                  pickFile(e.dataTransfer.files?.[0]);
                }}
                className="w-full flex flex-col items-center gap-1 rounded-xl border border-dashed border-line-strong bg-inset px-3 py-5 text-muted hover:border-accent hover:text-fg transition"
              >
                <Upload className="w-5 h-5" />
                <span className="text-xs font-semibold">Drop or choose a file</span>
                <span className={type.meta}>.xlsx, .xls or .csv with an Email column. New emails get an account.</span>
              </button>
            )}
          </div>

          <div className="space-y-1.5">
            <label htmlFor="add-students-text" className={labelClass}>
              Or paste existing students
            </label>
            <textarea
              id="add-students-text"
              rows={5}
              value={emails}
              onChange={(e) => setEmails(e.target.value)}
              placeholder={'one@college.edu\ntwo@college.edu\nRahul Sharma'}
              className={`${inputClass} resize-none font-mono`}
            />
            <p className={type.meta}>One per line: email, exact name or phone number. {lines > 0 && `${lines} entered.`}</p>
          </div>

          {error && <p className="rounded-xl border border-bad-line bg-bad-soft px-3 py-2 text-xs font-semibold text-bad">{error}</p>}
        </form>
      )}
    </Modal>
  );
}
