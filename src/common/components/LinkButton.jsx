import React from 'react';
import { Link } from 'react-router-dom';

const LinkButton = ({ 
  to, 
  children, 
  className = '',
  style = {},
  ...props 
}) => {
  const baseStyle = {
    backgroundColor: 'var(--python-blue)',
    color: 'white',
    padding: '12px 24px',
    borderRadius: '8px',
    fontSize: '14px',
    fontWeight: '500',
    border: 'none',
    cursor: 'pointer',
    transition: 'all 0.3s ease',
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center',
    textDecoration: 'none',
    ...style
  };

  const handleMouseEnter = (e) => {
    e.currentTarget.style.backgroundColor = '#1d4ed8';
    e.currentTarget.style.boxShadow = '0 4px 12px rgba(37, 99, 235, 0.3)';
  };

  const handleMouseLeave = (e) => {
    e.currentTarget.style.backgroundColor = 'var(--python-blue)';
    e.currentTarget.style.boxShadow = 'none';
  };

  return (
    <Link
      to={to}
      className={className}
      style={baseStyle}
      onMouseEnter={handleMouseEnter}
      onMouseLeave={handleMouseLeave}
      {...props}
    >
      {children}
    </Link>
  );
};

export default LinkButton; 