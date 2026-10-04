import React, { useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { ArrowLeft, ArrowRight } from 'lucide-react';
import { Button, Card } from '../../../common/ui/primitives';
import { labelClass, type } from '../../../common/ui/format';
import ClassPicker from '../components/ClassPicker';

const STEPS = [
  ['Pick a source class', 'The template is filed under it, but you can create exams from it for any class.'],
  ['Build the layout', 'Add questions and sections, set points, duration and proctoring rules.'],
  ['Reuse it', 'Create exams from the template in a few clicks; only the schedule is set per exam.'],
];

const CreateExamTemplate = () => {
  const navigate = useNavigate();
  const base = useLocation().pathname.startsWith('/teacher') ? '/teacher' : '/admin';
  const [selectedClass, setSelectedClass] = useState(null);
  const back = () => navigate(`${base}/exams/templates`);

  const handleContinue = (e) => {
    e.preventDefault();
    if (selectedClass) navigate(`${base}/classes/${selectedClass._id}/exams/create?template=true`);
  };

  return (
    <div className="w-full px-4 sm:px-5 py-5 space-y-4">
      <div className="flex items-center gap-2">
        <Button
          variant="ghost"
          icon={ArrowLeft}
          className="h-9 w-9 justify-center p-0!"
          onClick={back}
          aria-label="Back to exam templates"
          title="Back to exam templates"
        />
        <h1 className={type.pageTitle}>New exam template</h1>
      </div>

      <div className="grid lg:grid-cols-[1fr_20rem] xl:grid-cols-[1fr_22rem] gap-5 items-start">
        <Card as="form" onSubmit={handleContinue} className="space-y-5">
          <div className="space-y-1.5">
            <label htmlFor="template-class" className={labelClass}>
              Source class
            </label>
            <ClassPicker id="template-class" value={selectedClass} onChange={setSelectedClass} autoFocus />
            <p className={type.meta}>
              The template is filed under this class. You can still create exams from it for any class.
            </p>
          </div>

          <div className="flex justify-end gap-2 pt-1">
            <Button variant="secondary" onClick={back}>
              Cancel
            </Button>
            <Button type="submit" icon={ArrowRight} disabled={!selectedClass}>
              Continue to builder
            </Button>
          </div>
        </Card>

        <Card className="space-y-3">
          <h2 className={type.section}>How it works</h2>
          <ol className="space-y-3">
            {STEPS.map(([title, text], i) => (
              <li key={title} className="flex gap-3">
                <span
                  className={`h-6 w-6 shrink-0 rounded-lg text-[11px] font-bold flex items-center justify-center ${
                    i === 0 ? 'bg-accent text-on-accent' : 'bg-accent-soft text-accent-ink'
                  }`}
                >
                  {i + 1}
                </span>
                <div className="min-w-0">
                  <p className="text-xs font-semibold text-fg">{title}</p>
                  <p className={`${type.meta} mt-0.5`}>{text}</p>
                </div>
              </li>
            ))}
          </ol>
        </Card>
      </div>
    </div>
  );
};

export default CreateExamTemplate;
