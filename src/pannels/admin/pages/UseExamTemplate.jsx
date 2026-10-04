import React, { useEffect, useState } from 'react';
import { useLocation, useNavigate, useParams } from 'react-router-dom';
import { ArrowLeft, ArrowRight, Award, Clock, Layers, ListChecks, ShieldCheck } from 'lucide-react';
import { getExamDetails } from '../../../common/services/api';
import { Button, Card, EmptyState } from '../../../common/ui/primitives';
import { labelClass, type } from '../../../common/ui/format';
import ClassPicker from '../components/ClassPicker';

const errorText = (err, fallback) => (typeof err === 'string' ? err : err?.response?.data?.error || fallback);

function Fact({ icon, label, value }) {
  const Icon = icon;
  return (
    <div className="flex items-center gap-2 rounded-xl border border-line bg-inset px-3 py-2">
      <Icon className="w-3.5 h-3.5 text-muted shrink-0" />
      <div className="min-w-0">
        <p className="text-[10px] font-bold uppercase tracking-wider text-muted">{label}</p>
        <p className="text-xs font-semibold text-fg truncate">{value}</p>
      </div>
    </div>
  );
}

const UseExamTemplate = () => {
  const { templateId } = useParams();
  const navigate = useNavigate();
  const base = useLocation().pathname.startsWith('/teacher') ? '/teacher' : '/admin';
  const [selectedClass, setSelectedClass] = useState(null);
  const [template, setTemplate] = useState(null);
  const [error, setError] = useState('');

  useEffect(() => {
    let cancelled = false;
    getExamDetails(templateId)
      .then((response) => {
        if (cancelled) return;
        const exam = response.data.exam;
        if (!exam?.template?.isTemplate) setError('This exam is not a template.');
        else setTemplate(exam);
      })
      .catch((err) => !cancelled && setError(errorText(err, 'Failed to load template')));
    return () => {
      cancelled = true;
    };
  }, [templateId]);

  const backToList = () => navigate(`${base}/exams/templates`);

  const handleContinue = (e) => {
    e.preventDefault();
    if (selectedClass) navigate(`${base}/classes/${selectedClass._id}/exams/create?templateId=${templateId}`);
  };

  const proctoring = template?.proctoring || {};
  const totalPoints = (template?.questions || []).reduce((sum, q) => sum + (Number(q.points) || 0), 0);
  const rules = [
    proctoring.fullscreenRequired && 'Fullscreen',
    proctoring.copyPasteDisabled && 'No copy/paste',
    proctoring.tabSwitchLimit != null && `${proctoring.tabSwitchLimit} tab switches`,
  ].filter(Boolean);

  return (
    <div className="w-full px-4 sm:px-5 py-5">
      <div className="space-y-4">
        <div className="flex items-center gap-2">
          <Button
            variant="ghost"
            icon={ArrowLeft}
            className="h-9 w-9 justify-center p-0!"
            onClick={backToList}
            aria-label="Back to exam templates"
            title="Back to exam templates"
          />
          <h1 className={type.pageTitle}>Create exam from template</h1>
        </div>

        {error ? (
          <EmptyState
            icon={Award}
            title="Template unavailable"
            message={error}
            action={<Button variant="secondary" onClick={backToList}>Back to templates</Button>}
          />
        ) : !template ? (
          <div className="grid lg:grid-cols-[1fr_20rem] xl:grid-cols-[1fr_22rem] gap-5 items-start">
            <div className="h-40 rounded-2xl bg-hover animate-pulse" />
            <div className="h-64 rounded-2xl bg-hover animate-pulse" />
          </div>
        ) : (
          <div className="grid lg:grid-cols-[1fr_20rem] xl:grid-cols-[1fr_22rem] gap-5 items-start">
            <Card as="form" onSubmit={handleContinue} className="space-y-5 lg:order-1">
              <div className="space-y-1.5">
                <label htmlFor="target-class" className={labelClass}>
                  Class to create the exam for
                </label>
                <ClassPicker id="target-class" value={selectedClass} onChange={setSelectedClass} autoFocus />
                <p className={type.meta}>
                  Next you can set the title, schedule and settings. The questions and sections are copied from the
                  template, and the template itself is not changed.
                </p>
              </div>
              <div className="flex justify-end gap-2 pt-1">
                <Button variant="secondary" onClick={backToList}>
                  Cancel
                </Button>
                <Button type="submit" icon={ArrowRight} disabled={!selectedClass}>
                  Continue
                </Button>
              </div>
            </Card>

            <Card className="space-y-3 lg:order-2">
              <h2 className={type.section}>Template</h2>
              <div>
                <p className={type.cardTitle}>{template.title}</p>
                {(template.template?.templateDescription || template.description) && (
                  <p className={`${type.body} mt-1`}>{template.template?.templateDescription || template.description}</p>
                )}
              </div>
              <div className="grid grid-cols-2 lg:grid-cols-1 gap-2">
                <Fact
                  icon={ListChecks}
                  label="Questions"
                  value={`${template.questions?.length || 0}${totalPoints ? ` · ${totalPoints} pts` : ''}`}
                />
                <Fact icon={Layers} label="Sections" value={template.sections?.length || 0} />
                <Fact icon={Clock} label="Duration" value={proctoring.durationMinutes ? `${proctoring.durationMinutes} min` : '—'} />
                <Fact icon={ShieldCheck} label="Proctoring" value={rules.length ? rules.join(', ') : 'Off'} />
              </div>
            </Card>
          </div>
        )}
      </div>
    </div>
  );
};

export default UseExamTemplate;
