import React, { useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { Award, BarChart3, ClipboardList, Pencil, Plus, Settings2 } from 'lucide-react';
import { Button, EmptyState, Table } from '../../../../common/ui/primitives';
import ActionMenu from '../../../../common/ui/ActionMenu';
import { table as tableClass, type } from '../../../../common/ui/format';
import { RateBar, SearchBox, Segmented } from './shared';
import { HIDE_MD, HIDE_SM, formatDate, useStaffBase, useUrlState } from './helpers';

const PHASES = {
  live: { label: 'Live', dot: 'bg-ok animate-pulse', text: 'text-ok' },
  scheduled: { label: 'Scheduled', dot: 'bg-info', text: 'text-info' },
  draft: { label: 'Draft', dot: 'bg-warn', text: 'text-warn' },
  completed: { label: 'Completed', dot: 'bg-subtle', text: 'text-muted' },
  archived: { label: 'Archived', dot: 'bg-subtle', text: 'text-subtle' },
};

const FILTERS = ['all', 'live', 'scheduled', 'draft', 'completed'];
const DEFAULTS = { q: '', filter: 'all' };

const COLUMNS = [
  { label: 'Exam' },
  { label: 'Status' },
  { label: 'Schedule', className: HIDE_SM },
  { label: 'Questions', className: `text-right ${HIDE_MD}` },
  { label: 'Attempts', className: 'text-right' },
  { label: 'Avg. score', className: HIDE_SM },
  { label: 'Scores', className: HIDE_MD },
  { key: 'actions', label: '' },
];

export default function ExamsTab({ classId, data }) {
  const navigate = useNavigate();
  const { base: staffBase } = useStaffBase();
  const [get, update] = useUrlState(DEFAULTS);
  const query = get('q');
  const filter = FILTERS.includes(get('filter')) ? get('filter') : 'all';
  const enrolled = data.counts.students;
  const base = `${staffBase}/classes/${classId}/exams`;

  const counts = useMemo(() => {
    const c = { all: data.exams.length };
    data.exams.forEach((e) => {
      c[e.phase] = (c[e.phase] || 0) + 1;
    });
    return c;
  }, [data.exams]);

  const rows = useMemo(() => {
    const q = query.trim().toLowerCase();
    return data.exams.filter((e) => (filter === 'all' || e.phase === filter) && (!q || e.title.toLowerCase().includes(q)));
  }, [data.exams, filter, query]);

  const headerButtons = (
    <>
      <Button variant="secondary" icon={Award} className="h-9" onClick={() => navigate(`${staffBase}/exams/templates`)}>
        From template
      </Button>
      <Button icon={Plus} className="h-9" onClick={() => navigate(`${base}/create`)}>
        New exam
      </Button>
    </>
  );

  if (data.exams.length === 0) {
    return (
      <EmptyState
        icon={ClipboardList}
        title="No exams for this class"
        message="Create a proctored exam from scratch or start from a saved template."
        action={<div className="flex gap-2 justify-center">{headerButtons}</div>}
      />
    );
  }

  return (
    <>
      <div className="shrink-0 flex flex-wrap items-center gap-2">
        <SearchBox value={query} onChange={(v) => update({ q: v })} placeholder="Search exams" />
        <Segmented
          label="Filter exams"
          value={filter}
          onChange={(v) => update({ filter: v })}
          options={FILTERS.map((id) => ({ id, label: id === 'all' ? 'All' : PHASES[id].label, count: counts[id] || 0 }))}
        />
        <div className="ml-auto flex items-center gap-2">
          <Button variant="ghost" icon={Settings2} className="h-9" onClick={() => navigate(base)}>
            Manage exams
          </Button>
          {headerButtons}
        </div>
      </div>

      {rows.length === 0 ? (
        <EmptyState
          icon={ClipboardList}
          title="No exams match"
          action={<Button variant="secondary" onClick={() => update({ q: '', filter: 'all' })}>Clear filters</Button>}
        />
      ) : (
        <Table columns={COLUMNS} fill>
          {rows.map((e) => {
            const phase = PHASES[e.phase] || PHASES.draft;
            return (
              <tr key={e._id} onClick={() => navigate(`${base}/${e._id}/report`)} className={`${tableClass.row} cursor-pointer`}>
                <td className={`${tableClass.td} max-w-xs`}>
                  <p className="text-sm font-semibold text-fg truncate">{e.title}</p>
                  <p className={type.meta}>{e.durationMinutes ? `${e.durationMinutes} min` : 'No time limit'}</p>
                </td>
                <td className={`${tableClass.td} whitespace-nowrap`}>
                  <span className={`flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-wider ${phase.text}`}>
                    <span className={`w-1.5 h-1.5 rounded-full ${phase.dot}`} />
                    {phase.label}
                  </span>
                </td>
                <td className={`${tableClass.td} whitespace-nowrap ${HIDE_SM}`}>
                  {e.startTime ? (
                    <>
                      <p className="text-body">{formatDate(e.startTime, true)}</p>
                      {e.endTime && <p className={type.meta}>until {formatDate(e.endTime, true)}</p>}
                    </>
                  ) : (
                    <span className="text-subtle">Not scheduled</span>
                  )}
                </td>
                <td className={`${tableClass.td} text-right tabular-nums ${HIDE_MD}`}>{e.questionCount}</td>
                <td className={`${tableClass.td} text-right whitespace-nowrap`}>
                  <p className="tabular-nums">
                    <span className="text-fg font-semibold">{e.submitted}</span>
                    <span className="text-subtle">/{enrolled}</span>
                  </p>
                  {e.started > e.submitted && <p className={type.meta}>{e.started - e.submitted} in progress</p>}
                </td>
                <td className={`${tableClass.td} ${HIDE_SM}`}>
                  <RateBar value={e.averagePercent} />
                </td>
                <td className={`${tableClass.td} whitespace-nowrap ${HIDE_MD}`}>
                  {e.phase === 'completed' ? (
                    <span className={`text-[11px] font-semibold ${e.scoresReleased ? 'text-ok' : 'text-warn'}`}>
                      {e.scoresReleased ? 'Released' : 'Not released'}
                    </span>
                  ) : (
                    <span className="text-subtle">—</span>
                  )}
                </td>
                <td className={`${tableClass.td} whitespace-nowrap`}>
                  <div className="flex items-center justify-end gap-1">
                    <Button
                      variant="soft"
                      icon={BarChart3}
                      className="hidden sm:flex"
                      onClick={(ev) => {
                        ev.stopPropagation();
                        navigate(`${base}/${e._id}/report`);
                      }}
                    >
                      Report
                    </Button>
                    <ActionMenu
                      label={`Actions for ${e.title}`}
                      items={[
                        { label: 'View report', icon: BarChart3, onClick: () => navigate(`${base}/${e._id}/report`) },
                        {
                          label: 'Edit exam',
                          icon: Pencil,
                          onClick: () => navigate(`${base}/${e._id}/edit`),
                          disabled: e.phase === 'completed' || e.phase === 'archived',
                        },
                        { label: 'Manage exams', icon: Settings2, onClick: () => navigate(base) },
                      ]}
                    />
                  </div>
                </td>
              </tr>
            );
          })}
        </Table>
      )}
    </>
  );
}
