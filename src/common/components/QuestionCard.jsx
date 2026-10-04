import React from 'react';

const QuestionCard = ({ question }) => {
  console.log('QuestionCard: Rendered with question', question);

  return (
    <div className="bg-surface p-4 rounded-lg shadow-md">
      <h3 className="text-lg font-semibold">{question.title || 'No Title'}</h3>
      <p className="text-muted">{question.description || 'No Description'}</p>
      <p className="text-sm text-muted">Type: {question.type || 'Unknown'}</p>
      <p className="text-sm text-muted">Points: {question.points || 0}</p>
    </div>
  );
};

export default QuestionCard;