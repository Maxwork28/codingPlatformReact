import React, { useMemo, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { ArrowLeft, CheckCircle2, Eye, EyeOff, KeyRound, Loader2 } from 'lucide-react';
import { resetPassword } from '../../common/services/api';
import ThemeToggle from '../../common/components/ThemeToggle';
import BrandLogo from '../../common/components/BrandLogo';
import { button, inputClass, labelClass, shell, surface, type } from '../../common/ui/format';
import { PASSWORD_HINT, passwordProblem } from '../../common/utils/passwordRules';

const errorMessage = (err) => {
  if (typeof err === 'string') return err;
  return err?.response?.data?.error ?? 'Could not reach the server';
};

/** Public page for the link in the reset email: /reset-password?token=... */
const ResetPassword = () => {
  const [searchParams] = useSearchParams();
  const token = useMemo(() => (searchParams.get('token') || '').trim(), [searchParams]);

  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [show, setShow] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [done, setDone] = useState(false);
  const [error, setError] = useState('');

  const problem = password ? passwordProblem(password) : '';
  const mismatch = confirm && confirm !== password ? 'Passwords do not match.' : '';
  const canSubmit = Boolean(token) && password && confirm && !problem && !mismatch && !submitting;

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!canSubmit) return;
    setSubmitting(true);
    setError('');
    try {
      await resetPassword(token, password);
      setDone(true);
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className={`${shell.page} flex items-center justify-center px-4`}>
      <div className={`${surface.card} w-full max-w-md p-0 overflow-hidden`}>
        <div className="relative px-6 pt-6 pb-5 border-b border-line bg-inset">
          <div className="absolute right-4 top-4">
            <ThemeToggle />
          </div>
          <div className="flex items-center gap-3">
            <span className="w-10 h-10 rounded-xl bg-gradient-to-tr from-cyan-500 to-blue-600 shadow-lg shadow-accent/20 flex items-center justify-center overflow-hidden">
              <BrandLogo className="h-7 w-auto" />
            </span>
            <div>
              <p className="text-sm font-bold text-fg tracking-tight">AlgoSutra</p>
              <p className={type.meta}>Simpler Learning</p>
            </div>
          </div>
        </div>

        <div className="p-6 space-y-4">
          <Link to="/login" className={`${button.withIcon} text-muted hover:text-fg`}>
            <ArrowLeft className="w-3.5 h-3.5" />
            Back to sign in
          </Link>
          <div>
            <h1 className={type.pageTitle}>Choose a new password</h1>
            <p className={type.subtitle}>{PASSWORD_HINT}</p>
          </div>

          {!token ? (
            <div className="space-y-3">
              <p className="text-xs text-bad" role="alert">
                This reset link is missing its token. Open the link from your email again, or request a new one.
              </p>
              <Link to="/forgot-password" className="text-xs text-accent-ink hover:underline">
                Request a new reset link
              </Link>
            </div>
          ) : done ? (
            <div className="rounded-xl border border-ok-line bg-ok-soft p-4 flex items-start gap-3" role="status">
              <CheckCircle2 className="w-5 h-5 text-ok shrink-0 mt-0.5" />
              <div className="space-y-2">
                <p className="text-sm text-fg">Your password has been reset. Sign in with your new password.</p>
                <Link to="/login" className={`${button.withIcon} px-4 py-2 bg-accent hover:bg-accent-hover text-on-accent`}>
                  Go to sign in
                </Link>
              </div>
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="space-y-4" noValidate>
              <div>
                <label className={labelClass} htmlFor="reset-new">
                  New password
                </label>
                <div className="relative mt-1.5">
                  <KeyRound className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted" />
                  <input
                    id="reset-new"
                    type={show ? 'text' : 'password'}
                    autoComplete="new-password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    className={`${inputClass} pl-9 pr-10`}
                    disabled={submitting}
                    aria-invalid={Boolean(problem)}
                    aria-describedby="reset-new-hint"
                    required
                  />
                  <button
                    type="button"
                    onClick={() => setShow((v) => !v)}
                    className="absolute right-2 top-1/2 -translate-y-1/2 p-1.5 text-muted hover:text-fg rounded-lg"
                    aria-label={show ? 'Hide password' : 'Show password'}
                  >
                    {show ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
                <p id="reset-new-hint" className={`mt-1 text-[11px] ${problem ? 'text-bad' : 'text-muted'}`}>
                  {problem || PASSWORD_HINT}
                </p>
              </div>

              <div>
                <label className={labelClass} htmlFor="reset-confirm">
                  Confirm new password
                </label>
                <input
                  id="reset-confirm"
                  type={show ? 'text' : 'password'}
                  autoComplete="new-password"
                  value={confirm}
                  onChange={(e) => setConfirm(e.target.value)}
                  className={`${inputClass} mt-1.5`}
                  disabled={submitting}
                  aria-invalid={Boolean(mismatch)}
                  required
                />
                {mismatch && <p className="mt-1 text-[11px] text-bad">{mismatch}</p>}
              </div>

              {error && (
                <p className="text-xs text-bad" role="alert">
                  {error}
                </p>
              )}

              <button
                type="submit"
                disabled={!canSubmit}
                className={`${button.withIcon} w-full justify-center px-5 py-2.5 bg-accent hover:bg-accent-hover text-on-accent shadow-lg shadow-accent/25 disabled:opacity-50`}
              >
                {submitting ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <KeyRound className="w-3.5 h-3.5" />}
                {submitting ? 'Resetting…' : 'Reset password'}
              </button>
            </form>
          )}
        </div>
      </div>
    </div>
  );
};

export default ResetPassword;
