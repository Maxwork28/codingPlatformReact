import React, { useState } from 'react';
import axios from 'axios';
import { API_BASE_URL } from '../../common/constants';
import { Link } from 'react-router-dom';
import { ArrowLeft } from 'lucide-react';
import { button, inputClass, labelClass, shell, surface, type } from '../../common/ui/format';

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
    <div className={`${shell.page} flex items-center justify-center px-4`}>
      <div className={`${surface.card} w-full max-w-md`}>
        <Link to="/login" className={`${button.withIcon} text-muted hover:text-fg mb-4`}>
          <ArrowLeft className="w-3.5 h-3.5" />
          Back
        </Link>
        <h1 className={type.pageTitle}>Reset password</h1>
        <p className={type.subtitle}>Enter your email and the new password.</p>
        <form onSubmit={handleSubmit} className="mt-6 space-y-4">
          <div>
            <label className={labelClass} htmlFor="reset-email">Email</label>
            <input id="reset-email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} className={`${inputClass} mt-1.5`} required />
          </div>
          <div>
            <label className={labelClass} htmlFor="reset-old">Old password</label>
            <input id="reset-old" type="password" value={oldPassword} onChange={(e) => setOldPassword(e.target.value)} className={`${inputClass} mt-1.5`} required />
          </div>
          <div>
            <label className={labelClass} htmlFor="reset-new">New password</label>
            <input id="reset-new" type="password" value={newPassword} onChange={(e) => setNewPassword(e.target.value)} className={`${inputClass} mt-1.5`} required />
          </div>
          {message && <p className="text-xs text-ok">{message}</p>}
          {error && <p className="text-xs text-bad">{error}</p>}
          <button type="submit" className={`${button.withIcon} w-full justify-center px-5 py-2.5 bg-accent hover:bg-accent-hover text-on-accent shadow-lg shadow-accent/25`}>
            Reset password
          </button>
        </form>
      </div>
    </div>
  );
};

export default ForgotPassword;