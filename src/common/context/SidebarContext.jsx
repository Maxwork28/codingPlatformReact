import React, { createContext, useContext, useState, useEffect } from 'react';
import { useLocation } from 'react-router-dom';

const SidebarContext = createContext();

export const useSidebar = () => {
  const context = useContext(SidebarContext);
  if (!context) {
    throw new Error('useSidebar must be used within a SidebarProvider');
  }
  return context;
};

export const SidebarProvider = ({ children }) => {
  const [isCollapsed, setIsCollapsed] = useState(false);
  const [isManuallyToggled, setIsManuallyToggled] = useState(false);
  const location = useLocation();

  // Auto-collapse logic
  useEffect(() => {
    // Don't auto-collapse if user has manually toggled
    if (isManuallyToggled) return;

    // Auto-collapse on dashboard routes
    const dashboardRoutes = ['/admin', '/teacher', '/student'];
    const shouldCollapse = dashboardRoutes.includes(location.pathname);
    
    setIsCollapsed(shouldCollapse);
  }, [location.pathname, isManuallyToggled]);

  // Manual toggle function
  const toggleSidebar = () => {
    setIsCollapsed(!isCollapsed);
    setIsManuallyToggled(true);
  };

  // Reset manual toggle when navigating away from dashboard
  useEffect(() => {
    const dashboardRoutes = ['/admin', '/teacher', '/student'];
    const isOnDashboard = dashboardRoutes.includes(location.pathname);
    
    if (!isOnDashboard) {
      setIsManuallyToggled(false);
    }
  }, [location.pathname]);

  const value = {
    isCollapsed,
    toggleSidebar,
    isManuallyToggled
  };

  return (
    <SidebarContext.Provider value={value}>
      {children}
    </SidebarContext.Provider>
  );
}; 