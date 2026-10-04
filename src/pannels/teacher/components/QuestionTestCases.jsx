import React, { useEffect, useState } from 'react';
import { useLocation, useNavigate, useParams } from 'react-router-dom';
import { ArrowLeft } from 'lucide-react';
import { getQuestion } from '../../../common/services/api';
import { Button, EmptyState, StatusChip, Table } from '../../../common/ui/primitives';
import { table as tableClass, type } from '../../../common/ui/format';
import { QUESTION_TYPE_LABELS, RUNNABLE_CODING_TYPES, difficultyKind, stripHtml } from '../pages/takeClass/helpers';

const QuestionTestCases = () => {
  const { questionId } = useParams();
  const location = useLocation();
  const navigate = useNavigate();
  const [question, setQuestion] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    const fetchQuestion = async () => {
      try {
        setIsLoading(true);
        const response = await getQuestion(questionId);
        setQuestion(response.data.question);
      } catch (err) {
        setError(typeof err === 'string' ? err : err.response?.data?.error || 'Failed to load test cases');
      } finally {
        setIsLoading(false);
      }
    };
    fetchQuestion();
  }, [questionId]);

  const handleBack = () => {
    if (location.state?.fromTakeClass && location.state?.classId) {
      navigate('/teacher/take-class', {
        state: { classId: location.state.classId, questionId },
      });
      return;
    }
    const classId = location.state?.classId;
    if (classId) {
      navigate(`/teacher/classes/${classId}`, { state: { classId } });
      return;
    }
    navigate('/teacher/questions');
  };

  if (isLoading) {
    return (
      <div className="flex justify-center items-center min-h-[50vh] bg-page">
        <div className="w-8 h-8 border-2 border-accent border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  if (error || !question) {
    return (
      <div className="h-full flex flex-col px-4 sm:px-5 py-5">
        <EmptyState
          title="Couldn't load test cases"
          message={error || 'Question not found'}
          action={<Button variant="secondary" onClick={handleBack}>Go back</Button>}
        />
      </div>
    );
  }

  const runnable = RUNNABLE_CODING_TYPES.includes(question.type);

  return (
    <div className="flex flex-col h-[calc(100vh-4rem)] max-h-[calc(100vh-4rem)] bg-page">
      <header className="shrink-0 h-14 px-4 sm:px-5 border-b border-line bg-surface flex items-center gap-2">
        <Button variant="ghost" icon={ArrowLeft} className="h-9 w-9 justify-center p-0!" onClick={handleBack} aria-label="Back" />
        <h1 className={`${type.pageTitle} text-xl! truncate min-w-0`}>Test cases</h1>
        <StatusChip kind="neutral">{QUESTION_TYPE_LABELS[question.type] || question.type}</StatusChip>
        <StatusChip kind={difficultyKind(question.difficulty)}>{question.difficulty || '—'}</StatusChip>
      </header>
      <section className="flex-1 min-h-0 flex flex-col gap-3 px-4 sm:px-5 py-5">
        {!runnable ? (
          <EmptyState title="No sandbox tests" message="Test cases are only available for coding questions." />
        ) : question.testCases?.length ? (
          <Table
            fill
            columns={[
              { key: 'input', label: 'Input' },
              { key: 'output', label: 'Expected output' },
              { key: 'visibility', label: 'Visibility' },
            ]}
          >
            {question.testCases.map((testCase, idx) => (
              <tr key={idx} className={tableClass.row}>
                <td className={`${tableClass.td} whitespace-pre-wrap`}>{stripHtml(testCase.input)}</td>
                <td className={`${tableClass.td} whitespace-pre-wrap`}>{stripHtml(testCase.expectedOutput)}</td>
                <td className={tableClass.td}>
                  <StatusChip kind={testCase.isPublic ? 'info' : 'neutral'}>
                    {testCase.isPublic ? 'Public' : 'Hidden'}
                  </StatusChip>
                </td>
              </tr>
            ))}
          </Table>
        ) : (
          <EmptyState title="No test cases" message="This question does not have test cases yet." />
        )}
      </section>
    </div>
  );
};

export default QuestionTestCases;
