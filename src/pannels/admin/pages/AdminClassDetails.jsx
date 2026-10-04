import React, { useCallback, useEffect, useState } from 'react';
import { useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { BookOpen, ClipboardList, GraduationCap, LayoutDashboard, School, Users } from 'lucide-react';
import { getClassOverview } from '../../../common/services/api';
import { Button, EmptyState } from '../../../common/ui/primitives';
import ClassHeader from '../components/classDetails/ClassHeader';
import AddStudentsModal from '../components/classDetails/AddStudentsModal';
import OverviewTab from '../components/classDetails/OverviewTab';
import StudentsTab from '../components/classDetails/StudentsTab';
import QuestionsTab from '../components/classDetails/QuestionsTab';
import ExamsTab from '../components/classDetails/ExamsTab';
import TeachersTab from '../components/classDetails/TeachersTab';
import { errorText, useStaffBase } from '../components/classDetails/helpers';

const TABS = [
  { id: 'overview', label: 'Overview', icon: LayoutDashboard },
  { id: 'students', label: 'Students', icon: Users, count: (d) => d.counts.students },
  { id: 'questions', label: 'Questions', icon: BookOpen, count: (d) => d.counts.questions },
  { id: 'exams', label: 'Exams', icon: ClipboardList, count: (d) => d.counts.exams },
  { id: 'teachers', label: 'Teachers', icon: GraduationCap, count: (d) => d.counts.teachers },
];

function LoadingShell() {
  return (
    <div className="space-y-4 animate-pulse" aria-busy="true">
      <div className="h-9 w-72 rounded-xl bg-surface border border-line" />
      <div className="h-10 w-full max-w-xl rounded-xl bg-surface border border-line" />
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        {Array.from({ length: 4 }, (_, i) => (
          <div key={i} className="h-24 rounded-2xl bg-surface border border-line" />
        ))}
      </div>
      <div className="h-64 rounded-2xl bg-surface border border-line" />
    </div>
  );
}

const AdminClassDetails = () => {
  const { classId } = useParams();
  const navigate = useNavigate();
  const { base, isTeacher } = useStaffBase();
  const [params, setParams] = useSearchParams();
  const [data, setData] = useState(null);
  const [error, setError] = useState('');
  const [refreshing, setRefreshing] = useState(false);
  const [addOpen, setAddOpen] = useState(false);

  const visibleTabs = isTeacher ? TABS.filter((t) => t.id !== 'teachers') : TABS;
  const tab = visibleTabs.some((t) => t.id === params.get('tab')) ? params.get('tab') : 'overview';

  const load = useCallback(async () => {
    setRefreshing(true);
    try {
      const response = await getClassOverview(classId);
      setData(response.data);
      setError('');
    } catch (err) {
      setError(errorText(err, 'Failed to load class'));
    } finally {
      setRefreshing(false);
    }
  }, [classId]);

  useEffect(() => {
    setData(null);
    setError('');
    load();
  }, [load]);

  const openTab = (id, extra = {}) => {
    const next = new URLSearchParams();
    if (id !== 'overview') next.set('tab', id);
    Object.entries(extra).forEach(([k, v]) => v && next.set(k, v));
    setParams(next);
  };

  if (!data) {
    return (
      <div className="px-4 sm:px-5 py-5">
        {error ? (
          <EmptyState
            icon={School}
            title={error === 'Class not found' ? 'Class not found' : "Couldn't load this class"}
            message={error === 'Class not found' ? 'It may have been deleted.' : error}
            action={
              <div className="flex gap-2 justify-center">
                <Button variant="secondary" onClick={() => navigate(`${base}/classes`)}>
                  Back to classes
                </Button>
                {error !== 'Class not found' && <Button onClick={load}>Try again</Button>}
              </div>
            }
          />
        ) : (
          <LoadingShell />
        )}
      </div>
    );
  }

  const tabProps = { classId, data, reload: load, refreshing, openTab, onAddStudents: () => setAddOpen(true) };

  return (
    <div className="h-full flex flex-col px-4 sm:px-5 py-5 gap-3">
      <ClassHeader data={data} onChanged={load} onAddStudents={() => setAddOpen(true)} />

      <nav className="shrink-0 flex gap-1 border-b border-line overflow-x-auto" role="tablist" aria-label="Class sections">
        {visibleTabs.map((t) => {
          const Icon = t.icon;
          const selected = tab === t.id;
          return (
            <button
              key={t.id}
              type="button"
              role="tab"
              aria-selected={selected}
              onClick={() => openTab(t.id)}
              className={`flex items-center gap-1.5 px-3 py-2 -mb-px border-b-2 text-xs font-semibold whitespace-nowrap transition ${
                selected ? 'border-accent text-fg' : 'border-transparent text-muted hover:text-fg'
              }`}
            >
              <Icon className="w-3.5 h-3.5" />
              {t.label}
              {t.count && (
                <span className={`rounded-md px-1.5 text-[10px] tabular-nums ${selected ? 'bg-accent-soft text-accent-ink' : 'bg-hover text-muted'}`}>
                  {t.count(data)}
                </span>
              )}
            </button>
          );
        })}
      </nav>

      {error && (
        <p className="shrink-0 rounded-xl border border-bad-line bg-bad-soft px-3 py-2 text-xs text-bad">
          Refresh failed: {error}
        </p>
      )}

      <section className={`flex-1 min-h-0 ${tab === 'overview' ? 'overflow-y-auto' : 'flex flex-col gap-3'}`}>
        {tab === 'overview' && <OverviewTab {...tabProps} />}
        {tab === 'students' && <StudentsTab {...tabProps} />}
        {tab === 'questions' && <QuestionsTab {...tabProps} />}
        {tab === 'exams' && <ExamsTab {...tabProps} />}
        {tab === 'teachers' && <TeachersTab {...tabProps} />}
      </section>

      <AddStudentsModal
        open={addOpen}
        classId={classId}
        className={data.class.name}
        onClose={() => setAddOpen(false)}
        onAdded={load}
      />
    </div>
  );
};

export default AdminClassDetails;
