import React from 'react';
import { Link } from 'react-router-dom';

const LinkButton = ({ to, children, className = '', style, ...props }) => (
  <Link
    to={to}
    className={`inline-flex items-center justify-center px-6 py-3 rounded-lg text-sm font-medium bg-accent text-on-accent hover:bg-accent-hover hover:shadow-lg hover:shadow-accent/30 transition no-underline ${className}`}
    style={style}
    {...props}
  >
    {children}
  </Link>
);

export default LinkButton;
