/** Unique question progress for a student in a class. */

function questionIdOf(row) {
  return String(row?.questionId?._id ?? row?.questionId ?? '');
}

function recordAttempt(byQuestion, questionId, isCorrect) {
  const id = questionIdOf({ questionId });
  if (!id) return;
  const prev = byQuestion.get(id);
  if (prev === true) return;
  byQuestion.set(id, !!isCorrect);
}

export function getStudentQuestionProgress(entry, totalQuestions) {
  const total = Number(totalQuestions) || 0;
  const byQuestion = new Map();
  const attempts = Array.isArray(entry?.attempts) ? entry.attempts : null;

  if (attempts) {
    for (const row of attempts) {
      if (row?.isRun) continue;
      recordAttempt(byQuestion, row.questionId, row.isCorrect);
    }
  }

  if (byQuestion.size === 0) {
    const highest = Array.isArray(entry?.highestScores) ? entry.highestScores : [];
    for (const row of highest) {
      recordAttempt(byQuestion, row.questionId, row.isCorrect);
    }
  }

  let correct = 0;
  let incorrect = 0;
  byQuestion.forEach((ok) => {
    if (ok) correct += 1;
    else incorrect += 1;
  });

  return {
    totalQuestions: total,
    correct,
    incorrect,
    unattempted: Math.max(0, total - correct - incorrect),
  };
}
