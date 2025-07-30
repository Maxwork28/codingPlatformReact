import React, { useState, useEffect } from 'react';
import { getStudents, editStudent, deleteStudent } from '../../../common/services/api';
import { UserIcon, EnvelopeIcon, PhoneIcon, PencilIcon, TrashIcon } from '@heroicons/react/24/outline';

const StudentManagement = () => {
  const [students, setStudents] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [editModal, setEditModal] = useState({ open: false, student: null });
  const [deleteModal, setDeleteModal] = useState({ open: false, student: null });
  const [editForm, setEditForm] = useState({ name: '', email: '', number: '' });
  const [processing, setProcessing] = useState(false);

  useEffect(() => {
    const fetchStudents = async () => {
      try {
        const response = await getStudents();
        setStudents(response.data.students);
      } catch (err) {
        setError(err.response?.data?.error || 'Failed to fetch students');
      } finally {
        setLoading(false);
      }
    };
    fetchStudents();
  }, []);

  const handleEditClick = (student) => {
    setEditForm({
      name: student.name,
      email: student.email,
      number: student.number || ''
    });
    setEditModal({ open: true, student });
  };

  const handleDeleteClick = (student) => {
    setDeleteModal({ open: true, student });
  };

  const handleEditSubmit = async (e) => {
    e.preventDefault();
    setProcessing(true);
    try {
      await editStudent(editModal.student._id, editForm);
      // Update the students list with the edited student
      setStudents(students.map(student => 
        student._id === editModal.student._id 
          ? { ...student, ...editForm }
          : student
      ));
      setEditModal({ open: false, student: null });
      setEditForm({ name: '', email: '', number: '' });
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to edit student');
    } finally {
      setProcessing(false);
    }
  };

  const handleDeleteConfirm = async () => {
    setProcessing(true);
    try {
      await deleteStudent(deleteModal.student._id);
      // Remove the student from the list
      setStudents(students.filter(student => student._id !== deleteModal.student._id));
      setDeleteModal({ open: false, student: null });
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to delete student');
    } finally {
      setProcessing(false);
    }
  };

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      <div className="mb-10">
        <h2 className="text-3xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-indigo-600 to-indigo-400 tracking-tight">
          Student Management
        </h2>
        <p className="mt-1 text-sm text-gray-500">View and manage student records.</p>
      </div>

      {error && (
        <div className="flex items-center p-4 mb-6 bg-red-50/80 backdrop-blur-sm rounded-xl shadow-sm border border-red-200">
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
          <button 
            onClick={() => setError('')}
            className="ml-auto text-red-500 hover:text-red-700"
          >
            ×
          </button>
        </div>
      )}

      {loading ? (
        <div className="flex justify-center items-center py-16 bg-white/50 backdrop-blur-sm rounded-xl shadow-lg">
          <div className="w-12 h-12 border-4 border-indigo-500 border-t-transparent rounded-full animate-spin"></div>
        </div>
      ) : (
        <div className="bg-white/90 backdrop-blur-sm rounded-2xl shadow-lg border border-gray-100 overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th
                  scope="col"
                  className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider"
                >
                  Name
                </th>
                <th
                  scope="col"
                  className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider"
                >
                  Email
                </th>
                <th
                  scope="col"
                  className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider"
                >
                  Phone
                </th>
                <th
                  scope="col"
                  className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider"
                >
                  Actions
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200">
              {students.map((student) => (
                <tr key={student._id}>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="flex items-center">
                      <div className="flex-shrink-0 h-10 w-10 rounded-full bg-indigo-100 flex items-center justify-center">
                        <UserIcon className="h-5 w-5 text-indigo-600" />
                      </div>
                      <div className="ml-4">
                        <div className="text-sm font-medium text-gray-900">{student.name}</div>
                      </div>
                    </div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="flex items-center">
                      <EnvelopeIcon className="h-5 w-5 text-gray-400 mr-2" />
                      <div className="text-sm text-gray-500">{student.email}</div>
                    </div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="flex items-center">
                      <PhoneIcon className="h-5 w-5 text-gray-400 mr-2" />
                      <div className="text-sm text-gray-500">{student.number || 'N/A'}</div>
                    </div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                    <button 
                      onClick={() => handleEditClick(student)}
                      className="text-indigo-600 hover:text-indigo-900 mr-3 flex items-center"
                    >
                      <PencilIcon className="h-4 w-4 mr-1" />
                      Edit
                    </button>
                    <button 
                      onClick={() => handleDeleteClick(student)}
                      className="text-red-600 hover:text-red-900 flex items-center"
                    >
                      <TrashIcon className="h-4 w-4 mr-1" />
                      Remove
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Edit Modal */}
      {editModal.open && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 w-full max-w-md mx-4">
            <h3 className="text-lg font-semibold mb-4">Edit Student</h3>
            <form onSubmit={handleEditSubmit}>
              <div className="mb-4">
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Name
                </label>
                <input
                  type="text"
                  value={editForm.name}
                  onChange={(e) => setEditForm({ ...editForm, name: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  required
                />
              </div>
              <div className="mb-4">
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Email
                </label>
                <input
                  type="email"
                  value={editForm.email}
                  onChange={(e) => setEditForm({ ...editForm, email: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  required
                />
              </div>
              <div className="mb-6">
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Phone Number
                </label>
                <input
                  type="text"
                  value={editForm.number}
                  onChange={(e) => setEditForm({ ...editForm, number: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-indigo-500"
                />
              </div>
              <div className="flex justify-end space-x-3">
                <button
                  type="button"
                  onClick={() => setEditModal({ open: false, student: null })}
                  className="px-4 py-2 text-gray-600 hover:text-gray-800"
                  disabled={processing}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 bg-indigo-600 text-white rounded-md hover:bg-indigo-700 disabled:opacity-50"
                  disabled={processing}
                >
                  {processing ? 'Saving...' : 'Save Changes'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Delete Confirmation Modal */}
      {deleteModal.open && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 w-full max-w-md mx-4">
            <h3 className="text-lg font-semibold mb-4 text-red-600">Delete Student</h3>
            <p className="text-gray-600 mb-6">
              Are you sure you want to delete <strong>{deleteModal.student?.name}</strong>? 
              This action cannot be undone and will remove the student from all classes.
            </p>
            <div className="flex justify-end space-x-3">
              <button
                onClick={() => setDeleteModal({ open: false, student: null })}
                className="px-4 py-2 text-gray-600 hover:text-gray-800"
                disabled={processing}
              >
                Cancel
              </button>
              <button
                onClick={handleDeleteConfirm}
                className="px-4 py-2 bg-red-600 text-white rounded-md hover:bg-red-700 disabled:opacity-50"
                disabled={processing}
              >
                {processing ? 'Deleting...' : 'Delete'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default StudentManagement;