import React, { useEffect, useRef } from 'react';

// Placeholder sidebar. We'll wire real data/actions later.
const SidebarQuestions = ({ questions = [], activeId, onSelect, fixed = true }) => {
  const containerRef = useRef(null);

  useEffect(() => {
    const handleDocumentClick = (event) => {
      if (event.target.closest('details')) return; // clicks inside any details should not close immediately
      const root = containerRef.current;
      if (!root) return;
      root.querySelectorAll('details[open]').forEach((el) => el.removeAttribute('open'));
    };
    document.addEventListener('click', handleDocumentClick);
    return () => document.removeEventListener('click', handleDocumentClick);
  }, []);

  return (
    <aside
      className={`h-full w-full shrink-0 border-r border-gray-200 dark:border-gray-700 overflow-visible`}
      aria-label="Questions sidebar"
      style={{
        background: 'linear-gradient(180deg, var(--primary-navy) 0%, #1a252f 100%)'
      }}
      ref={containerRef}
    >
      <div className="p-4">
        {/* Removed the 'Questions' subheading for a cleaner sidebar */}
        <div className="space-y-2">
          {questions.map((q, idx) => {
            const isActive = String(q._id) === String(activeId);
            const shortTitle = (q.title || 'Question').slice(0, 45);
            return (
              <div
                key={q._id}
                className={`w-full flex items-center justify-between px-3 py-2 rounded-lg border transition ${
                  isActive
                    ? 'bg-white/10 text-white border-white/20'
                    : 'bg-white/5 text-gray-200 border-white/10 hover:bg-white/10'
                }`}
              >
                <button
                  onClick={() => onSelect?.(q._id)}
                  className="flex items-center gap-2 text-left flex-1"
                >
                  <span className="flex h-6 w-6 items-center justify-center rounded-md bg-gray-700 text-white text-xs font-semibold">
                    {idx + 1}
                  </span>
                  <span className="text-sm truncate">{shortTitle}</span>
                </button>
                <details className="relative">
                  <summary className="list-none cursor-pointer px-2 py-1 text-white/80 hover:text-white">⋮</summary>
                  <div className="absolute left-full ml-2 top-0 w-64 rounded-md bg-white text-gray-800 shadow-lg ring-1 ring-black/5 border border-gray-200 z-50 overflow-hidden">
                    {[
                      { label: 'Unpublish Question', icon: (
                        <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M13 16h-1v-4h-1m1-4h.01"/><circle cx="12" cy="12" r="9"/></svg>
                      )},
                      { label: 'Disable Question', icon: (
                        <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="9"/><path d="M4.9 4.9l14.2 14.2"/></svg>
                      )},
                      { label: 'Mark Assignment', icon: (
                        <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="3" y="4" width="18" height="16" rx="2"/><path d="M7 8h10M7 12h10M7 16h6"/></svg>
                      )},
                      { label: 'Publish Answer', icon: (
                        <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M4 12l6 6L20 6"/></svg>
                      )},
                    ].map((item) => (
                      <button key={item.label} className="w-full flex items-center gap-3 px-4 py-2 text-sm hover:bg-gray-50">
                        <span className="text-gray-500">{item.icon}</span>
                        <span>{item.label}</span>
                      </button>
                    ))}
                    <div className="h-px bg-gray-200" />
                    {[
                      { label: 'View Statement', icon: (
                        <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="4" y="3" width="16" height="18" rx="2"/><path d="M8 7h8M8 11h8M8 15h6"/></svg>
                      )},
                      { label: 'View Solution', icon: (
                        <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M12 20l9-16H3l9 16z"/></svg>
                      )},
                      { label: 'View Test Cases', icon: (
                        <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M19 11H5M12 4v16"/></svg>
                      )},
                    ].map((item) => (
                      <button key={item.label} className="w-full flex items-center gap-3 px-4 py-2 text-sm hover:bg-gray-50">
                        <span className="text-gray-500">{item.icon}</span>
                        <span>{item.label}</span>
                      </button>
                    ))}
                  </div>
                </details>
              </div>
            );
          })}
          {questions.length === 0 && (
            <p className="text-sm text-gray-300/80">No questions yet.</p>
          )}
        </div>
      </div>
    </aside>
  );
};

export default SidebarQuestions;


