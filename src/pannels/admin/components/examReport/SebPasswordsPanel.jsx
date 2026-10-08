import React, { useState } from 'react';
import { CheckCircle2, Copy, Download, Eye, EyeOff, KeyRound, Link2, RefreshCw, ShieldCheck, Stethoscope, XCircle } from 'lucide-react';
import { downloadSebConfig, getSebCheck, regenerateSebPasswords } from '../../../../common/services/api';
import { Button, StatusChip } from '../../../../common/ui/primitives';
import Modal from '../../../../common/ui/Modal';
import { type } from '../../../../common/ui/format';
import { confirmAction, notify } from '../../../../common/ui/Toast';

const MASK = '••••••••';

async function copyText(text, label) {
  try {
    await navigator.clipboard.writeText(text);
    notify(`${label} copied`, 'success');
  } catch {
    notify(`Could not copy the ${label.toLowerCase()}. Select it and copy it by hand.`, 'error');
  }
}

function PasswordTile({ label, hint, value, revealed }) {
  return (
    <div className="rounded-xl border border-line bg-inset px-4 py-3 min-w-0">
      <div className="flex items-center justify-between gap-2">
        <p className="text-[10px] font-bold uppercase tracking-wider text-muted">{label}</p>
        <Button
          variant="ghost"
          icon={Copy}
          className="h-7 w-7 justify-center p-0!"
          onClick={() => copyText(value, label)}
          disabled={!value}
          title={`Copy ${label.toLowerCase()}`}
        />
      </div>
      <p
        className="mt-1 font-mono text-3xl sm:text-4xl font-bold tracking-[0.2em] text-fg tabular-nums select-all break-all"
        aria-label={revealed ? `${label}: ${value?.split('').join(' ')}` : `${label} hidden`}
      >
        {revealed ? value || '—' : MASK}
      </p>
      <p className={`${type.meta} mt-1`}>{hint}</p>
    </div>
  );
}

function CheckRow({ ok, label, detail }) {
  const Icon = ok ? CheckCircle2 : XCircle;
  return (
    <li className="flex items-start gap-2">
      <Icon className={`w-4 h-4 shrink-0 mt-0.5 ${ok ? 'text-ok' : 'text-bad'}`} />
      <div className="min-w-0">
        <p className="text-xs font-semibold text-fg">{label}</p>
        {detail && <p className={type.meta}>{detail}</p>}
      </div>
    </li>
  );
}

/**
 * Staff panel on the exam report when the exam requires Safe Exam Browser: the entry / exit passwords
 * to announce in class (hidden until revealed, so they are not shown on a projector by accident), the
 * student launch link, the .seb download, password rotation and a live "is this browser SEB?" check.
 */
export default function SebPasswordsPanel({ exam, onChanged }) {
  const [revealed, setRevealed] = useState(false);
  const [busy, setBusy] = useState('');
  const [check, setCheck] = useState(null);
  const [checkOpen, setCheckOpen] = useState(false);
  const seb = exam?.seb;
  if (!seb?.required) return null;

  const strict = seb.verifyMode === 'strict';

  const regenerate = async () => {
    const ok = await confirmAction(
      'Both passwords are replaced right away. Announce the new entry password before anyone else starts.\n\nStudents who are already inside Safe Exam Browser keep the OLD exit password until they restart SEB, so keep the old one at hand until the exam ends.' +
        (seb.configKeyOverride ? '\n\nYour Config Key override is cleared, because the exit password is part of the .seb settings.' : ''),
      { title: 'Generate new passwords?', confirmLabel: 'Generate new passwords', danger: true },
    );
    if (!ok) return;
    setBusy('regenerate');
    try {
      await regenerateSebPasswords(exam._id);
      notify('New passwords generated', 'success');
      setRevealed(false);
      onChanged?.();
    } catch (err) {
      notify(typeof err === 'string' ? err : 'Failed to generate new passwords', 'error');
    } finally {
      setBusy('');
    }
  };

  const download = async () => {
    setBusy('download');
    try {
      const { data } = await downloadSebConfig(exam._id);
      const url = URL.createObjectURL(data);
      const a = document.createElement('a');
      a.href = url;
      a.download = seb.configFileName || 'exam.seb';
      document.body.appendChild(a);
      a.click();
      a.remove();
      setTimeout(() => URL.revokeObjectURL(url), 1000);
    } catch (err) {
      notify(typeof err === 'string' ? err : 'Failed to download the .seb file', 'error');
    } finally {
      setBusy('');
    }
  };

  const runCheck = async () => {
    setBusy('check');
    try {
      const { data } = await getSebCheck(exam._id);
      setCheck(data);
    } catch (err) {
      setCheck({ error: typeof err === 'string' ? err : 'Check failed' });
    } finally {
      setBusy('');
      setCheckOpen(true);
    }
  };

  return (
    <section className="shrink-0 rounded-2xl border border-line bg-surface p-4 shadow-card space-y-4" aria-label="Safe Exam Browser">
      <div className="flex flex-wrap items-center gap-2">
        <span className="w-8 h-8 rounded-lg border bg-accent-soft text-accent-ink border-accent-line flex items-center justify-center shrink-0">
          <ShieldCheck className="w-4 h-4" />
        </span>
        <div className="min-w-0 mr-auto">
          <h2 className={type.cardTitle}>Safe Exam Browser</h2>
          <p className={type.meta}>Announce the passwords in class. Students never receive them from the app.</p>
        </div>
        <StatusChip kind={strict ? 'warning' : 'info'}>{strict ? 'Strict check' : 'Basic check'}</StatusChip>
        <Button variant="secondary" icon={revealed ? EyeOff : Eye} onClick={() => setRevealed((v) => !v)} aria-pressed={revealed}>
          {revealed ? 'Hide passwords' : 'Show passwords'}
        </Button>
      </div>

      <div className="grid gap-3 sm:grid-cols-2">
        <PasswordTile
          label="Entry password"
          value={seb.entryPassword}
          revealed={revealed}
          hint="Students type it in the exam lobby (inside SEB) to start. Capital letters and digits; case does not matter."
        />
        <PasswordTile
          label="Exit password"
          value={seb.exitPassword}
          revealed={revealed}
          hint="SEB asks for it when a student quits Safe Exam Browser. Type it in CAPITALS exactly."
        />
      </div>

      <div className="rounded-xl border border-line px-3 py-2.5 space-y-1">
        <div className="flex items-center gap-2">
          <Link2 className="w-3.5 h-3.5 text-muted shrink-0" />
          <p className="text-xs font-semibold text-fg">Student launch link</p>
          {seb.launchLink && (
            <Button variant="ghost" icon={Copy} className="ml-auto h-7 px-2!" onClick={() => copyText(seb.launchLink, 'Launch link')}>
              Copy
            </Button>
          )}
        </div>
        <p className="font-mono text-[11px] text-body break-all select-all">{seb.launchLink || 'Not available: set API_PUBLIC_URL on the server.'}</p>
        <p className={type.meta}>
          Students get this as the “Open in Safe Exam Browser” button in the exam lobby. Opening it starts SEB with this exam’s settings.
        </p>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <Button variant="secondary" icon={Download} onClick={download} disabled={busy === 'download'}>
          {busy === 'download' ? 'Preparing…' : 'Download .seb file'}
        </Button>
        <Button variant="secondary" icon={Stethoscope} onClick={runCheck} disabled={busy === 'check'}>
          {busy === 'check' ? 'Checking…' : 'Test SEB detection'}
        </Button>
        <Button variant="danger" icon={RefreshCw} onClick={regenerate} disabled={busy === 'regenerate'} className="ml-auto">
          {busy === 'regenerate' ? 'Generating…' : 'Regenerate passwords'}
        </Button>
      </div>

      <Modal open={checkOpen} onClose={() => setCheckOpen(false)} title="Safe Exam Browser detection" icon={KeyRound} width="max-w-lg">
        <div className="space-y-4">
          <p className={type.body}>
            Before the exam, test one laptop: open the launch link on a laptop with Safe Exam Browser, sign in with your own account, open this
            report and press <span className="font-semibold text-fg">Test SEB detection</span> there. In a normal browser everything below shows as
            not detected, which is expected.
          </p>
          {check?.error ? (
            <p className="text-xs text-bad">{check.error}</p>
          ) : (
            check && (
              <ul className="space-y-2.5">
                <CheckRow ok={check.inSeb} label={check.inSeb ? 'This browser is Safe Exam Browser' : 'This browser is not Safe Exam Browser'} />
                <CheckRow ok={check.uaMatched} label="User-Agent identifies SEB" detail="Enough for Basic mode." />
                <CheckRow
                  ok={check.configKeyHashPresent}
                  label="Config Key proof sent"
                  detail={check.configKeyHashSource === 'jsapi' ? 'From SEB’s JavaScript API.' : check.configKeyHashSource === 'header' ? 'From SEB’s request header.' : undefined}
                />
                <CheckRow
                  ok={check.configKeyHashValid}
                  label={check.configKeyHashValid ? 'Config Key matches this exam' : 'Config Key does not match (yet)'}
                  detail={
                    check.configKeyHashValid
                      ? 'Strict mode is safe to switch on.'
                      : 'Keep Basic mode. If this laptop runs SEB with this exam and the key still does not match, paste the Config Key SEB shows into the exam’s Config Key override.'
                  }
                />
              </ul>
            )
          )}
          {check && !check.error && (
            <div className="rounded-xl border border-line bg-inset px-3 py-2 space-y-1">
              <p className={type.meta}>
                Current mode: <span className="font-semibold text-fg">{check.expectedMode === 'strict' ? 'Strict' : 'Basic'}</span> · this browser would{' '}
                <span className="font-semibold text-fg">{check.wouldPass ? 'be allowed' : 'be refused'}</span>
              </p>
              {check.effectiveConfigKey && (
                <p className={`${type.meta} break-all`}>
                  Expected Config Key: <span className="font-mono">{check.effectiveConfigKey}</span>
                </p>
              )}
              {check.userAgent && <p className={`${type.meta} break-all`}>User-Agent: {check.userAgent}</p>}
            </div>
          )}
        </div>
      </Modal>
    </section>
  );
}
