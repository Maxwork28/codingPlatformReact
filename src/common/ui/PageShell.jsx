import React from 'react';
import { roleOf, shell, type } from './format';

export default function PageShell({ role = 'teacher', eyebrow, title, subtitle, action, children }) {
  const tone = roleOf(role);
  return (
    <div className={shell.page}>
      <div className={shell.content}>
        <header className={`p-6 rounded-3xl shadow-xl bg-gradient-to-r ${tone.hero} via-surface to-surface border flex flex-wrap items-center justify-between gap-4`}>
          <div className="min-w-0">
            {eyebrow && (
              <span className={`inline-flex px-2 py-0.5 text-[10px] font-bold uppercase rounded ${tone.badge}`}>
                {eyebrow}
              </span>
            )}
            {title && <h1 className={`${type.pageTitle} ${eyebrow ? 'mt-2' : ''}`}>{title}</h1>}
            {subtitle && <p className={type.subtitle}>{subtitle}</p>}
          </div>
          {action}
        </header>
        {children}
      </div>
    </div>
  );
}
