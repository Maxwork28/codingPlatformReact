import { useEffect, useState } from 'react';

/**
 * Countdown helpers for the exam screen. Every deadline is on the server clock: the client only
 * knows `clockOffset` (serverNow - Date.now()), so a backgrounded tab or a sleeping laptop cannot
 * gain time: on wake-up the countdown is simply recomputed from the deadline.
 */

/** Whole seconds left until `endsAt` on the server clock. */
export const remainingFor = (endsAt, clockOffset) =>
  endsAt ? Math.max(0, Math.floor((new Date(endsAt).getTime() - (Date.now() + clockOffset)) / 1000)) : null;

/** Seconds left until `endsAt`, re-evaluated once a second while `active`. Only the caller re-renders. */
export function useRemainingSeconds(endsAt, clockOffset, active = true) {
  const [remaining, setRemaining] = useState(() => remainingFor(endsAt, clockOffset));
  useEffect(() => {
    setRemaining(remainingFor(endsAt, clockOffset));
    if (!active || !endsAt) return undefined;
    const id = setInterval(() => setRemaining(remainingFor(endsAt, clockOffset)), 1000);
    return () => clearInterval(id);
  }, [endsAt, clockOffset, active]);
  return remaining;
}

/**
 * Seconds shown for a section/question timer as normalised by `timerMap`: counts down to `endsAt`
 * while the server says it runs, otherwise shows the frozen budget. null for untimed.
 */
export function useTimerSeconds(timer, clockOffset) {
  const endsAt = timer?.running && !timer.completed ? timer.endsAt : null;
  const live = useRemainingSeconds(endsAt, clockOffset, Boolean(endsAt));
  if (!timer || timer.remaining === null || timer.remaining === undefined) return null;
  if (timer.completed) return 0;
  return endsAt ? live : Math.floor(timer.remaining);
}

/** Server timer list → { [id]: { remaining, running, completed, endsAt } }. */
export const timerMap = (list, key) =>
  Object.fromEntries(
    (list || []).map((t) => [
      String(t[key]),
      {
        remaining: typeof t.remainingSeconds === 'number' ? t.remainingSeconds : null,
        running: Boolean(t.running) && !t.completed,
        completed: Boolean(t.completed),
        endsAt: t.running && !t.completed && t.endsAt ? t.endsAt : null,
      },
    ]),
  );

const LOCKED = { remaining: 0, running: false, completed: true, endsAt: null };

/**
 * Lock every running timer whose deadline has passed at `serverNow` (questions of an expired section
 * freeze too). Returns `timers` unchanged when nothing expired so callers can skip a re-render.
 */
export function expireTimers(timers, serverNow, sectionOf) {
  const due = (t) => t?.running && t.endsAt && new Date(t.endsAt).getTime() <= serverNow;
  const expiredSections = Object.keys(timers.sections).filter((id) => due(timers.sections[id]));
  const expiredQuestions = Object.keys(timers.questions).filter((id) => due(timers.questions[id]));
  if (!expiredSections.length && !expiredQuestions.length) return timers;
  const sections = { ...timers.sections };
  const questions = { ...timers.questions };
  expiredSections.forEach((id) => {
    sections[id] = LOCKED;
  });
  expiredQuestions.forEach((id) => {
    questions[id] = LOCKED;
  });
  if (expiredSections.length) {
    const frozen = new Set(expiredSections);
    Object.keys(questions).forEach((id) => {
      const t = questions[id];
      if (t.running && frozen.has(sectionOf.get(id))) {
        const left = Math.max(0, (new Date(t.endsAt).getTime() - serverNow) / 1000);
        questions[id] = { ...t, remaining: left, running: false, endsAt: null };
      }
    });
  }
  return { sections, questions };
}

/** The nearest deadline (server-clock ms) among running timers, or null. */
export function nextDeadline(timers) {
  let next = null;
  [timers.sections, timers.questions].forEach((group) => {
    Object.values(group).forEach((t) => {
      if (!t?.running || !t.endsAt) return;
      const at = new Date(t.endsAt).getTime();
      if (next === null || at < next) next = at;
    });
  });
  return next;
}
