import React, { useEffect, useState, useMemo } from 'react';
import { useSelector, useDispatch } from 'react-redux';
import { fetchClasses } from '../../../common/components/redux/classSlice';
import { Link } from 'react-router-dom';
import { DiJavascript } from "react-icons/di";
import { FaJava, FaPython, FaDatabase, FaBookOpen } from "react-icons/fa";
import { GiNotebook } from "react-icons/gi";
import { MdDataObject, MdDataArray } from "react-icons/md";
import { MagnifyingGlassIcon } from '@heroicons/react/24/outline';

const TeacherClassManagement = () => {
  const dispatch = useDispatch();
  const { classes, status, error } = useSelector((state) => state.classes);
  const { user } = useSelector((state) => state.auth);
  const [searchQuery, setSearchQuery] = useState('');
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage, setItemsPerPage] = useState(12);

  useEffect(() => {
    if (status === 'idle' && user) {
      console.log('%c[TeacherDashboard] Dispatching fetchClasses', 'color: orange;');
      dispatch(fetchClasses(''));
    }
  }, [status, dispatch, user]);

  // Reset to page 1 when search changes
  useEffect(() => {
    setCurrentPage(1);
  }, [searchQuery]);

  if (!user) {
    return (
      <div className="p-6">
        <p className="text-red-700 font-semibold text-center">You must be logged in to view this page.</p>
      </div>
    );
  }

  const myClasses = classes.filter(
    (cls) => cls.teachers.some((t) => t._id === user.id) || cls.createdBy._id === user.id
  );

  // Filter classes based on search query
  const filteredClasses = useMemo(() => {
    if (!searchQuery.trim()) {
      return myClasses;
    }
    const query = searchQuery.toLowerCase();
    return myClasses.filter((cls) => {
      const nameMatch = cls.name?.toLowerCase().includes(query);
      const descMatch = cls.description?.toLowerCase().includes(query);
      return nameMatch || descMatch;
    });
  }, [myClasses, searchQuery]);

  // Pagination calculations
  const totalPages = Math.ceil(filteredClasses.length / itemsPerPage);
  const startIndex = (currentPage - 1) * itemsPerPage;
  const endIndex = startIndex + itemsPerPage;
  const paginatedClasses = filteredClasses.slice(startIndex, endIndex);
  // Function to get appropriate icon and color based on class name
  const getClassIconAndColor = (className) => {
    const lowerName = className.toLowerCase();
    
    if (lowerName.includes('javascript') || lowerName.includes('js') || lowerName.includes('web development')) {
      return { icon: <DiJavascript className="w-6 h-6" style={{ color: 'var(--text-primary)' }} />, color: 'var(--python-blue)' };
    } else if (
      lowerName.includes('java') ||
      lowerName.includes('object-oriented programming') ||
      lowerName.includes('oop') ||
      lowerName.includes('object-oriented prog')
    ) {
      return { icon: <FaJava className="w-6 h-6" style={{ color: 'var(--text-primary)' }} />, color: 'var(--oop-amber)' };
    } else if (lowerName.includes('software engineering') || lowerName.includes('engineering')) {
      return { icon: <GiNotebook className="w-6 h-6" style={{ color: 'var(--text-primary)' }} />, color: 'var(--software-cyan)' };
    } else if (lowerName.includes('python') || lowerName.includes('introduction to progra')) {
      return { icon: <FaPython className="w-6 h-6" style={{ color: 'var(--text-primary)' }} />, color: 'var(--python-blue)' };
    } else if (lowerName.includes('database')) {
      return { icon: <FaDatabase className="w-6 h-6" style={{ color: 'var(--text-primary)' }} />, color: 'var(--database-violet)' };
    } else if (lowerName.includes('competitive programming')) {
      return { icon: <MdDataObject className="w-6 h-6" style={{ color: 'var(--text-primary)' }} />, color: 'var(--competition-red)' };
    } else if (lowerName.includes('data structure') || lowerName.includes('datastructure')) {
      return { icon: <MdDataArray className="w-6 h-6" style={{ color: 'var(--text-primary)' }} />, color: 'var(--data-emerald)' };
    } else if (lowerName.includes('demo')) {
      return { icon: <FaBookOpen className="w-6 h-6" style={{ color: 'var(--text-primary)' }} />, color: 'var(--python-blue)' };
    } else if (lowerName.includes('algorithm')) {
      return { icon: <MdDataObject className="w-6 h-6" style={{ color: 'var(--text-primary)' }} />, color: 'var(--competition-red)' };
    } else {
      // Default book icon for other classes
      return { 
        icon: <svg className="w-6 h-6" style={{ color: 'var(--text-primary)' }} fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" />
        </svg>, 
        color: 'var(--python-blue)' 
      };
    }
  };
  console.log('%c[TeacherDashboard]', 'color: blue;');
  console.log('User:', user);
  console.log('Classes:', classes);
  console.log('My Classes:', myClasses);
  console.log('Status:', status);
  console.log('Error:', error);
  return (
    <div className="p-3 pt-6">
      <div className="mb-6">
        <h2 className="tracking-tight" style={{ 
          color: 'var(--text-heading)', 
          fontSize: '28px', 
          fontWeight: '700',
          fontFamily: "-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Oxygen, Ubuntu, Cantarell, sans-serif"
        }}>
          Class Management
        </h2>
      </div>
      {status === 'loading' && (
        <div className="flex justify-center items-center py-12 backdrop-blur-sm rounded-xl shadow-lg" style={{ backgroundColor: 'var(--background-light)' }}>
          <div className="w-12 h-12 border-4 border-t-transparent rounded-full animate-spin" style={{ borderColor: 'var(--python-blue)', borderTopColor: 'transparent' }}></div>
        </div>
      )}
      {error && (
        <div className="flex items-center p-4 mb-4 bg-red-50/80 backdrop-blur-sm rounded-xl shadow-sm border border-red-200">
          <svg className="h-6 w-6 text-red-500 mr-3" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor">
            <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
          </svg>
          <div>
            <h3 className="text-sm font-semibold text-red-800">Error loading classes</h3>
            <p className="mt-1 text-sm text-red-700">{error}</p>
          </div>
        </div>
      )}
      {status === 'succeeded' && myClasses.length === 0 && (
        <div className="text-center py-12 backdrop-blur-sm rounded-2xl shadow-lg border" style={{ backgroundColor: 'var(--background-light)', borderColor: 'var(--card-border)' }}>
          <svg className="mx-auto h-14 w-14" style={{ color: 'var(--text-secondary)' }} fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9.172 16.172a4 4 0 015.656 0M9 10h.01M15 10h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
          <h3 className="mt-3 text-lg font-semibold" style={{ color: 'var(--text-primary)' }}>No classes found</h3>
          <p className="mt-1 text-sm" style={{ color: 'var(--text-secondary)' }}>You haven't been assigned to any classes yet.</p>
        </div>
      )}
      {status === 'succeeded' && myClasses.length > 0 && (
        <>
          {/* Search and Controls */}
          <div className="mb-6 space-y-4">
            {/* Search Input */}
            <div className="relative">
              <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                <MagnifyingGlassIcon className="h-5 w-5" style={{ color: 'var(--text-secondary)' }} />
              </div>
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search classes by name or description..."
                className="w-full pl-10 pr-4 py-3 rounded-xl border focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 transition-all"
                style={{ 
                  backgroundColor: 'var(--card-white)', 
                  borderColor: 'var(--card-border)',
                  color: 'var(--text-primary)'
                }}
              />
            </div>

            {/* Results Count and Items Per Page */}
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
              <div className="text-sm" style={{ color: 'var(--text-secondary)' }}>
                Showing {filteredClasses.length === 0 ? 0 : startIndex + 1} to {Math.min(endIndex, filteredClasses.length)} of {filteredClasses.length} classes
                {searchQuery && ` (filtered from ${myClasses.length} total)`}
              </div>
              <div className="flex items-center gap-2">
                <label className="text-sm" style={{ color: 'var(--text-secondary)' }}>
                  Items per page:
                </label>
                <select
                  value={itemsPerPage}
                  onChange={(e) => {
                    setItemsPerPage(Number(e.target.value));
                    setCurrentPage(1);
                  }}
                  className="px-3 py-1.5 rounded-lg border focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 text-sm"
                  style={{ 
                    backgroundColor: 'var(--card-white)', 
                    borderColor: 'var(--card-border)',
                    color: 'var(--text-primary)'
                  }}
                >
                  <option value={6}>6</option>
                  <option value={12}>12</option>
                  <option value={18}>18</option>
                  <option value={24}>24</option>
                  <option value={36}>36</option>
                </select>
              </div>
            </div>
          </div>

          {/* No Results Message */}
          {filteredClasses.length === 0 && searchQuery && (
            <div className="text-center py-12 backdrop-blur-sm rounded-2xl shadow-lg border" style={{ backgroundColor: 'var(--background-light)', borderColor: 'var(--card-border)' }}>
              <MagnifyingGlassIcon className="mx-auto h-14 w-14 mb-4" style={{ color: 'var(--text-secondary)' }} />
              <h3 className="mt-3 text-lg font-semibold" style={{ color: 'var(--text-primary)' }}>No classes found</h3>
              <p className="mt-1 text-sm" style={{ color: 'var(--text-secondary)' }}>
                No classes match "{searchQuery}". Try a different search term.
              </p>
              <button
                onClick={() => setSearchQuery('')}
                className="mt-4 px-4 py-2 rounded-lg text-sm font-medium transition-colors"
                style={{ 
                  backgroundColor: 'var(--accent-indigo)', 
                  color: 'white' 
                }}
              >
                Clear Search
              </button>
            </div>
          )}

          {/* Classes Grid */}
          {filteredClasses.length > 0 && (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-2 mb-6">
              {paginatedClasses.map((cls) => (
            <Link
              key={cls._id}
              to={`/teacher/classes/${cls._id}`}
              className="rounded-xl shadow-md border overflow-hidden transition-all duration-300 hover:shadow-lg hover:-translate-y-1 hover:scale-[1.01]"
              style={{ backgroundColor: 'var(--background-light)', borderColor: 'var(--card-border)' }}
            >
              <div className="p-3">
                <div className="flex items-center">
                  {(() => {
                    const { icon, color } = getClassIconAndColor(cls.name);
                    return (
                      <div className="flex-shrink-0 rounded-lg p-2.5 shadow-sm" style={{ backgroundColor: 'var(--background-light)' }}>
                        {icon}
                      </div>
                    );
                  })()}
                  <div className="ml-3 w-0 flex-1">
                    <h3 className="truncate" style={{ color: 'var(--text-primary)', fontSize: '18px', fontWeight: '700' }}>{cls.name}</h3>
                    <p className="text-sm mt-0.5" style={{ color: 'var(--text-primary)' }}>{cls.students?.length || 0} students</p>
                  </div>
                </div>
                <div className="mt-1.5">
                  <p className="line-clamp-2" style={{ color: 'var(--text-primary)', fontSize: '14px', fontWeight: '400' }}>{cls.description}</p>
                </div>
                <div className="mt-1.5 flex justify-between items-center">
                  <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-semibold" style={{ backgroundColor: 'var(--badge-slate)', color: 'var(--text-primary)' }}>
                    {cls.questions?.length || 0} questions
                  </span>
                  <span style={{ color: 'var(--text-primary)', fontSize: '12px', fontWeight: '400' }}>Created by {cls.createdBy?.name || 'Unknown'}</span>
                </div>
              </div>
            </Link>
              ))}
            </div>
          )}

          {/* Pagination */}
          {totalPages > 1 && (
            <div className="flex flex-col sm:flex-row justify-between items-center gap-4 mt-6 pt-6 border-t" style={{ borderColor: 'var(--card-border)' }}>
              <div className="text-sm" style={{ color: 'var(--text-secondary)' }}>
                Page {currentPage} of {totalPages}
              </div>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => setCurrentPage(prev => Math.max(1, prev - 1))}
                  disabled={currentPage === 1}
                  className="px-4 py-2 rounded-lg text-sm font-medium transition-all hover:shadow-md disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:shadow-none"
                  style={{ 
                    backgroundColor: currentPage === 1 ? '#f3f4f6' : '#4f46e5', 
                    color: currentPage === 1 ? '#6b7280' : '#ffffff',
                    border: currentPage === 1 ? '1px solid #e5e7eb' : '1px solid #4f46e5'
                  }}
                >
                  Previous
                </button>
                
                {/* Page Numbers */}
                <div className="flex items-center gap-1">
                  {Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
                    let pageNum;
                    if (totalPages <= 5) {
                      pageNum = i + 1;
                    } else if (currentPage <= 3) {
                      pageNum = i + 1;
                    } else if (currentPage >= totalPages - 2) {
                      pageNum = totalPages - 4 + i;
                    } else {
                      pageNum = currentPage - 2 + i;
                    }
                    
                    const isActive = currentPage === pageNum;
                    return (
                      <button
                        key={pageNum}
                        onClick={() => setCurrentPage(pageNum)}
                        className="w-10 h-10 rounded-lg text-sm font-semibold transition-all hover:shadow-md"
                        style={{ 
                          backgroundColor: isActive ? '#4f46e5' : '#ffffff', 
                          color: isActive ? '#ffffff' : '#1f2937',
                          border: `1px solid ${isActive ? '#4f46e5' : '#d1d5db'}`,
                          boxShadow: isActive ? '0 1px 3px 0 rgba(79, 70, 229, 0.3)' : 'none'
                        }}
                      >
                        {pageNum}
                      </button>
                    );
                  })}
                </div>

                <button
                  onClick={() => setCurrentPage(prev => Math.min(totalPages, prev + 1))}
                  disabled={currentPage === totalPages}
                  className="px-4 py-2 rounded-lg text-sm font-medium transition-all hover:shadow-md disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:shadow-none"
                  style={{ 
                    backgroundColor: currentPage === totalPages ? '#f3f4f6' : '#4f46e5', 
                    color: currentPage === totalPages ? '#6b7280' : '#ffffff',
                    border: currentPage === totalPages ? '1px solid #e5e7eb' : '1px solid #4f46e5'
                  }}
                >
                  Next
                </button>
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
};

export default TeacherClassManagement;