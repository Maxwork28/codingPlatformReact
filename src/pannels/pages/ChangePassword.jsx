import React, { useState } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { Link, useNavigate } from 'react-router-dom';
import { ArrowLeft, ArrowRight, CheckCircle2, Eye, EyeOff, KeyRound, Loader2, ShieldAlert } from 'lucide-react';
import { changePassword } from '../../common/services/api';
import { logout, passwordChanged } from '../../common/components/redux/authSlice';
import { button, inputClass, labelClass, surface, type } from '../../common/ui/format';
import { PASSWORD_HINT, passwordProblem } from '../../common/utils/passwordRules';

const ROLE_HOME = { admin: '/admin', teacher: '/teacher', student: '/student' };

const errorMessage = (err) => {
  if (typeof err === 'string') return err;
  return err?.response?.data?.error ?? 'Could not reach the server';
};

/**
 * Authenticated page at /change-password. Posts { oldPassword, newPassword } to /auth/change-password,
 * stores the returned token and lifts the `mustChangePassword` gate (App.jsx redirects here while it is set).
 * Rendered inside the app layout, so it fills the content area rather than the whole screen.
 */
const ChangePassword = () => {
  const dispatch = useDispatch();
  const navigate = useNavigate();
  const { user, role } = useSelector((state) => state.auth);
  const dashboard = ROLE_HOME[role || user?.role] || '/';
  // Captured once so the banner and the success copy stay the same after the gate lifts.
  const [wasForced] = useState(() => Boolean(user?.mustChangePassword));

  const [oldPassword, setOldPassword] = useState('');
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [show, setShow] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [done, setDone] = useState(false);
  const [error, setError] = useState('');

  const problem = password ? passwordProblem(password) : '';
  const sameAsOld = password && oldPassword && password === oldPassword ? 'Choose a password different from your current one.' : '';
  const mismatch = confirm && confirm !== password ? 'Passwords do not match.' : '';
  const canSubmit = oldPassword && password && confirm && !problem && !sameAsOld && !mismatch && !submitting;

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!canSubmit) return;
    setSubmitting(true);
    setError('');
    try {
      const data = await changePassword(oldPassword, password);
      if (data?.token) localStorage.setItem('token', data.token);
      // Stores the fresh token and clears `mustChangePassword` on the signed-in user.
      dispatch(passwordChanged({ token: data?.token }));
      setDone(true);
      setOldPassword('');
      setPassword('');
      setConfirm('');
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="min-h-full flex items-center justify-center px-4 py-10 text-body">
      <div className={`${surface.card} w-full max-w-md p-0 overflow-hidden`}>
        <div className="px-6 pt-6 pb-5 border-b border-line bg-inset">
          <div className="flex items-center gap-3">
            <span className="w-10 h-10 rounded-xl bg-accent-soft border border-accent-line text-accent-ink flex items-center justify-center shrink-0">
              <KeyRound className="w-5 h-5" />
            </span>
            <div>
              <h1 className={type.pageTitle}>Change password</h1>
              <p className={type.subtitle}>{PASSWORD_HINT}</p>
            </div>
          </div>
        </div>

        <div className="p-6 space-y-4">
          {!wasForced && !done && (
            <Link to={dashboard} className={`${button.withIcon} text-muted hover:text-fg`}>
              <ArrowLeft className="w-3.5 h-3.5" />
              Back to dashboard
            </Link>
          )}

          {wasForced && !done && (
            <div className="rounded-xl border border-warn-line bg-warn-soft p-3 flex items-start gap-2.5 text-xs text-warn" role="status">
              <ShieldAlert className="w-4 h-4 shrink-0 mt-0.5" />
              <span>You are using a temporary password. Choose a new one to continue to your dashboard.</span>
            </div>
          )}

          {done ? (
            <div className="rounded-xl border border-ok-line bg-ok-soft p-4 flex items-start gap-3" role="status">
              <CheckCircle2 className="w-5 h-5 text-ok shrink-0 mt-0.5" />
              <div className="space-y-3">
                <p className="text-sm text-fg">
                  {wasForced ? 'Your password is set. You can now use the platform.' : 'Your password has been changed.'}
                </p>
                <button
                  type="button"
                  onClick={() => navigate(dashboard, { replace: true })}
                  className={`${button.withIcon} px-4 py-2 bg-accent hover:bg-accent-hover text-on-accent`}
                >
                  <ArrowRight className="w-3.5 h-3.5" />
                  Go to dashboard
                </button>
              </div>
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="space-y-4" noValidate>
              <div>
                <label className={labelClass} htmlFor="change-old">
                  Current password
                </label>
                <input
                  id="change-old"
                  type={show ? 'text' : 'password'}
                  autoComplete="current-password"
                  value={oldPassword}
                  onChange={(e) => setOldPassword(e.target.value)}
                  className={`${inputClass} mt-1.5`}
                  disabled={submitting}
                  required
                />
              </div>

              <div>
                <label className={labelClass} htmlFor="change-new">
                  New password
                </label>
                <div className="relative mt-1.5">
                  <KeyRound className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted" />
                  <input
                    id="change-new"
                    type={show ? 'text' : 'password'}
                    autoComplete="new-password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    className={`${inputClass} pl-9 pr-10`}
                    disabled={submitting}
                    aria-invalid={Boolean(problem || sameAsOld)}
                    aria-describedby="change-new-hint"
                    required
                  />
                  <button
                    type="button"
                    onClick={() => setShow((v) => !v)}
                    className="absolute right-2 top-1/2 -translate-y-1/2 p-1.5 text-muted hover:text-fg rounded-lg"
                    aria-label={show ? 'Hide passwords' : 'Show passwords'}
                  >
                    {show ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
                <p id="change-new-hint" className={`mt-1 text-[11px] ${problem || sameAsOld ? 'text-bad' : 'text-muted'}`}>
                  {problem || sameAsOld || PASSWORD_HINT}
                </p>
              </div>

              <div>
                <label className={labelClass} htmlFor="change-confirm">
                  Confirm new password
                </label>
                <input
                  id="change-confirm"
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
                {submitting ? 'Updating…' : 'Update password'}
              </button>

              {wasForced && (
                <button type="button" onClick={() => dispatch(logout())} className="w-full text-center text-xs text-muted hover:text-fg underline">
                  Sign out instead
                </button>
              )}
            </form>
          )}
        </div>
      </div>
    </div>
  );
};

export default ChangePassword;
