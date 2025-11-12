import React, { useMemo } from 'react';
import PropTypes from 'prop-types';

const stripHtml = (html) => {
  if (!html) return '';
  try {
    const tmp = document.createElement('div');
    tmp.innerHTML = html;
    return tmp.textContent || tmp.innerText || '';
  } catch (err) {
    console.warn('StudentQuestionCard: stripHtml fallback used', { html, error: err });
    return typeof html === 'string' ? html.replace(/<[^>]*>/g, '') : '';
  }
};

const StudentQuestionCard = ({ question, assignment }) => {
  const titleText = useMemo(() => stripHtml(question.title), [question.title]);
  const descriptionText = useMemo(
    () => stripHtml(question.description),
    [question.description]
  );

  console.log('StudentQuestionCard: Rendered with question', {
    id: question._id,
    title: titleText,
    isDisabled: question.isDisabled,
    isPublished: question.isPublished,
    classes: question.classes,
    assignment,
  });

  return (
    <div className="flex-1">
      <div className="flex justify-between items-start">
        <div>
          <h3 className="text-lg font-semibold text-gray-800 tracking-tight">
            {titleText || 'No Title'}
          </h3>
          <p className="mt-2 text-sm text-gray-600 leading-relaxed">
            {descriptionText || 'No Description'}
          </p>
          <div className="mt-3 flex flex-wrap gap-2">
            <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold bg-gray-100 text-gray-700 shadow-sm">
              {question.difficulty}
            </span>
            {assignment && (
              <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold bg-indigo-100 text-indigo-700 shadow-sm">
                {assignment.maxPoints} points
              </span>
            )}
            <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold bg-green-100 text-green-700 shadow-sm">
              {question.isPublished ? 'Published' : 'Unpublished'}
            </span>
            <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold bg-red-100 text-red-700 shadow-sm">
              {question.isDisabled ? 'Disabled' : 'Enabled'}
            </span>
          </div>
          {assignment && (
            <p className="mt-2 text-sm text-gray-600">
              Due: {new Date(assignment.dueDate).toLocaleString()}
            </p>
          )}
        </div>
      </div>
    </div>
  );
};

StudentQuestionCard.propTypes = {
  question: PropTypes.shape({
    _id: PropTypes.string.isRequired,
    title: PropTypes.string,
    description: PropTypes.string,
    difficulty: PropTypes.string,
    isPublished: PropTypes.bool,
    isDisabled: PropTypes.bool,
    classes: PropTypes.array,
  }).isRequired,
  assignment: PropTypes.shape({
    _id: PropTypes.string,
    maxPoints: PropTypes.number,
    dueDate: PropTypes.string,
  }),
};

export default StudentQuestionCard;