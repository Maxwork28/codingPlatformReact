import React, { useCallback, useEffect, useState } from 'react';
import { useLocation, useNavigate, useParams } from 'react-router-dom';
import { AlertTriangle, ArrowLeft, Eye, RefreshCw, Rocket } from 'lucide-react';
import { adminEditQuestion, adminSearchQuestionsById, publishDraftQuestion } from '../../../common/services/api';
import { Button, Card, StatusChip } from '../../../common/ui/primitives';
import { type } from '../../../common/ui/format';
import { confirmAction, notify } from '../../../common/ui/Toast';
import QuestionForm from './AdminQuestionForm';
import { errorText } from './classDetails/helpers';

const OBJECT_ID = /^[0-9a-f]{24}$/i;

function LoadingShell() {
  return (
    <div className="h-full flex flex-col gap-4 px-4 sm:px-5 py-5 animate-pulse">
      <div className="flex items-center gap-3">
        <div className="w-9 h-9 rounded-xl bg-hover" />
        <div className="h-6 w-72 rounded-lg bg-hover" />
        <div className="ml-auto h-9 w-24 rounded-xl bg-hover" />
      </div>
      <div className="flex-1 flex gap-4">
        <div className="hidden lg:block w-52 rounded-2xl bg-surface border border-line" />
        <div className="flex-1 space-y-4">
          <div className="h-56 rounded-2xl bg-surface border border-line" />
          <div className="h-72 rounded-2xl bg-surface border border-line" />
        </div>
      </div>
    </div>
  );
}

const AdminQuestionEdit = () => {
  const { questionId } = useParams();
  const navigate = useNavigate();
  const base = useLocation().pathname.startsWith('/teacher') ? '/teacher' : '/admin';
  const [question, setQuestion] = useState(null);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState('');
  const [publishing, setPublishing] = useState(false);

  const load = useCallback(async () => {
    if (!OBJECT_ID.test(questionId || '')) {
      setLoadError("This link doesn't point to a valid question.");
      setLoading(false);
      return;
    }
    setLoading(true);
    setLoadError('');
    try {
      const res = await adminSearchQuestionsById(questionId);
      setQuestion(res.data.question);
    } catch (err) {
      setLoadError(errorText(err, 'Failed to load question'));
    } finally {
      setLoading(false);
    }
  }, [questionId]);

  useEffect(() => {
    load();
  }, [load]);

  if (loading) return <LoadingShell />;

  if (loadError || !question) {
    return (
      <div className="h-full flex items-center justify-center px-4">
        <Card className="max-w-sm w-full p-6 text-center space-y-3">
          <span className="mx-auto w-10 h-10 rounded-xl bg-bad-soft text-bad flex items-center justify-center">
            <AlertTriangle className="w-5 h-5" />
          </span>
          <p className={type.cardTitle}>Couldn't open this question</p>
          <p className={type.body}>{loadError || 'Question not found.'}</p>
          <div className="flex justify-center gap-2 pt-1">
            <Button variant="secondary" icon={ArrowLeft} onClick={() => navigate(`${base}/questions`)}>
              Question bank
            </Button>
            {OBJECT_ID.test(questionId || '') && (
              <Button icon={RefreshCw} onClick={load}>
                Try again
              </Button>
            )}
          </div>
        </Card>
      </div>
    );
  }

  const isDraft = question.isDraft || question.status === 'draft';

  const save = async (payload) => {
    const res = await adminEditQuestion(questionId, payload);
    if (res.data?.question) setQuestion((prev) => ({ ...prev, updatedAt: res.data.question.updatedAt }));
    notify(isDraft ? 'Draft saved' : 'Question updated', 'success');
  };

  const extraActions = ({ dirty, saving, save: saveForm }) => (
    <>
      <Button
        variant="secondary"
        icon={Eye}
        className="h-9"
        disabled={saving}
        onClick={async () => {
          if (dirty && !(await saveForm())) return;
          navigate(`${base}/questions/${questionId}/preview`, { state: { returnTo: `${base}/questions/${questionId}/edit` } });
        }}
      >
        {dirty ? 'Save & preview' : 'Preview'}
      </Button>
      {isDraft && (
        <Button
          variant="publish"
          icon={Rocket}
          className="h-9"
          disabled={saving || publishing}
          onClick={async () => {
            const ok = await confirmAction('Publish this question? It moves to the question bank and can be added to classes and exams.', {
              title: 'Publish question',
              confirmLabel: 'Publish',
            });
            if (!ok) return;
            if (dirty && !(await saveForm())) return;
            setPublishing(true);
            try {
              await publishDraftQuestion(questionId);
              setQuestion((prev) => ({ ...prev, isDraft: false, status: 'published' }));
              notify('Question published', 'success');
            } catch (err) {
              notify(errorText(err, 'Failed to publish'), 'error');
            } finally {
              setPublishing(false);
            }
          }}
        >
          {publishing ? 'Publishing…' : 'Publish'}
        </Button>
      )}
    </>
  );

  return (
    <QuestionForm
      key={question._id}
      initialQuestion={question}
      questionId={question._id}
      heading="Edit question"
      backTo={isDraft ? `${base}/questions/drafts` : `${base}/questions`}
      badges={
        <span className="flex items-center gap-1.5">
          {isDraft ? <StatusChip kind="warning">Draft</StatusChip> : <StatusChip kind="pass">Published</StatusChip>}
          {question.isExamOnly && <StatusChip kind="info">Exam-only</StatusChip>}
        </span>
      }
      saveLabel={isDraft ? 'Save draft' : 'Save changes'}
      onSave={save}
      extraActions={extraActions}
    />
  );
};

export default AdminQuestionEdit;
