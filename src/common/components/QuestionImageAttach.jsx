import React, { useRef, useState } from 'react';
import { PhotoIcon } from '@heroicons/react/24/outline';
import { uploadQuestionImageFile } from '../utils/questionRichTextImages';

const QuestionImageAttach = ({ onUploaded }) => {
  const inputRef = useRef(null);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState('');

  const handleFiles = async (fileList) => {
    const files = Array.from(fileList || []).filter((f) => f.type && f.type.startsWith('image/'));
    if (!files.length) {
      setError('Choose a PNG, JPG, GIF, or WebP image.');
      return;
    }
    setError('');
    setUploading(true);
    try {
      const items = [];
      for (const file of files) {
        items.push(await uploadQuestionImageFile(file));
      }
      if (items.length) onUploaded?.(items);
    } catch (err) {
      setError(err.message || 'Failed to add image');
    } finally {
      setUploading(false);
    }
  };

  return (
    <div className="mt-2">
      <input
        ref={inputRef}
        type="file"
        accept="image/png,image/jpeg,image/gif,image/webp"
        multiple
        className="hidden"
        onChange={(e) => {
          handleFiles(e.target.files);
          e.target.value = '';
        }}
      />
      <button
        type="button"
        disabled={uploading}
        onClick={() => inputRef.current?.click()}
        onDragOver={(e) => {
          e.preventDefault();
          e.stopPropagation();
        }}
        onDrop={(e) => {
          e.preventDefault();
          e.stopPropagation();
          if (!uploading) handleFiles(e.dataTransfer.files);
        }}
        className={`w-full flex items-center justify-center gap-2 rounded-lg border-2 border-dashed px-3 py-3 text-sm ${
          uploading ? 'opacity-60 cursor-wait' : 'hover:border-indigo-400 hover:bg-indigo-50/60'
        }`}
        style={{ borderColor: 'var(--card-border)', color: 'var(--text-secondary)' }}
      >
        <PhotoIcon className="h-5 w-5 shrink-0" />
        <span>
          {uploading ? 'Uploading image…' : 'Add image — click or drop a diagram / screenshot here'}
        </span>
      </button>
      <p className="mt-1 text-xs" style={{ color: 'var(--text-secondary)' }}>
        PNG, JPG, GIF, or WebP, up to 5MB. Paste text as usual; add pictures after. You can also use Image in the toolbar or paste a screenshot into the description.
      </p>
      {error && <p className="mt-1 text-xs text-red-600">{error}</p>}
    </div>
  );
};

export default QuestionImageAttach;
