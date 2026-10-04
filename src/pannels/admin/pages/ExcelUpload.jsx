import React, { useMemo, useRef, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import {
  AlertTriangle,
  ArrowRight,
  Download,
  FileSpreadsheet,
  GraduationCap,
  KeyRound,
  Upload,
  Users,
  X,
} from 'lucide-react';
import { uploadExcel } from '../../../common/services/api';
import { Button, StatusChip, Table } from '../../../common/ui/primitives';
import { table as tableClass, type } from '../../../common/ui/format';
import { notify } from '../../../common/ui/Toast';

const MAX_BYTES = 5 * 1024 * 1024;
const ACCEPTED = ['.xlsx', '.xls', '.csv'];

const ROLES = [
  { id: 'student', label: 'Students', icon: GraduationCap, listPath: '/admin/students' },
  { id: 'teacher', label: 'Teachers', icon: Users, listPath: '/admin/teachers' },
];

const TEMPLATE_ROWS = [
  ['name', 'email', 'number'],
  ['Asha Patel', 'asha.patel@example.com', '9876543210'],
  ['Rohan Mehta', 'rohan.mehta@example.com', ''],
];

const RESULT_KINDS = {
  created: { label: 'Added', chip: 'pass' },
  existing: { label: 'Already exists', chip: 'info' },
  skipped: { label: 'Skipped', chip: 'warning' },
  invalid: { label: 'Invalid', chip: 'fail' },
};

const REASONS = {
  duplicate_in_file: 'Same email appears earlier in this file',
  already_registered: 'Email belongs to an account with a different role',
  missing_email: 'Email cell is empty',
  invalid_email: 'Not a valid email address',
};

const RESULT_COLUMNS = [
  { label: 'Row', className: 'w-16' },
  { label: 'Email' },
  { label: 'Result' },
  { label: 'Details' },
];

const formatSize = (bytes) => (bytes < 1024 * 1024 ? `${Math.max(1, Math.round(bytes / 1024))} KB` : `${(bytes / 1024 / 1024).toFixed(1)} MB`);

function downloadTemplate(role) {
  const csv = TEMPLATE_ROWS.map((row) => row.join(',')).join('\n');
  const url = URL.createObjectURL(new Blob([csv], { type: 'text/csv' }));
  const link = document.createElement('a');
  link.href = url;
  link.download = `${role}s-import-template.csv`;
  link.click();
  URL.revokeObjectURL(url);
}

function buildRows(result) {
  if (!result) return [];
  const rows = [
    ...(result.createdUsers || []).map((r) => ({ ...r, kind: 'created', detail: r.name })),
    ...(result.existing || []).map((r) => ({ ...r, kind: 'existing', detail: `${r.name} — kept as is` })),
    ...(result.skipped || []).map((r) => ({
      ...r,
      kind: 'skipped',
      detail: r.reason === 'already_registered' && r.role ? `Already registered as ${r.role}` : REASONS[r.reason] || r.reason,
    })),
    ...(result.invalid || []).map((r) => ({ ...r, kind: 'invalid', detail: REASONS[r.reason] || r.reason })),
  ];
  return rows.sort((a, b) => (a.row || 0) - (b.row || 0));
}

const ExcelUpload = () => {
  const navigate = useNavigate();
  const [params, setParams] = useSearchParams();
  const role = params.get('role') === 'teacher' ? 'teacher' : 'student';
  const roleInfo = ROLES.find((r) => r.id === role);

  const [file, setFile] = useState(null);
  const [dragging, setDragging] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState('');
  const [result, setResult] = useState(null);
  const [resultFilter, setResultFilter] = useState('all');
  const inputRef = useRef(null);

  const rows = useMemo(() => buildRows(result), [result]);
  const counts = useMemo(
    () => Object.fromEntries(Object.keys(RESULT_KINDS).map((k) => [k, rows.filter((r) => r.kind === k).length])),
    [rows],
  );
  const visibleRows = resultFilter === 'all' ? rows : rows.filter((r) => r.kind === resultFilter);

  const setRole = (id) => {
    setParams((prev) => {
      const next = new URLSearchParams(prev);
      if (id === 'student') next.delete('role');
      else next.set('role', id);
      return next;
    }, { replace: true });
  };

  const pickFile = (candidate) => {
    setError('');
    if (!candidate) return;
    const ext = candidate.name.slice(candidate.name.lastIndexOf('.')).toLowerCase();
    if (!ACCEPTED.includes(ext)) {
      setError('Choose an Excel (.xlsx, .xls) or CSV file.');
      return;
    }
    if (candidate.size > MAX_BYTES) {
      setError(`This file is ${formatSize(candidate.size)}. The limit is 5 MB.`);
      return;
    }
    setFile(candidate);
  };

  const clearFile = () => {
    setFile(null);
    setError('');
    if (inputRef.current) inputRef.current.value = '';
  };

  const startOver = () => {
    clearFile();
    setResult(null);
    setResultFilter('all');
  };

  const handleImport = async () => {
    if (!file) return;
    setUploading(true);
    setError('');
    try {
      const response = await uploadExcel(file, role);
      setResult(response.data);
      setResultFilter('all');
      clearFile();
      notify(response.data.message, response.data.created ? 'success' : 'info');
    } catch (err) {
      setError(typeof err === 'string' ? err : err?.message || 'Failed to import file');
    } finally {
      setUploading(false);
    }
  };

  const onDrop = (e) => {
    e.preventDefault();
    setDragging(false);
    pickFile(e.dataTransfer.files?.[0]);
  };

  return (
    <div className="w-full px-4 sm:px-5 py-5 space-y-4">
      <header className="flex flex-wrap items-center gap-2">
        <h1 className={`${type.pageTitle} mr-2`}>Data Import</h1>
        <div className="flex h-9 rounded-xl border border-line bg-inset p-0.5" role="tablist" aria-label="Account type">
          {ROLES.map((r) => (
            <button
              key={r.id}
              type="button"
              role="tab"
              aria-selected={role === r.id}
              disabled={uploading}
              onClick={() => setRole(r.id)}
              className={`flex items-center gap-1.5 px-3 rounded-lg text-xs font-semibold transition ${
                role === r.id ? 'bg-surface text-fg shadow-sm' : 'text-muted hover:text-fg'
              }`}
            >
              <r.icon className="w-3.5 h-3.5" />
              {r.label}
            </button>
          ))}
        </div>
        <Button variant="secondary" icon={Download} className="ml-auto h-9" onClick={() => downloadTemplate(role)}>
          Download template
        </Button>
      </header>

      <div className="grid gap-4 lg:grid-cols-3">
        <section className="lg:col-span-2 bg-surface border border-line rounded-2xl p-4 space-y-3">
          <div
            role="button"
            tabIndex={0}
            onClick={() => !file && inputRef.current?.click()}
            onKeyDown={(e) => (e.key === 'Enter' || e.key === ' ') && !file && inputRef.current?.click()}
            onDragOver={(e) => {
              e.preventDefault();
              setDragging(true);
            }}
            onDragLeave={() => setDragging(false)}
            onDrop={onDrop}
            className={`flex flex-col items-center justify-center gap-2 rounded-xl border-2 border-dashed px-4 py-10 text-center transition ${
              dragging ? 'border-accent bg-accent-soft' : 'border-line-strong bg-inset'
            } ${file ? '' : 'cursor-pointer hover:border-accent'}`}
          >
            <input
              ref={inputRef}
              type="file"
              accept={ACCEPTED.join(',')}
              className="hidden"
              onChange={(e) => pickFile(e.target.files?.[0])}
            />
            {file ? (
              <div className="flex w-full max-w-md items-center gap-3 rounded-xl border border-line bg-surface px-3 py-2.5 text-left">
                <FileSpreadsheet className="w-5 h-5 text-ok shrink-0" />
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-semibold text-fg truncate">{file.name}</p>
                  <p className={type.meta}>{formatSize(file.size)}</p>
                </div>
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    clearFile();
                  }}
                  disabled={uploading}
                  className="p-1.5 rounded-lg text-muted hover:text-fg hover:bg-hover"
                  aria-label="Remove file"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
            ) : (
              <>
                <span className="w-10 h-10 rounded-xl bg-accent-soft text-accent-ink border border-accent-line flex items-center justify-center">
                  <Upload className="w-5 h-5" />
                </span>
                <p className="text-sm font-semibold text-fg">
                  Drop a file here or <span className="text-accent-ink underline underline-offset-2">browse</span>
                </p>
                <p className={type.body}>Excel (.xlsx, .xls) or CSV · up to 5 MB</p>
              </>
            )}
          </div>

          {error && (
            <p className="flex items-center gap-2 rounded-xl border border-bad-line bg-bad-soft px-3 py-2 text-xs font-semibold text-bad">
              <AlertTriangle className="w-3.5 h-3.5 shrink-0" />
              {error}
            </p>
          )}

          <div className="flex flex-wrap items-center justify-between gap-2">
            <p className={type.body}>
              New accounts are created as <span className="font-semibold text-fg">{roleInfo.label.toLowerCase()}</span>. Existing emails are left unchanged.
            </p>
            <Button icon={Upload} onClick={handleImport} disabled={!file || uploading}>
              {uploading ? 'Importing…' : `Import ${roleInfo.label.toLowerCase()}`}
            </Button>
          </div>
        </section>

        <aside className="bg-surface border border-line rounded-2xl p-4 space-y-3">
          <h2 className={type.cardTitle}>File format</h2>
          <ul className="space-y-1.5 text-xs text-body">
            <li className="flex items-center justify-between gap-2">
              <code className="rounded bg-inset px-1.5 py-0.5 text-fg">email</code>
              <StatusChip kind="fail">Required</StatusChip>
            </li>
            <li className="flex items-center justify-between gap-2">
              <code className="rounded bg-inset px-1.5 py-0.5 text-fg">name</code>
              <span className="text-muted">Optional · taken from email if empty</span>
            </li>
            <li className="flex items-center justify-between gap-2">
              <code className="rounded bg-inset px-1.5 py-0.5 text-fg">number</code>
              <span className="text-muted">Optional · phone</span>
            </li>
          </ul>
          <ul className="list-disc pl-4 space-y-1 text-xs text-muted">
            <li>First row must be the column headers; only the first sheet is read.</li>
            <li>Rows with an email that already exists are not changed.</li>
            <li>
              New users get login details by email, or the default password if email sending isn&apos;t set up.
            </li>
            {role === 'teacher' && <li>Imported teachers can create questions; change this on the Teachers page.</li>}
          </ul>
        </aside>
      </div>

      {result && (
        <section className="space-y-3">
          <div className="flex flex-wrap items-center gap-2">
            <h2 className={`${type.cardTitle} mr-1`}>Import results</h2>
            <span className={type.body}>{result.totalRows} rows read</span>
            <div className="flex h-9 rounded-xl border border-line bg-inset p-0.5 ml-2" role="tablist" aria-label="Filter results">
              {[['all', 'All', rows.length], ...Object.entries(RESULT_KINDS).map(([k, v]) => [k, v.label, counts[k]])].map(
                ([id, label, count]) => (
                  <button
                    key={id}
                    type="button"
                    role="tab"
                    aria-selected={resultFilter === id}
                    onClick={() => setResultFilter(id)}
                    className={`px-3 rounded-lg text-xs font-semibold transition whitespace-nowrap ${
                      resultFilter === id ? 'bg-surface text-fg shadow-sm' : 'text-muted hover:text-fg'
                    }`}
                  >
                    {label} <span className="text-subtle font-normal">{count}</span>
                  </button>
                ),
              )}
            </div>
            <div className="ml-auto flex gap-2">
              <Button variant="secondary" className="h-9" onClick={startOver}>
                Import another file
              </Button>
              <Button icon={ArrowRight} className="h-9" onClick={() => navigate(roleInfo.listPath)}>
                View {roleInfo.label.toLowerCase()}
              </Button>
            </div>
          </div>

          {result.defaultPassword && result.created > 0 && (
            <p className="flex items-center gap-2 rounded-xl border border-warn-line bg-warn-soft px-3 py-2 text-xs text-warn">
              <KeyRound className="w-3.5 h-3.5 shrink-0" />
              Email sending isn&apos;t configured. New accounts can sign in with the default password
              <code className="rounded bg-surface px-1.5 py-0.5 font-semibold text-fg">{result.defaultPassword}</code>
            </p>
          )}

          {visibleRows.length === 0 ? (
            <p className={`${type.body} py-6 text-center`}>No rows in this group.</p>
          ) : (
            <Table columns={RESULT_COLUMNS}>
              {visibleRows.map((r, i) => (
                <tr key={`${r.kind}-${r.row}-${r.email}-${i}`} className={tableClass.row}>
                  <td className={`${tableClass.td} tabular-nums text-muted`}>{r.row ?? '—'}</td>
                  <td className={`${tableClass.td} text-fg`}>{r.email}</td>
                  <td className={tableClass.td}>
                    <StatusChip kind={RESULT_KINDS[r.kind].chip}>{RESULT_KINDS[r.kind].label}</StatusChip>
                  </td>
                  <td className={`${tableClass.td} text-muted`}>{r.detail}</td>
                </tr>
              ))}
            </Table>
          )}
        </section>
      )}
    </div>
  );
};

export default ExcelUpload;
