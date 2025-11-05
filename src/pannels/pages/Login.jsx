import React, { useState } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { login } from '../../common/components/redux/authSlice';
import { Link, useNavigate } from 'react-router-dom';
import ThemeToggle from '../../common/components/ThemeToggle';

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
    <div className="flex items-center justify-center min-h-screen transition-all duration-300" 
         style={{ backgroundColor: 'var(--background-content)' }}>
      <div className="w-full max-w-md p-8 rounded-xl shadow-lg transition-all duration-300" 
           style={{ 
             backgroundColor: 'var(--card-white)',
             borderColor: 'var(--card-border)',
             border: '1px solid var(--card-border)'
           }}>
        {/* Header with Theme Toggle */}
        <div className="relative mb-8">
          <div className="absolute right-0 top-0">
            <ThemeToggle variant="card" />
          </div>
          <div className="text-center">
            <h1 className="text-2xl font-bold tracking-tight" style={{ color: 'var(--primary-indigo)' }}>CodeMaster</h1>
            <p className="text-sm" style={{ color: 'var(--text-secondary)' }}>Simpler Learning</p>
          </div>
        </div>

        {/* Sign In Title */}
        <h2 className="text-2xl font-bold mb-6 text-center" style={{ color: 'var(--text-heading)' }}>Sign In</h2>

        {/* Login Form */}
        <form onSubmit={handleSubmit} className="space-y-4">
          {/* Email Field */}
          <div className="relative">
            <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
              <svg className="h-5 w-5" style={{ color: 'var(--text-secondary)' }} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 8l7.89 4.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
              </svg>
            </div>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="Email"
              className="block w-full pl-10 pr-3 py-3 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all duration-300"
              style={{ 
                backgroundColor: 'var(--background-light)',
                borderColor: 'var(--card-border)',
                color: 'var(--text-primary)'
              }}
              required
            />
          </div>

          {/* Password Field */}
          <div className="relative">
            <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
              <svg className="h-5 w-5" style={{ color: 'var(--text-secondary)' }} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
              </svg>
            </div>
            <input
              type={showPassword ? "text" : "password"}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="Password"
              className="block w-full pl-10 pr-12 py-3 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all duration-300"
              style={{ 
                backgroundColor: 'var(--background-light)',
                borderColor: 'var(--card-border)',
                color: 'var(--text-primary)'
              }}
              required
            />
            <button
              type="button"
              onClick={() => setShowPassword(!showPassword)}
              className="absolute inset-y-0 right-0 pr-3 flex items-center justify-center z-20 rounded-r-lg transition-all duration-300 hover:bg-gray-100 dark:hover:bg-gray-700"
              style={{ 
                backgroundColor: 'var(--background-light)',
                color: 'var(--text-secondary)'
              }}
            >
              {showPassword ? (
                <svg className="h-5 w-5 hover:opacity-80" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.878 9.878L3 3m6.878 6.878L21 21" />
                </svg>
              ) : (
                <svg className="h-5 w-5 hover:opacity-80" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                </svg>
              )}
            </button>
          </div>

          {/* Error Message */}
          {error && <p className="text-red-500 text-sm">{error}</p>}

          {/* Forgot Password Link */}
          <div className="text-right">
            <Link to="/forgot-password" className="text-sm hover:opacity-80 transition-colors" style={{ color: 'var(--primary-indigo)' }}>
              Forgot Password
            </Link>
          </div>

          {/* Sign In Button */}
          <button
            type="submit"
            disabled={status === 'loading'}
            className="w-full flex items-center justify-center py-3 px-4 rounded-lg disabled:opacity-50 transition-all duration-200 font-semibold"
            style={{ 
              background: 'var(--button-gradient)',
              color: 'white'
            }}
          >
            <svg className="w-5 h-5 mr-2 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7l5 5m0 0l-5 5m5-5H6" />
            </svg>
            {status === 'loading' ? 'Signing In...' : 'SIGN IN'}
          </button>
        </form>
      </div>
    </div>
  );
};

export default Login;