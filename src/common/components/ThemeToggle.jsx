import React from 'react';
import { useTheme } from '../context/ThemeContext';

const ThemeToggle = ({ variant = 'navbar' }) => {
  const { theme, toggleTheme, isDark } = useTheme();

  // Determine colors based on variant
  const isNavbar = variant === 'navbar';
  const iconColor = isNavbar ? 'white' : 'var(--text-primary)';
  const hoverBg = isNavbar ? 'hover:bg-white hover:bg-opacity-10' : 'hover:bg-gray-100 dark:hover:bg-gray-700';

  return (
    <button
      onClick={toggleTheme}
      className={`theme-toggle p-2 rounded-lg transition-all duration-300 ${hoverBg}`}
      style={{ 
        color: iconColor,
        backgroundColor: 'transparent'
      }}
      title={`Switch to ${isDark ? 'light' : 'dark'} mode`}
    >
      {isDark ? (
        // Sun icon for dark mode (click to switch to light)
        <svg
          className="w-5 h-5"
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
          xmlns="http://www.w3.org/2000/svg"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M12 3v1m0 16v1m9-9h-1M4 12H3m15.364 6.364l-.707-.707M6.343 6.343l-.707-.707m12.728 0l-.707.707M6.343 17.657l-.707.707M16 12a4 4 0 11-8 0 4 4 0 018 0z"
          />
        </svg>
      ) : (
        // Moon icon for light mode (click to switch to dark)
        <svg
          className="w-5 h-5"
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
          xmlns="http://www.w3.org/2000/svg"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M20.354 15.354A9 9 0 018.646 3.646 9.003 9.003 0 0012 21a9.003 9.003 0 008.354-5.646z"
          />
        </svg>
      )}
    </button>
  );
};

export default ThemeToggle;


