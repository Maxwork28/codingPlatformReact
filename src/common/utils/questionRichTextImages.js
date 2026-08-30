import { Transforms } from 'slate';
import { API_BASE_URL } from '../constants';
import { uploadQuestionImage } from '../services/api';

const MAX_IMAGE_BYTES = 5 * 1024 * 1024;

export function resolveQuestionMediaUrl(src) {
  if (!src) return '';
  if (/^(https?:|data:|blob:)/i.test(src)) return src;
  return `${API_BASE_URL}${src}`;
}

export function serializeImageHtml(node) {
  const src = String(node.url || '').replace(/&/g, '&amp;').replace(/"/g, '&quot;');
  const alt = String(node.alt || '').replace(/&/g, '&amp;').replace(/"/g, '&quot;');
  return `<img src="${src}" alt="${alt}" class="question-inline-image" />`;
}

export function deserializeImgNode(domNode) {
  return [
    {
      type: 'image',
      url: domNode.getAttribute('src') || '',
      alt: domNode.getAttribute('alt') || '',
      children: [{ text: '' }],
    },
  ];
}

export function insertImageNode(editor, url, alt = '') {
  if (!url) return;
  Transforms.insertNodes(editor, {
    type: 'image',
    url,
    alt,
    children: [{ text: '' }],
  });
}

export async function insertImageFile(editor, file) {
  if (!file || !file.type || !file.type.startsWith('image/')) {
    throw new Error('Please choose an image file (PNG, JPG, GIF, or WebP).');
  }
  if (file.size > MAX_IMAGE_BYTES) {
    throw new Error('Image must be 5MB or smaller.');
  }
  const data = await uploadQuestionImage(file);
  const url = resolveQuestionMediaUrl(data.url);
  insertImageNode(editor, url, file.name || '');
  return url;
}

/** Marks image nodes as inline voids and uploads pasted screenshot/files. */
export function withQuestionImages(editor) {
  const { isVoid, isInline, insertData } = editor;

  editor.isInline = (element) => (element.type === 'image' ? true : isInline(element));
  editor.isVoid = (element) => (element.type === 'image' ? true : isVoid(element));

  editor.insertData = (data) => {
    const files = Array.from(data.files || []).filter((f) => f.type && f.type.startsWith('image/'));
    if (files.length > 0) {
      files.forEach((file) => {
        insertImageFile(editor, file).catch((err) => {
          console.error('[question image paste]', err);
          window.alert(err.message || 'Failed to add image');
        });
      });
      return;
    }
    insertData(data);
  };

  return editor;
}
