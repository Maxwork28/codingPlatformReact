import React, { useRef, useState } from 'react';
import { useSlate } from 'slate-react';
import { insertImageFile } from '../utils/questionRichTextImages';
import { ImageIcon } from 'lucide-react';
import { notify } from '../ui/Toast';

const InsertQuestionImageButton = () => {
  const editor = useSlate();
  const inputRef = useRef(null);
  const [uploading, setUploading] = useState(false);

  const handleFiles = async (file) => {
    if (!file) return;
    setUploading(true);
    try {
      await insertImageFile(editor, file);
    } catch (err) {
      notify(err.message || 'Failed to add image');
    } finally {
      setUploading(false);
    }
  };

  return (
    <>
      <input
        ref={inputRef}
        type="file"
        accept="image/png,image/jpeg,image/gif,image/webp"
        className="hidden"
        onChange={(e) => {
          const file = e.target.files?.[0];
          e.target.value = '';
          handleFiles(file);
        }}
      />
      <button
        type="button"
        disabled={uploading}
        onMouseDown={(e) => {
          e.preventDefault();
          if (!uploading) inputRef.current?.click();
        }}
        className={`px-2 py-1 rounded inline-flex items-center gap-1 ${
          uploading ? 'opacity-60 cursor-wait' : 'bg-surface hover:bg-accent-soft'
        } transition-colors`}
        aria-label="Insert image"
        title="Insert image"
      >
        <ImageIcon className="h-4 w-4" />
        <span className="text-xs">{uploading ? 'Uploading…' : 'Image'}</span>
      </button>
    </>
  );
};

export default InsertQuestionImageButton;
