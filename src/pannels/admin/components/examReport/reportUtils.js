export const ATTEMPT_STATUS = {
  in_progress: { label: 'Writing', kind: 'info' },
  not_started: { label: 'Not started', kind: 'neutral' },
  submitted: { label: 'Submitted', kind: 'pass' },
  auto_submitted: { label: 'Auto-submitted', kind: 'warning' },
  expired: { label: 'Time ran out', kind: 'warning' },
  terminated: { label: 'Terminated', kind: 'fail' },
};

export const VIOLATION_LABELS = {
  tab_switch: 'Switched tab',
  fullscreen_exit: 'Left fullscreen',
  copy_paste: 'Copy / paste attempt',
  network_loss: 'Went offline',
};

export const isOpen = (a) => a.status === 'in_progress' || a.status === 'not_started';

export const answerKey = (id) => String(id?._id || id || '');

export const percentOf = (a) => (isOpen(a) || !a.maxScore ? null : Math.round(((a.totalScore || 0) / a.maxScore) * 100));

export const formatTime = (value, short = false) =>
  value
    ? new Date(value).toLocaleString(undefined, short ? { hour: '2-digit', minute: '2-digit', second: '2-digit' } : { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })
    : '—';

export const formatDuration = (ms) => {
  if (!Number.isFinite(ms) || ms < 0) return '—';
  const mins = Math.round(ms / 60000);
  if (mins < 60) return `${mins} min`;
  return `${Math.floor(mins / 60)} h ${mins % 60} min`;
};

export const formatCountdown = (ms) => {
  if (ms <= 0) return '0:00';
  const total = Math.floor(ms / 1000);
  const h = Math.floor(total / 3600);
  const m = Math.floor((total % 3600) / 60);
  const s = String(total % 60).padStart(2, '0');
  return h ? `${h}:${String(m).padStart(2, '0')}:${s}` : `${m}:${s}`;
};

export const answeredCount = (a) => (a.answers || []).filter((x) => x.answer != null && x.answer !== '').length;

export const violationTotal = (a) => (a.tabSwitchCount || 0) + (a.fullscreenExitCount || 0) + (a.copyPasteCount || 0);

const cell = (value) => `"${String(value ?? '').replace(/"/g, '""')}"`;

export const downloadCsv = (report) => {
  const { exam, attempts, notStarted } = report;
  const questions = exam.questions || [];
  const header = [
    'Student',
    'Email',
    'Status',
    'Started',
    'Submitted',
    'Score',
    'Max score',
    'Percent',
    'Tab switches',
    'Fullscreen exits',
    'Copy/paste',
    ...questions.map((q, i) => `Q${i + 1} ${q.title} (${q.points})`),
  ];
  const iso = (v) => (v ? new Date(v).toISOString() : '');
  const rows = attempts.map((a) => {
    const byQ = new Map((a.answers || []).map((x) => [answerKey(x.questionId), x]));
    const pct = percentOf(a);
    return [
      a.student?.name || 'Unknown',
      a.student?.email || '',
      ATTEMPT_STATUS[a.status]?.label || a.status,
      iso(a.startedAt),
      iso(a.submittedAt),
      a.totalScore ?? 0,
      a.maxScore ?? 0,
      pct == null ? '' : pct,
      a.tabSwitchCount || 0,
      a.fullscreenExitCount || 0,
      a.copyPasteCount || 0,
      ...questions.map((q) => {
        const ans = byQ.get(answerKey(q.questionId));
        return ans && ans.answer != null && ans.answer !== '' ? ans.score ?? 0 : '';
      }),
    ];
  });
  notStarted.forEach((s) => rows.push([s.name, s.email, 'Not started', '', '', '', '', '', '', '', '', ...questions.map(() => '')]));

  const csv = [header, ...rows].map((r) => r.map(cell).join(',')).join('\r\n');
  const blob = new Blob([`\ufeff${csv}`], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = `${(exam.title || 'exam').replace(/[^\w\- ]+/g, '').trim() || 'exam'} results.csv`;
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
};
