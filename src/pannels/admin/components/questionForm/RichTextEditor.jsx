import React, { useCallback, useMemo, useState } from 'react';
import { Editable, Slate, useSlate, withReact } from 'slate-react';
import { createEditor, Editor, Transforms } from 'slate';
import { withHistory } from 'slate-history';
import isHotkey from 'is-hotkey';
import { Bold, Code, Italic, List, ListOrdered, SquareCode } from 'lucide-react';
import { withQuestionImages } from '../../../../common/utils/questionRichTextImages';
import QuestionImageElement from '../../../../common/components/QuestionImageElement';
import InsertQuestionImageButton from '../../../../common/components/InsertQuestionImageButton';
import { emptyRichText, withFormatting } from './richText';

const LIST_TYPES = ['bulleted-list', 'numbered-list'];
const HOTKEYS = { 'mod+b': 'bold', 'mod+i': 'italic', 'mod+`': 'code' };

const isMarkActive = (editor, mark) => Boolean(Editor.marks(editor)?.[mark]);
const isBlockActive = (editor, block) => {
  const [match] = Editor.nodes(editor, { match: (n) => n.type === block });
  return Boolean(match);
};

const toggleMark = (editor, mark) => {
  if (isMarkActive(editor, mark)) Editor.removeMark(editor, mark);
  else Editor.addMark(editor, mark, true);
};

const toggleBlock = (editor, block) => {
  const active = isBlockActive(editor, block);
  const isList = LIST_TYPES.includes(block);
  Transforms.unwrapNodes(editor, { match: (n) => LIST_TYPES.includes(n.type), split: true });
  Transforms.setNodes(editor, { type: active ? 'paragraph' : isList ? 'list-item' : block });
  if (!active && isList) Transforms.wrapNodes(editor, { type: block, children: [] });
};

function Leaf({ attributes, children, leaf }) {
  let out = children;
  if (leaf.bold) out = <strong>{out}</strong>;
  if (leaf.italic) out = <em>{out}</em>;
  if (leaf.code) out = <code className="bg-inset px-1 rounded font-mono text-[0.9em]">{out}</code>;
  return <span {...attributes}>{out}</span>;
}

function Element({ attributes, children, element }) {
  switch (element.type) {
    case 'image':
      return <QuestionImageElement attributes={attributes} element={element}>{children}</QuestionImageElement>;
    case 'code-block':
      return (
        <pre className="bg-inset border border-line text-fg p-3 rounded-lg font-mono text-xs my-1 whitespace-pre-wrap" {...attributes}>
          {children}
        </pre>
      );
    case 'bulleted-list':
      return <ul className="list-disc pl-6" {...attributes}>{children}</ul>;
    case 'numbered-list':
      return <ol className="list-decimal pl-6" {...attributes}>{children}</ol>;
    case 'list-item':
      return <li {...attributes}>{children}</li>;
    default:
      return <p {...attributes}>{children}</p>;
  }
}

function ToolButton({ active, label, icon, onPress }) {
  const Icon = icon;
  return (
    <button
      type="button"
      title={label}
      aria-label={label}
      aria-pressed={active}
      onMouseDown={(e) => {
        e.preventDefault();
        onPress();
      }}
      className={`w-7 h-7 rounded-md flex items-center justify-center transition ${
        active ? 'bg-accent-soft text-accent-ink' : 'text-muted hover:text-fg hover:bg-hover'
      }`}
    >
      <Icon className="w-3.5 h-3.5" />
    </button>
  );
}

function Toolbar({ allowImages, compact }) {
  const editor = useSlate();
  return (
    <div className="flex flex-wrap items-center gap-0.5 px-1.5 py-1 border-b border-line bg-inset rounded-t-xl">
      <ToolButton label="Bold (Ctrl+B)" icon={Bold} active={isMarkActive(editor, 'bold')} onPress={() => toggleMark(editor, 'bold')} />
      <ToolButton label="Italic (Ctrl+I)" icon={Italic} active={isMarkActive(editor, 'italic')} onPress={() => toggleMark(editor, 'italic')} />
      <ToolButton label="Inline code" icon={Code} active={isMarkActive(editor, 'code')} onPress={() => toggleMark(editor, 'code')} />
      {!compact && (
        <>
          <span className="w-px h-4 bg-line mx-1" />
          <ToolButton label="Code block" icon={SquareCode} active={isBlockActive(editor, 'code-block')} onPress={() => toggleBlock(editor, 'code-block')} />
          <ToolButton label="Bulleted list" icon={List} active={isBlockActive(editor, 'bulleted-list')} onPress={() => toggleBlock(editor, 'bulleted-list')} />
          <ToolButton label="Numbered list" icon={ListOrdered} active={isBlockActive(editor, 'numbered-list')} onPress={() => toggleBlock(editor, 'numbered-list')} />
        </>
      )}
      {allowImages && (
        <>
          <span className="w-px h-4 bg-line mx-1" />
          <InsertQuestionImageButton />
        </>
      )}
    </div>
  );
}

/**
 * Uncontrolled Slate editor: `value` is only read on mount. Change the `key` to load new content
 * (for example after importing a pasted question).
 */
export default function RichTextEditor({ value, onChange, placeholder, allowImages = false, compact = false, minHeight = 'min-h-24', invalid = false, mono = false }) {
  const editor = useMemo(
    () => withHistory((allowImages ? withQuestionImages : (e) => e)(withFormatting(withReact(createEditor())))),
    [allowImages],
  );
  const renderElement = useCallback((props) => <Element {...props} />, []);
  const renderLeaf = useCallback((props) => <Leaf {...props} />, []);
  const [initialValue] = useState(() =>
    Array.isArray(value) && value.length && value.every((n) => n.type && Array.isArray(n.children)) ? value : emptyRichText(),
  );

  const handleKeyDown = (event) => {
    const hit = Object.keys(HOTKEYS).find((hotkey) => isHotkey(hotkey, event));
    if (hit) {
      event.preventDefault();
      toggleMark(editor, HOTKEYS[hit]);
    }
  };

  const handleCopy = (event) => {
    const selected = window.getSelection()?.toString();
    if (!selected || !event.clipboardData) return;
    event.clipboardData.setData('text/plain', selected);
    event.preventDefault();
  };

  const handleCut = (event) => {
    if (!editor.selection || !event.clipboardData) return;
    const selected = Editor.string(editor, editor.selection);
    if (!selected) return;
    event.clipboardData.setData('text/plain', selected);
    Editor.deleteFragment(editor);
    event.preventDefault();
  };

  return (
    <div
      className={`field-box rounded-xl border bg-surface transition focus-within:border-accent ${invalid ? 'border-bad-line' : 'border-line'}`}
    >
      <Slate
        editor={editor}
        initialValue={initialValue}
        onChange={(next) => {
          if (editor.operations.some((op) => op.type !== 'set_selection')) onChange(next);
        }}
      >
        <Toolbar allowImages={allowImages} compact={compact} />
        <Editable
          renderElement={renderElement}
          renderLeaf={renderLeaf}
          placeholder={placeholder}
          onKeyDown={handleKeyDown}
          onCopy={handleCopy}
          onCut={handleCut}
          className={`px-3 py-2 ${minHeight} text-xs text-fg leading-relaxed outline-none [&_p]:my-0.5 ${mono ? 'font-mono' : ''}`}
        />
      </Slate>
    </div>
  );
}
