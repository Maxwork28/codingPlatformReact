import { Editor, Range, Text, Transforms } from 'slate';
import { deserializeImgNode, serializeImageHtml } from '../../../../common/utils/questionRichTextImages';

const EMPTY = [{ type: 'paragraph', children: [{ text: '' }] }];
export const emptyRichText = () => EMPTY.map((n) => ({ ...n, children: [{ text: '' }] }));

/** Plain-text multi-line paste becomes one paragraph per line; HTML paste keeps Slate's default handling. */
export const withFormatting = (editor) => {
  const { insertData, isInline } = editor;

  editor.isInline = (element) => (element.type === 'link' ? true : isInline(element));

  editor.insertData = (data) => {
    try {
      const text = data.getData('text/plain');
      const html = data.getData('text/html');
      if ((html && html.includes('<')) || !text || !text.trim()) {
        insertData(data);
        return;
      }
      const lines = text.split(/\r?\n/);
      if (lines.length <= 1) {
        Transforms.insertText(editor, text);
        return;
      }
      if (!editor.selection) Transforms.select(editor, Editor.end(editor, []));
      if (editor.selection && !Range.isCollapsed(editor.selection)) Transforms.delete(editor);
      Transforms.insertText(editor, lines[0] || '');
      lines.slice(1).forEach((line) => Transforms.insertNodes(editor, { type: 'paragraph', children: [{ text: line || '' }] }));
    } catch {
      insertData(data);
    }
  };

  return editor;
};

export const serializeToHTML = (nodes) => {
  if (!Array.isArray(nodes) || nodes.length === 0) return '';
  return nodes
    .map((node) => {
      if (Text.isText(node)) {
        let text = node.text;
        if (node.bold) text = `<strong>${text}</strong>`;
        if (node.italic) text = `<em>${text}</em>`;
        if (node.code) text = `<code class="bg-inset px-1 rounded">${text}</code>`;
        return text;
      }
      const children = serializeToHTML(node.children);
      switch (node.type) {
        case 'image':
          return serializeImageHtml(node);
        case 'paragraph':
          return `<p>${children}</p>`;
        case 'code-block':
          return `<pre class="bg-gray-900 text-white p-4 rounded-lg font-mono text-sm">${children}</pre>`;
        case 'bulleted-list':
          return `<ul class="list-disc pl-6">${children}</ul>`;
        case 'numbered-list':
          return `<ol class="list-decimal pl-6">${children}</ol>`;
        case 'list-item':
          return `<li>${children}</li>`;
        default:
          return children;
      }
    })
    .join('');
};

export const deserializeFromHTML = (input) => {
  if (!input || typeof input !== 'string') return emptyRichText();
  if (!input.includes('<') || !input.includes('>')) return [{ type: 'paragraph', children: [{ text: input.trim() }] }];

  try {
    const body = new DOMParser().parseFromString(input, 'text/html').body;
    const BLOCK_PARENTS = new Set(['body', 'ul', 'ol']);
    const walk = (node) => {
      if (node.nodeType === Node.TEXT_NODE) {
        const parent = node.parentNode?.nodeName?.toLowerCase();
        const text = node.textContent || '';
        if (BLOCK_PARENTS.has(parent) && !text.trim()) return [];
        return [{ text: BLOCK_PARENTS.has(parent) ? text.trim() : text }];
      }
      if (node.nodeType !== Node.ELEMENT_NODE) return [];
      const children = Array.from(node.childNodes).flatMap(walk).filter(Boolean);
      if (children.length === 0) children.push({ text: '' });
      switch (node.tagName.toLowerCase()) {
        case 'img':
          return deserializeImgNode(node);
        case 'p':
          return [{ type: 'paragraph', children }];
        case 'pre':
          return [{ type: 'code-block', children }];
        case 'ul':
          return [{ type: 'bulleted-list', children }];
        case 'ol':
          return [{ type: 'numbered-list', children }];
        case 'li':
          return [{ type: 'list-item', children }];
        case 'strong':
          return children.map((child) => ({ ...child, bold: true }));
        case 'em':
          return children.map((child) => ({ ...child, italic: true }));
        case 'code':
          return children.map((child) => ({ ...child, code: true }));
        default:
          return children;
      }
    };
    const nodes = Array.from(body.childNodes).flatMap(walk).filter(Boolean);
    // Top-level text must sit inside a block for Slate.
    const blocks = nodes.map((n) => (Text.isText(n) ? { type: 'paragraph', children: [n] } : n));
    return blocks.length ? blocks : emptyRichText();
  } catch {
    return [{ type: 'paragraph', children: [{ text: input.trim() }] }];
  }
};

export const richTextIsEmpty = (nodes) =>
  !serializeToHTML(nodes)
    .replace(/<img[^>]*>/gi, 'img')
    .replace(/<[^>]*>/g, '')
    .replace(/&nbsp;/gi, ' ')
    .trim();
