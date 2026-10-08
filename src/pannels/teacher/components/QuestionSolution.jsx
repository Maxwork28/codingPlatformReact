import React, { useEffect, useMemo, useState } from 'react';
import { useLocation, useNavigate, useParams } from 'react-router-dom';
import parse from 'html-react-parser';
import { ArrowLeft } from 'lucide-react';
import { getQuestion, viewSolution } from '../../../common/services/api';
import { Button, EmptyState, StatusChip } from '../../../common/ui/primitives';
import { type } from '../../../common/ui/format';
import { RUNNABLE_CODING_TYPES, QUESTION_TYPE_LABELS, stripHtml } from '../pages/takeClass/helpers';
import { sanitizeHtml } from '../../../common/utils/sanitizeHtml';

const safeParse = (html) => parse(sanitizeHtml(html || ''));

const langLabel = (lang) => (lang ? String(lang).charAt(0).toUpperCase() + String(lang).slice(1) : 'Solution');

const collectCodingSolutions = (question) => {
  const byLang = new Map();
  (question.solutionCodes || []).forEach((entry) => {
    const code = (entry.code || '').trim();
    if (!entry.language || !code) return;
    byLang.set(entry.language, entry.code);
  });
  const legacy = (question.solutionCode || '').trim();
  if (legacy) {
    const lang = question.solutionLanguage || 'solution';
    if (!byLang.has(lang)) byLang.set(lang, question.solutionCode);
  }
  return [...byLang.entries()].map(([language, code]) => ({ language, code }));
};

const SolutionCodeBlock = ({ language, code }) => (
  <div>
    {language ? <p className="text-xs font-semibold text-fg mb-2">{langLabel(language)}</p> : null}
    <pre className="p-4 rounded-xl text-xs font-mono whitespace-pre-wrap overflow-x-auto bg-inset border border-line text-fg">
      {code}
    </pre>
  </div>
);

const QuestionSolution = () => {
  const { questionId } = useParams();
  const navigate = useNavigate();
  const location = useLocation();
  const [question, setQuestion] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState('');
  const navClassId = location.state?.classId || '';

  useEffect(() => {
    const fetchQuestion = async () => {
      try {
        setIsLoading(true);
        let q = null;
        try {
          const response = await getQuestion(questionId);
          q = response.data?.question || response.data;
        } catch {
          /* continue to viewSolution */
        }
        try {
          const solRes = await viewSolution(questionId);
          q = { ...(q || {}), ...(solRes.data?.solution || {}) };
        } catch {
          /* getQuestion already includes solutions for teachers */
        }
        if (!q) throw new Error('Question not found');
        setQuestion(q);
      } catch (err) {
        setError(
          (typeof err === 'string' && err) ||
            err.response?.data?.error ||
            err?.error ||
            err?.message ||
            'Failed to load question solution'
        );
      } finally {
        setIsLoading(false);
      }
    };
    fetchQuestion();
  }, [questionId]);

  const codingSolutions = useMemo(() => (question ? collectCodingSolutions(question) : []), [question]);

  const handleBack = () => {
    if (location.state?.fromTakeClass && navClassId) {
      navigate('/teacher/take-class', { state: { classId: navClassId, questionId } });
      return;
    }
    if (navClassId) {
      navigate(`/teacher/classes/${navClassId}`, { state: { classId: navClassId } });
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
          title="Couldn't load solution"
          message={error || 'Question not found'}
          action={<Button variant="secondary" onClick={handleBack}>Go back</Button>}
        />
      </div>
    );
  }

  const qType = question.type;
  const isCoding = RUNNABLE_CODING_TYPES.includes(qType);
  let body = null;

  if (qType === 'singleCorrectMcq') {
    const opt = question.options?.[question.correctOption];
    body = opt ? (
      <p className="text-xs text-body">
        {question.correctOption + 1}. {safeParse(opt)}
      </p>
    ) : (
      <p className="text-xs text-muted">No solution saved.</p>
    );
  } else if (qType === 'multipleCorrectMcq') {
    const indexes = question.correctOptions || [];
    body = indexes.length ? (
      <ul className="space-y-2 text-xs text-body">
        {indexes.map((idx) => (
          <li key={idx}>
            {idx + 1}. {safeParse(question.options?.[idx])}
          </li>
        ))}
      </ul>
    ) : (
      <p className="text-xs text-muted">No solution saved.</p>
    );
  } else if (qType === 'fillInTheBlanks') {
    body = question.correctAnswer ? (
      <p className="text-xs text-body">{safeParse(question.correctAnswer)}</p>
    ) : (
      <p className="text-xs text-muted">No solution saved.</p>
    );
  } else if (isCoding) {
    const fillAnswer = qType === 'fillInTheBlanksCoding' ? stripHtml(question.correctAnswer || '') : '';
    body = (
      <div className="space-y-6">
        {fillAnswer ? <SolutionCodeBlock code={fillAnswer} /> : null}
        {codingSolutions.length > 0 ? (
          codingSolutions.map((sol) => (
            <SolutionCodeBlock key={sol.language} language={sol.language} code={sol.code} />
          ))
        ) : !fillAnswer ? (
          <p className="text-xs text-muted">No solution saved for any language.</p>
        ) : null}
      </div>
    );
  } else {
    body = <p className="text-xs text-muted">No solution available for this question type.</p>;
  }

  return (
    <div className="flex flex-col h-[calc(100vh-4rem)] max-h-[calc(100vh-4rem)] bg-page">
      <header className="shrink-0 h-14 px-4 sm:px-5 border-b border-line bg-surface flex items-center gap-2">
        <Button variant="ghost" icon={ArrowLeft} className="h-9 w-9 justify-center p-0!" onClick={handleBack} aria-label="Back" />
        <h1 className={`${type.pageTitle} text-xl! truncate min-w-0`}>Solution</h1>
        <StatusChip kind="neutral">{QUESTION_TYPE_LABELS[qType] || qType}</StatusChip>
      </header>
      <div className="flex-1 min-h-0 overflow-y-auto px-4 sm:px-5 py-5">
        <div className="rounded-2xl border border-line bg-surface shadow-card p-5">{body}</div>
      </div>
    </div>
  );
};

export default QuestionSolution;
