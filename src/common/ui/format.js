/**
 * Shared class strings built on the semantic tokens in index.css.
 * Import these instead of inventing a new green, red, or gray; every value
 * works in both the dark and light theme and follows the role accent.
 */

export const shell = {
  page: 'min-h-screen bg-page text-body font-sans',
  content: 'w-full px-4 sm:px-5 py-6 space-y-6',
  navbar: 'sticky top-0 z-40 h-16 border-b border-line bg-navbar backdrop-blur-md',
};

const accentTone = {
  tab: 'bg-accent text-on-accent',
  badge: 'bg-accent-soft text-accent-ink border border-accent-line',
  hero: 'from-accent-soft border-accent-line',
  primary: 'px-5 py-2.5 bg-accent hover:bg-accent-hover text-on-accent shadow-lg shadow-accent/25',
};

export const role = {
  student: accentTone,
  teacher: accentTone,
  admin: accentTone,
};

export const inactiveTab = 'text-muted hover:text-fg hover:bg-hover';

export const surface = {
  card: 'bg-surface border border-line rounded-2xl p-5 shadow-card',
  cardHover: 'hover:border-line-strong',
  inset: 'bg-inset border border-line rounded-2xl',
  listHeader: 'px-6 py-4 border-b border-line bg-inset',
  empty: 'bg-surface/50 border border-line rounded-2xl',
  modalOverlay: 'fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/35 dark:bg-black/60 backdrop-blur-sm animate-fade-in',
  modalPanel: 'w-full bg-surface border border-line rounded-3xl shadow-2xl flex flex-col max-h-[92vh] overflow-hidden',
  modalHeader: 'px-6 py-5 border-b border-line bg-inset',
  modalBody: 'flex-1 overflow-y-auto p-6 space-y-6 text-xs text-body',
  modalFooter: 'px-6 py-4 border-t border-line bg-inset flex justify-end gap-2',
};

export const type = {
  pageTitle: 'text-2xl font-bold text-fg tracking-tight',
  modalTitle: 'text-lg font-bold text-fg tracking-tight',
  section: 'text-xs font-bold text-fg uppercase tracking-wider',
  cardTitle: 'text-sm font-bold text-fg',
  body: 'text-xs text-muted',
  meta: 'text-[11px] text-subtle',
  subtitle: 'text-xs text-muted mt-1',
};

export const button = {
  base: 'rounded-xl text-xs font-semibold transition cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed',
  withIcon: 'rounded-xl text-xs font-semibold transition cursor-pointer flex items-center gap-1.5 disabled:opacity-50 disabled:cursor-not-allowed',
  primary: 'px-4 py-2 bg-accent hover:bg-accent-hover text-on-accent',
  secondary: 'px-3 py-1.5 bg-surface hover:bg-hover text-body border border-line-strong',
  soft: 'bg-accent-soft hover:bg-accent/25 text-accent-ink border border-accent-line',
  info: 'bg-info-soft hover:bg-info-soft/70 text-info border border-info-line',
  publish: 'bg-ok-soft hover:bg-ok-soft/70 border border-ok-line text-ok',
  unpublish: 'bg-warn-soft hover:bg-warn-soft/70 border border-warn-line text-warn',
  danger: 'p-2 bg-bad-soft hover:bg-bad-soft/70 text-bad border border-bad-line',
  dangerSolid: 'px-4 py-2 bg-red-600 hover:bg-red-500 text-white',
  close: 'p-1.5 text-muted hover:text-fg rounded-lg hover:bg-hover',
};

export const chip = 'px-2 py-0.5 rounded text-[10px] font-bold uppercase';

export const status = {
  pass: `${chip} bg-ok-soft text-ok border border-ok-line`,
  warning: `${chip} bg-warn-soft text-warn border border-warn-line`,
  fail: `${chip} bg-bad-soft text-bad border border-bad-line`,
  info: `${chip} bg-info-soft text-info border border-info-line`,
  neutral: `${chip} bg-quiet-soft text-quiet border border-quiet-line`,
  ai: `${chip} bg-accent-soft text-accent-ink border border-accent-line`,
};

export const table = {
  wrap: 'overflow-x-auto bg-surface border border-line rounded-2xl shadow-card',
  table: 'min-w-full divide-y divide-line text-xs',
  head: 'bg-inset',
  th: 'px-3 py-2 text-left text-[10px] font-bold uppercase tracking-wider text-muted',
  body: 'divide-y divide-line',
  row: 'hover:bg-hover',
  td: 'px-3 py-2 text-body',
};

export const inputClass =
  'w-full bg-inset border border-line rounded-xl px-3.5 py-2 text-fg text-xs outline-none focus:border-accent';

export const labelClass = 'text-xs text-body font-semibold';

export function roleOf(roleName) {
  if (roleName === 'admin' || roleName === 'student' || roleName === 'teacher') return role[roleName];
  return role.teacher;
}
