import React from 'react';
import { Navigate } from 'react-router-dom';
import { useSelector } from 'react-redux';

const ProtectedRoute = ({ role, children }) => {
  const { user, role: userRole, token } = useSelector((state) => state.auth);
  const hasToken = token || localStorage.getItem('token');
  const effectiveRole = userRole || user?.role;

  console.log('ProtectedRoute: Checking access', {
    user,
    userRole: effectiveRole,
    requiredRole: role,
    hasToken,
  });

  // Redirect if no user or no token
  if (!user || !hasToken) {
    console.log('ProtectedRoute: No user or token, redirecting to /login');
    return <Navigate to="/login" replace />;
  }

  // Check role if specified
  if (Array.isArray(role)) {
    if (!role.includes(effectiveRole)) {
      console.log('ProtectedRoute: Role not allowed, redirecting to role home', {
        userRole: effectiveRole,
        allowedRoles: role,
      });
      return <Navigate to={`/${effectiveRole || 'login'}`} replace />;
    }
  } else if (role && effectiveRole !== role) {
    console.log('ProtectedRoute: Role mismatch, redirecting to role home', {
      userRole: effectiveRole,
      requiredRole: role,
    });
    return <Navigate to={`/${effectiveRole || 'login'}`} replace />;
  }

  return children;
};

export default ProtectedRoute;
