import React from 'react';
import { Activity } from 'lucide-react';
import { EmptyState, Table } from '../../../../common/ui/primitives';
import { table as tableClass, type } from '../../../../common/ui/format';
import { HIDE_MD, HIDE_SM, plural, timeAgo } from '../classDetails/helpers';
import { isRunnable, langLabel } from './helpers';

const RESULTS = [
  { id: 'accepted', label: 'Accepted', bar: 'bg-ok', text: 'text-ok' },
  { id: 'wrong_answer', label: 'Wrong answer', bar: 'bg-bad', text: 'text-bad' },
  { id: 'runtime_error', label: 'Runtime error', bar: 'bg-warn', text: 'text-warn' },
  { id: 'compile_error', label: 'Compile error', bar: 'bg-warn', text: 'text-warn' },
  { id: 'tle', label: 'Time limit', bar: 'bg-info', text: 'text-info' },
  { id: 'mle', label: 'Memory limit', bar: 'bg-info', text: 'text-info' },
];
const RESULT_BY_ID = Object.fromEntries(RESULTS.map((r) => [r.id, r]));

function Tile({ label, value, hint }) {
  return (
    <div className="rounded-xl border border-line bg-surface px-3 py-2.5 min-w-0">
      <p className="text-[10px] font-bold uppercase tracking-wider text-muted truncate">{label}</p>
      <p className="text-xl font-bold text-fg leading-tight tabular-nums">{value}</p>
      {hint && <p className={`${type.meta} truncate`}>{hint}</p>}
    </div>
  );
}

function Breakdown({ title, rows, total }) {
  return (
    <div className="rounded-xl border border-line bg-surface p-3">
      <h3 className={`${type.section} mb-3`}>{title}</h3>
      <ul className="space-y-2">
        {rows.map((r) => {
          const pct = total ? Math.round((r.count / total) * 100) : 0;
          return (
            <li key={r.key}>
              <div className="flex items-center justify-between text-[11px] mb-1">
                <span className="text-body">{r.label}</span>
                <span className="text-muted tabular-nums">
                  {r.count} · {pct}%
                </span>
              </div>
              <div className="h-1.5 rounded-full bg-hover overflow-hidden">
                <div className={`h-full rounded-full ${r.bar}`} style={{ width: `${pct}%` }} />
              </div>
            </li>
          );
        })}
      </ul>
    </div>
  );
}

const COLUMNS = [
  { label: 'Student' },
  { label: 'Result' },
  { label: 'Class', className: HIDE_SM },
  { label: 'Details', className: HIDE_MD },
  { label: 'When', className: 'text-right' },
];

export default function ActivityTab({ question, stats, recent }) {
  const runnable = isRunnable(question);

  if (!stats.submissions) {
    return (
      <EmptyState
        icon={Activity}
        title="No submissions yet"
        message={
          stats.examSubmissions
            ? `No practice submissions. ${plural(stats.examSubmissions, 'answer')} came from exams.`
            : 'Student practice submissions will appear here.'
        }
      />
    );
  }

  const resultRows = RESULTS.filter((r) => stats.byStatus[r.id]).map((r) => ({ key: r.id, label: r.label, bar: r.bar, count: stats.byStatus[r.id] }));
  const languageRows = stats.byLanguage.map((l) => ({
    key: l.language,
    label: `${langLabel(l.language)} · ${l.count ? Math.round((l.correct / l.count) * 100) : 0}% correct`,
    bar: 'bg-accent',
    count: l.count,
  }));

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-2">
        <Tile label="Students" value={stats.students} hint={`${stats.solvedStudents} solved it`} />
        <Tile label="Solve rate" value={stats.solveRate == null ? '—' : `${stats.solveRate}%`} hint="Of students who tried" />
        <Tile label="Submissions" value={stats.submissions} hint={`${(stats.submissions / Math.max(1, stats.students)).toFixed(1)} per student`} />
        <Tile
          label="Accuracy"
          value={stats.accuracy == null ? '—' : `${stats.accuracy}%`}
          hint={stats.examSubmissions ? `+ ${stats.examSubmissions} exam answers` : 'Correct submissions'}
        />
      </div>

      <div className={`grid gap-3 ${runnable && languageRows.length ? 'md:grid-cols-2' : ''}`}>
        {resultRows.length > 0 && <Breakdown title="Results" rows={resultRows} total={stats.submissions} />}
        {runnable && languageRows.length > 0 && <Breakdown title="Languages" rows={languageRows} total={stats.submissions} />}
      </div>

      <section className="space-y-2">
        <div className="flex items-baseline gap-2">
          <h3 className={type.section}>Recent submissions</h3>
          <span className={type.meta}>Latest {recent.length}, practice only</span>
        </div>
        <Table columns={COLUMNS}>
          {recent.map((s) => {
            const result = s.isCorrect ? RESULT_BY_ID.accepted : RESULT_BY_ID[s.status] || RESULT_BY_ID.wrong_answer;
            return (
              <tr key={s._id} className={tableClass.row}>
                <td className={tableClass.td}>
                  <span className="block text-xs font-semibold text-fg truncate max-w-[14rem]">{s.student?.name || 'Deleted user'}</span>
                  {s.student?.email && <span className={`block ${type.meta} truncate max-w-[14rem]`}>{s.student.email}</span>}
                </td>
                <td className={tableClass.td}>
                  <span className={`text-[11px] font-semibold ${s.isCorrect ? 'text-ok' : result.text}`}>{s.isCorrect ? 'Accepted' : result.label}</span>
                </td>
                <td className={`${tableClass.td} ${HIDE_SM}`}>
                  <span className="truncate max-w-[12rem] inline-block align-bottom">{s.className || '—'}</span>
                </td>
                <td className={`${tableClass.td} ${HIDE_MD} whitespace-nowrap`}>
                  {runnable && s.totalTestCases ? `${s.passedTestCases}/${s.totalTestCases} tests` : null}
                  {runnable && s.totalTestCases && s.language ? ' · ' : null}
                  {s.language ? langLabel(s.language) : null}
                  {!runnable && s.score != null ? `${s.score} pts` : null}
                </td>
                <td className={`${tableClass.td} text-right whitespace-nowrap text-muted`} title={new Date(s.submittedAt).toLocaleString()}>
                  {timeAgo(s.submittedAt)}
                </td>
              </tr>
            );
          })}
        </Table>
      </section>
    </div>
  );
}
