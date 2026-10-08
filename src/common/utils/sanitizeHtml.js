import DOMPurify from 'dompurify';

/**
 * Single place where author/server supplied HTML is made safe to render.
 * Every `dangerouslySetInnerHTML` / html-react-parser call must go through `sanitizeHtml`.
 */

const ALLOWED_TAGS = [
  'p', 'br', 'strong', 'b', 'em', 'i', 'u', 's', 'code', 'pre',
  'ul', 'ol', 'li',
  'h1', 'h2', 'h3', 'h4', 'h5', 'h6',
  'blockquote', 'span', 'div',
  'table', 'thead', 'tbody', 'tr', 'th', 'td',
  'img', 'a',
];

const ALLOWED_ATTR = [
  // img
  'src', 'alt', 'width', 'height',
  // a
  'href', 'target', 'rel',
  // generic presentation
  'class', 'title', 'colspan', 'rowspan',
];

const FORBID_TAGS = ['script', 'style', 'iframe', 'object', 'embed', 'svg', 'math', 'form', 'input', 'button', 'link', 'meta', 'base'];

const FORBID_ATTR = [
  'onabort', 'onblur', 'onchange', 'onclick', 'ondblclick', 'onerror', 'onfocus', 'oninput', 'onkeydown', 'onkeypress',
  'onkeyup', 'onload', 'onmousedown', 'onmouseenter', 'onmouseleave', 'onmousemove', 'onmouseout', 'onmouseover',
  'onmouseup', 'onpointerdown', 'onpointerup', 'onreset', 'onresize', 'onscroll', 'onselect', 'onsubmit', 'ontoggle',
  'onunload', 'onwheel', 'onanimationstart', 'onanimationend', 'ontransitionend', 'style', 'srcset', 'formaction',
];

/**
 * http(s) absolute URLs, relative URLs (anything without a scheme) and data:image/* only.
 * Anything with another scheme (javascript:, vbscript:, data:text/html, mailto:, …) is dropped.
 */
const ALLOWED_URI_REGEXP = /^(?:https?:|data:image\/[a-z0-9.+-]+[;,]|(?![a-z][a-z0-9+.-]*:))/i;

const CONFIG = {
  ALLOWED_TAGS,
  ALLOWED_ATTR,
  ADD_ATTR: ['target'],
  FORBID_TAGS,
  FORBID_ATTR,
  ALLOWED_URI_REGEXP,
  ALLOW_DATA_ATTR: false,
  ALLOW_ARIA_ATTR: false,
  KEEP_CONTENT: true,
};

let hooked = false;
function ensureHooks() {
  if (hooked || typeof DOMPurify.addHook !== 'function') return;
  hooked = true;
  // Links that open a new tab must not get a handle on our window.
  DOMPurify.addHook('afterSanitizeAttributes', (node) => {
    if (node.tagName === 'A') {
      if (node.getAttribute('target') === '_blank') {
        node.setAttribute('rel', 'noopener noreferrer');
      } else if (node.hasAttribute('target')) {
        node.removeAttribute('target');
      }
    }
  });
}

/** Returns sanitized HTML (string). Non-string / empty input yields ''. */
export function sanitizeHtml(html) {
  if (html == null) return '';
  const raw = typeof html === 'string' ? html : String(html);
  if (!raw.trim()) return '';
  if (typeof window === 'undefined' || typeof DOMPurify.sanitize !== 'function') return '';
  ensureHooks();
  return DOMPurify.sanitize(raw, CONFIG);
}

/** Plain text of an HTML fragment (for titles, tooltips, search). Shared by every panel. */
export function stripHtml(html) {
  if (html == null) return '';
  const raw = typeof html === 'string' ? html : String(html);
  if (!raw) return '';
  if (typeof DOMParser === 'undefined') return raw.replace(/<[^>]*>/g, '').trim();
  const doc = new DOMParser().parseFromString(raw, 'text/html');
  return (doc.body?.textContent || '').trim();
}

/**
 * Plain text that keeps line breaks: block tags (<p>, <div>, <br>, <li>) become newlines.
 * Used for code templates that older questions stored as rich-text HTML.
 */
export function htmlToPlainText(html) {
  if (html == null) return '';
  const raw = String(html).replace(/\r\n?/g, '\n');
  if (!/<\/?(p|br|div|pre|li)\b[^>]*>/i.test(raw)) return raw;
  const withBreaks = raw
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<\/(p|div|pre|li)>\s*/gi, '\n')
    .replace(/<(p|div|pre|li)\b[^>]*>/gi, '');
  if (typeof DOMParser === 'undefined') return withBreaks.replace(/<[^>]*>/g, '').replace(/\n+$/, '');
  const doc = new DOMParser().parseFromString(`<pre>${withBreaks}</pre>`, 'text/html');
  return (doc.body?.textContent || '').replace(/\n+$/, '');
}

export default sanitizeHtml;
