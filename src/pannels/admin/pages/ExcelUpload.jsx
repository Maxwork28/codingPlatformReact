import React, { useState } from 'react';

import { uploadExcel } from '../../../common/services/api';
import { DocumentArrowUpIcon } from '@heroicons/react/24/outline';
const UploadExcel = () => {
  const [file, setFile] = useState(null);
  const [role, setRole] = useState('student');
  const [isUploading, setIsUploading] = useState(false);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!file) {
      setError('Please select a file first');
      return;
    }
    setIsUploading(true);
    try {
      const response = await uploadExcel(file, role);
      setMessage(response.data.message);
      setError('');
      setFile(null);
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to upload file');
    } finally {
      setIsUploading(false);
    }
  };
  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      <div className="mb-10">
        <h2 className="text-3xl font-bold tracking-tight text-gray-900 dark:text-white">
          Bulk User Upload
        </h2>
        <p className="mt-1 text-sm text-gray-600 dark:text-gray-300">Upload an Excel file to add multiple users at once.</p>
      </div>
      <div className="rounded-2xl shadow-lg border p-6 bg-white dark:bg-gray-800 border-gray-200 dark:border-gray-700">
        <form onSubmit={handleSubmit} className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* Role Selection */}
            <div>
              <label className="block text-sm font-medium mb-2 text-gray-900 dark:text-white">User Role</label>
              <select
                value={role}
                onChange={(e) => setRole(e.target.value)}
                className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-gray-500 focus:border-gray-500 bg-white dark:bg-gray-900 border-gray-200 dark:border-gray-700 text-gray-900 dark:text-gray-100"
              >
                <option value="student">Student</option>
                <option value="teacher">Teacher</option>
              </select>
            </div>
            {/* File Upload */}
            <div>
              <label className="block text-sm font-medium mb-2 text-gray-900 dark:text-white">Excel File</label>
              <div className="flex items-center justify-center w-full">
                <label
                  htmlFor="fileInput"
                  className="flex flex-col items-center justify-center w-full h-32 border-2 border-dashed rounded-lg cursor-pointer transition-colors"
                  style={{ borderColor: 'var(--card-border)', backgroundColor: 'var(--background-light)' }}
                >
                  <div className="flex flex-col items-center justify-center pt-5 pb-6">
                    <DocumentArrowUpIcon className="h-8 w-8 text-gray-400" />
                    <p className="mt-2 text-sm" style={{ color: 'var(--text-secondary)' }}>
                      {file ? file.name : 'Drag and drop or click to select Excel file'}
                    </p>
                  </div>
                  <input
                    id="fileInput"
                    type="file"
                    accept=".xlsx,.xls"
                    onChange={(e) => setFile(e.target.files[0])}
                    className="hidden"
                    required
                  />
                </label>
              </div>
            </div>
          </div>
          {/* Submit Button */}
          <div className="flex justify-end">
            <button
              type="submit"
              disabled={isUploading}
              className={`inline-flex items-center px-4 py-2 rounded-lg text-sm font-semibold text-white ${
                isUploading ? 'bg-gray-400 cursor-not-allowed' : 'bg-gray-600 hover:bg-gray-700'
              } focus:outline-none focus:ring-2 focus:ring-gray-500 focus:ring-offset-2 transition-all duration-300`}
            >
              {isUploading ? (
                <>
                  <svg
                    className="animate-spin h-5 w-5 mr-2 text-white"
                    xmlns="http://www.w3.org/2000/svg"
                    fill="none"
                    viewBox="0 0 24 24"
                  >
                    <circle
                      className="opacity-25"
                      cx="12"
                      cy="12"
                      r="10"
                      stroke="currentColor"
                      strokeWidth="4"
                    ></circle>
                    <path
                      className="opacity-75"
                      fill="currentColor"
                      d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                    ></path>
                  </svg>
                  Uploading...
                </>
              ) : (
                'Upload'
              )}
            </button>
          </div>
        </form>

        {/* Feedback Messages */}
        {message && (
          <div className="mt-6 flex items-center p-4 bg-green-50/80 backdrop-blur-sm rounded-xl shadow-sm border border-green-200">
            <svg
              className="h-6 w-6 text-green-500 mr-3"
              xmlns="http://www.w3.org/2000/svg"
              viewBox="0 0 20 20"
              fill="currentColor"
            >
              <path
                fillRule="evenodd"
                d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z"
                clipRule="evenodd"
              />
            </svg>
            <p className="text-sm font-semibold text-green-800">{message}</p>
          </div>
        )}
        {error && (
          <div className="mt-6 flex items-center p-4 bg-red-50/80 backdrop-blur-sm rounded-xl shadow-sm border border-red-200">
            <svg
              className="h-6 w-6 text-red-500 mr-3"
              xmlns="http://www.w3.org/2000/svg"
              viewBox="0 0 20 20"
              fill="currentColor"
            >
              <path
                fillRule="evenodd"
                d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z"
                clipRule="evenodd"
              />
            </svg>
            <p className="text-sm font-semibold text-red-800">{error}</p>
          </div>
        )}

        {/* Instructions */}
        <div className="mt-6 rounded-2xl shadow-lg border p-6 bg-white dark:bg-gray-800 border-gray-200 dark:border-gray-700">
          <h3 className="text-lg font-semibold mb-3 text-gray-900 dark:text-white">File Format Requirements</h3>
          <p className="text-sm text-gray-600 dark:text-gray-300">
            The Excel file must contain the following columns:
          </p>
          <ul className="list-disc pl-5 space-y-1 text-sm mt-2 text-gray-600 dark:text-gray-300">
            <li>First row should contain column headers</li>
            <li>
              Required columns: <strong>name</strong>, <strong>email</strong>, <strong>number</strong>
            </li>
            <li>File size should not exceed 5MB</li>
          </ul>
        </div>
      </div>
    </div>
  );
};

export default UploadExcel;