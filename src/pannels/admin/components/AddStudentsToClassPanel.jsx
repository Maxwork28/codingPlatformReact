import React, { useState } from 'react';
import { addStudentsToClass } from '../../../common/services/api';

const AddStudentsToClassPanel = ({ classId, onAdded, onError, onMessage }) => {
  const [file, setFile] = useState(null);
  const [fileKey, setFileKey] = useState(0);
  const [emails, setEmails] = useState('');
  const [adding, setAdding] = useState(false);

  const handleAdd = async (event) => {
    event?.preventDefault();
    if (!file && !emails.trim()) {
      onError?.('Upload an Excel or paste the 70 emails/names. You do not need to tick students one by one.');
      return;
    }
    setAdding(true);
    try {
      const response = await addStudentsToClass(classId, { file, emails });
      onMessage?.(response.data?.message || 'Students added');
      setFile(null);
      setFileKey((key) => key + 1);
      setEmails('');
      await onAdded?.();
    } catch (err) {
      onError?.(typeof err === 'string' ? err : err.message || 'Failed to add students');
    } finally {
      setAdding(false);
    }
  };

  return (
    <div className="rounded-lg border border-indigo-100 bg-indigo-50/60 p-4 space-y-3">
      <div>
        <p className="text-sm font-semibold text-gray-800">Add 70 students without ticking</p>
        <p className="text-xs text-gray-600 mt-0.5">
          Do not search the 250-student list. Open this class → Students tab, then either
          upload an Excel of those 70 (Email or Name column) or paste their emails/names below.
        </p>
      </div>
      <div>
        <label className="block text-xs font-medium text-gray-700 mb-1">Excel (Email or Name column)</label>
        <input
          type="file"
          key={fileKey}
          accept=".xlsx,.xls"
          onChange={(e) => setFile(e.target.files?.[0] || null)}
          className="w-full text-sm text-gray-600 file:mr-3 file:py-1.5 file:px-3 file:rounded-lg file:border-0 file:text-xs file:font-semibold file:bg-indigo-600 file:text-white hover:file:bg-indigo-700"
        />
        {file && <p className="mt-1 text-xs text-gray-500">{file.name}</p>}
      </div>
      <div>
        <label className="block text-xs font-medium text-gray-700 mb-1">Or paste the 70 emails or names</label>
        <textarea
          value={emails}
          onChange={(e) => setEmails(e.target.value)}
          rows={4}
          placeholder={'one@college.edu\ntwo@college.edu\nRahul Sharma'}
          className="w-full rounded-lg border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 text-sm"
        />
      </div>
      <button
        type="button"
        onClick={handleAdd}
        disabled={adding}
        className="inline-flex items-center px-3 py-1.5 rounded-lg text-xs font-semibold text-white bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50"
      >
        {adding ? 'Adding...' : 'Add students to class'}
      </button>
    </div>
  );
};

export default AddStudentsToClassPanel;
