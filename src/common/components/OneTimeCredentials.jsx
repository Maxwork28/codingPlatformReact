import React, { useState } from 'react';
import { Check, Copy, Download, KeyRound } from 'lucide-react';
import { Button } from '../ui/primitives';
import { table as tableClass, type } from '../ui/format';
import { downloadCsv } from '../utils/downloadCsv';

const asLines = (rows) => rows.map((r) => `${r.name || ''}\t${r.email || ''}\t${r.password || ''}`).join('\n');

/**
 * Renders the generated passwords for newly created accounts. Only lives in React state: nothing is
 * written to localStorage/sessionStorage, and the table disappears when the parent clears its result.
 */
export default function OneTimeCredentials({ credentials, filename = 'new-account-passwords', compact = false }) {
  const [copied, setCopied] = useState(false);
  const rows = Array.isArray(credentials) ? credentials : [];
  if (!rows.length) return null;

  const copyAll = async () => {
    try {
      await navigator.clipboard.writeText(`Name\tEmail\tPassword\n${asLines(rows)}`);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 2000);
    } catch {
      setCopied(false);
    }
  };

  const download = () => {
    downloadCsv(filename, [['Name', 'Email', 'Password'], ...rows.map((r) => [r.name || '', r.email || '', r.password || ''])]);
  };

  return (
    <section className="rounded-xl border border-warn-line bg-warn-soft/60 overflow-hidden" aria-labelledby="one-time-credentials-title">
      <div className="flex flex-wrap items-start gap-2 px-3 py-2.5 border-b border-warn-line">
        <KeyRound className="w-4 h-4 text-warn shrink-0 mt-0.5" />
        <div className="min-w-0 flex-1">
          <p id="one-time-credentials-title" className="text-xs font-bold text-fg">
            Login details for {rows.length} new account{rows.length === 1 ? '' : 's'}
          </p>
          <p className="text-[11px] text-warn">
            Email sending is not configured, so these one-time passwords are shown once. Copy or download them now; they cannot be retrieved later.
            Users must choose a new password the first time they sign in.
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="secondary" className="h-8" icon={copied ? Check : Copy} onClick={copyAll}>
            {copied ? 'Copied' : 'Copy all'}
          </Button>
          <Button variant="secondary" className="h-8" icon={Download} onClick={download}>
            Download CSV
          </Button>
        </div>
      </div>
      <div className={compact ? 'max-h-56 overflow-auto' : 'max-h-96 overflow-auto'}>
        <table className="w-full text-xs">
          <thead className="sticky top-0 bg-surface">
            <tr>
              <th className={`${tableClass.th} text-left`}>Name</th>
              <th className={`${tableClass.th} text-left`}>Email</th>
              <th className={`${tableClass.th} text-left`}>Password</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r, i) => (
              <tr key={`${r.email}-${i}`} className={tableClass.row}>
                <td className={`${tableClass.td} text-fg`}>{r.name || '—'}</td>
                <td className={`${tableClass.td} text-body`}>{r.email}</td>
                <td className={`${tableClass.td}`}>
                  <code className="rounded bg-surface px-1.5 py-0.5 font-mono font-semibold text-fg select-all">{r.password}</code>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <p className={`${type.meta} px-3 py-2`}>Students are asked to change this password the first time they sign in.</p>
    </section>
  );
}
