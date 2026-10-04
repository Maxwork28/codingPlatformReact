import React, { useState } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { login } from '../../common/components/redux/authSlice';
import { Link, useNavigate } from 'react-router-dom';
import { ArrowRight, Eye, EyeOff, KeyRound, Loader2 } from 'lucide-react';
import ThemeToggle from '../../common/components/ThemeToggle';
import BrandLogo from '../../common/components/BrandLogo';
import { button, inputClass, labelClass, shell, surface, type } from '../../common/ui/format';

const Login = () => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const dispatch = useDispatch();
  const navigate = useNavigate();
  const { status, error } = useSelector((state) => state.auth);

  const handleSubmit = async (e) => {
    e.preventDefault();
    const result = await dispatch(login({ email, password: password.trim() }));
    if (login.fulfilled.match(result)) {
      navigate(`/${result.payload.role}`);
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

        <form onSubmit={handleSubmit} className="p-6 space-y-4">
        <h2 className={type.pageTitle}>Sign in</h2>
        <p className={type.subtitle}>Use the email and password for your panel.</p>

          <div>
            <label className={labelClass} htmlFor="login-email">Email</label>
            <input
              id="login-email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="Email"
              className={`${inputClass} mt-1.5`}
              required
            />
          </div>

          {/* Password Field */}
          <div>
            <label className={labelClass} htmlFor="login-password">Password</label>
            <div className="relative mt-1.5">
              <KeyRound className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted" />
              <input
                id="login-password"
                type={showPassword ? 'text' : 'password'}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Password"
                className={`${inputClass} pl-9 pr-10`}
                required
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute right-2 top-1/2 -translate-y-1/2 p-1.5 text-muted hover:text-fg rounded-lg"
                aria-label={showPassword ? 'Hide password' : 'Show password'}
              >
                {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>
          </div>

          {/* Error Message */}
          {error && (
            <p className="text-xs text-bad">
              {typeof error === 'string' ? error : error.message || 'Login failed'}
            </p>
          )}

          <div className="text-right">
            <Link to="/forgot-password" className="text-[11px] text-accent-ink hover:underline">
              Forgot password
            </Link>
          </div>

          <button
            type="submit"
            disabled={status === 'loading'}
            className={`${button.withIcon} w-full justify-center px-5 py-2.5 bg-accent hover:bg-accent-hover text-on-accent shadow-lg shadow-accent/25 disabled:opacity-50`}
          >
            {status === 'loading' ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <ArrowRight className="w-3.5 h-3.5" />}
            {status === 'loading' ? 'Signing in…' : 'Sign in'}
          </button>
        </form>
      </div>
    </div>
  );
};

export default Login;