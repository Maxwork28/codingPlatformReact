import React from 'react';
import { rewriteQuestionHtmlMedia } from '../utils/questionRichTextImages';

const IMAGE_CLASS =
  'question-html [&_img]:max-w-full [&_img]:h-auto [&_img]:max-h-[28rem] [&_img]:rounded-lg [&_img]:border [&_img]:border-gray-200 [&_img]:my-3 [&_img]:block';

const QuestionHtml = ({ html, className = '', empty = null, style }) => {
  if (html == null || String(html).trim() === '') return empty;
  return (
    <div
      className={`${IMAGE_CLASS} ${className}`.trim()}
      style={style}
      dangerouslySetInnerHTML={{ __html: rewriteQuestionHtmlMedia(html) }}
    />
  );
};

export default QuestionHtml;
