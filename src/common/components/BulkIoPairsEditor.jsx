import React, { useState } from 'react';
import { PlusIcon, TrashIcon } from '@heroicons/react/24/outline';
import { parseBulkIo } from '../utils/parseBulkIo';

const fieldClass =
  'w-full px-3 py-2 rounded-lg border font-mono text-sm focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500';

const BulkIoPairsEditor = ({
  items,
  onChange,
  emptyItem,
  inputKey = 'input',
  outputKey = 'output',
  showFlags = false,
  minItems = 1,
  addLabel = 'Add row',
  errors = [],
}) => {
  const [bulkText, setBulkText] = useState('');
  const [bulkOpen, setBulkOpen] = useState(false);
  const [bulkMessage, setBulkMessage] = useState('');

  const updateItem = (index, field, value) => {
    const next = items.map((item, i) => (i === index ? { ...item, [field]: value } : item));
    onChange(next);
  };

  const addItem = () => {
    onChange([...items, { ...emptyItem }]);
  };

  const removeItem = (index) => {
    if (items.length <= minItems) return;
    onChange(items.filter((_, i) => i !== index));
  };

  const applyBulk = () => {
    const parsed = parseBulkIo(bulkText);
    if (parsed.length === 0) {
      setBulkMessage('No pairs found. Use --- between input and output, and === between cases.');
      return;
    }

    const mapped = parsed.map((pair) => ({
      ...emptyItem,
      [inputKey]: pair.input,
      [outputKey]: pair.output,
    }));

    const onlyBlank =
      items.length <= 1 &&
      !String(items[0]?.[inputKey] || '').trim() &&
      !String(items[0]?.[outputKey] || '').trim();

    onChange(onlyBlank ? mapped : [...items.filter((item) => {
      return String(item[inputKey] || '').trim() || String(item[outputKey] || '').trim();
    }), ...mapped]);

    setBulkText('');
    setBulkMessage(`Added ${mapped.length} pair${mapped.length === 1 ? '' : 's'}.`);
  };

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <button
          type="button"
          onClick={() => setBulkOpen((open) => !open)}
          className="text-sm font-medium text-indigo-600 hover:text-indigo-800"
        >
          {bulkOpen ? 'Hide paste box' : 'Paste many at once'}
        </button>
        <button
          type="button"
          onClick={addItem}
          className="inline-flex items-center px-3 py-1.5 text-sm font-semibold text-white bg-indigo-600 rounded-lg hover:bg-indigo-700"
        >
          <PlusIcon className="h-4 w-4 mr-1" />
          {addLabel}
        </button>
      </div>

      {bulkOpen && (
        <div
          className="rounded-lg border p-3 space-y-2"
          style={{ borderColor: 'var(--card-border)', backgroundColor: 'var(--background-light)' }}
        >
          <p className="text-xs" style={{ color: 'var(--text-secondary)' }}>
            Separate input and output with <code className="px-1 rounded bg-gray-200 dark:bg-gray-700">---</code>
            {' '}and cases with <code className="px-1 rounded bg-gray-200 dark:bg-gray-700">===</code>
          </p>
          <textarea
            value={bulkText}
            onChange={(e) => {
              setBulkText(e.target.value);
              setBulkMessage('');
            }}
            rows={8}
            className={fieldClass}
            style={{ backgroundColor: 'var(--card-white)', borderColor: 'var(--card-border)', color: 'var(--text-primary)' }}
            placeholder={'1 2 3\n---\n6\n===\n5 5\n---\n10'}
          />
          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={applyBulk}
              className="px-3 py-1.5 text-sm font-semibold text-white bg-indigo-600 rounded-lg hover:bg-indigo-700"
            >
              Parse & add
            </button>
            {bulkMessage && (
              <span className="text-xs" style={{ color: 'var(--text-secondary)' }}>{bulkMessage}</span>
            )}
          </div>
        </div>
      )}

      <div className="overflow-x-auto rounded-lg border" style={{ borderColor: 'var(--card-border)' }}>
        <table className="min-w-full">
          <thead style={{ backgroundColor: 'var(--background-light)' }}>
            <tr>
              <th className="px-3 py-2 text-left text-xs font-semibold uppercase tracking-wider w-10" style={{ color: 'var(--text-secondary)' }}>#</th>
              <th className="px-3 py-2 text-left text-xs font-semibold uppercase tracking-wider" style={{ color: 'var(--text-secondary)' }}>Input</th>
              <th className="px-3 py-2 text-left text-xs font-semibold uppercase tracking-wider" style={{ color: 'var(--text-secondary)' }}>Output</th>
              {showFlags && (
                <>
                  <th className="px-3 py-2 text-center text-xs font-semibold uppercase tracking-wider w-20" style={{ color: 'var(--text-secondary)' }}>Public</th>
                  <th className="px-3 py-2 text-center text-xs font-semibold uppercase tracking-wider w-20" style={{ color: 'var(--text-secondary)' }}>Large</th>
                </>
              )}
              <th className="px-3 py-2 w-12" />
            </tr>
          </thead>
          <tbody>
            {items.map((item, idx) => (
              <tr key={idx} className="border-t align-top" style={{ borderColor: 'var(--card-border)' }}>
                <td className="px-3 py-2 text-sm font-medium" style={{ color: 'var(--text-secondary)' }}>{idx + 1}</td>
                <td className="px-3 py-2">
                  <textarea
                    value={item[inputKey] || ''}
                    onChange={(e) => updateItem(idx, inputKey, e.target.value)}
                    rows={3}
                    className={fieldClass}
                    style={{ backgroundColor: 'var(--card-white)', borderColor: 'var(--card-border)', color: 'var(--text-primary)' }}
                    placeholder="stdin"
                  />
                  {errors[idx] && <p className="mt-1 text-xs text-red-600">{errors[idx]}</p>}
                </td>
                <td className="px-3 py-2">
                  <textarea
                    value={item[outputKey] || ''}
                    onChange={(e) => updateItem(idx, outputKey, e.target.value)}
                    rows={3}
                    className={fieldClass}
                    style={{ backgroundColor: 'var(--card-white)', borderColor: 'var(--card-border)', color: 'var(--text-primary)' }}
                    placeholder="expected stdout"
                  />
                </td>
                {showFlags && (
                  <>
                    <td className="px-3 py-2 text-center">
                      <input
                        type="checkbox"
                        checked={Boolean(item.isPublic)}
                        onChange={(e) => updateItem(idx, 'isPublic', e.target.checked)}
                        className="h-4 w-4 text-indigo-600 rounded"
                        title="Public"
                      />
                    </td>
                    <td className="px-3 py-2 text-center">
                      <input
                        type="checkbox"
                        checked={Boolean(item.isLargeTestCase)}
                        onChange={(e) => updateItem(idx, 'isLargeTestCase', e.target.checked)}
                        className="h-4 w-4 text-amber-600 rounded"
                        title="Large (TLE/MLE)"
                      />
                    </td>
                  </>
                )}
                <td className="px-3 py-2">
                  <button
                    type="button"
                    onClick={() => removeItem(idx)}
                    disabled={items.length <= minItems}
                    className="p-1.5 rounded-full text-red-600 hover:bg-red-50 disabled:opacity-40"
                    aria-label="Remove"
                  >
                    <TrashIcon className="h-4 w-4" />
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
};

export const QuestionFormStepper = ({ step, steps, onStepChange }) => (
  <div className="flex flex-wrap gap-2 mb-6">
    {steps.map((item) => {
      const active = step === item.id;
      const done = step > item.id;
      return (
        <button
          key={item.id}
          type="button"
          onClick={() => onStepChange(item.id)}
          className={`inline-flex items-center gap-2 px-3 py-2 rounded-lg text-sm font-semibold border transition-colors ${
            active
              ? 'bg-indigo-600 text-white border-indigo-600'
              : done
                ? 'bg-indigo-50 text-indigo-800 border-indigo-200'
                : ''
          }`}
          style={
            active
              ? undefined
              : done
                ? undefined
                : {
                    color: 'var(--text-primary)',
                    backgroundColor: 'var(--background-light)',
                    borderColor: 'var(--card-border)',
                  }
          }
        >
          <span className={`inline-flex h-5 w-5 items-center justify-center rounded-full text-xs ${
            active ? 'bg-white/20' : 'bg-black/10'
          }`}>
            {item.id}
          </span>
          {item.label}
        </button>
      );
    })}
  </div>
);

export default BulkIoPairsEditor;
