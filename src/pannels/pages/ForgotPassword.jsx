import React, { useState } from 'react';
import axios from 'axios';
import { API_BASE_URL } from '../../common/constants';
import ThemeToggle from '../../common/components/ThemeToggle';

const ForgotPassword = () => {
  const [email, setEmail] = useState('');
  const [oldPassword, setOldPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');

  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      const response = await axios.post(`${API_BASE_URL}/auth/forgot-password`, {
        email,
        oldPassword,
        newPassword,
      });
      setMessage(response.data.message);
      setError('');
    } catch (err) {
      setError(err.response.data.error);
      setMessage('');
    }
  };

  return (
    <div className="flex items-center justify-center min-h-screen transition-all duration-300" style={{ backgroundColor: 'var(--background-content)' }}>
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

        {/* Reset Password Title */}
        <h2 className="text-2xl font-bold mb-6 text-center" style={{ color: 'var(--text-heading)' }}>Reset Password</h2>

        {/* Reset Password Form */}
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

          {/* Old Password Field */}
          <div className="relative">
            <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
              <svg className="h-5 w-5" style={{ color: 'var(--text-secondary)' }} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
              </svg>
            </div>
            <input
              type="password"
              value={oldPassword}
              onChange={(e) => setOldPassword(e.target.value)}
              placeholder="Old Password"
              className="block w-full pl-10 pr-3 py-3 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all duration-300"
              style={{ 
                backgroundColor: 'var(--background-light)',
                borderColor: 'var(--card-border)',
                color: 'var(--text-primary)'
              }}
              required
            />
          </div>

          {/* New Password Field */}
          <div className="relative">
            <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
              <svg className="h-5 w-5" style={{ color: 'var(--text-secondary)' }} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
              </svg>
            </div>
            <input
              type="password"
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
              placeholder="New Password"
              className="block w-full pl-10 pr-3 py-3 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all duration-300"
              style={{ 
                backgroundColor: 'var(--background-light)',
                borderColor: 'var(--card-border)',
                color: 'var(--text-primary)'
              }}
              required
            />
          </div>

          {/* Error and Success Messages */}
          {message && <p className="text-green-500 text-sm">{message}</p>}
          {error && <p className="text-red-500 text-sm">{error}</p>}

          {/* Reset Password Button */}
          <button
            type="submit"
            className="w-full flex items-center justify-center py-3 px-4 rounded-lg transition-all duration-200 font-semibold"
            style={{ 
              background: 'var(--button-gradient)',
              color: 'white'
            }}
          >
            <svg className="w-5 h-5 mr-2 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7l5 5m0 0l-5 5m5-5H6" />
            </svg>
            Reset Password
          </button>
        </form>
      </div>
    </div>
  );
};

export default ForgotPassword;