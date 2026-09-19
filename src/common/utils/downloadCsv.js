function csvCell(value) {
  const s = value == null ? '' : String(value);
  if (/[",\n\r]/.test(s)) return `"${s.replace(/"/g, '""')}"`;
  return s;
}

export function downloadCsv(filename, rows) {
  const lines = (rows || []).map((row) => (Array.isArray(row) ? row.map(csvCell).join(',') : ''));
  const blob = new Blob([`\uFEFF${lines.join('\n')}`], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename.endsWith('.csv') ? filename : `${filename}.csv`;
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
}

export function downloadQuestionStatsReport(report, { filename } = {}) {
  const questionTitle = String(report?.question?.title || 'question').replace(/<[^>]*>/g, '').trim() || 'question';
  const className = report?.class?.name || '';
  const students = report?.studentData || [];
  const statusLabel = (status) => {
    if (status === 'correct') return 'Correct';
    if (status === 'incorrect') return 'Wrong';
    return 'Inactive';
  };
  const rows = [
    ['Question', questionTitle],
    ['Class', className],
    ['Enrolled', report?.totalStudentsEnrolled ?? students.length],
    ['Correct', report?.totalStudentsCorrect ?? 0],
    ['Wrong', report?.totalStudentsIncorrect ?? 0],
    ['Inactive', report?.totalStudentsNotAttempted ?? 0],
    [],
    ['Name', 'Email', 'Status', 'Language', 'Correct', 'Last submitted'],
    ...students.map((s) => [
      s.studentName || '',
      s.studentEmail || '',
      statusLabel(s.status),
      s.lastSubmittedLanguage || '',
      s.lastSubmittedIsCorrect === true ? 'Yes' : s.lastSubmittedIsCorrect === false ? 'No' : '',
      s.lastSubmittedAt ? new Date(s.lastSubmittedAt).toLocaleString() : '',
    ]),
  ];
  const safeName = questionTitle.replace(/[^\w\-]+/g, '_').slice(0, 40);
  downloadCsv(filename || `question-report-${safeName}`, rows);
}
