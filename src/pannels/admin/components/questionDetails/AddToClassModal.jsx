import React, { useEffect, useState } from 'react';
import { School } from 'lucide-react';
import { assignQuestionToClass, publishQuestion } from '../../../../common/services/api';
import Modal from '../../../../common/ui/Modal';
import { Button } from '../../../../common/ui/primitives';
import { labelClass, type } from '../../../../common/ui/format';
import ClassPicker from '../ClassPicker';
import { errorText } from '../classDetails/helpers';

export default function AddToClassModal({ open, questionId, existingIds, onClose, onAdded }) {
  const [cls, setCls] = useState(null);
  const [publish, setPublish] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!open) return;
    setCls(null);
    setPublish(true);
    setError('');
  }, [open]);

  const already = cls && existingIds.some((id) => String(id) === String(cls._id));

  const submit = async () => {
    if (!cls || already) return;
    setSaving(true);
    setError('');
    try {
      await assignQuestionToClass(questionId, String(cls._id));
      let message = `Added to ${cls.name}`;
      if (publish) {
        try {
          await publishQuestion(questionId, String(cls._id));
          message = `Added to ${cls.name} and visible to students`;
        } catch {
          message = `Added to ${cls.name}, but it could not be published. It is hidden for now.`;
        }
      }
      onAdded(message);
    } catch (err) {
      setError(errorText(err, 'Failed to add the question to the class'));
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal
      open={open}
      onClose={saving ? () => {} : onClose}
      title="Add to class"
      icon={School}
      width="max-w-md"
      footer={
        <>
          <Button variant="secondary" onClick={onClose} disabled={saving}>
            Cancel
          </Button>
          <Button onClick={submit} disabled={!cls || already || saving}>
            {saving ? 'Adding…' : 'Add to class'}
          </Button>
        </>
      }
    >
      <div className="space-y-4">
        <div className="space-y-1.5">
          <label htmlFor="add-to-class" className={labelClass}>
            Class
          </label>
          <ClassPicker id="add-to-class" value={cls} onChange={setCls} autoFocus />
          {already && <p className="text-[11px] text-warn">This question is already in {cls.name}.</p>}
        </div>
        <label className="flex items-start gap-2.5 cursor-pointer">
          <input
            type="checkbox"
            checked={publish}
            onChange={(e) => setPublish(e.target.checked)}
            className="mt-0.5 w-3.5 h-3.5 rounded border-line-strong bg-inset text-accent focus:ring-accent"
          />
          <span>
            <span className="block text-xs text-fg font-semibold">Publish right away</span>
            <span className={type.meta}>Students in the class can see and attempt it immediately.</span>
          </span>
        </label>
        {error && <p className="rounded-xl border border-bad-line bg-bad-soft px-3 py-2 text-xs text-bad">{error}</p>}
      </div>
    </Modal>
  );
}
