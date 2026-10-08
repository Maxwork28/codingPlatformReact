import React from 'react';
import { Link } from 'react-router-dom';

/**
 * 404 page. `homePath` should point at the current user's dashboard (or /login when signed out).
 */
export default function NotFound({ homePath = '/', homeLabel = 'Go to dashboard' }) {
  return (
    <div className="flex min-h-[60vh] flex-col items-center justify-center gap-4 px-6 text-center text-fg">
      <p className="text-5xl font-bold tracking-tight">404</p>
      <h1 className="text-xl font-semibold">Page not found</h1>
      <p className="max-w-md text-sm opacity-80">The page you are looking for does not exist or has moved.</p>
      <Link
        to={homePath}
        replace
        className="rounded-md border border-current px-4 py-2 text-sm font-medium hover:opacity-80"
      >
        {homeLabel}
      </Link>
    </div>
  );
}
