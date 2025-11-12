import React, { useState, useEffect } from 'react';
import { getTeachers, manageTeacherPermission } from '../../../common/services/api';
import { ShieldCheckIcon } from '@heroicons/react/24/outline';

const TeacherManagement = () => {
  const [teachers, setTeachers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage] = useState(10);

  // Calculate pagination
  const indexOfLastItem = currentPage * itemsPerPage;
  const indexOfFirstItem = indexOfLastItem - itemsPerPage;
  const currentTeachers = teachers.slice(indexOfFirstItem, indexOfLastItem);
  const totalPages = Math.ceil(teachers.length / itemsPerPage);

  const fetchTeachers = async (search = '') => {
    try {
      setLoading(true);
      const response = await getTeachers(search);
      setTeachers(response.data.teachers);
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to fetch teachers');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchTeachers('');
  }, []);

  const handleSearch = (e) => {
    e.preventDefault();
    setCurrentPage(1); // Reset to first page on search
    fetchTeachers(searchQuery);
  };

  const handleClearFilter = () => {
    setSearchQuery('');
    setCurrentPage(1); // Reset to first page on clear
    fetchTeachers('');
  };

  const handlePageChange = (pageNumber) => {
    setCurrentPage(pageNumber);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handlePermissionToggle = async (teacherId, canCreateQuestion) => {
    try {
      await manageTeacherPermission(teacherId, canCreateQuestion);
      setTeachers(teachers.map((t) =>
        t._id === teacherId ? { ...t, canCreateQuestion } : t
      ));
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to update permission');
    }
  };

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      <div className="mb-10">
        <h2 className="text-3xl font-bold tracking-tight mb-2" style={{ color: 'var(--text-heading)' }}>
          Teacher Management
        </h2>
        <p className="mt-1 text-sm mb-8" style={{ color: 'var(--text-secondary)' }}>Manage teacher permissions and records.</p>
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
              placeholder="Search by teacher name or email..."
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

      {loading ? (
        <div className="flex justify-center items-center py-16 rounded-xl shadow-lg" style={{ backgroundColor: 'var(--card-white)', backdropFilter: 'blur(8px)' }}>
          <div className="w-12 h-12 border-4 border-indigo-500 border-t-transparent rounded-full animate-spin"></div>
        </div>
      ) : error ? (
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
        </div>
      ) : (
        <div className="rounded-2xl shadow-lg border p-6" style={{ backgroundColor: 'var(--card-white)', borderColor: 'var(--card-border)' }}>
          <h3 className="text-lg font-semibold mb-4" style={{ color: 'var(--text-heading)' }}>
            Teachers ({teachers.length})
            {searchQuery && <span className="text-sm font-normal ml-2" style={{ color: 'var(--text-secondary)' }}>(filtered by "{searchQuery}")</span>}
          </h3>
          
          {teachers.length === 0 ? (
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
                  d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z"
                />
              </svg>
              <p className="mt-3 text-sm" style={{ color: 'var(--text-secondary)' }}>
                {searchQuery ? `No teachers found matching "${searchQuery}"` : 'No teachers available'}
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
                  Teacher
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
                  Permissions
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
              {currentTeachers.map((teacher) => (
                <tr key={teacher._id}>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="flex items-center">
                      <div className="flex-shrink-0 h-10 w-10 rounded-full flex items-center justify-center" style={{ backgroundColor: 'var(--background-light)', color: 'var(--text-primary)' }}>
                        <svg className="w-6 h-6" fill="currentColor" viewBox="0 0 24 24">
                          <path d="M12 12c2.21 0 4-1.79 4-4s-1.79-4-4-4-4 1.79-4 4 1.79 4 4 4zm0 2c-2.67 0-8 1.34-8 4v2h16v-2c0-2.66-5.33-4-8-4z"/>
                        </svg>
                      </div>
                      <div className="ml-4">
                        <div className="text-sm font-medium" style={{ color: 'var(--text-primary)' }}>{teacher.name}</div>
                      </div>
                    </div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm" style={{ color: 'var(--text-secondary)' }}>
                    {teacher.email}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="flex items-center">
                      <ShieldCheckIcon
                        className={`h-5 w-5 mr-2 ${
                          teacher.canCreateQuestion ? 'text-green-500' : 'text-gray-400'
                        }`}
                      />
                      <span
                        className={`px-2 inline-flex text-xs leading-5 font-semibold rounded-full ${
                          teacher.canCreateQuestion
                            ? 'bg-green-100 text-green-800'
                            : 'bg-gray-100 text-gray-800'
                        }`}
                      >
                        {teacher.canCreateQuestion ? 'Can create questions' : 'Cannot create questions'}
                      </span>
                    </div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                    <label className="inline-flex items-center cursor-pointer">
                      <input
                        type="checkbox"
                        checked={teacher.canCreateQuestion}
                        onChange={(e) => handlePermissionToggle(teacher._id, e.target.checked)}
                        className="sr-only peer"
                      />
                      <div className="relative w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-indigo-300 rounded-full peer peer-checked:after:translate-x-full rtl:peer-checked:after:-translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:start-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-indigo-600"></div>
                    </label>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          </div>

          {/* Pagination */}
          {teachers.length > itemsPerPage && (
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
                    <span className="font-medium">{Math.min(indexOfLastItem, teachers.length)}</span> of{' '}
                    <span className="font-medium">{teachers.length}</span> results
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
                      // Show first page, last page, current page, and pages around current
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
    </div>
  );
};

export default TeacherManagement;