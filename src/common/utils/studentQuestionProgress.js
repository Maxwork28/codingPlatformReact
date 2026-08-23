/** Unique question progress for a student in a class (from leaderboard highestScores). */
export function getStudentQuestionProgress(entry, totalQuestions) {
  const total = Number(totalQuestions) || 0;
  const highest = Array.isArray(entry?.highestScores) ? entry.highestScores : [];
  const byQuestion = new Map();

  for (const row of highest) {
    const id = String(row.questionId?._id ?? row.questionId ?? '');
    if (!id) continue;
    const isCorrect = !!row.isCorrect;
    const prev = byQuestion.get(id);
    if (prev == null || (isCorrect && !prev)) {
      byQuestion.set(id, isCorrect);
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
