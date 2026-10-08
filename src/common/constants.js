// Backend origin. Configure per environment via VITE_API_BASE_URL (see .env.example).
export const API_BASE_URL = (import.meta.env.VITE_API_BASE_URL || 'http://localhost:5000').replace(/\/$/, '');

/** Custom run stdin — any text the program would read (numbers, strings, arrays, multiple lines). */
export const CUSTOM_STDIN_PLACEHOLDER = 'Any stdin, e.g. 2 3  or hello  or:\n3\n1 2 3';
export const CUSTOM_STDOUT_PLACEHOLDER = 'Expected stdout (optional)';
