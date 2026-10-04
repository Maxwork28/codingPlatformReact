import React from 'react';
import { Copy } from 'lucide-react';
import { Card } from '../../../../common/ui/primitives';
import { type } from '../../../../common/ui/format';
import { QUESTION_TYPES, formatDate, plural, timeAgo } from '../classDetails/helpers';
import { copyText, isRunnable, langLabel } from './helpers';

function Row({ label, children }) {
  return (
    <div className="flex items-start justify-between gap-3 py-2">
      <dt className="text-[11px] text-muted shrink-0">{label}</dt>
      <dd className="text-xs text-fg text-right min-w-0 break-words">{children}</dd>
    </div>
  );
}

function Glance({ label, value, hint }) {
  return (
    <div className="rounded-xl border border-line bg-inset px-3 py-2 min-w-0">
      <p className="text-[10px] font-bold uppercase tracking-wider text-muted truncate">{label}</p>
      <p className="text-lg font-bold text-fg leading-tight tabular-nums">{value}</p>
      {hint && <p className={`${type.meta} truncate`}>{hint}</p>}
    </div>
  );
}

export default function DetailsPanel({ question: q, classes, exams, stats, templateCount }) {
  const tests = q.testCases || [];
  const publicTests = tests.filter((t) => t.isPublic).length;
  const isDraft = q.isDraft || q.status === 'draft';
  const visibleIn = classes.filter((c) => c.isPublished && !c.isDisabled).length;

  return (
    <div className="space-y-4">
      <Card className="p-4">
        <h2 className={`${type.section} mb-3`}>At a glance</h2>
        <div className="grid grid-cols-2 gap-2">
          <Glance label="Classes" value={classes.length} hint={classes.length ? `${visibleIn} visible` : 'Not assigned'} />
          <Glance label="Exams" value={exams.length} hint={templateCount ? `+ ${plural(templateCount, 'template')}` : null} />
          <Glance label="Students" value={stats.students} hint={stats.students ? `${stats.solvedStudents} solved` : 'No attempts'} />
          <Glance
            label="Solve rate"
            value={stats.solveRate == null ? '—' : `${stats.solveRate}%`}
            hint={stats.lastSubmittedAt ? `Last ${timeAgo(stats.lastSubmittedAt)}` : null}
          />
        </div>
      </Card>

      <Card className="p-4">
        <h2 className={`${type.section} mb-1`}>Details</h2>
        <dl className="divide-y divide-line">
          <Row label="ID">
            <button
              type="button"
              onClick={() => copyText(q._id, 'Question ID copied')}
              className="inline-flex items-center gap-1.5 font-mono text-[11px] text-body hover:text-fg"
              title="Copy ID"
            >
              {String(q._id).slice(-8)}
              <Copy className="w-3 h-3" />
            </button>
          </Row>
          <Row label="Status">
            {isDraft ? <span className="text-warn">Draft</span> : q.status === 'archived' ? 'Archived' : <span className="text-ok">Ready</span>}
            {q.isExamOnly && <span className="text-info"> · Exam-only</span>}
          </Row>
          <Row label="Type">{QUESTION_TYPES[q.type] || q.type}</Row>
          <Row label="Difficulty">
            <span className="capitalize">{q.difficulty || '—'}</span>
            {q.level && <span className="text-muted capitalize"> · {q.level}</span>}
          </Row>
          <Row label="Points">{q.points ?? '—'}</Row>
          {q.maxAttempts ? <Row label="Max attempts">{q.maxAttempts}</Row> : null}
          {isRunnable(q) && (
            <>
              <Row label="Languages">{q.languages?.length ? q.languages.map(langLabel).join(', ') : '—'}</Row>
              <Row label="Limits">
                {q.timeLimit ?? 2}s · {q.memoryLimit ?? 256} MB
              </Row>
              <Row label="Test cases">
                {tests.length}
                <span className="text-muted">
                  {' '}
                  ({publicTests} public · {tests.length - publicTests} hidden)
                </span>
              </Row>
            </>
          )}
          {q.tags?.length > 0 && (
            <Row label="Tags">
              <span className="flex flex-wrap justify-end gap-1">
                {q.tags.map((t) => (
                  <span key={t} className="px-1.5 py-0.5 rounded-md bg-hover text-body text-[10px]">
                    {t}
                  </span>
                ))}
              </span>
            </Row>
          )}
          <Row label="Created by">
            {q.createdBy?.name || '—'}
            {q.createdBy?.role && <span className="text-muted capitalize"> · {q.createdBy.role}</span>}
          </Row>
          <Row label="Created">{formatDate(q.createdAt)}</Row>
          <Row label="Updated">{formatDate(q.updatedAt, true)}</Row>
          {q.publishedAt && (
            <Row label="Published">
              {formatDate(q.publishedAt)}
              {q.publishedBy?.name && <span className="text-muted"> · {q.publishedBy.name}</span>}
            </Row>
          )}
        </dl>
      </Card>
    </div>
  );
}
