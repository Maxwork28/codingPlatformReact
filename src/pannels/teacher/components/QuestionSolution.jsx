import React, { useState, useEffect, useMemo } from 'react';
import { useParams, useNavigate, useLocation } from 'react-router-dom';
import { getQuestion, viewSolution } from '../../../common/services/api';
import parse from 'html-react-parser';

const stripHtml = (html) => {
  if (!html) return '';
  const doc = new DOMParser().parseFromString(html, 'text/html');
  return doc.body.textContent || '';
};

const langLabel = (lang) =>
  lang ? String(lang).charAt(0).toUpperCase() + String(lang).slice(1) : 'Solution';

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
    {language ? (
      <p className="text-sm font-semibold mb-2" style={{ color: 'var(--text-heading)' }}>
        {langLabel(language)}
      </p>
    ) : null}
    <pre
      className="p-4 rounded-lg text-sm font-mono whitespace-pre-wrap overflow-x-auto"
      style={{ backgroundColor: '#0f172a', color: '#e2e8f0' }}
    >
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
        const response = await getQuestion(questionId);
        let q = response.data.question;
        try {
          const solRes = await viewSolution(questionId);
          q = { ...q, ...(solRes.data?.solution || {}) };
        } catch {
          /* getQuestion already includes solutions for teachers */
        }
        setQuestion(q);
      } catch (err) {
        setError(err.response?.data?.error || err?.error || 'Failed to load question solution');
      } finally {
        setIsLoading(false);
      }
    };
    fetchQuestion();
  }, [questionId]);

  const codingSolutions = useMemo(
    () => (question ? collectCodingSolutions(question) : []),
    [question]
  );

  const handleBack = () => {
    if (location.state?.fromTakeClass && navClassId) {
      navigate('/teacher/take-class', {
        state: { classId: navClassId, questionId },
      });
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
      <div className="flex justify-center items-center min-h-[50vh]">
        <div className="w-10 h-10 border-4 border-indigo-600 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  if (error || !question) {
    return (
      <div className="max-w-4xl mx-auto px-4 py-8">
        <p className="text-red-600 mb-4">{error || 'Question not found'}</p>
        <button type="button" onClick={handleBack} className="text-indigo-600 font-medium hover:underline">
          Go back
        </button>
      </div>
    );
  }

  const type = question.type;
  const isCoding = ['coding', 'codingWithDriver', 'fillInTheBlanksCoding'].includes(type);

  let body = null;

  if (type === 'singleCorrectMcq') {
    const opt = question.options?.[question.correctOption];
    body = opt ? (
      <p className="text-sm" style={{ color: 'var(--text-primary)' }}>
        {question.correctOption + 1}. {parse(opt)}
      </p>
    ) : (
      <p className="text-sm" style={{ color: 'var(--text-secondary)' }}>No solution saved.</p>
    );
  } else if (type === 'multipleCorrectMcq') {
    const indexes = question.correctOptions || [];
    body = indexes.length ? (
      <ul className="space-y-2 text-sm" style={{ color: 'var(--text-primary)' }}>
        {indexes.map((idx) => (
          <li key={idx}>
            {idx + 1}. {parse(question.options?.[idx] || '')}
          </li>
        ))}
      </ul>
    ) : (
      <p className="text-sm" style={{ color: 'var(--text-secondary)' }}>No solution saved.</p>
    );
  } else if (type === 'fillInTheBlanks') {
    body = question.correctAnswer ? (
      <p className="text-sm" style={{ color: 'var(--text-primary)' }}>
        {parse(question.correctAnswer)}
      </p>
    ) : (
      <p className="text-sm" style={{ color: 'var(--text-secondary)' }}>No solution saved.</p>
    );
  } else if (isCoding) {
    const fillAnswer = type === 'fillInTheBlanksCoding' ? stripHtml(question.correctAnswer || '').trim() : '';
    body = (
      <div className="space-y-6">
        {fillAnswer ? <SolutionCodeBlock code={fillAnswer} /> : null}
        {codingSolutions.length > 0 ? (
          codingSolutions.map((sol) => (
            <SolutionCodeBlock key={sol.language} language={sol.language} code={sol.code} />
          ))
        ) : !fillAnswer ? (
          <p className="text-sm" style={{ color: 'var(--text-secondary)' }}>
            No solution saved for any language.
          </p>
        ) : null}
      </div>
    );
  } else {
    body = (
      <p className="text-sm" style={{ color: 'var(--text-secondary)' }}>
        No solution available for this question type.
      </p>
    );
  }

  return (
    <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      <div className="flex items-center gap-3 mb-6">
        <button
          type="button"
          onClick={handleBack}
          className="p-2 rounded-full border hover:opacity-80"
          style={{ borderColor: 'var(--card-border)', color: 'var(--text-primary)' }}
          aria-label="Back"
        >
          <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
            <path
              fillRule="evenodd"
              d="M9.707 16.707a1 1 0 01-1.414 0l-6-6a1 1 0 010-1.414l6-6a1 1 0 011.414 1.414L5.414 9H17a1 1 0 110 2H5.414l4.293 4.293a1 1 0 010 1.414z"
              clipRule="evenodd"
            />
          </svg>
        </button>
        <h2 className="text-xl font-bold truncate" style={{ color: 'var(--text-heading)' }}>
          Solution
        </h2>
      </div>

      <div
        className="rounded-2xl border p-6"
        style={{ backgroundColor: 'var(--card-white)', borderColor: 'var(--card-border)' }}
      >
        {body}
      </div>
    </div>
  );
};

export default QuestionSolution;
