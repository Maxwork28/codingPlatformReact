import React, { useEffect, useMemo, useState } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { io } from 'socket.io-client';
import { ArrowLeft, ClipboardList, Play, Search, Trophy, X } from 'lucide-react';
import { fetchClasses } from '../../../common/components/redux/classSlice';
import { getAssignments, getLeaderboard, getQuestionsByClass, listClassExams } from '../../../common/services/api';
import { API_BASE_URL } from '../../../common/constants';
import { Button, EmptyState, StatusChip, Table } from '../../../common/ui/primitives';
import { table as tableClass, type } from '../../../common/ui/format';
import { ATTEMPT_LABELS, formatDateTime, isClosedAttempt } from '../components/exam/examUtils';
import { classEntryFor, isEnrolledStudent, stripHtml } from './takeClass/helpers';

const TABS = [
  { id: 'questions', label: 'Questions' },
  { id: 'exams', label: 'Exams' },
  { id: 'leaderboard', label: 'Leaderboard' },
];

const Q_COLS = [{ label: 'Question' }, { label: 'Due', className: 'hidden sm:table-cell' }, { label: 'Status' }, { label: '', key: 'action' }];
const E_COLS = [{ label: 'Exam' }, { label: 'When', className: 'hidden md:table-cell' }, { label: 'Status' }, { label: '', key: 'action' }];
const L_COLS = [{ label: 'Rank' }, { label: 'Student' }, { label: 'Solved', className: 'text-right' }, { label: 'Score', className: 'hidden sm:table-cell text-right' }];

const StudentClassView = () => {
  const { classId } = useParams();
  const navigate = useNavigate();
  const dispatch = useDispatch();
  const [params, setParams] = useSearchParams();
  const { classes, status } = useSelector((state) => state.classes);
  const { user } = useSelector((state) => state.auth);
  const [questions, setQuestions] = useState([]);
  const [assignments, setAssignments] = useState([]);
  const [exams, setExams] = useState([]);
  const [leaderboard, setLeaderboard] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [query, setQuery] = useState('');

  const tab = TABS.some((t) => t.id === params.get('tab')) ? params.get('tab') : 'questions';
  const enrolled = useMemo(
    () => (classes || []).filter((cls) => isEnrolledStudent(cls, user?.id)),
    [classes, user?.id],
  );
  const classData = enrolled.find((cls) => String(cls._id) === String(classId));

  useEffect(() => {
    if (user?.id && status === 'idle') dispatch(fetchClasses(''));
  }, [dispatch, status, user?.id]);

  useEffect(() => {
    if (!classId) {
      setLoading(false);
      return;
    }
    if (status === 'idle' || status === 'loading') {
      setLoading(true);
      return;
    }
    if (!classData) {
      setError('Class not found or you are not enrolled.');
      setLoading(false);
      return;
    }

    let cancelled = false;
    const load = async () => {
      setLoading(true);
      setError('');
      try {
        const [qRes, aRes, eRes, lRes] = await Promise.allSettled([
          getQuestionsByClass(classId),
          getAssignments(classId),
          listClassExams(classId),
          getLeaderboard(classId),
        ]);
        if (cancelled) return;
        if (qRes.status === 'fulfilled') setQuestions(qRes.value.data.questions || []);
        if (aRes.status === 'fulfilled') setAssignments(aRes.value.data.assignments || []);
        if (eRes.status === 'fulfilled') setExams((eRes.value.data.exams || []).filter((exam) => exam.status !== 'draft' && exam.status !== 'archived'));
        if (lRes.status === 'fulfilled') setLeaderboard(lRes.value.data.leaderboard || []);
      } catch (err) {
        if (!cancelled) setError(typeof err === 'string' ? err : 'Failed to load class');
      } finally {
        if (!cancelled) setLoading(false);
      }
    };
    load();

    const socket = io(`${API_BASE_URL}/`, { withCredentials: true });
    socket.emit('joinClass', classId);
    const refresh = () => {
      void load();
    };
    socket.on('questionPublished', refresh);
    socket.on('questionDisabled', refresh);
    socket.on('questionAssigned', refresh);
    return () => {
      cancelled = true;
      socket.disconnect();
    };
  }, [classData, classId, status]);

  const assignmentByQuestion = useMemo(() => {
    const map = new Map();
    assignments.forEach((a) => map.set(String(a.questionId?._id || a.questionId), a));
    return map;
  }, [assignments]);

  const questionRows = useMemo(() => {
    const q = query.trim().toLowerCase();
    return questions
      .filter((question) => {
        const entry = classEntryFor(question, classId);
        return Boolean(entry?.isPublished);
      })
      .filter((question) => !q || stripHtml(question.title).toLowerCase().includes(q))
      .map((question) => ({
        question,
        assignment: assignmentByQuestion.get(String(question._id)),
        entry: classEntryFor(question, classId),
      }));
  }, [assignmentByQuestion, classId, query, questions]);

  const filteredBoard = useMemo(() => {
    const q = query.trim().toLowerCase();
    return leaderboard.filter((row) => !q || String(row.studentId?.name || '').toLowerCase().includes(q));
  }, [leaderboard, query]);

  if (!classId) {
    return (
      <div className="h-full flex flex-col px-4 sm:px-5 py-5">
        <header className="shrink-0 flex items-center gap-2 mb-3">
          <h1 className={type.pageTitle}>Classes</h1>
        </header>
        {status === 'loading' ? (
          <div className="flex-1 grid place-items-center">
            <div className="w-8 h-8 border-2 border-accent border-t-transparent rounded-full animate-spin" />
          </div>
        ) : enrolled.length === 0 ? (
          <EmptyState title="No classes" message="You are not enrolled in any class yet." />
        ) : (
          <Table columns={[{ label: 'Class' }, { label: 'Students', className: 'hidden sm:table-cell' }, { label: '', key: 'action' }]} fill>
            {enrolled.map((cls) => (
              <tr key={cls._id} className={`${tableClass.row} cursor-pointer`} onClick={() => navigate(`/student/classes/${cls._id}`)}>
                <td className={tableClass.td}>
                  <p className="text-sm font-semibold text-fg">{cls.name}</p>
                  <p className={type.meta}>{cls.description || `${cls.questions?.length || 0} questions`}</p>
                </td>
                <td className={`${tableClass.td} hidden sm:table-cell`}>{cls.students?.length || 0}</td>
                <td className={`${tableClass.td} text-right`}>
                  <Button variant="soft" onClick={() => navigate(`/student/classes/${cls._id}`)}>Open</Button>
                </td>
              </tr>
            ))}
          </Table>
        )}
      </div>
    );
  }

  if (error && !classData) {
    return (
      <div className="px-4 sm:px-5 py-6">
        <EmptyState title="Class unavailable" message={error} action={<Button variant="secondary" onClick={() => navigate('/student')}>Back to dashboard</Button>} />
      </div>
    );
  }

  return (
    <div className="h-full flex flex-col px-4 sm:px-5 py-5">
      <section className="flex-1 min-h-0 flex flex-col gap-3">
        <header className="shrink-0 flex flex-wrap items-center gap-2">
          <Button variant="ghost" icon={ArrowLeft} className="h-9 w-9 justify-center p-0!" onClick={() => navigate('/student')} aria-label="Back" />
          <h1 className={`${type.pageTitle} mr-2`}>{classData?.name || 'Class'}</h1>
          <div className="flex h-9 rounded-xl border border-line bg-inset p-0.5" role="tablist">
            {TABS.map((t) => (
              <button
                key={t.id}
                type="button"
                role="tab"
                aria-selected={tab === t.id}
                onClick={() => setParams({ tab: t.id }, { replace: true })}
                className={`px-3 rounded-lg text-xs font-semibold ${tab === t.id ? 'bg-surface text-fg shadow-sm' : 'text-muted hover:text-fg'}`}
              >
                {t.label}
              </button>
            ))}
          </div>
          <div className="relative w-full sm:w-56 sm:ml-auto">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted pointer-events-none" />
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder={tab === 'leaderboard' ? 'Search students' : 'Search'}
              className="w-full h-9 bg-inset border border-line rounded-xl pl-9 pr-8 text-fg text-xs outline-none focus:border-accent"
            />
            {query && (
              <button type="button" onClick={() => setQuery('')} className="absolute right-2 top-1/2 -translate-y-1/2 p-1 rounded-lg text-muted hover:text-fg" aria-label="Clear">
                <X className="w-3.5 h-3.5" />
              </button>
            )}
          </div>
          <Button
            variant="secondary"
            icon={Play}
            onClick={() => navigate('/student/take-class', { state: { classId } })}
          >
            Practice
          </Button>
        </header>

        {tab === 'questions' && (
          loading && !questionRows.length ? (
            <div className="flex-1 grid place-items-center"><div className="w-8 h-8 border-2 border-accent border-t-transparent rounded-full animate-spin" /></div>
          ) : questionRows.length === 0 ? (
            <EmptyState icon={ClipboardList} title="No published questions" message="Questions appear here after your teacher publishes them." />
          ) : (
            <Table columns={Q_COLS} fill>
              {questionRows.map(({ question, assignment, entry }) => {
                const disabled = Boolean(entry?.isDisabled);
                return (
                  <tr key={question._id} className={tableClass.row}>
                    <td className={`${tableClass.td} max-w-xs`}>
                      <p className="text-sm font-semibold text-fg truncate">{stripHtml(question.title) || 'Untitled'}</p>
                      <p className={type.meta}>{question.difficulty || '—'}{assignment?.maxPoints != null ? ` · ${assignment.maxPoints} pts` : ''}</p>
                    </td>
                    <td className={`${tableClass.td} hidden sm:table-cell whitespace-nowrap text-body`}>
                      {assignment?.dueDate ? formatDateTime(assignment.dueDate) : '—'}
                    </td>
                    <td className={tableClass.td}>
                      <StatusChip kind={disabled ? 'bad' : question.studentAttemptStatus === 'attempted' ? 'ok' : 'neutral'}>
                        {disabled ? 'Disabled' : question.studentAttemptStatus === 'attempted' ? 'Solved' : question.studentAttemptStatus === 'wrong' ? 'Attempted' : 'Open'}
                      </StatusChip>
                    </td>
                    <td className={`${tableClass.td} text-right`}>
                      {disabled ? (
                        <span className="text-xs text-muted">Disabled</span>
                      ) : (
                        <Button
                          variant="soft"
                          onClick={() =>
                            navigate(`/student/questions/${question._id}/submit?classId=${classId}`, { state: { classId } })
                          }
                        >
                          Open
                        </Button>
                      )}
                    </td>
                  </tr>
                );
              })}
            </Table>
          )
        )}

        {tab === 'exams' && (
          loading && !exams.length ? (
            <div className="flex-1 grid place-items-center"><div className="w-8 h-8 border-2 border-accent border-t-transparent rounded-full animate-spin" /></div>
          ) : exams.length === 0 ? (
            <EmptyState title="No exams" message="Exams for this class will show up here." action={<Button variant="secondary" onClick={() => navigate('/student/exams')}>All exams</Button>} />
          ) : (
            <Table columns={E_COLS} fill>
              {exams.map((exam) => (
                <tr key={exam._id} className={`${tableClass.row} cursor-pointer`} onClick={() => navigate(`/student/exams/${exam._id}`)}>
                  <td className={tableClass.td}>
                    <p className="text-sm font-semibold text-fg truncate">{exam.title}</p>
                    <p className={type.meta}>{exam.questionCount} questions</p>
                  </td>
                  <td className={`${tableClass.td} hidden md:table-cell text-body`}>
                    {exam.proctoring?.startTime ? formatDateTime(exam.proctoring.startTime) : 'Any time'}
                  </td>
                  <td className={tableClass.td}>
                    <StatusChip kind={isClosedAttempt(exam.attempt) ? 'pass' : exam.phase === 'live' ? 'ok' : exam.phase === 'scheduled' ? 'info' : 'neutral'}>
                      {exam.attempt && isClosedAttempt(exam.attempt) ? ATTEMPT_LABELS[exam.attempt.status] : exam.phase === 'live' ? 'Open' : exam.phase === 'scheduled' ? 'Upcoming' : exam.phase}
                    </StatusChip>
                  </td>
                  <td className={`${tableClass.td} text-right`}>
                    <Button variant="soft" onClick={() => navigate(`/student/exams/${exam._id}`)}>Open</Button>
                  </td>
                </tr>
              ))}
            </Table>
          )
        )}

        {tab === 'leaderboard' && (
          loading && !leaderboard.length ? (
            <div className="flex-1 grid place-items-center"><div className="w-8 h-8 border-2 border-accent border-t-transparent rounded-full animate-spin" /></div>
          ) : filteredBoard.length === 0 ? (
            <EmptyState icon={Trophy} title="No rankings yet" message="Solve published questions to appear on the leaderboard." />
          ) : (
            <Table columns={L_COLS} fill>
              {filteredBoard.map((row, index) => (
                <tr key={row._id || row.studentId?._id || index} className={tableClass.row}>
                  <td className={tableClass.td}>{row.rank || index + 1}</td>
                  <td className={tableClass.td}>
                    <p className="text-sm font-semibold text-fg">{row.studentId?.name || 'Unknown'}</p>
                  </td>
                  <td className={`${tableClass.td} text-right tabular-nums`}>{row.problemsSolved ?? 0}</td>
                  <td className={`${tableClass.td} hidden sm:table-cell text-right tabular-nums`}>{row.totalScore || 0}</td>
                </tr>
              ))}
            </Table>
          )
        )}
      </section>
    </div>
  );
};

export default StudentClassView;
