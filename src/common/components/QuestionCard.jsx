import React from 'react';

const QuestionCard = ({ question }) => {
  console.log('QuestionCard: Rendered with question', question);

  return (
    <div className="bg-white p-4 rounded-lg shadow-md">
      <h3 className="text-lg font-semibold">{question.title || 'No Title'}</h3>
      <p className="text-gray-600">{question.description || 'No Description'}</p>
      <p className="text-sm text-gray-500">Type: {question.type || 'Unknown'}</p>
      <p className="text-sm text-gray-500">Points: {question.points || 0}</p>
    </div>
  );
};

export default QuestionCard;