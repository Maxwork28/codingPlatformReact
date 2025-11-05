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
  const [searchQuery, setSearchQuery] = useState('');
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage] = useState(10);

  // Calculate pagination
  const indexOfLastItem = currentPage * itemsPerPage;
  const indexOfFirstItem = indexOfLastItem - itemsPerPage;
  const currentStudents = students.slice(indexOfFirstItem, indexOfLastItem);
  const totalPages = Math.ceil(students.length / itemsPerPage);

  const fetchStudents = async (search = '') => {
    try {
      setLoading(true);
      const response = await getStudents(search);
      setStudents(response.data.students);
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to fetch students');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchStudents('');
  }, []);

  const handleSearch = (e) => {
    e.preventDefault();
    setCurrentPage(1); // Reset to first page on search
    fetchStudents(searchQuery);
  };

  const handleClearFilter = () => {
    setSearchQuery('');
    setCurrentPage(1); // Reset to first page on clear
    fetchStudents('');
  };

  const handlePageChange = (pageNumber) => {
    setCurrentPage(pageNumber);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

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
        <h2 className="text-3xl font-bold tracking-tight" style={{ color: 'var(--text-heading)' }}>
          Student Management
        </h2>
        <p className="mt-1 text-sm" style={{ color: 'var(--text-secondary)' }}>View and manage student records.</p>
      </div>

      {/* Search and Filter */}
      <div className="mb-6 rounded-2xl shadow-lg border p-6" style={{ backgroundColor: 'var(--card-white)', borderColor: 'var(--card-border)' }}>
        <form onSubmit={handleSearch} className="flex gap-2">
          <div className="flex-1 relative">
            <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
              <svg className="h-5 w-5" style={{ color: 'var(--text-secondary)' }} fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
              </svg>
            </div>
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search by name, email, or phone number..."
              className="w-full pl-10 pr-3 py-2 border rounded-lg focus:ring-2 focus:ring-gray-500 focus:border-gray-500"
              style={{ 
                borderColor: 'var(--card-border)', 
                backgroundColor: 'var(--background-light)', 
                color: 'var(--text-primary)' 
              }}
            />
          </div>
          <button
            type="submit"
            className="inline-flex items-center px-4 py-2 rounded-lg text-sm font-semibold text-white focus:outline-none focus:ring-2 focus:ring-offset-2 transition-all duration-300"
            style={{ backgroundColor: 'var(--primary-navy)' }}
          >
            Search
          </button>
          {searchQuery && (
            <button
              type="button"
              onClick={handleClearFilter}
              className="inline-flex items-center px-4 py-2 rounded-lg text-sm font-semibold border transition-all duration-300"
              style={{ 
                color: 'var(--text-primary)', 
                backgroundColor: 'var(--background-light)', 
                borderColor: 'var(--card-border)' 
              }}
            >
              Clear
            </button>
          )}
        </form>
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
        <div className="flex justify-center items-center py-16 rounded-xl shadow-lg" style={{ backgroundColor: 'var(--card-white)', backdropFilter: 'blur(8px)' }}>
          <div className="w-12 h-12 border-4 border-indigo-500 border-t-transparent rounded-full animate-spin"></div>
        </div>
      ) : (
        <div className="rounded-2xl shadow-lg border p-6" style={{ backgroundColor: 'var(--card-white)', borderColor: 'var(--card-border)' }}>
          <h3 className="text-lg font-semibold mb-4" style={{ color: 'var(--text-heading)' }}>
            Students ({students.length})
            {searchQuery && <span className="text-sm font-normal ml-2" style={{ color: 'var(--text-secondary)' }}>(filtered by "{searchQuery}")</span>}
          </h3>
          
          {students.length === 0 ? (
            <div className="text-center py-12">
              <svg
                className="mx-auto h-14 w-14"
                style={{ color: 'var(--text-secondary)' }}
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={1.5}
                  d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z"
                />
              </svg>
              <p className="mt-3 text-sm" style={{ color: 'var(--text-secondary)' }}>
                {searchQuery ? `No students found matching "${searchQuery}"` : 'No students available'}
              </p>
              {searchQuery && (
                <button
                  onClick={handleClearFilter}
                  className="mt-4 inline-flex items-center px-4 py-2 rounded-lg text-sm font-semibold border transition-all duration-300"
                  style={{ 
                    color: 'var(--text-primary)', 
                    backgroundColor: 'var(--background-light)', 
                    borderColor: 'var(--card-border)' 
                  }}
                >
                  Clear Search
                </button>
              )}
            </div>
          ) : (
            <>
            <div className="overflow-x-auto">
          <table className="min-w-full divide-y" style={{ borderColor: 'var(--card-border)' }}>
            <thead style={{ backgroundColor: 'var(--background-light)' }}>
              <tr>
                <th
                  scope="col"
                  className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider"
                  style={{ color: 'var(--text-secondary)' }}
                >
                  Name
                </th>
                <th
                  scope="col"
                  className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider"
                  style={{ color: 'var(--text-secondary)' }}
                >
                  Email
                </th>
                <th
                  scope="col"
                  className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider"
                  style={{ color: 'var(--text-secondary)' }}
                >
                  Phone
                </th>
                <th
                  scope="col"
                  className="px-6 py-3 text-right text-xs font-medium uppercase tracking-wider"
                  style={{ color: 'var(--text-secondary)' }}
                >
                  Actions
                </th>
              </tr>
            </thead>
            <tbody className="divide-y" style={{ borderColor: 'var(--card-border)' }}>
              {currentStudents.map((student) => (
                <tr key={student._id}>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="flex items-center">
                      <div className="flex-shrink-0 h-10 w-10 rounded-full flex items-center justify-center" style={{ backgroundColor: 'var(--background-light)', color: 'var(--text-primary)' }}>
                        <UserIcon className="h-5 w-5" />
                      </div>
                      <div className="ml-4">
                        <div className="text-sm font-medium" style={{ color: 'var(--text-primary)' }}>{student.name}</div>
                      </div>
                    </div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="flex items-center">
                      <EnvelopeIcon className="h-5 w-5 text-gray-400 mr-2" />
                      <div className="text-sm" style={{ color: 'var(--text-secondary)' }}>{student.email}</div>
                    </div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="flex items-center">
                      <PhoneIcon className="h-5 w-5 text-gray-400 mr-2" />
                      <div className="text-sm" style={{ color: 'var(--text-secondary)' }}>{student.number || 'N/A'}</div>
                    </div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                    <button 
                      onClick={() => handleEditClick(student)}
                      className="text-indigo-600 hover:text-indigo-900 mr-3 inline-flex items-center"
                    >
                      <PencilIcon className="h-4 w-4 mr-1" />
                      Edit
                    </button>
                    <button 
                      onClick={() => handleDeleteClick(student)}
                      className="text-red-600 hover:text-red-900 inline-flex items-center"
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

          {/* Pagination */}
          {students.length > itemsPerPage && (
            <div className="mt-6 flex items-center justify-between border-t pt-4" style={{ borderColor: 'var(--card-border)' }}>
              <div className="flex-1 flex justify-between sm:hidden">
                <button
                  onClick={() => handlePageChange(currentPage - 1)}
                  disabled={currentPage === 1}
                  className="relative inline-flex items-center px-4 py-2 border text-sm font-medium rounded-md disabled:opacity-50 disabled:cursor-not-allowed"
                  style={{ 
                    color: 'var(--text-primary)', 
                    backgroundColor: 'var(--background-light)', 
                    borderColor: 'var(--card-border)' 
                  }}
                >
                  Previous
                </button>
                <button
                  onClick={() => handlePageChange(currentPage + 1)}
                  disabled={currentPage === totalPages}
                  className="ml-3 relative inline-flex items-center px-4 py-2 border text-sm font-medium rounded-md disabled:opacity-50 disabled:cursor-not-allowed"
                  style={{ 
                    color: 'var(--text-primary)', 
                    backgroundColor: 'var(--background-light)', 
                    borderColor: 'var(--card-border)' 
                  }}
                >
                  Next
                </button>
              </div>
              <div className="hidden sm:flex-1 sm:flex sm:items-center sm:justify-between">
                <div>
                  <p className="text-sm" style={{ color: 'var(--text-secondary)' }}>
                    Showing <span className="font-medium">{indexOfFirstItem + 1}</span> to{' '}
                    <span className="font-medium">{Math.min(indexOfLastItem, students.length)}</span> of{' '}
                    <span className="font-medium">{students.length}</span> results
                  </p>
                </div>
                <div>
                  <nav className="relative z-0 inline-flex rounded-md shadow-sm -space-x-px" aria-label="Pagination">
                    <button
                      onClick={() => handlePageChange(currentPage - 1)}
                      disabled={currentPage === 1}
                      className="relative inline-flex items-center px-2 py-2 rounded-l-md border text-sm font-medium disabled:opacity-50 disabled:cursor-not-allowed"
                      style={{ 
                        color: 'var(--text-secondary)', 
                        backgroundColor: 'var(--background-light)', 
                        borderColor: 'var(--card-border)' 
                      }}
                    >
                      <span className="sr-only">Previous</span>
                      <svg className="h-5 w-5" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor">
                        <path fillRule="evenodd" d="M12.707 5.293a1 1 0 010 1.414L9.414 10l3.293 3.293a1 1 0 01-1.414 1.414l-4-4a1 1 0 010-1.414l4-4a1 1 0 011.414 0z" clipRule="evenodd" />
                      </svg>
                    </button>
                    
                    {[...Array(totalPages)].map((_, index) => {
                      const pageNumber = index + 1;
                      if (
                        pageNumber === 1 ||
                        pageNumber === totalPages ||
                        (pageNumber >= currentPage - 1 && pageNumber <= currentPage + 1)
                      ) {
                        return (
                          <button
                            key={pageNumber}
                            onClick={() => handlePageChange(pageNumber)}
                            className={`relative inline-flex items-center px-4 py-2 border text-sm font-medium ${
                              currentPage === pageNumber ? 'text-white' : ''
                            }`}
                            style={
                              currentPage === pageNumber
                                ? { backgroundColor: 'var(--primary-navy)', borderColor: 'var(--primary-navy)' }
                                : { color: 'var(--text-secondary)', backgroundColor: 'var(--background-light)', borderColor: 'var(--card-border)' }
                            }
                          >
                            {pageNumber}
                          </button>
                        );
                      } else if (
                        pageNumber === currentPage - 2 ||
                        pageNumber === currentPage + 2
                      ) {
                        return (
                          <span
                            key={pageNumber}
                            className="relative inline-flex items-center px-4 py-2 border text-sm font-medium"
                            style={{ 
                              color: 'var(--text-secondary)', 
                              backgroundColor: 'var(--background-light)', 
                              borderColor: 'var(--card-border)' 
                            }}
                          >
                            ...
                          </span>
                        );
                      }
                      return null;
                    })}
                    
                    <button
                      onClick={() => handlePageChange(currentPage + 1)}
                      disabled={currentPage === totalPages}
                      className="relative inline-flex items-center px-2 py-2 rounded-r-md border text-sm font-medium disabled:opacity-50 disabled:cursor-not-allowed"
                      style={{ 
                        color: 'var(--text-secondary)', 
                        backgroundColor: 'var(--background-light)', 
                        borderColor: 'var(--card-border)' 
                      }}
                    >
                      <span className="sr-only">Next</span>
                      <svg className="h-5 w-5" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor">
                        <path fillRule="evenodd" d="M7.293 14.707a1 1 0 010-1.414L10.586 10 7.293 6.707a1 1 0 011.414-1.414l4 4a1 1 0 010 1.414l-4 4a1 1 0 01-1.414 0z" clipRule="evenodd" />
                      </svg>
                    </button>
                  </nav>
                </div>
              </div>
            </div>
          )}
          </>
          )}
        </div>
      )}

      {/* Edit Modal */}
      {editModal.open && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="rounded-lg p-6 w-full max-w-md mx-4" style={{ backgroundColor: 'var(--card-white)' }}>
            <h3 className="text-lg font-semibold mb-4" style={{ color: 'var(--text-heading)' }}>Edit Student</h3>
            <form onSubmit={handleEditSubmit}>
              <div className="mb-4">
                <label className="block text-sm font-medium mb-2" style={{ color: 'var(--text-primary)' }}>
                  Name
                </label>
                <input
                  type="text"
                  value={editForm.name}
                  onChange={(e) => setEditForm({ ...editForm, name: e.target.value })}
                  className="w-full px-3 py-2 border rounded-md focus:outline-none focus:ring-2 focus:ring-gray-500"
                  style={{ backgroundColor: 'var(--background-light)', borderColor: 'var(--card-border)', color: 'var(--text-primary)' }}
                  required
                />
              </div>
              <div className="mb-4">
                <label className="block text-sm font-medium mb-2" style={{ color: 'var(--text-primary)' }}>
                  Email
                </label>
                <input
                  type="email"
                  value={editForm.email}
                  onChange={(e) => setEditForm({ ...editForm, email: e.target.value })}
                  className="w-full px-3 py-2 border rounded-md focus:outline-none focus:ring-2 focus:ring-gray-500"
                  style={{ backgroundColor: 'var(--background-light)', borderColor: 'var(--card-border)', color: 'var(--text-primary)' }}
                  required
                />
              </div>
              <div className="mb-6">
                <label className="block text-sm font-medium mb-2" style={{ color: 'var(--text-primary)' }}>
                  Phone Number
                </label>
                <input
                  type="text"
                  value={editForm.number}
                  onChange={(e) => setEditForm({ ...editForm, number: e.target.value })}
                  className="w-full px-3 py-2 border rounded-md focus:outline-none focus:ring-2 focus:ring-gray-500"
                  style={{ backgroundColor: 'var(--background-light)', borderColor: 'var(--card-border)', color: 'var(--text-primary)' }}
                />
              </div>
              <div className="flex justify-end space-x-3">
                <button
                  type="button"
                  onClick={() => setEditModal({ open: false, student: null })}
                  className="px-4 py-2 hover:opacity-80"
                  style={{ color: 'var(--text-secondary)' }}
                  disabled={processing}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 bg-gray-600 text-white rounded-md hover:bg-gray-700 disabled:opacity-50"
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
          <div className="rounded-lg p-6 w-full max-w-md mx-4" style={{ backgroundColor: 'var(--card-white)' }}>
            <h3 className="text-lg font-semibold mb-4 text-red-600">Delete Student</h3>
            <p className="mb-6" style={{ color: 'var(--text-secondary)' }}>
              Are you sure you want to delete <strong>{deleteModal.student?.name}</strong>? 
              This action cannot be undone and will remove the student from all classes.
            </p>
            <div className="flex justify-end space-x-3">
              <button
                onClick={() => setDeleteModal({ open: false, student: null })}
                className="px-4 py-2 hover:opacity-80"
                style={{ color: 'var(--text-secondary)' }}
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