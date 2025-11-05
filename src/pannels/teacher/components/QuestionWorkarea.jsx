import React from 'react';

// Placeholder work area wrapper that keeps the header/actions area free.
const QuestionWorkarea = ({ children }) => {
  return (
    <div className="flex-1 min-w-0 h-full overflow-y-auto">
      <div className="p-0">
        {children || null}
      </div>
    </div>
  );
};

export default QuestionWorkarea;


