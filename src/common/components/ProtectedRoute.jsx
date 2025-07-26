import React from 'react';
import { Navigate } from 'react-router-dom';
import { useSelector } from 'react-redux';

const ProtectedRoute = ({ role, children }) => {
  const { user, role: userRole, token } = useSelector((state) => state.auth);
  const hasToken = token || localStorage.getItem('token');

  console.log('ProtectedRoute: Checking access', { user, userRole, requiredRole: role, hasToken });

  // Redirect if no user or no token
  if (!user || !hasToken) {
    console.log('ProtectedRoute: No user or token, redirecting to /login');
    return <Navigate to="/login" />;
  }

  // Check role if specified
  if (Array.isArray(role)) {
    if (!role.includes(userRole)) {
      console.log('ProtectedRoute: Role not allowed, redirecting to /', { userRole, allowedRoles: role });
      return <Navigate to="/" />;
    }
  } else if (role && userRole !== role) {
    console.log('ProtectedRoute: Role mismatch, redirecting to /', { userRole, requiredRole: role });
    return <Navigate to="/" />;
  }

  return children;
};

export default ProtectedRoute;