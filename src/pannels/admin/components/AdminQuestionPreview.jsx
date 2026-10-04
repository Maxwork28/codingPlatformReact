import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useSelector } from 'react-redux';
import { useLocation, useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { Activity, AlertTriangle, ArrowLeft, Copy, Eye, FlaskConical, KeyRound, Link2, Pencil, RefreshCw, Share2, Trash2 } from 'lucide-react';
import { adminDeleteQuestion, deleteDraftQuestion, getQuestionOverview } from '../../../common/services/api';
import { Button, Card, StatusChip } from '../../../common/ui/primitives';
import ActionMenu from '../../../common/ui/ActionMenu';
import { type } from '../../../common/ui/format';
import { confirmAction, notify } from '../../../common/ui/Toast';
import { QUESTION_TYPES, errorText, plural } from './classDetails/helpers';
import { DIFFICULTY_KIND, copyText, isRunnable, stripHtml } from './questionDetails/helpers';
import DetailsPanel from './questionDetails/DetailsPanel';
import AnswerKeyTab from './questionDetails/AnswerKeyTab';
import TestSolutionTab from './questionDetails/TestSolutionTab';
import UsageTab from './questionDetails/UsageTab';
import ActivityTab from './questionDetails/ActivityTab';
import StudentPreview from './questionDetails/StudentPreview';

const OBJECT_ID = /^[0-9a-f]{24}$/i;

/** Students only get starter code; older coding questions store it as templateCode. */
function withStarterCode(q) {
  if (!q || (q.type !== 'coding' && q.type !== 'codingWithDriver')) return q;
  if (q.starterCode?.length || !q.templateCode?.length) return q;
  return { ...q, starterCode: q.templateCode.map(({ language, code }) => ({ language, code })) };
}

function LoadingShell() {
  return (
    <div className="h-full flex flex-col gap-4 px-4 sm:px-5 py-5 animate-pulse">
      <div className="flex items-center gap-3">
        <div className="w-9 h-9 rounded-xl bg-hover" />
        <div className="h-6 w-72 rounded-lg bg-hover" />
      </div>
      <div className="flex-1 grid gap-4 lg:grid-cols-[minmax(0,1fr)_18rem]">
        <div className="rounded-2xl bg-surface border border-line min-h-80" />
        <div className="rounded-2xl bg-surface border border-line min-h-80" />
      </div>
    </div>
  );
}

const AdminQuestionPreview = () => {
  const { questionId } = useParams();
  const navigate = useNavigate();
  const location = useLocation();
  const [params, setParams] = useSearchParams();

  const user = useSelector((state) => state.auth.user);
  const base = location.pathname.startsWith('/teacher') ? '/teacher' : '/admin';
  const isAdmin = base === '/admin';
  const [returnTo] = useState(() => {
    const target = location.state?.returnTo;
    return typeof target === 'string' && target.startsWith(base) ? target : `${base}/questions`;
  });
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState('');

  const load = useCallback(
    async (silent = false) => {
      if (!OBJECT_ID.test(questionId || '')) {
        setError("This link doesn't point to a valid question.");
        setLoading(false);
        return;
      }
      if (silent) setRefreshing(true);
      else setLoading(true);
      try {
        const res = await getQuestionOverview(questionId);
        setData(res.data);
        setError('');
      } catch (err) {
        if (silent) notify(errorText(err, 'Failed to refresh'), 'error');
        else setError(errorText(err, 'Failed to load question'));
      } finally {
        setLoading(false);
        setRefreshing(false);
      }
    },
    [questionId],
  );

  useEffect(() => {
    load();
  }, [load]);

  const reload = useCallback(() => load(true), [load]);
  const question = data?.question;
  const previewQuestion = useMemo(() => withStarterCode(question), [question]);
  const runnable = isRunnable(question);

  const tabs = useMemo(() => {
    if (!data) return [];
    return [
      { id: 'statement', label: 'Student view', icon: Eye },
      { id: 'answer', label: 'Answer key', icon: KeyRound },
      ...(runnable ? [{ id: 'test', label: 'Test solution', icon: FlaskConical }] : []),
      { id: 'usage', label: 'Usage', icon: Share2, count: data.classes.length + data.exams.length },
      { id: 'activity', label: 'Activity', icon: Activity, count: data.stats.submissions },
    ];
  }, [data, runnable]);

  const tab = tabs.some((t) => t.id === params.get('tab')) ? params.get('tab') : 'statement';
  const openTab = (id) =>
    setParams(
      (prev) => {
        const next = new URLSearchParams(prev);
        if (id === 'statement') next.delete('tab');
        else next.set('tab', id);
        return next;
      },
      { replace: true, state: location.state },
    );

  const goBack = () => navigate(returnTo);

  if (loading) return <LoadingShell />;

  if (error || !question) {
    return (
      <div className="h-full flex items-center justify-center px-4">
        <Card className="max-w-sm w-full p-6 text-center space-y-3">
          <span className="mx-auto w-10 h-10 rounded-xl bg-bad-soft text-bad flex items-center justify-center">
            <AlertTriangle className="w-5 h-5" />
          </span>
          <p className={type.cardTitle}>Couldn't open this question</p>
          <p className={type.body}>{error || 'Question not found.'}</p>
          <div className="flex justify-center gap-2 pt-1">
            <Button variant="secondary" icon={ArrowLeft} onClick={goBack}>
              Back
            </Button>
            {OBJECT_ID.test(questionId || '') && (
              <Button icon={RefreshCw} onClick={() => load()}>
                Try again
              </Button>
            )}
          </div>
        </Card>
      </div>
    );
  }

  const title = stripHtml(question.title) || 'Untitled question';
  const isDraft = question.isDraft || question.status === 'draft';
  const testClassId = location.state?.classId || data.classes[0]?._id || null;

  const deleteQuestion = async () => {
    const usage = [
      data.classes.length && plural(data.classes.length, 'class', 'classes'),
      data.exams.length && plural(data.exams.length, 'exam'),
    ].filter(Boolean);
    const ok = await confirmAction(
      `"${title}" will be permanently deleted${usage.length ? `. It is used in ${usage.join(' and ')}` : ''}` +
        `${data.stats.submissions ? `, and ${plural(data.stats.submissions, 'student submission')} will be lost` : ''}. This cannot be undone.`,
      { title: 'Delete question', confirmLabel: 'Delete question', danger: true },
    );
    if (!ok) return;
    try {
      await (isAdmin ? adminDeleteQuestion(question._id) : deleteDraftQuestion(question._id));
      notify('Question deleted', 'success');
      goBack();
    } catch (err) {
      notify(errorText(err, 'Failed to delete question'), 'error');
    }
  };

  return (
    <div className="lg:h-full flex flex-col gap-4 px-4 sm:px-5 py-5">
      <header className="shrink-0 flex flex-wrap items-center gap-x-3 gap-y-2">
        <button
          type="button"
          onClick={goBack}
          className="w-9 h-9 shrink-0 rounded-xl border border-line bg-surface text-muted hover:text-fg hover:bg-hover flex items-center justify-center"
          aria-label="Back"
          title="Back"
        >
          <ArrowLeft className="w-4 h-4" />
        </button>
        <h1 className={`${type.pageTitle} min-w-0 truncate max-w-full sm:max-w-[40rem]`} title={title}>
          {title}
        </h1>
        <div className="flex flex-wrap items-center gap-1.5">
          <StatusChip kind="ai">{QUESTION_TYPES[question.type] || question.type}</StatusChip>
          {question.difficulty && <StatusChip kind={DIFFICULTY_KIND[question.difficulty]}>{question.difficulty}</StatusChip>}
          {question.points != null && <StatusChip kind="neutral">{question.points} pts</StatusChip>}
          {isDraft && <StatusChip kind="warning">Draft</StatusChip>}
          {question.isExamOnly && <StatusChip kind="info">Exam-only</StatusChip>}
        </div>
        <div className="ml-auto flex items-center gap-2">
          <Button
            variant="ghost"
            icon={RefreshCw}
            className={`h-9 ${refreshing ? '[&>svg]:animate-spin' : ''}`}
            onClick={reload}
            disabled={refreshing}
            aria-label="Refresh"
            title="Refresh"
          />
          <Button variant="secondary" icon={Pencil} className="h-9" onClick={() => navigate(`${base}/questions/${question._id}/edit`)}>
            Edit
          </Button>
          <ActionMenu
            label="Question actions"
            items={[
              { label: 'Copy question ID', icon: Copy, onClick: () => copyText(question._id, 'Question ID copied') },
              { label: 'Copy link', icon: Link2, onClick: () => copyText(window.location.href.split('?')[0], 'Link copied') },
              ...(isAdmin || (isDraft && String(question.createdBy?._id || question.createdBy) === String(user?.id || user?._id))
                ? [{ divider: true }, { label: isDraft ? 'Delete draft' : 'Delete question', icon: Trash2, tone: 'danger', onClick: deleteQuestion }]
                : []),
            ]}
          />
        </div>
      </header>

      <div className="flex-1 lg:min-h-0 grid gap-4 lg:grid-cols-[minmax(0,1fr)_20rem] xl:grid-cols-[minmax(0,1fr)_22rem]">
        <Card className="lg:min-h-0 flex flex-col overflow-hidden">
          <nav className="shrink-0 flex gap-1 overflow-x-auto border-b border-line px-2" role="tablist" aria-label="Question sections">
            {tabs.map((t) => {
              const Icon = t.icon;
              const active = t.id === tab;
              return (
                <button
                  key={t.id}
                  type="button"
                  role="tab"
                  aria-selected={active}
                  onClick={() => openTab(t.id)}
                  className={`relative flex items-center gap-1.5 px-3 py-3 text-xs font-semibold whitespace-nowrap transition ${
                    active ? 'text-fg' : 'text-muted hover:text-fg'
                  }`}
                >
                  <Icon className="w-3.5 h-3.5" />
                  {t.label}
                  {t.count != null && (
                    <span className={`px-1.5 rounded-md text-[10px] tabular-nums ${active ? 'bg-accent-soft text-accent-ink' : 'bg-hover text-muted'}`}>
                      {t.count}
                    </span>
                  )}
                  {active && <span className="absolute inset-x-2 -bottom-px h-0.5 rounded-full bg-accent" />}
                </button>
              );
            })}
          </nav>

          <div className="flex-1 lg:min-h-0 lg:overflow-y-auto p-4 sm:p-5">
            {tab === 'statement' && <StudentPreview key={question._id} question={previewQuestion} />}
            {tab === 'answer' && <AnswerKeyTab key={question._id} question={question} />}
            {tab === 'test' && (
              <TestSolutionTab
                key={question._id}
                question={question}
                classId={testClassId}
                onLimitsSaved={(timeLimit, memoryLimit) =>
                  setData((prev) => ({ ...prev, question: { ...prev.question, timeLimit, memoryLimit } }))
                }
              />
            )}
            {tab === 'usage' && (
              <UsageTab base={base} canRemove={isAdmin} question={question} classes={data.classes} exams={data.exams} templateCount={data.templateCount} reload={reload} />
            )}
            {tab === 'activity' && <ActivityTab question={question} stats={data.stats} recent={data.recentSubmissions} />}
          </div>
        </Card>

        <aside className="lg:min-h-0 lg:overflow-y-auto">
          <DetailsPanel question={question} classes={data.classes} exams={data.exams} stats={data.stats} templateCount={data.templateCount} />
        </aside>
      </div>
    </div>
  );
};

export default AdminQuestionPreview;
