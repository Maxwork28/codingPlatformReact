import React from 'react';
import { Transforms } from 'slate';
import { useSlateStatic, ReactEditor } from 'slate-react';
import { resolveQuestionMediaUrl } from '../utils/questionRichTextImages';

const QuestionImageElement = ({ attributes, children, element }) => {
  const editor = useSlateStatic();
  const src = resolveQuestionMediaUrl(element.url);

  const handleRemove = (event) => {
    event.preventDefault();
    event.stopPropagation();
    const path = ReactEditor.findPath(editor, element);
    Transforms.removeNodes(editor, { at: path });
  };

  return (
    <span {...attributes} className="relative inline-block max-w-full my-2 align-middle">
      <span contentEditable={false} className="relative inline-block max-w-full">
        <img
          src={src}
          alt={element.alt || ''}
          className="question-inline-image max-h-80 rounded-md border border-gray-200"
        />
        <button
          type="button"
          onMouseDown={handleRemove}
          className="absolute top-1 right-1 rounded bg-black/60 px-1.5 py-0.5 text-xs text-white hover:bg-black/80"
          aria-label="Remove image"
        >
          Remove
        </button>
      </span>
      {children}
    </span>
  );
};

export default QuestionImageElement;
