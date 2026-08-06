import React from 'react';
import { useNavigate } from 'react-router-dom';

/**
 * Consistent back control for student pages.
 * Prefers browser history when available; otherwise navigates to fallbackTo.
 */
const StudentBackNav = ({
  fallbackTo = '/student',
  label = 'Back',
  className = '',
  compact = false,
  onClick,
}) => {
  const navigate = useNavigate();

  const handleBack = () => {
    if (typeof onClick === 'function') {
      onClick();
      return;
    }
    if (typeof window !== 'undefined' && window.history.length > 1) {
      navigate(-1);
      return;
    }
    navigate(fallbackTo);
  };

  return (
    <button
      type="button"
      onClick={handleBack}
      className={`inline-flex items-center gap-1.5 rounded-lg border transition-colors hover:opacity-90 focus:outline-none focus:ring-2 focus:ring-offset-1 ${
        compact ? 'px-1.5 py-0.5 text-[10px] leading-none' : 'px-3 py-1.5 text-sm font-medium'
      } ${className}`}
      style={{
        backgroundColor: 'var(--card-white)',
        borderColor: 'var(--card-border)',
        color: 'var(--text-primary)',
      }}
      aria-label={label}
    >
      <svg
        className={compact ? 'h-3 w-3' : 'h-4 w-4'}
        fill="none"
        viewBox="0 0 24 24"
        stroke="currentColor"
        aria-hidden="true"
      >
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
      </svg>
      <span>{label}</span>
    </button>
  );
};

export default StudentBackNav;
