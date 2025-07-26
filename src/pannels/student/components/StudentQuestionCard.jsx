import React from 'react';
import PropTypes from 'prop-types';

const StudentQuestionCard = ({ question, assignment }) => {
  console.log('StudentQuestionCard: Rendered with question', {
    id: question._id,
    title: question.title,
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
            {question.title || 'No Title'}
          </h3>
          <p className="mt-2 text-sm text-gray-600 leading-relaxed">
            {question.description || 'No Description'}
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