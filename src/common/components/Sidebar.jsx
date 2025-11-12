import React, { useEffect, useState } from 'react';
import { NavLink, useLocation, useNavigate } from 'react-router-dom';
import { useSelector, useDispatch } from 'react-redux';
import { useSidebar } from '../context/SidebarContext';
import { fetchClasses } from './redux/classSlice';
import { getDraftCount } from '../services/api';

const Sidebar = () => {
  const { role, user } = useSelector((state) => state.auth);
  const { classes, status } = useSelector((state) => state.classes || { classes: [], status: 'idle' });
  const { isCollapsed, toggleSidebar } = useSidebar();
  const dispatch = useDispatch();
  const [draftCount, setDraftCount] = useState(0);
  
  // Fetch classes if not already loaded
  useEffect(() => {
    if (classes.length === 0 && status === 'idle') {
      console.log('[Sidebar] No classes loaded, fetching...');
      dispatch(fetchClasses(''));
    }
  }, [dispatch, classes.length, status]);
  
  // Fetch draft count for admin and teacher
  useEffect(() => {
    if (role === 'admin' || role === 'teacher') {
      const fetchDraftCount = async () => {
        try {
          const response = await getDraftCount();
          setDraftCount(response.data.count || 0);
        } catch (error) {
          console.error('Failed to fetch draft count:', error);
          setDraftCount(0);
        }
      };
      fetchDraftCount();
      // Refresh draft count every 30 seconds
      const interval = setInterval(fetchDraftCount, 30000);
      return () => clearInterval(interval);
    }
  }, [role]);
  
  // Debug Redux state
  console.log('[Sidebar] Redux state:', {
    classes: classes,
    status: status,
    classesLength: classes?.length,
    firstClass: classes?.[0] ? {
      id: classes[0]._id,
      name: classes[0].name,
      assignmentsCount: classes[0].assignments?.length,
      questionsCount: classes[0].questions?.length
    } : null
  });

  const location = useLocation();
  const navigate = useNavigate();
  const isClassView = role !== 'admin' && (location.pathname.startsWith('/student/classes/') || location.pathname.startsWith('/student/questions/'));
  
  // Force isClassView to true for students on question pages for debugging
  const forceClassView = role === 'student' && location.pathname.startsWith('/student/questions/');
  
  // Only hide navigation for student question submission pages, NOT for class view pages
  const shouldHideNavigation = role === 'student' && location.pathname.startsWith('/student/questions/');
  
  // Debug logging
  console.log('[Sidebar] Component state:', {
    role,
    pathname: location.pathname,
    isClassView,
    forceClassView,
    classesCount: classes?.length,
    classes: classes?.map(c => ({ id: c._id, name: c.name, assignmentsCount: c.assignments?.length })),
    isCollapsed
  });

  const adminLinks = [
    { to: '/admin', label: 'Dashboard', icon: 'M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6' },
    { to: '/admin/classes', label: 'Classes', icon: 'M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253' },
    { to: '/admin/teachers', label: 'Teachers', icon: 'M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z' },
    { to: '/admin/students', label: 'Students', icon: 'M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z' },
    { to: '/admin/upload', label: 'Data Import', icon: 'M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12' },
    { to: '/admin/questions', label: 'Question Bank', icon: 'M8.228 9c.549-1.165 2.03-2 3.772-2 2.21 0 4 1.343 4 3 0 1.4-1.278 2.575-3.006 2.907-.542.104-.994.54-.994 1.093m0 3h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z' },
    { to: '/admin/questions/drafts', label: 'Drafts', icon: 'M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z', badge: draftCount > 0 ? draftCount : null },
  ];

  const teacherLinks = [
    { to: '/teacher', label: 'Dashboard', icon: 'M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6' },
    { to: '/teacher/classes', label: 'My Classes', icon: 'M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253' },
    { to: '/teacher/take-class', label: 'Take Class', icon: 'M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z' },
    { to: '/teacher/questions', label: 'Questions', icon: 'M8.228 9c.549-1.165 2.03-2 3.772-2 2.21 0 4 1.343 4 3 0 1.4-1.278 2.575-3.006 2.907-.542.104-.994.54-.994 1.093m0 3h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z' },
    { to: '/teacher/questions/drafts', label: 'Drafts', icon: 'M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z', badge: draftCount > 0 ? draftCount : null },
  ];

  const studentLinks = [
    { to: '/student', label: 'Dashboard', icon: 'M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6' },
  ];

  // TEMPORARY: Default to student links for UI development
  const links = role === 'admin' ? adminLinks : 
                role === 'teacher' ? teacherLinks : 
                studentLinks; // Default to student links

  // Don't return null - we'll show contextual content for teacher class pages

  return (
    <>
      {/* Mobile overlay - shown when sidebar is open on mobile */}
      {!isCollapsed && (
        <div 
          className="fixed inset-0 bg-black bg-opacity-50 z-30 md:hidden"
          onClick={toggleSidebar}
        />
      )}
      
      {/* Sidebar */}
      <aside className={`fixed md:relative inset-y-0 left-0 z-40 md:z-auto flex flex-shrink-0 transition-transform duration-300 ease-in-out ${
        isCollapsed ? '-translate-x-full md:translate-x-0' : 'translate-x-0'
      }`}>
        <div 
          className={`flex flex-col h-full shadow-2xl transition-all duration-300 ease-in-out w-full md:w-auto`}
          style={{ 
            maxWidth: isCollapsed ? '80px' : '288px',
            background: 'linear-gradient(180deg, var(--primary-navy) 0%, #1a252f 100%)',
            borderRight: '1px solid rgba(255, 255, 255, 0.1)'
          }}
        >
        {/* Sidebar Header with Collapse Button */}
        {!isCollapsed && (
          <div className="flex-shrink-0 p-4 border-b flex items-center justify-between" style={{ borderColor: 'rgba(255, 255, 255, 0.1)' }}>
            <h2 className="text-lg font-semibold text-white">Navigation</h2>
            <button
              onClick={toggleSidebar}
              className="p-1.5 rounded-lg text-gray-300 hover:text-white hover:bg-white hover:bg-opacity-10 transition-all duration-300"
              title="Collapse Sidebar"
            >
              <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 19l-7-7 7-7m8 14l-7-7 7-7" />
              </svg>
            </button>
          </div>
        )}

        {/* Collapsed Expand Button */}
        {isCollapsed && (
          <div className="flex-shrink-0 p-4 flex justify-center">
            <button
              onClick={toggleSidebar}
              className="p-1.5 rounded-lg text-gray-300 hover:text-white hover:bg-white hover:bg-opacity-10 transition-all duration-300"
              title="Expand Sidebar"
            >
              <svg className="h-5 w-5 transform rotate-180" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 19l-7-7 7-7m8 14l-7-7 7-7" />
              </svg>
            </button>
          </div>
        )}

        {/* Sidebar content */}
        <div className="flex flex-col flex-grow overflow-y-auto" style={{ padding: isCollapsed ? '16px 8px' : '24px 16px' }}>
          {/* Navigation - show icons when collapsed, full links when expanded */}
          <nav className="space-y-1 mb-6">
              {links.map((link) => (
                <NavLink
                  key={link.to}
                  to={link.to}
                  end={link.to === '/admin' || link.to === '/teacher' || link.to === '/student'}
                  className={({ isActive }) =>
                    `group flex items-center rounded-lg transition-all duration-300 ease-in-out ${
                      isActive
                        ? 'text-white shadow-lg'
                        : 'text-gray-300 hover:text-white'
                    }`
                  }
                  style={({ isActive }) => ({
                    backgroundColor: isActive ? 'var(--accent-indigo)' : 'transparent',
                    boxShadow: isActive ? '0 4px 12px rgba(99, 102, 241, 0.4)' : 'none',
                    transform: isActive ? 'translateX(4px)' : 'translateX(0)',
                    borderLeft: isActive ? '4px solid rgba(255, 255, 255, 0.8)' : '4px solid transparent',
                    fontSize: '14px',
                    fontWeight: isActive ? '600' : '500',
                    padding: isCollapsed ? '12px' : '12px 16px',
                    justifyContent: isCollapsed ? 'center' : 'flex-start',
                    position: 'relative'
                  })}
                  onMouseEnter={(e) => {
                    const isActive = e.currentTarget.getAttribute('aria-current') === 'page';
                    if (!isActive) {
                      e.currentTarget.style.backgroundColor = 'rgba(99, 102, 241, 0.15)';
                      e.currentTarget.style.borderLeft = '4px solid rgba(99, 102, 241, 0.5)';
                      e.currentTarget.style.transform = 'translateX(4px)';
                    }
                  }}
                  onMouseLeave={(e) => {
                    const isActive = e.currentTarget.getAttribute('aria-current') === 'page';
                    if (!isActive) {
                      e.currentTarget.style.backgroundColor = 'transparent';
                      e.currentTarget.style.borderLeft = '4px solid transparent';
                      e.currentTarget.style.transform = 'translateX(0)';
                    }
                  }}
                  title={isCollapsed ? link.label : undefined}
                >
                  {({ isActive }) => (
                    <>
                      <svg 
                        className={`flex-shrink-0 transition-all duration-300 ${
                          isActive ? 'text-white' : 'text-gray-400 group-hover:text-white'
                        }`}
                        style={{
                          filter: isActive ? 'drop-shadow(0 0 8px rgba(255, 255, 255, 0.5))' : 'none',
                          width: '24px',
                          height: '24px',
                          marginRight: isCollapsed ? '0' : '12px'
                        }}
                        xmlns="http://www.w3.org/2000/svg" 
                        fill="none" 
                        viewBox="0 0 24 24" 
                        stroke="currentColor"
                      >
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d={link.icon} />
                      </svg>
                      {!isCollapsed && (
                        <span className="transition-all duration-300 flex-1 flex items-center justify-between">
                          {link.label}
                          {link.badge !== null && link.badge !== undefined && link.badge > 0 && (
                            <span className="ml-2 px-2 py-0.5 text-xs font-bold rounded-full bg-red-500 text-white flex-shrink-0">
                              {link.badge}
                            </span>
                          )}
                        </span>
                      )}
                      {isCollapsed && link.badge !== null && link.badge !== undefined && link.badge > 0 && (
                        <span className="absolute -top-1 -right-1 px-1.5 py-0.5 text-xs font-bold rounded-full bg-red-500 text-white flex-shrink-0 min-w-[20px] text-center">
                          {link.badge > 9 ? '9+' : link.badge}
                        </span>
                      )}
                    </>
                  )}
                </NavLink>
              ))}
          </nav>

          {/* Contextual questions list for student question submission pages */}
          {role === 'student' && location.pathname.startsWith('/student/questions/') && !isCollapsed && (
            (() => {
              console.log('[Sidebar] Rendering assignments section:', {
                isClassView,
                isCollapsed,
                pathname: location.pathname,
                classesCount: classes?.length,
                classes: classes?.map(c => ({ id: c._id, name: c.name }))
              });
              
              // Get classId from either class view or question submission page
              let classId = null;
              let cls = null;
              
              // Try to get classId from class view path
              const classMatch = location.pathname.match(/\/student\/classes\/(?<id>[^/]+)/);
              if (classMatch) {
                classId = classMatch.groups.id;
                cls = classes?.find?.((c) => c._id === classId);
                console.log('[Sidebar] Found class from path:', { classId, cls: cls?.name });
              }
              
              // If not found, try to get classId from question submission page URL query
              if (!cls && location.pathname.startsWith('/student/questions/')) {
                const searchParams = new URLSearchParams(location.search);
                const urlClassId = searchParams.get('classId');
                console.log('[Sidebar] Looking for classId in URL query:', { urlClassId });
                if (urlClassId) {
                  cls = classes?.find?.((c) => c._id === urlClassId);
                  classId = urlClassId;
                  console.log('[Sidebar] Found class from URL query:', { classId, cls: cls?.name });
                }
              }
              
              console.log('[Sidebar] Final class data:', { classId, cls: cls?.name, hasAssignments: !!cls?.assignments });
              
              if (!cls) {
                console.log('[Sidebar] No class found, not showing assignments');
                return null;
              }
              
              // Show loading state if classes are still being fetched
              if (status === 'loading') {
                return (
                  <div className="mt-4">
                    <div className="p-3 bg-white/5 rounded-lg">
                      <p className="text-sm text-gray-300">Loading assignments...</p>
                    </div>
                  </div>
                );
              }
              
              // If no assignments, show a message
              if (!cls.assignments || cls.assignments.length === 0) {
                return (
                  <div className="mt-4">
                    <div className="p-3 bg-white/5 rounded-lg">
                      <p className="text-sm text-gray-300">No assignments available</p>
                    </div>
                  </div>
                );
              }
              
              // Check if we're on a question submission page to highlight the active question
              const questionMatch = location.pathname.match(/\/student\/questions\/(?<questionId>[^/]+)\/submit/);
              const activeQ = questionMatch?.groups?.questionId;
              
              console.log('[Sidebar] Rendering assignments list:', {
                assignmentsCount: cls.assignments?.length,
                questionsCount: cls.questions?.length,
                activeQ,
                assignments: cls.assignments?.map(a => ({
                  id: a._id,
                  questionId: a.questionId?._id || a.questionId,
                  title: cls.questions.find(q => q._id === (a.questionId?._id || a.questionId))?.title
                }))
              });
              
              return (
                <>
                  {/* Divider */}
                  <div className="border-t my-4" style={{ borderColor: 'rgba(255, 255, 255, 0.1)' }}></div>
                  
                  {/* Class Name Header */}
                  <div className="mb-3">
                    <p className="text-xs uppercase tracking-wide font-semibold" style={{ color: 'rgba(255, 255, 255, 0.6)' }}>
                      {cls.name}
                    </p>
                  </div>
                  
                  {/* Assignments List */}
                  <div className="space-y-2 max-h-[60vh] overflow-auto">
                    {cls.assignments?.map?.((a, idx) => {
                      const qid = a.questionId?._id || a.questionId;
                      const question = cls.questions.find((q) => q._id === qid);
                      const title = question?.title || 'Untitled';
                      const type = question?.type || 'Question';
                      
                      console.log('[Sidebar] Rendering assignment:', { idx, qid, title, type, isActive: activeQ === String(qid) });
                      
                      const isActiveQuestion = activeQ === String(qid);
                      
                      return (
                        <button
                          key={a._id || qid}
                          onClick={() => navigate(`/student/questions/${qid}/submit?classId=${classId}`)}
                          className={`w-full flex items-start gap-3 px-3 py-3 text-left transition-all duration-300 cursor-pointer rounded-lg ${
                            isActiveQuestion
                              ? 'text-white shadow-lg' 
                              : 'text-gray-300 hover:text-white'
                          }`}
                          style={{
                            backgroundColor: isActiveQuestion ? 'var(--accent-indigo)' : 'transparent',
                            boxShadow: isActiveQuestion ? '0 4px 12px rgba(99, 102, 241, 0.4)' : 'none',
                            transform: isActiveQuestion ? 'translateX(4px)' : 'translateX(0)',
                            borderLeft: isActiveQuestion ? '4px solid rgba(255, 255, 255, 0.8)' : '4px solid transparent',
                            fontWeight: isActiveQuestion ? '600' : '500'
                          }}
                          onMouseEnter={(e) => {
                            if (!isActiveQuestion) {
                              e.currentTarget.style.backgroundColor = 'rgba(99, 102, 241, 0.15)';
                              e.currentTarget.style.borderLeft = '4px solid rgba(99, 102, 241, 0.5)';
                              e.currentTarget.style.transform = 'translateX(4px)';
                            }
                          }}
                          onMouseLeave={(e) => {
                            if (!isActiveQuestion) {
                              e.currentTarget.style.backgroundColor = 'transparent';
                              e.currentTarget.style.borderLeft = '4px solid transparent';
                              e.currentTarget.style.transform = 'translateX(0)';
                            }
                          }}
                        >
                          <span 
                            className={`flex h-7 w-7 items-center justify-center rounded-full text-sm font-bold flex-shrink-0 mt-0.5 transition-all duration-300 ${
                              isActiveQuestion ? 'bg-white text-indigo-600' : 'bg-gray-600 text-white'
                            }`}
                          >
                            {idx + 1}
                          </span>
                          <div className="min-w-0 flex-1">
                            <p className="text-sm font-medium leading-tight">{title}</p>
                            <p className={`text-xs mt-1 font-mono transition-colors duration-300 ${
                              isActiveQuestion ? 'text-indigo-200' : 'text-gray-400'
                            }`}>
                              {String(type).toUpperCase()}
                            </p>
                          </div>
                        </button>
                      );
                    })}
                  </div>
                </>
              );
            })()
          )}
        </div>
      </div>
    </aside>
    </>
  );
};

export default Sidebar;