import React, { useState, useEffect } from 'react';
import { ThemeContext } from './ThemeContext';

const STORAGE_KEY = 'theme';
const systemQuery = () => window.matchMedia?.('(prefers-color-scheme: light)');

function readSavedTheme() {
  const saved = localStorage.getItem(STORAGE_KEY);
  return saved === 'light' || saved === 'dark' ? saved : null;
}

function systemTheme() {
  return systemQuery()?.matches ? 'light' : 'dark';
}

export const ThemeProvider = ({ children }) => {
  const [theme, setTheme] = useState(() => readSavedTheme() || systemTheme());

  useEffect(() => {
    const root = document.documentElement;
    root.setAttribute('data-theme', theme);
    root.classList.toggle('dark', theme === 'dark');
    root.style.colorScheme = theme;
  }, [theme]);

  // Follow the OS setting until the user picks a theme explicitly.
  useEffect(() => {
    const query = systemQuery();
    if (!query) return undefined;
    const onChange = () => {
      if (!readSavedTheme()) setTheme(systemTheme());
    };
    query.addEventListener('change', onChange);
    return () => query.removeEventListener('change', onChange);
  }, []);

  const toggleTheme = () => {
    setTheme((prevTheme) => {
      const next = prevTheme === 'light' ? 'dark' : 'light';
      localStorage.setItem(STORAGE_KEY, next);
      return next;
    });
  };

  const value = {
    theme,
    toggleTheme,
    isDark: theme === 'dark',
    isLight: theme === 'light',
  };

  return (
    <ThemeContext.Provider value={value}>
      {children}
    </ThemeContext.Provider>
  );
};

export default ThemeProvider;
