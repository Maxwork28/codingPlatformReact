import { createContext, useContext } from 'react';

/** Theme context object + hook. The provider component lives in ThemeProvider.jsx. */
export const ThemeContext = createContext();

export const useTheme = () => {
  const context = useContext(ThemeContext);
  if (!context) {
    throw new Error('useTheme must be used within a ThemeProvider');
  }
  return context;
};
