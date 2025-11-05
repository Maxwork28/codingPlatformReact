import React, { useEffect, useRef, useState } from 'react';
import { useSelector, useDispatch } from 'react-redux';
import { useNavigate, useLocation } from 'react-router-dom';
import { logout } from '../components/redux/authSlice';
import { useSidebar } from '../context/SidebarContext';
import { useTheme } from '../context/ThemeContext';
import ThemeToggle from './ThemeToggle';

const Navbar = () => {
  const dispatch = useDispatch();
  const navigate = useNavigate();
  const location = useLocation();
  const { user } = useSelector((state) => state.auth);
  const { isCollapsed, toggleSidebar } = useSidebar();
  const { isDark } = useTheme();
  const [menuOpen, setMenuOpen] = useState(false);
  const menuRef = useRef(null);
  
  // Debug: Log user data
  console.log('Navbar: Current user data:', user);
  console.log('Navbar: User name:', user?.name);
  console.log('Navbar: User email:', user?.email);
  console.log('Navbar: User role:', user?.role);

  const handleLogout = () => {
    dispatch(logout());
    navigate('/login');
  };

  // Detect classId from teacher routes to enable Details
  let activeClassId = null;
  try {
    const parts = location.pathname.split('/').filter(Boolean);
    const idx = parts.indexOf('classes');
    if (idx !== -1 && parts[idx + 1]) activeClassId = parts[idx + 1];
  } catch (e) {
    activeClassId = null;
  }

  // Get first available class for fallback navigation
  const { classes } = useSelector((state) => state.classes);
  const firstClass = classes && classes.length > 0 ? classes[0] : null;

  // Close menu on outside click
  useEffect(() => {
    const onClickOutside = (e) => {
      if (menuRef.current && !menuRef.current.contains(e.target)) {
        setMenuOpen(false);
      }
    };
    document.addEventListener('mousedown', onClickOutside);
    return () => document.removeEventListener('mousedown', onClickOutside);
  }, []);

  return (
    <nav className="shadow-sm border-b sticky top-0 z-50 transition-all duration-300" 
         style={{ 
           backgroundColor: 'var(--primary-navy)',
           borderColor: 'var(--card-border)'
         }}>
      <div className="max-w-7xl mx-auto pl-0 pr-4 sm:pr-6 lg:pr-8">
        <div className="flex items-center justify-between h-16 w-full">
          {/* Left: Logo */}
          <div className="flex items-center gap-3 pl-4">
            <div className="flex items-center gap-2">
              <svg 
                className="h-8 w-8 text-white" 
                fill="none" 
                viewBox="0 0 24 24" 
                stroke="currentColor"
              >
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 20l4-16m4 4l4 4-4 4M6 16l-4-4 4-4" />
              </svg>
              <h1 className="text-2xl font-bold tracking-tight text-white" style={{ color: '#ffffff' }}>CodeMaster</h1>
            </div>
          </div>

          {/* Right: Actions */}
          <div className="flex items-center gap-4">
            {/* Theme Toggle */}
            <ThemeToggle />

            {/* Conditional Layout based on Theme */}
            {isDark ? (
              // Dark Mode Layout: Three dots between email and logout
              <>
                {/* User Profile */}
                <div className="flex items-center gap-3">
                  {/* User Avatar */}
                  <div className="flex-shrink-0">
                    <div className="w-8 h-8 rounded-full flex items-center justify-center" style={{ backgroundColor: 'var(--background-light)', color: 'var(--text-primary)' }}>
                      <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24">
                        <path d="M12 12c2.21 0 4-1.79 4-4s-1.79-4-4-4-4 1.79-4 4 1.79 4 4 4zm0 2c-2.67 0-8 1.34-8 4v2h16v-2c0-2.66-5.33-4-8-4z"/>
                      </svg>
                    </div>
                  </div>
                  
                  <div className="text-center">
                    <p className="text-sm font-medium text-white">{user?.name || 'Test Teacher'}</p>
                    <p className="text-xs text-white text-opacity-80">{user?.email || 'teacher1@example.com'}</p>
                  </div>

                  {/* Kebab menu */}
                  <div className="relative" ref={menuRef}>
                    <button
                      onClick={() => setMenuOpen((v) => !v)}
                      className="p-2 rounded-lg text-white hover:bg-white hover:bg-opacity-10 transition-all duration-300"
                      title="Menu"
                    >
                      <svg className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
                        <path d="M10 3a1.5 1.5 0 110 3 1.5 1.5 0 010-3zm0 5.5a1.5 1.5 0 110 3 1.5 1.5 0 010-3zm0 5.5a1.5 1.5 0 110 3 1.5 1.5 0 010-3z" />
                      </svg>
                    </button>
                    {menuOpen && (
                      <div className="absolute right-0 mt-2 w-44 rounded-md bg-slate-800 text-gray-800 dark:bg-gray-800 dark:text-gray-100 shadow-lg ring-1 ring-black ring-opacity-5 border border-gray-200 dark:border-gray-700 z-50">
                        <div className="py-1">
                          <button
                            className="w-full text-left px-4 py-2 text-sm hover:bg-gray-50 dark:hover:bg-gray-700"
                            onClick={() => {
                              setMenuOpen(false);
                              if (user?.role === 'teacher' && activeClassId) {
                                navigate(`/teacher/classes/${activeClassId}/details`);
                              } else if (user?.role === 'teacher' && firstClass) {
                                navigate(`/teacher/classes/${firstClass._id}/details`);
                              } else if (user?.role === 'teacher') {
                                navigate('/teacher');
                              } else if (user?.role === 'admin') {
                                navigate('/admin');
                              } else {
                                navigate('/');
                              }
                            }}
                          >
                            Details
                          </button>
                        </div>
                      </div>
                    )}
                  </div>

                  <button
                    onClick={handleLogout}
                    className="p-2 rounded-lg text-white hover:bg-white hover:bg-opacity-10 transition-all duration-300"
                    title="Logout"
                  >
                    <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
                    </svg>
                  </button>
                </div>
              </>
            ) : (
              // Light Mode Layout: Three dots before user profile (original layout)
              <>
                {/* Kebab menu */}
                <div className="relative" ref={menuRef}>
                  <button
                    onClick={() => setMenuOpen((v) => !v)}
                    className="p-2 rounded-lg text-white hover:bg-white hover:bg-opacity-10 transition-all duration-300"
                    title="Menu"
                  >
                    <svg className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
                      <path d="M10 3a1.5 1.5 0 110 3 1.5 1.5 0 010-3zm0 5.5a1.5 1.5 0 110 3 1.5 1.5 0 010-3zm0 5.5a1.5 1.5 0 110 3 1.5 1.5 0 010-3z" />
                    </svg>
                  </button>
                                     {menuOpen && (
                     <div className="absolute right-0 mt-2 w-44 rounded-md bg-white text-gray-800 shadow-lg ring-1 ring-black ring-opacity-5 border border-gray-200 z-50">
                       <div className="py-1">
                         <button
                           className="w-full text-left px-4 py-2 text-sm hover:bg-gray-50"
                          onClick={() => {
                            setMenuOpen(false);
                            if (user?.role === 'teacher' && activeClassId) {
                              navigate(`/teacher/classes/${activeClassId}/details`);
                            } else if (user?.role === 'teacher' && firstClass) {
                              navigate(`/teacher/classes/${firstClass._id}/details`);
                            } else if (user?.role === 'teacher') {
                              navigate('/teacher');
                            } else if (user?.role === 'admin') {
                              navigate('/admin');
                            } else {
                              navigate('/');
                            }
                          }}
                        >
                          Details
                        </button>
                      </div>
                    </div>
                  )}
                </div>
                
                {/* User Profile */}
                <div className="flex items-center gap-3">
                  {/* User Avatar */}
                  <div className="flex-shrink-0">
                    <div className="w-8 h-8 rounded-full flex items-center justify-center" style={{ backgroundColor: 'var(--background-light)', color: 'var(--text-primary)' }}>
                      <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24">
                        <path d="M12 12c2.21 0 4-1.79 4-4s-1.79-4-4-4-4 1.79-4 4 1.79 4 4 4zm0 2c-2.67 0-8 1.34-8 4v2h16v-2c0-2.66-5.33-4-8-4z"/>
                      </svg>
                    </div>
                  </div>
                  
                  <div className="text-center">
                    <p className="text-sm font-medium text-white">{user?.name || 'Test Teacher'}</p>
                    <p className="text-xs text-white text-opacity-80">{user?.email || 'teacher1@example.com'}</p>
                  </div>

                  <button
                    onClick={handleLogout}
                    className="p-2 rounded-lg text-white hover:bg-white hover:bg-opacity-10 transition-all duration-300"
                    title="Logout"
                  >
                    <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
                    </svg>
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      </div>
    </nav>
  );
};

export default Navbar;