import React from 'react';
import { Navigate } from 'react-router-dom';
import { useSelector } from 'react-redux';

const ProtectedRoute = ({ role, children }) => {
  const { user, role: userRole, token } = useSelector((state) => state.auth);
  const hasToken = token || localStorage.getItem('token');
  const effectiveRole = userRole || user?.role;

  // Redirect if no user or no token
  if (!user || !hasToken) {
    return <Navigate to="/login" replace />;
  }

  // Check role if specified
  if (Array.isArray(role)) {
    if (!role.includes(effectiveRole)) {
      return <Navigate to={`/${effectiveRole || 'login'}`} replace />;
    }
  } else if (role && effectiveRole !== role) {
    return <Navigate to={`/${effectiveRole || 'login'}`} replace />;
  }

  return children;
};

export default ProtectedRoute;
