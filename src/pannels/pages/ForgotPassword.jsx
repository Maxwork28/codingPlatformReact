import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { ArrowLeft, Loader2, MailCheck, Send } from 'lucide-react';
import { forgotPassword } from '../../common/services/api';
import ThemeToggle from '../../common/components/ThemeToggle';
import BrandLogo from '../../common/components/BrandLogo';
import { button, inputClass, labelClass, shell, surface, type } from '../../common/ui/format';

/** Same copy whether or not the address exists, so the form cannot be used to probe accounts. */
const GENERIC_SUCCESS = 'If an account exists for that email, a reset link is on its way. Check your inbox and spam folder.';

const errorMessage = (err) => {
  if (typeof err === 'string') return err;
  return err?.response?.data?.error ?? 'Could not reach the server';
};

const ForgotPassword = () => {
  const [email, setEmail] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [sent, setSent] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (submitting) return;
    setSubmitting(true);
    setError('');
    try {
      await forgotPassword(email);
      setSent(true);
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
            <h1 className={type.pageTitle}>Forgot password</h1>
            <p className={type.subtitle}>Enter your email and we will send you a link to choose a new password.</p>
          </div>

          {sent ? (
            <div className="rounded-xl border border-ok-line bg-ok-soft p-4 flex items-start gap-3" role="status">
              <MailCheck className="w-5 h-5 text-ok shrink-0 mt-0.5" />
              <div className="space-y-2">
                <p className="text-sm text-fg">{GENERIC_SUCCESS}</p>
                <Link to="/login" className="text-xs text-accent-ink hover:underline">
                  Return to sign in
                </Link>
              </div>
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="space-y-4" noValidate>
              <div>
                <label className={labelClass} htmlFor="forgot-email">
                  Email
                </label>
                <input
                  id="forgot-email"
                  type="email"
                  autoComplete="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="you@example.com"
                  className={`${inputClass} mt-1.5`}
                  disabled={submitting}
                  required
                />
              </div>
              {error && (
                <p className="text-xs text-bad" role="alert">
                  {error}
                </p>
              )}
              <button
                type="submit"
                disabled={submitting || !email.trim()}
                className={`${button.withIcon} w-full justify-center px-5 py-2.5 bg-accent hover:bg-accent-hover text-on-accent shadow-lg shadow-accent/25 disabled:opacity-50`}
              >
                {submitting ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Send className="w-3.5 h-3.5" />}
                {submitting ? 'Sending…' : 'Send reset link'}
              </button>
            </form>
          )}
        </div>
      </div>
    </div>
  );
};

export default ForgotPassword;
