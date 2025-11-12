import React from 'react';
import { useSelector, useDispatch } from 'react-redux';
import { useNavigate } from 'react-router-dom';
import { logout } from '../components/redux/authSlice';
import { useSidebar } from '../context/SidebarContext';
import { useTheme } from '../context/ThemeContext';
import ThemeToggle from './ThemeToggle';

const Navbar = () => {
  const dispatch = useDispatch();
  const navigate = useNavigate();
  const { user } = useSelector((state) => state.auth);
  const { isCollapsed, toggleSidebar } = useSidebar();
  const { isDark } = useTheme();
  // Debug: Log user data
  console.log('Navbar: Current user data:', user);
  console.log('Navbar: User name:', user?.name);
  console.log('Navbar: User email:', user?.email);
  console.log('Navbar: User role:', user?.role);

  const handleLogout = () => {
    dispatch(logout());
    navigate('/login');
  };

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
              // Dark Mode Layout
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
              // Light Mode Layout (original layout)
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