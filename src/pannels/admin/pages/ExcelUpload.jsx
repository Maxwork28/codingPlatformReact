import React, { useState } from 'react';
import { uploadExcel } from '../../../common/services/api';
import { DocumentArrowUpIcon } from '@heroicons/react/24/outline';

const StudentUpload = () => {
  const [file, setFile] = useState(null);
  const [role, setRole] = useState('student');
  const [isUploading, setIsUploading] = useState(false);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');

  const handleFileChange = (e) => {
    const selectedFile = e.target.files[0];
    if (selectedFile && selectedFile.type.includes('spreadsheetml')) {
      setFile(selectedFile);
      setError('');
    } else {
      setFile(null);
      setError('Please select a valid Excel file (.xlsx).');
    }
  };

  const handleUpload = async () => {
    if (!file) {
      setError('Please select an Excel file to upload.');
      return;
    }

    setIsUploading(true);
    setMessage('');
    setError('');

    try {
      const response = await uploadExcel(file, role);
      setMessage(response.data.message);
      setFile(null);
      document.getElementById('fileInput').value = '';
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to upload file. Please try again.');
    } finally {
      setIsUploading(false);
    }
  };

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      <div className="mb-10">
        <h2 className="text-3xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-indigo-600 to-indigo-400 tracking-tight">
          Upload Students
        </h2>
        <p className="mt-1 text-sm text-gray-500">
          Upload an Excel file to create student accounts with generated credentials.
        </p>
      </div>

      <div className="bg-white/90 backdrop-blur-sm rounded-2xl shadow-lg border border-gray-100 p-6">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {/* File Input */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Select Excel File</label>
            <div className="flex items-center justify-center w-full">
              <label
                htmlFor="fileInput"
                className="flex flex-col items-center justify-center w-full h-32 border-2 border-gray-300 border-dashed rounded-lg cursor-pointer bg-gray-50 hover:bg-gray-100 transition-colors"
              >
                <div className="flex flex-col items-center justify-center pt-5 pb-6">
                  <DocumentArrowUpIcon className="h-8 w-8 text-gray-400" />
                  <p className="mt-2 text-sm text-gray-500">
                    {file ? file.name : 'Drag and drop or click to select Excel file'}
                  </p>
                </div>
                <input
                  id="fileInput"
                  type="file"
                  accept=".xlsx,.xls"
                  onChange={handleFileChange}
                  className="hidden"
                />
              </label>
            </div>
          </div>

          {/* Role Selection and Upload Button */}
          <div className="flex flex-col justify-between">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">User Role</label>
              <select
                value={role}
                onChange={(e) => setRole(e.target.value)}
                className="w-full rounded-lg border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm"
              >
                <option value="student">Student</option>
                <option value="teacher">Teacher</option>
              </select>
            </div>
            <button
              onClick={handleUpload}
              disabled={isUploading || !file}
              className={`mt-4 inline-flex items-center px-4 py-2 rounded-lg text-sm font-semibold text-white ${
                isUploading || !file
                  ? 'bg-indigo-400 cursor-not-allowed'
                  : 'bg-indigo-600 hover:bg-indigo-700'
              } focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2 transition-all duration-300`}
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
                'Upload File'
              )}
            </button>
          </div>
        </div>

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
        <div className="mt-6 bg-white/90 backdrop-blur-sm rounded-2xl shadow-lg border border-gray-100 p-6">
          <h3 className="text-lg font-semibold text-gray-800 mb-3">Excel File Format</h3>
          <p className="text-sm text-gray-600">
            The Excel file must contain the following columns:
          </p>
          <ul className="list-disc pl-5 space-y-1 text-sm text-gray-600 mt-2">
            <li>
              <strong>name</strong>: Full name of the student
            </li>
            <li>
              <strong>email</strong>: Email address for login
            </li>
            <li>
              <strong>number</strong>: Contact number
            </li>
          </ul>
          <p className="text-sm text-gray-600 mt-2">
            Passwords will be automatically generated and sent to each student's email.
          </p>
        </div>
      </div>
    </div>
  );
};

export default StudentUpload;