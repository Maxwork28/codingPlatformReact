import React from 'react';

const variantStyles = {
  info: 'bg-blue-100 text-blue-800 border-blue-200',
  warning: 'bg-yellow-100 text-yellow-800 border-yellow-200',
  danger: 'bg-red-100 text-red-800 border-red-200',
  success: 'bg-green-100 text-green-800 border-green-200'
};

const ExamPrompt = ({
  open,
  title,
  message,
  variant = 'info',
  confirmText = 'OK',
  cancelText,
  onConfirm,
  onCancel
}) => {
  if (!open) return null;

  const variantClass = variantStyles[variant] || variantStyles.info;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60">
      <div className="w-full max-w-lg rounded-lg border bg-white shadow-xl">
        <div className={`rounded-t-lg border-b px-6 py-4 ${variantClass}`}>
          <h3 className="text-lg font-semibold">{title}</h3>
        </div>
        <div className="px-6 py-5">
          <p className="text-gray-700 whitespace-pre-wrap">{message}</p>
        </div>
        <div className="flex items-center justify-end gap-3 border-t px-6 py-4">
          {cancelText && (
            <button
              onClick={onCancel}
              className="rounded-md border border-gray-300 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50"
            >
              {cancelText}
            </button>
          )}
          <button
            onClick={onConfirm}
            className="rounded-md bg-blue-600 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-700"
          >
            {confirmText}
          </button>
        </div>
      </div>
    </div>
  );
};

export default ExamPrompt;
